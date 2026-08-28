import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { BrandDto, CategoryDto, IngredientDto, StoreDto } from '@kosvia/shared';
import { Public } from '../../common/decorators/public.decorator';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Public()
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('brands')
  @ApiOperation({ summary: 'All brands' })
  brands(): Promise<BrandDto[]> {
    return this.catalog.brands();
  }

  @Get('categories')
  @ApiOperation({ summary: 'The category tree' })
  categories(): Promise<CategoryDto[]> {
    return this.catalog.categories();
  }

  @Get('categories/:slug')
  @ApiOperation({ summary: 'A single category with its children' })
  category(@Param('slug') slug: string): Promise<CategoryDto> {
    return this.catalog.category(slug);
  }

  @Get('ingredients')
  @ApiOperation({ summary: 'Search the ingredient reference' })
  ingredients(@Query('q') q?: string, @Query('tag') tag?: string): Promise<IngredientDto[]> {
    return this.catalog.ingredients(q, tag);
  }

  @Get('ingredients/:slug')
  @ApiOperation({ summary: 'A single ingredient' })
  ingredient(@Param('slug') slug: string): Promise<IngredientDto> {
    return this.catalog.ingredient(slug);
  }

  @Get('stores')
  @ApiOperation({ summary: 'Demo stores carrying offers' })
  stores(): Promise<StoreDto[]> {
    return this.catalog.stores();
  }
}
