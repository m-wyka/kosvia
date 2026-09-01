import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  SKIN_DIARY_FLAGS,
  SKIN_DIARY_NOTE_MAX_LENGTH,
  SKIN_DIARY_OVERALL_MAX,
  SKIN_DIARY_OVERALL_MIN,
} from '@kosvia/shared';
import type { SkinDiaryFlag } from '@kosvia/shared';

export class DiaryMonthQueryDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month!: string;
}

export class UpsertSkinDiaryEntryDto {
  @Type(() => Number)
  @IsInt()
  @Min(SKIN_DIARY_OVERALL_MIN)
  @Max(SKIN_DIARY_OVERALL_MAX)
  overall!: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(SKIN_DIARY_FLAGS, { each: true })
  flags?: SkinDiaryFlag[];

  @IsOptional() @IsString() @MaxLength(SKIN_DIARY_NOTE_MAX_LENGTH) note?: string | null;
}
