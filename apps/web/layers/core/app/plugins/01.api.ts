import { appendResponseHeader } from 'h3';
import type { ApiErrorBody } from '@kosvia/shared';

type FetchRequest = Parameters<typeof $fetch>[0];
type FetchOptions = Parameters<typeof $fetch>[1];

/**
 * A single configured API client for the whole app.
 *
 * Three things it takes care of that are easy to get wrong:
 *  1. SSR cookie forwarding — during server rendering the browser's cookies are
 *     not attached automatically, so authenticated pages would render logged
 *     out and then flip on hydration.
 *  2. Silent refresh — one retry through /auth/refresh on a 401, so a
 *     15-minute access token never interrupts someone mid-session.
 *  3. Refresh during SSR — opening a protected URL directly with an expired
 *     access token rotates the session server-side and passes the new
 *     Set-Cookie back to the browser, instead of bouncing to the login page.
 *
 * The retry is a wrapper around the client rather than an `onResponseError`
 * hook: that hook cannot turn a failed response into a successful one, because
 * ofetch throws on `response.ok` regardless of what the hook does to it.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  // Error copy is user-facing, so it goes through the same translations.
  const t = (key: string) => String(nuxtApp.$i18n.t(key));
  const baseURL = import.meta.server ? config.apiInternalUrl : config.public.apiBase;

  /** Cookie header used for SSR requests; updated in place after a refresh. */
  let serverCookie = import.meta.server ? (useRequestHeaders(['cookie']).cookie ?? '') : '';
  // Captured here, not inside the refresh: composables that read the Nuxt
  // instance are unavailable once an `await` has crossed the async boundary.
  const requestEvent = import.meta.server ? useRequestEvent() : null;
  let inFlightRefresh: Promise<boolean> | null = null;

  const client = $fetch.create({
    baseURL,
    credentials: 'include',
    retry: 0,
    onRequest({ options }) {
      if (import.meta.server && serverCookie) options.headers.set('cookie', serverCookie);
    },
  });

  /** Merges rotated cookies over the ones this request arrived with. */
  function mergeCookies(existing: string, setCookies: string[]): string {
    const jar = new Map<string, string>();
    for (const pair of existing.split(';')) {
      const [name, ...rest] = pair.trim().split('=');
      if (name) jar.set(name, rest.join('='));
    }
    for (const cookie of setCookies) {
      const [name, ...rest] = (cookie.split(';')[0] ?? '').split('=');
      if (name) jar.set(name.trim(), rest.join('='));
    }
    return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  async function refreshSession(): Promise<boolean> {
    try {
      if (import.meta.server) {
        if (!serverCookie) return false;
        const response = await $fetch.raw('/auth/refresh', {
          baseURL,
          method: 'POST',
          headers: { cookie: serverCookie },
        });

        // Hand the rotated cookies to the browser so the next request is clean.
        const setCookies = response.headers.getSetCookie?.() ?? [];
        for (const cookie of setCookies) {
          if (requestEvent) appendResponseHeader(requestEvent, 'set-cookie', cookie);
        }
        if (setCookies.length) serverCookie = mergeCookies(serverCookie, setCookies);
        return true;
      }

      await $fetch('/auth/refresh', { baseURL, method: 'POST', credentials: 'include' });
      return true;
    } catch {
      return false;
    }
  }

  function statusOf(error: unknown): number | undefined {
    return (error as { status?: number; statusCode?: number })?.status
      ?? (error as { statusCode?: number })?.statusCode;
  }

  const api = (async (request: FetchRequest, options?: FetchOptions) => {
    try {
      return await client(request, options);
    } catch (error) {
      const url = String(request);
      const isAuthCall = url.includes('/auth/refresh') || url.includes('/auth/login');
      if (statusOf(error) !== 401 || isAuthCall) throw error;

      // Coalesce concurrent 401s onto one refresh — a page can easily fire
      // three requests at once, and three rotations would invalidate each other.
      inFlightRefresh ??= refreshSession().finally(() => {
        inFlightRefresh = null;
      });
      if (!(await inFlightRefresh)) throw error;

      return await client(request, options);
    }
  }) as typeof $fetch;

  return {
    provide: {
      api,
      /** Turns any thrown fetch error into a message we are happy to show. */
      apiMessage(error: unknown): string {
        const data = (error as { data?: ApiErrorBody })?.data;
        if (data?.message) {
          return Array.isArray(data.message) ? data.message.join(' ') : data.message;
        }
        const status = statusOf(error);
        if (status === 404) return t('ERRORS.API.NOT_FOUND');
        if (status === 401) return t('ERRORS.API.UNAUTHORIZED');
        if (status === 403) return t('ERRORS.API.FORBIDDEN');
        return t('ERRORS.API.GENERIC');
      },
    },
  };
});

declare module '#app' {
  interface NuxtApp {
    $api: typeof $fetch;
    $apiMessage: (error: unknown) => string;
  }
}
