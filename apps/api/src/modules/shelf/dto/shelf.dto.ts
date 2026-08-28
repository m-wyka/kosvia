import { IsBoolean, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddShelfItemDto {
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() slug?: string;
  /** Reserved for the barcode scanner — the API already accepts it. */
  @IsOptional() @IsString() @MaxLength(14) ean?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsISO8601() openedAt?: string;
  @IsOptional() @IsBoolean() isFavorite?: boolean;
}

export class UpdateShelfItemDto {
  @IsOptional() @IsString() @MaxLength(500) notes?: string | null;
  @IsOptional() @IsBoolean() isFavorite?: boolean;
  @IsOptional() @IsISO8601() openedAt?: string | null;
  @IsOptional() @IsISO8601() finishedAt?: string | null;
}
