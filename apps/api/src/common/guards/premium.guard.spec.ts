import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PREMIUM_REQUIRED_CODE, type ApiErrorBody } from '@kosvia/shared';
import { PremiumGuard } from './premium.guard';
import type { EntitlementService } from '../../modules/subscription/entitlement.service';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

const contextFor = (user: AuthenticatedUser | null, requiresPremium = true): ExecutionContext =>
  ({
    getHandler: () => (requiresPremium ? { requiresPremium: true } : {}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user: user ?? undefined }) }),
  }) as unknown as ExecutionContext;

const reflectorFor = (requiresPremium: boolean) =>
  ({
    getAllAndOverride: () => (requiresPremium ? true : undefined),
  }) as unknown as Reflector;

const entitlementsFor = (plan: 'FREE' | 'PREMIUM') =>
  ({ currentPlan: () => Promise.resolve(plan) }) as unknown as EntitlementService;

const premiumUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'demo@kosvia.app',
  role: 'USER',
  subscriptionStatus: 'PREMIUM',
};

describe('PremiumGuard', () => {
  it('lets unmarked routes through untouched', async () => {
    const guard = new PremiumGuard(reflectorFor(false), entitlementsFor('FREE'));
    await expect(guard.canActivate(contextFor(null, false))).resolves.toBe(true);
  });

  it('refuses anonymous viewers with the machine-readable code', async () => {
    const guard = new PremiumGuard(reflectorFor(true), entitlementsFor('FREE'));
    const attempt = guard.canActivate(contextFor(null));
    await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
    await attempt.catch((error: ForbiddenException) => {
      expect((error.getResponse() as ApiErrorBody).code).toBe(PREMIUM_REQUIRED_CODE);
    });
  });

  it('refuses Free users and admits Premium ones', async () => {
    const freeGuard = new PremiumGuard(reflectorFor(true), entitlementsFor('FREE'));
    await expect(freeGuard.canActivate(contextFor(premiumUser))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const premiumGuard = new PremiumGuard(reflectorFor(true), entitlementsFor('PREMIUM'));
    await expect(premiumGuard.canActivate(contextFor(premiumUser))).resolves.toBe(true);
  });
});
