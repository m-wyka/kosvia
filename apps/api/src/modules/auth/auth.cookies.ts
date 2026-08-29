import type { CookieOptions, Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'kosvia_at';
export const REFRESH_TOKEN_COOKIE = 'kosvia_rt';

export interface CookieSettings {
  /** Only set when the API is deliberately served from a sibling host; empty behind the Nitro proxy. */
  domain?: string;
  secure: boolean;
}

/**
 * Both tokens live in HttpOnly cookies so no script — ours or anyone else's —
 * can read them.
 *
 * Both are scoped to `/` rather than path-scoping the refresh token to
 * `/auth`. Path scoping is the tighter default, but it also means the browser
 * never sends the refresh token with a page request — so a server-rendered
 * visit to a protected URL with an expired access token cannot rotate the
 * session and bounces to the login page instead. Since the token is HttpOnly
 * and SameSite-restricted either way, the broader scope costs little and makes
 * SSR sessions actually work.
 *
 * SameSite is always Lax: the browser reaches the API through the same-origin
 * Nitro proxy, so the cookies are first-party in every environment. `None`
 * would only be needed for a cross-site API host — and it is exactly the
 * setting browsers keep tightening.
 */
function baseOptions(settings: CookieSettings, maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: settings.secure,
    sameSite: 'lax',
    domain: cookieDomain(settings),
    maxAge,
    path: '/',
  };
}

const cookieDomain = (settings: CookieSettings): string | undefined =>
  settings.domain && settings.domain !== 'localhost' ? settings.domain : undefined;

export function setAuthCookies(
  res: Response,
  settings: CookieSettings,
  tokens: {
    accessToken: string;
    accessMaxAge: number;
    refreshToken: string;
    refreshMaxAge: number;
  },
): void {
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, baseOptions(settings, tokens.accessMaxAge));
  res.cookie(
    REFRESH_TOKEN_COOKIE,
    tokens.refreshToken,
    baseOptions(settings, tokens.refreshMaxAge),
  );
}

export function clearAuthCookies(res: Response, settings: CookieSettings): void {
  const common = {
    httpOnly: true,
    secure: settings.secure,
    sameSite: 'lax',
    domain: cookieDomain(settings),
  } as const;
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...common, path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...common, path: '/' });
}
