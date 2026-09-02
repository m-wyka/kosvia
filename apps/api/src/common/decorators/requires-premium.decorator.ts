import { SetMetadata } from '@nestjs/common';

export const REQUIRES_PREMIUM_KEY = 'requiresPremium';

/**
 * Marks a route as part of the Premium plan. Without an active Premium
 * subscription the PremiumGuard answers 403 PREMIUM_REQUIRED and the client
 * shows the upgrade screen instead of an error.
 */
export const RequiresPremium = () => SetMetadata(REQUIRES_PREMIUM_KEY, true);
