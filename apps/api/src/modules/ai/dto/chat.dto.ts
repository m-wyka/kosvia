import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ChatDto {
  @IsString()
  @MinLength(2, { message: 'Ask a question first.' })
  @MaxLength(1000, { message: 'Keep it under 1000 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  message!: string;

  @IsOptional() @IsString() conversationId?: string;

  /** Language the answer should be written in. Defaults to English. */
  @IsOptional() @IsIn(['en', 'pl']) locale?: 'en' | 'pl';
}
