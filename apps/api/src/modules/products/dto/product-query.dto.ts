import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SkinType } from '@prisma/client';
import type { ProductSort } from '@kosvia/shared';

const PRODUCT_SORTS = [
  'recommended',
  'price-asc',
  'price-desc',
  'best-match',
  'ingredient-score',
  'newest',
] as const;

/** `?brand=a&brand=b` and `?brand=a,b` both work — keeps shareable URLs tidy. */
const toArray = ({ value }: { value: unknown }): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : [value];
  return raw
    .flatMap((entry) => String(entry).split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const toBoolean = ({ value }: { value: unknown }): boolean | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  return value === true || value === 'true' || value === '1';
};

export class ProductQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;

  @IsOptional() @IsString() category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(toArray)
  brand?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(toArray)
  ingredient?: string[];

  @IsOptional() @IsEnum(SkinType) skinType?: SkinType;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxPrice?: number;

  @IsOptional() @IsBoolean() @Transform(toBoolean) fragranceFree?: boolean;
  @IsOptional() @IsBoolean() @Transform(toBoolean) vegan?: boolean;
  @IsOptional() @IsBoolean() @Transform(toBoolean) crueltyFree?: boolean;

  @IsOptional() @IsEnum(PRODUCT_SORTS) sort?: ProductSort;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) pageSize?: number;
}

export class SuggestQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q!: string;
}

export class CompareQueryDto {
  /** 2-4 product ids or slugs. */
  @IsArray()
  @IsString({ each: true })
  @Transform(toArray)
  products!: string[];
}
