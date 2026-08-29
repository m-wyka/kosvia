import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  AliasKind,
  Availability,
  RoutineStep,
  SkinType,
  SubscriptionStatus,
  TokenStatus,
  UserRole,
} from '@prisma/client';

export class AdminListQueryDto {
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class UpsertBrandDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(140) slug?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(500) logo?: string;
  @IsOptional() @IsBoolean() isVegan?: boolean;
  @IsOptional() @IsBoolean() isCrueltyFree?: boolean;
}

export class UpsertCategoryDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(140) slug?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() parentId?: string | null;
  @IsOptional() @IsEnum(RoutineStep) routineStep?: RoutineStep;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpsertIngredientDto {
  @IsString() @MaxLength(200) inciName!: string;
  @IsOptional() @IsString() @MaxLength(200) commonName?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() concerns?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(20) functions?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(20) tags?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(5) comedogenicRating?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(-2) @Max(2) sensitivityImpact?: number;
  @IsOptional() @IsArray() @IsEnum(SkinType, { each: true }) goodForSkinTypes?: SkinType[];
  @IsOptional() @IsBoolean() isActiveIngredient?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) targetsConcernSlugs?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) supportsGoalSlugs?: string[];
}

export class ProductIngredientInputDto {
  @IsString() ingredientId!: string;
  @IsOptional() @IsString() @MaxLength(200) rawText?: string;
  @Type(() => Number) @IsInt() @Min(1) position!: number;
  @IsOptional() @IsString() @MaxLength(40) concentrationRange?: string;
}

export class UpsertProductDto {
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(220) slug?: string;
  @IsString() brandId!: string;
  @IsString() categoryId!: string;
  @IsOptional() @IsString() @MaxLength(14) ean?: string | null;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() usage?: string;
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) volume?: number;
  @IsOptional() @IsString() @MaxLength(10) volumeUnit?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(10) highlights?: string[];
  @IsOptional() @IsBoolean() isFragranceFree?: boolean;
  @IsOptional() @IsBoolean() isVegan?: boolean;
  @IsOptional() @IsBoolean() isCrueltyFree?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @IsEnum(SkinType, { each: true }) targetSkinTypes?: SkinType[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => ProductIngredientInputDto)
  ingredients?: ProductIngredientInputDto[];
}

export class CreateMatchWeightSetDto {
  @IsObject() weights!: Record<string, number>;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
  @IsOptional() @IsBoolean() activate?: boolean;
}

export class ImportLabelDto {
  @IsString() @MaxLength(10_000) rawLabel!: string;
}

export class UnmatchedTokenQueryDto {
  @IsOptional() @IsEnum(TokenStatus) status?: TokenStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class MapTokenDto {
  @IsString() ingredientId!: string;
  @IsOptional() @IsEnum(AliasKind) kind?: AliasKind;
}

export class UpsertStoreDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(140) slug?: string;
  @IsOptional() @IsString() @MaxLength(500) websiteUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) logo?: string;
  @IsOptional() @IsString() @MaxLength(500) affiliateUrlTemplate?: string;
}

export class UpsertOfferDto {
  @IsString() productId!: string;
  @IsString() storeId!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price!: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsString() @MaxLength(500) url?: string;
  @IsOptional() @IsEnum(Availability) availability?: Availability;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(80) @Transform(({ value }) => value?.trim()) name?: string;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsEnum(SubscriptionStatus) subscriptionStatus?: SubscriptionStatus;
}
