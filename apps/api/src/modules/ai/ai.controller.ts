import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AiChatResponse, AiConversationDto } from '@kosvia/shared';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { OptionalAuth } from '../../common/decorators/public.decorator';
import { AIService } from './ai.service';
import { ChatDto } from './dto/chat.dto';

@ApiTags('ai')
@Controller('ai')
export class AIController {
  constructor(private readonly ai: AIService) {}

  @Post('chat')
  // AI calls are the most expensive endpoint we have; keep the ceiling low.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Ask the AI Beauty Shopper a question' })
  chat(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChatDto): Promise<AiChatResponse> {
    return this.ai.chat(user.id, dto.message, dto.conversationId, dto.locale ?? 'pl');
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Recent conversations' })
  conversations(@CurrentUser() user: AuthenticatedUser): Promise<AiConversationDto[]> {
    return this.ai.conversations(user.id);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'One conversation with all its messages' })
  conversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<AiConversationDto> {
    return this.ai.conversation(user.id, id);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a conversation' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    return this.ai.deleteConversation(user.id, id);
  }

  @OptionalAuth()
  @Get('products/:slug/explain')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Plain-language read of a product’s formula' })
  explainProduct(
    @Param('slug') slug: string,
    @Query('locale') locale?: string,
  ): Promise<{ explanation: string }> {
    return this.ai.explainProduct(slug, locale === 'pl' ? 'pl' : 'en');
  }

  @OptionalAuth()
  @Get('products/:slug/why')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Why this product got its Personal Match score' })
  explainMatch(
    @CurrentUser() user: AuthenticatedUser | null,
    @Param('slug') slug: string,
    @Query('locale') locale?: string,
  ): Promise<{ explanation: string }> {
    return this.ai.explainMatch(user?.id ?? null, slug, locale === 'pl' ? 'pl' : 'en');
  }
}
