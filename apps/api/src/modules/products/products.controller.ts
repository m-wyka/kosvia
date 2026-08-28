import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { IngredientScoreBreakdownDto, ProductDto, ProductSearchResult } from '@kosvia/shared';
import { OptionalAuth } from '../../common/decorators/public.decorator';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ViewerContextService } from '../profile/viewer-context.service';
import { ProductsService } from './products.service';
import { ProductQueryDto } from './dto/product-query.dto';

@ApiTags('products')
@OptionalAuth()
@Controller('products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly viewers: ViewerContextService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Search and filter the catalogue' })
  async search(
    @Query() query: ProductQueryDto,
    @CurrentUser() user: AuthenticatedUser | null,
  ): Promise<ProductSearchResult> {
    const viewer = await this.viewers.load(user?.id);
    return this.products.search(query, viewer);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'A single product with ingredients, offers and Personal Match' })
  async detail(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser | null,
  ): Promise<ProductDto> {
    const viewer = await this.viewers.load(user?.id);
    return this.products.findBySlug(slug, viewer);
  }

  @Get(':slug/ingredient-score')
  @ApiOperation({ summary: 'How the deterministic ingredient score was reached' })
  breakdown(@Param('slug') slug: string): Promise<IngredientScoreBreakdownDto> {
    return this.products.ingredientBreakdown(slug);
  }
}
