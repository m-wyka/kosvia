import { SetMetadata } from '@nestjs/common';
import type { ConsentType } from '@prisma/client';

export const REQUIRED_CONSENT_KEY = 'requiredConsent';

/**
 * Marks a route as touching data that needs an explicit consent
 * (02_RODO.md §3). Without it the ConsentGuard answers 403 CONSENT_REQUIRED
 * and the client shows the consent screen instead of an error.
 */
export const RequiresConsent = (type: ConsentType) => SetMetadata(REQUIRED_CONSENT_KEY, type);
