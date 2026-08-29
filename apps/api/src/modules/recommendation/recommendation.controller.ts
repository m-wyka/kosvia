import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type {
  AlternativeGroupDto,
  ComparisonResultDto,
  DiscoveryFeedDto,
  ProductSummaryDto,
} from '@kosvia/shared';
import { OptionalAuth } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ViewerContextService } from '../profile/viewer-context.service';
import { CompareQueryDto } from '../products/dto/product-query.dto';
import { AlternativeProductService } from './alternative-product.service';
import { ComparisonService } from './comparison.service';
import { RecommendationService, type RoutinePlan } from './recommendation.service';

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
    private readonly comparison: ComparisonService,
    private readonly recommendations: RecommendationService,
  ) {}

  @Get('products/:idOrSlug/alternatives')
  @ApiOperation({ summary: 'Cheaper, better-matching and similar products' })
  async forProduct(
    @Param('idOrSlug') idOrSlug: string,
    @CurrentUser() user: AuthenticatedUser | null,
  ): Promise<AlternativeGroupDto[]> {
    return this.alternatives.forProduct(idOrSlug, await this.viewers.load(user?.id));
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
  ): Promise<ComparisonResultDto> {
    return this.comparison.compare(query.products, await this.viewers.load(user?.id));
  }

  @Get('discover')
  @ApiOperation({ summary: 'Personalised discovery feed' })
  async discover(@CurrentUser() user: AuthenticatedUser | null): Promise<DiscoveryFeedDto> {
    return this.recommendations.getDiscoveryFeed(await this.viewers.load(user?.id));
  }

  @Post('routine/build')
  @ApiOperation({ summary: 'Build a core routine within a budget (Smart Basket foundation)' })
  async buildRoutine(
    @Body() dto: BuildRoutineDto,
    @CurrentUser() user: AuthenticatedUser | null,
  ): Promise<RoutinePlan> {
    return this.recommendations.buildRoutine(dto.budget, await this.viewers.load(user?.id));
  }
}
