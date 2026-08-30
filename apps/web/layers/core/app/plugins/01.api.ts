import { appendResponseHeader } from 'h3';
import type { ApiErrorBody } from '@kosvia/shared';

type FetchRequest = Parameters<typeof $fetch>[0];
type FetchOptions = Parameters<typeof $fetch>[1];

const UNAUTHORIZED_STATUS = 401;
const AUTH_ENDPOINTS = ['/auth/refresh', '/auth/login'];

const statusOf = (error: unknown): number | undefined => {
  const candidate = error as { status?: number; statusCode?: number } | undefined;
  return candidate?.status ?? candidate?.statusCode;
};

const isAuthEndpoint = (request: FetchRequest): boolean => {
  const url = String(request);
  return AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
};

const mergeCookies = (existing: string, setCookies: string[]): string => {
  const jar = new Map<string, string>();
  for (const pair of existing.split(';')) {
    const [name, ...rest] = pair.trim().split('=');
    if (name) {
      jar.set(name, rest.join('='));
    }
  }
  for (const cookie of setCookies) {
    const [name, ...rest] = (cookie.split(';')[0] ?? '').split('=');
    if (name) {
      jar.set(name.trim(), rest.join('='));
    }
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
};

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();
  const t = (key: string) => String(nuxtApp.$i18n.t(key));
  const baseURL = import.meta.server ? config.apiInternalUrl : config.public.apiBase;

  let serverCookie = import.meta.server ? (useRequestHeaders(['cookie']).cookie ?? '') : '';
  const requestEvent = import.meta.server ? useRequestEvent() : null;
  let inFlightRefresh: Promise<boolean> | null = null;

  const client = $fetch.create({
    baseURL,
    credentials: 'include',
    retry: 0,
    onRequest: ({ options }) => {
      options.headers.set('accept-language', String(nuxtApp.$i18n.locale.value));
      if (import.meta.server && serverCookie) {
        options.headers.set('cookie', serverCookie);
      }
    },
  });

  const refreshSessionOnServer = async (): Promise<boolean> => {
    if (!serverCookie) {
      return false;
    }
    const response = await $fetch.raw('/auth/refresh', {
      baseURL,
      method: 'POST',
      headers: { cookie: serverCookie },
    });

    const setCookies = response.headers.getSetCookie?.() ?? [];
    for (const cookie of setCookies) {
      if (requestEvent) {
        appendResponseHeader(requestEvent, 'set-cookie', cookie);
      }
    }
    if (setCookies.length) {
      serverCookie = mergeCookies(serverCookie, setCookies);
    }
    return true;
  };

  const refreshSession = async (): Promise<boolean> => {
    try {
      if (import.meta.server) {
        return await refreshSessionOnServer();
      }
      await $fetch('/auth/refresh', { baseURL, method: 'POST', credentials: 'include' });
      return true;
    } catch {
      return false;
    }
  };

  const refreshOnce = (): Promise<boolean> => {
    inFlightRefresh ??= refreshSession().finally(() => {
      inFlightRefresh = null;
    });
    return inFlightRefresh;
  };

  const api = (async (request: FetchRequest, options?: FetchOptions) => {
    try {
      return await client(request, options);
    } catch (error) {
      const shouldRetry = statusOf(error) === UNAUTHORIZED_STATUS && !isAuthEndpoint(request);
      if (!shouldRetry) {
        throw error;
      }
      const refreshed = await refreshOnce();
      if (!refreshed) {
        throw error;
      }
      return await client(request, options);
    }
  }) as typeof $fetch;

  const apiMessage = (error: unknown): string => {
    const data = (error as { data?: ApiErrorBody })?.data;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(' ') : data.message;
    }
    const status = statusOf(error);
    if (status === 404) {
      return t('ERRORS.API.NOT_FOUND');
    }
    if (status === 401) {
      return t('ERRORS.API.UNAUTHORIZED');
    }
    if (status === 403) {
      return t('ERRORS.API.FORBIDDEN');
    }
    return t('ERRORS.API.GENERIC');
  };

  return {
    provide: { api, apiMessage },
  };
});

declare module '#app' {
  interface NuxtApp {
    $api: typeof $fetch;
    $apiMessage: (error: unknown) => string;
  }
}
