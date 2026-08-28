import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @IsString()
  @MinLength(10, { message: 'Use at least 10 characters.' })
  @MaxLength(128)
  @Matches(/[a-z]/, { message: 'Include at least one lowercase letter.' })
  @Matches(/[A-Z]/, { message: 'Include at least one uppercase letter.' })
  @Matches(/[0-9]/, { message: 'Include at least one number.' })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Enter your password.' })
  password!: string;
}
