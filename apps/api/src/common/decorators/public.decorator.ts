import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opts a route out of the globally applied JWT guard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';

/**
 * Route is reachable anonymously, but a valid token still populates `req.user`.
 * Used for catalogue endpoints, which return Personal Match only when signed in.
 */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
