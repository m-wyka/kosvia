import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { BudgetTier, FragrancePreference, SensitivityLevel, SkinType } from '@prisma/client';

export class UpdateBeautyProfileDto {
  @IsOptional() @IsEnum(SkinType) skinType?: SkinType;
  @IsOptional() @IsEnum(SensitivityLevel) sensitivity?: SensitivityLevel;
  @IsOptional() @IsEnum(BudgetTier) budget?: BudgetTier;
  @IsOptional() @IsEnum(FragrancePreference) fragrancePreference?: FragrancePreference;
  @IsOptional() @IsBoolean() veganPreference?: boolean;
  @IsOptional() @IsBoolean() crueltyFreePreference?: boolean;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) concernSlugs?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) goalSlugs?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) preferredBrandIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) excludedBrandIds?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  excludedIngredientIds?: string[];
}
