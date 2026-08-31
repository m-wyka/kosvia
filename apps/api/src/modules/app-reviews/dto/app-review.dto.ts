import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  APP_REVIEW_BODY_MAX_LENGTH,
  APP_REVIEW_BODY_MIN_LENGTH,
  APP_REVIEW_SORTS,
} from '@kosvia/shared';
import type { AppReviewSort } from '@kosvia/shared';

export class AppReviewQueryDto {
  @IsOptional() @IsEnum(APP_REVIEW_SORTS) sort?: AppReviewSort;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize?: number;
}

export class CreateAppReviewDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(5) rating!: number;

  @IsString()
  @MinLength(APP_REVIEW_BODY_MIN_LENGTH)
  @MaxLength(APP_REVIEW_BODY_MAX_LENGTH)
  body!: string;
}
