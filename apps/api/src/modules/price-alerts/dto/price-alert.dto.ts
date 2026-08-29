import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreatePriceAlertDto {
  @IsString() productId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(100000)
  targetPrice!: number;
}

export class UpdatePriceAlertDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(100000)
  targetPrice?: number;

  @IsOptional() @IsBoolean() active?: boolean;
}
