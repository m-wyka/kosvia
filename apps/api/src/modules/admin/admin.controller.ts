import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AdminStatsDto } from '@kosvia/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import {
  AdminListQueryDto,
  UpdateUserDto,
  UpsertBrandDto,
  UpsertCategoryDto,
  UpsertIngredientDto,
  UpsertOfferDto,
  UpsertProductDto,
  UpsertStoreDto,
} from './dto/admin.dto';

/** Every route here is ADMIN-only — the guard is applied at the class level. */
@ApiTags('admin')
@Controller('admin')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Catalogue and usage counters' })
  stats(): Promise<AdminStatsDto> {
    return this.admin.stats();
  }

  /* -------------------------------------------------------------- brands -- */
  @Get('brands') listBrands(@Query() query: AdminListQueryDto) {
    return this.admin.listBrands(query);
  }
  @Post('brands') createBrand(@Body() dto: UpsertBrandDto) {
    return this.admin.createBrand(dto);
  }
  @Put('brands/:id') updateBrand(@Param('id') id: string, @Body() dto: UpsertBrandDto) {
    return this.admin.updateBrand(id, dto);
  }
  @Delete('brands/:id') @HttpCode(HttpStatus.NO_CONTENT) deleteBrand(@Param('id') id: string) {
    return this.admin.deleteBrand(id);
  }

  /* ---------------------------------------------------------- categories -- */
  @Get('categories') listCategories() {
    return this.admin.listCategories();
  }
  @Post('categories') createCategory(@Body() dto: UpsertCategoryDto) {
    return this.admin.createCategory(dto);
  }
  @Put('categories/:id') updateCategory(@Param('id') id: string, @Body() dto: UpsertCategoryDto) {
    return this.admin.updateCategory(id, dto);
  }
  @Delete('categories/:id') @HttpCode(HttpStatus.NO_CONTENT) deleteCategory(
    @Param('id') id: string,
  ) {
    return this.admin.deleteCategory(id);
  }

  /* --------------------------------------------------------- ingredients -- */
  @Get('ingredients') listIngredients(@Query() query: AdminListQueryDto) {
    return this.admin.listIngredients(query);
  }
  @Post('ingredients') createIngredient(@Body() dto: UpsertIngredientDto) {
    return this.admin.createIngredient(dto);
  }
  @Put('ingredients/:id') updateIngredient(
    @Param('id') id: string,
    @Body() dto: UpsertIngredientDto,
  ) {
    return this.admin.updateIngredient(id, dto);
  }
  @Delete('ingredients/:id') @HttpCode(HttpStatus.NO_CONTENT) deleteIngredient(
    @Param('id') id: string,
  ) {
    return this.admin.deleteIngredient(id);
  }

  /* ------------------------------------------------------------ products -- */
  @Get('products') listProducts(@Query() query: AdminListQueryDto) {
    return this.admin.listProducts(query);
  }
  @Get('products/:id') productDetail(@Param('id') id: string) {
    return this.admin.productDetail(id);
  }
  @Post('products') createProduct(@Body() dto: UpsertProductDto) {
    return this.admin.createProduct(dto);
  }
  @Put('products/:id') updateProduct(@Param('id') id: string, @Body() dto: UpsertProductDto) {
    return this.admin.updateProduct(id, dto);
  }
  @Delete('products/:id') @HttpCode(HttpStatus.NO_CONTENT) deleteProduct(@Param('id') id: string) {
    return this.admin.deleteProduct(id);
  }

  /* -------------------------------------------------------------- stores -- */
  @Get('stores') listStores() {
    return this.admin.listStores();
  }
  @Post('stores') createStore(@Body() dto: UpsertStoreDto) {
    return this.admin.createStore(dto);
  }
  @Put('stores/:id') updateStore(@Param('id') id: string, @Body() dto: UpsertStoreDto) {
    return this.admin.updateStore(id, dto);
  }
  @Delete('stores/:id') @HttpCode(HttpStatus.NO_CONTENT) deleteStore(@Param('id') id: string) {
    return this.admin.deleteStore(id);
  }

  /* -------------------------------------------------------------- offers -- */
  @Get('offers') listOffers(@Query() query: AdminListQueryDto) {
    return this.admin.listOffers(query);
  }
  @Post('offers') upsertOffer(@Body() dto: UpsertOfferDto) {
    return this.admin.upsertOffer(dto);
  }
  @Delete('offers/:id') @HttpCode(HttpStatus.NO_CONTENT) deleteOffer(@Param('id') id: string) {
    return this.admin.deleteOffer(id);
  }

  /* --------------------------------------------------------------- users -- */
  @Get('users') listUsers(@Query() query: AdminListQueryDto) {
    return this.admin.listUsers(query);
  }

  @Patch('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.admin.updateUser(id, dto, actor.id);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteUser(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.admin.deleteUser(id, actor.id);
  }
}
