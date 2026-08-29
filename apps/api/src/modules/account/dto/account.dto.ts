import { IsBoolean, IsEnum, IsString, MaxLength } from 'class-validator';
import { ConsentType } from '@prisma/client';

export class SetConsentDto {
  @IsEnum(ConsentType) type!: ConsentType;
  @IsBoolean() granted!: boolean;
}

export class DeleteAccountDto {
  @IsString() @MaxLength(128) password!: string;
}
