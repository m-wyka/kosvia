import { proxyRequest } from 'h3';

/**
 * Same-origin gateway to the NestJS API (06_AUTH_SSR_CACHE.md §1).
 *
 * The browser only ever talks to this host, so auth cookies are first-party,
 * SameSite=Lax works everywhere, and there is no CORS to configure. The target
 * comes from runtime config, not build time, so one image serves every
 * environment.
 */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);
  const path = getRouterParam(event, 'path') ?? '';
  const search = getRequestURL(event).search;
  const target = `${config.apiInternalUrl.replace(/\/$/, '')}/${path}${search}`;
  return proxyRequest(event, target);
});
