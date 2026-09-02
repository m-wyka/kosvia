import { Global, Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { EntitlementService } from './entitlement.service';
import { UsageService } from './usage.service';
import { PremiumGuard } from '../../common/guards/premium.guard';

/**
 * Global on purpose: plan rules are cross-cutting (AI, shelf, alerts, scoring,
 * recommendations all consult them), exactly like PrismaModule.
 */
@Global()
@Module({
  controllers: [SubscriptionController],
  providers: [SubscriptionService, EntitlementService, UsageService, PremiumGuard],
  exports: [SubscriptionService, EntitlementService, UsageService, PremiumGuard],
})
export class SubscriptionModule {}
