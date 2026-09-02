import { ForbiddenException } from '@nestjs/common';
import { PLAN_LIMIT_REACHED_CODE, PREMIUM_REQUIRED_CODE, type LimitMetric } from '@kosvia/shared';

export const premiumRequiredException = () =>
  new ForbiddenException({
    message: 'This feature is part of the Premium plan.',
    error: 'Forbidden',
    code: PREMIUM_REQUIRED_CODE,
  });

export const planLimitReachedException = (metric: LimitMetric, limit: number) =>
  new ForbiddenException({
    message: `You have reached the plan limit for ${metric} (${limit}).`,
    error: 'Forbidden',
    code: PLAN_LIMIT_REACHED_CODE,
    metric,
    limit,
  });
