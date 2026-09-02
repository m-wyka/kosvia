import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRES_PREMIUM_KEY } from '../decorators/requires-premium.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import { EntitlementService } from '../../modules/subscription/entitlement.service';
import { premiumRequiredException } from '../../modules/subscription/plan-errors';

@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean | undefined>(REQUIRES_PREMIUM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!user) {
      throw premiumRequiredException();
    }
    const plan = await this.entitlements.currentPlan(user);
    if (plan !== 'PREMIUM') {
      throw premiumRequiredException();
    }
    return true;
  }
}
