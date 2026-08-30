import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  IngredientScoreBreakdownDto,
  ProductDto,
  ProductSearchResult,
  ProductSuggestionDto,
} from '@kosvia/shared';
import { OptionalAuth } from '../../common/decorators/public.decorator';
import { RequestLocale } from '../../common/decorators/request-locale.decorator';
import type { AnswerLocale } from '../../common/i18n/phrases';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ViewerContextService } from '../profile/viewer-context.service';
import { ProductsService } from './products.service';
import { ProductQueryDto, SuggestQueryDto } from './dto/product-query.dto';

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

  @Get('suggest')
  @ApiOperation({ summary: 'Autocomplete hits for the search box' })
  suggest(@Query() query: SuggestQueryDto): Promise<ProductSuggestionDto[]> {
    return this.products.suggest(query.q);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'A single product with ingredients, offers and Personal Match' })
  async detail(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser | null,
    @RequestLocale() locale: AnswerLocale,
  ): Promise<ProductDto> {
    const viewer = await this.viewers.load(user?.id);
    return this.products.findBySlug(slug, viewer, locale);
  }

  @Get(':slug/ingredient-score')
  @ApiOperation({ summary: 'How the deterministic ingredient score was reached' })
  breakdown(@Param('slug') slug: string): Promise<IngredientScoreBreakdownDto> {
    return this.products.ingredientBreakdown(slug);
  }
}
