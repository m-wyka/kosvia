import type { CookieOptions, Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'kosvia_at';
export const REFRESH_TOKEN_COOKIE = 'kosvia_rt';

export interface CookieSettings {
  domain: string;
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
 */
function baseOptions(settings: CookieSettings, maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: settings.secure,
    sameSite: settings.secure ? 'none' : 'lax',
    domain: settings.domain === 'localhost' ? undefined : settings.domain,
    maxAge,
    path: '/',
  };
}

export function setAuthCookies(
  res: Response,
  settings: CookieSettings,
  tokens: { accessToken: string; accessMaxAge: number; refreshToken: string; refreshMaxAge: number },
): void {
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, baseOptions(settings, tokens.accessMaxAge));
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, baseOptions(settings, tokens.refreshMaxAge));
}

export function clearAuthCookies(res: Response, settings: CookieSettings): void {
  const common = { httpOnly: true, secure: settings.secure, sameSite: settings.secure ? 'none' : 'lax' } as const;
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...common, path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...common, path: '/' });
}
