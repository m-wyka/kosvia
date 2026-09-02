import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { SubscriptionOverviewDto, SubscriptionPlanDto } from '@kosvia/shared';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { EntitlementService } from './entitlement.service';
import { SubscriptionService } from './subscription.service';

@ApiTags('subscription')
@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly entitlements: EntitlementService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  /** Live pricing for the packages page — never hardcode these amounts client-side. */
  @Public()
  @Get('plans')
  plans(): Promise<SubscriptionPlanDto[]> {
    return this.subscriptions.plans();
  }

  /** The viewer's effective plan, subscription details and remaining monthly usage. */
  @Get()
  overview(@CurrentUser() user: AuthenticatedUser): Promise<SubscriptionOverviewDto> {
    return this.entitlements.overview(user);
  }
}
