import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type {
  AlternativeGroupDto,
  ComparisonResultDto,
  DiscoveryFeedDto,
  DupeResultDto,
  PlanTier,
  ProductSummaryDto,
} from '@kosvia/shared';
import { OptionalAuth } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { RequiresPremium } from '../../common/decorators/requires-premium.decorator';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { ViewerContextService } from '../profile/viewer-context.service';
import { CompareQueryDto } from '../products/dto/product-query.dto';
import { AlternativeProductService } from './alternative-product.service';
import { DupeFinderService } from './dupe-finder.service';
import { RequestLocale } from '../../common/decorators/request-locale.decorator';
import type { AnswerLocale } from '../../common/i18n/phrases';
import { ComparisonService } from './comparison.service';
import { RecommendationService, type RoutinePlan } from './recommendation.service';
import { EntitlementService } from '../subscription/entitlement.service';
import { restrictAlternativeGroups, restrictDupes } from '../subscription/plan-restrictions';

class BuildRoutineDto {
  @Type(() => Number) @IsInt() @Min(30) @Max(2000) budget!: number;
}

@ApiTags('recommendations')
@OptionalAuth()
@Controller()
export class RecommendationController {
  constructor(
    private readonly viewers: ViewerContextService,
    private readonly alternatives: AlternativeProductService,
    private readonly dupes: DupeFinderService,
    private readonly comparison: ComparisonService,
    private readonly recommendations: RecommendationService,
    private readonly entitlements: EntitlementService,
  ) {}

  @Get('products/:idOrSlug/alternatives')
  @ApiOperation({ summary: 'Cheaper, better-matching and similar products' })
  async forProduct(
    @Param('idOrSlug') idOrSlug: string,
    @CurrentUser() user: AuthenticatedUser | null,
  ): Promise<AlternativeGroupDto[]> {
    const [groups, plan] = await Promise.all([
      this.viewers.load(user?.id).then((viewer) => this.alternatives.forProduct(idOrSlug, viewer)),
      this.viewerPlan(user),
    ]);
    return restrictAlternativeGroups(
      groups,
      this.entitlements.limitsFor(plan).alternativesPerProduct,
    );
  }

  @Get('products/:idOrSlug/dupes')
  @ApiOperation({ summary: 'Closest formulas to a product, with the price gap' })
  async findDupes(
    @Param('idOrSlug') idOrSlug: string,
    @CurrentUser() user: AuthenticatedUser | null,
  ): Promise<DupeResultDto> {
    const [result, plan] = await Promise.all([
      this.viewers.load(user?.id).then((viewer) => this.dupes.findDupes(idOrSlug, viewer)),
      this.viewerPlan(user),
    ]);
    return restrictDupes(result, this.entitlements.limitsFor(plan).dupesPerProduct);
  }

  @Get('products/:idOrSlug/similar')
  @ApiOperation({ summary: 'Products serving the same routine step' })
  async similar(
    @Param('idOrSlug') idOrSlug: string,
    @CurrentUser() user: AuthenticatedUser | null,
  ): Promise<ProductSummaryDto[]> {
    const viewer = await this.viewers.load(user?.id);
    return this.recommendations.getSimilarProducts(idOrSlug, viewer);
  }

  @Get('compare')
  @ApiOperation({ summary: 'Compare 2-4 products side by side' })
  async compare(
    @Query() query: CompareQueryDto,
    @CurrentUser() user: AuthenticatedUser | null,
    @RequestLocale() locale: AnswerLocale,
  ): Promise<ComparisonResultDto> {
    const plan = await this.viewerPlan(user);
    return this.comparison.compare(
      query.products,
      await this.viewers.load(user?.id),
      locale,
      this.entitlements.limitsFor(plan).compareProducts,
    );
  }

  @Get('discover')
  @ApiOperation({ summary: 'Personalised discovery feed' })
  async discover(@CurrentUser() user: AuthenticatedUser | null): Promise<DiscoveryFeedDto> {
    return this.recommendations.getDiscoveryFeed(await this.viewers.load(user?.id));
  }

  @Post('routine/build')
  @UseGuards(PremiumGuard)
  @RequiresPremium()
  @ApiOperation({ summary: 'Build a core routine within a budget (Smart Basket foundation)' })
  async buildRoutine(
    @Body() dto: BuildRoutineDto,
    @CurrentUser() user: AuthenticatedUser | null,
  ): Promise<RoutinePlan> {
    return this.recommendations.buildRoutine(dto.budget, await this.viewers.load(user?.id));
  }

  private viewerPlan(user: AuthenticatedUser | null): Promise<PlanTier> {
    return user ? this.entitlements.currentPlan(user) : Promise.resolve('FREE');
  }
}
