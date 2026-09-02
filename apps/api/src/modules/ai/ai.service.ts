import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  AiChatResponse,
  AiConversationDto,
  AiMessageDto,
  AiProductSuggestion,
} from '@kosvia/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EntitlementService } from '../subscription/entitlement.service';
import { ViewerContextService } from '../profile/viewer-context.service';
import { ProductsService } from '../products/products.service';
import { PersonalMatchService } from '../scoring/personal-match.service';
import { IngredientScoreService } from '../scoring/ingredient-score.service';
import { PRODUCT_INCLUDE, hasMatchedIngredient } from '../products/product.select';
import { toProductSummary, toScorable } from '../products/product.mapper';
import { renderLocalised, toLocalisedReason } from '../../common/i18n/phrases';

const MEDICAL_FALLBACK_EN =
  'I can describe what these ingredients do, but I cannot give medical advice. If this is about a skin condition or a reaction, please talk to a dermatologist.';
import { BeautyAdvisorService } from './beauty-advisor.service';
import { findMedicalLanguage, REPHRASE_INSTRUCTION } from './medical-language';
import { AI_PROVIDER, type AIProvider, type AnswerLocale } from './providers/ai-provider.interface';
import { isProductVisible } from '../products/product-visibility';

@Injectable()
export class AIService {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AIProvider,
    private readonly prisma: PrismaService,
    private readonly advisor: BeautyAdvisorService,
    private readonly viewers: ViewerContextService,
    private readonly products: ProductsService,
    private readonly match: PersonalMatchService,
    private readonly ingredientScore: IngredientScoreService,
    private readonly entitlements: EntitlementService,
  ) {}

  async chat(
    user: AuthenticatedUser,
    message: string,
    conversationId?: string,
    locale: AnswerLocale = 'pl',
  ): Promise<AiChatResponse> {
    const plan = await this.entitlements.currentPlan(user);
    await this.entitlements.consumeAiMessage(user.id, plan);
    try {
      return await this.answer(user.id, message, conversationId, locale);
    } catch (error) {
      await this.entitlements.refundAiMessage(user.id);
      throw error;
    }
  }

  private async answer(
    userId: string,
    message: string,
    conversationId?: string,
    locale: AnswerLocale = 'pl',
  ): Promise<AiChatResponse> {
    const viewer = await this.viewers.load(userId);
    const conversation = await this.resolveConversation(userId, conversationId, message);

    const history = conversation.messages.map((entry) => ({
      role: entry.role,
      content: entry.content,
    }));

    await this.prisma.aIMessage.create({
      data: { conversationId: conversation.id, role: 'USER', content: message },
    });

    const { context, retrieved } = await this.advisor.buildContext(
      message,
      viewer,
      history,
      locale,
    );
    const answer = await this.safeAnswer(context, locale);
    const suggestions = this.advisor.toSuggestions(retrieved);

    const saved = await this.prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: answer,
        suggestions: suggestions as unknown as Prisma.InputJsonValue,
      },
    });
    await this.prisma.aIConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return {
      conversationId: conversation.id,
      message: {
        id: saved.id,
        role: 'ASSISTANT',
        content: answer,
        suggestions,
        createdAt: saved.createdAt.toISOString(),
      },
    };
  }

  async conversations(userId: string): Promise<AiConversationDto[]> {
    const rows = await this.prisma.aIConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 1 } },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      messages: row.messages.map(toMessageDto),
    }));
  }

  async conversation(userId: string, id: string): Promise<AiConversationDto> {
    const row = await this.prisma.aIConversation.findFirst({
      where: { id, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row) throw new NotFoundException('That conversation does not exist.');
    return {
      id: row.id,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      messages: row.messages.map(toMessageDto),
    };
  }

  async deleteConversation(userId: string, id: string): Promise<void> {
    const row = await this.prisma.aIConversation.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('That conversation does not exist.');
    await this.prisma.aIConversation.delete({ where: { id } });
  }

  /** Natural-language read of a formula, for the product page. */
  async explainProduct(
    slug: string,
    locale: AnswerLocale = 'pl',
  ): Promise<{ explanation: string }> {
    const row = await this.prisma.product.findUnique({ where: { slug }, include: PRODUCT_INCLUDE });
    if (!row || !isProductVisible(row)) {
      throw new NotFoundException('We could not find that product.');
    }

    const scorable = toScorable(row);
    const breakdown = this.ingredientScore.compute(scorable.ingredients);
    const explanation = await this.provider.analyzeProduct({
      locale,
      product: toProductSummary(row),
      ingredientScore: breakdown.score,
      notes: breakdown.notes,
      ingredientHighlights: row.ingredients
        .filter(hasMatchedIngredient)
        .filter(
          (entry) =>
            entry.ingredient.isActiveIngredient ||
            (entry.position <= 6 && entry.ingredient.tags.length > 0),
        )
        .slice(0, 6)
        .map((entry) => ({
          name: entry.ingredient.commonName ?? entry.ingredient.inciName,
          tags: entry.ingredient.tags,
          note: entry.ingredient.concerns,
        })),
    });
    return { explanation };
  }

  /** The "Why?" behind a Personal Match score, in plain language. */
  async explainMatch(
    userId: string | null,
    slug: string,
    locale: AnswerLocale = 'pl',
  ): Promise<{ explanation: string }> {
    const viewer = await this.viewers.load(userId);
    const row = await this.prisma.product.findUnique({ where: { slug }, include: PRODUCT_INCLUDE });
    if (!row || !isProductVisible(row)) {
      throw new NotFoundException('We could not find that product.');
    }

    const score = this.match.score({
      product: toScorable(row),
      profile: viewer.profile,
      shelf: viewer.shelf,
    });

    const explanation = await this.provider.explainRecommendation({
      locale,
      product: toProductSummary(row, score),
      score: score.score,
      reasons: score.reasons.map(toLocalisedReason),
      warnings: score.warnings.map(toLocalisedReason),
      profileSummary: viewer.profile
        ? `${viewer.profile.skinType.toLowerCase()} skin, ${viewer.profile.sensitivity.toLowerCase()} sensitivity`
        : null,
    });
    return { explanation };
  }

  /**
   * One rewrite when the model slips into medical language; if it still
   * does, a neutral fallback goes out instead of the model's words.
   */
  private async safeAnswer(
    context: Parameters<AIProvider['generateResponse']>[0],
    locale: AnswerLocale,
  ): Promise<string> {
    const first = await this.provider.generateResponse(context);
    if (!findMedicalLanguage(first)) return first;
    const second = await this.provider.generateResponse({
      ...context,
      rewriteInstruction: REPHRASE_INSTRUCTION,
    });
    if (!findMedicalLanguage(second)) return second;
    return renderLocalised({ code: 'ai.medical_fallback', text: MEDICAL_FALLBACK_EN }, locale);
  }

  private async resolveConversation(
    userId: string,
    conversationId: string | undefined,
    firstMessage: string,
  ) {
    if (conversationId) {
      const existing = await this.prisma.aIConversation.findFirst({
        where: { id: conversationId, userId },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
      });
      if (existing) return existing;
    }
    const created = await this.prisma.aIConversation.create({
      data: {
        userId,
        title: firstMessage.length > 60 ? `${firstMessage.slice(0, 57)}…` : firstMessage,
      },
    });
    return { ...created, messages: [] as Array<{ role: 'USER' | 'ASSISTANT'; content: string }> };
  }
}

function toMessageDto(message: {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  suggestions: unknown;
  createdAt: Date;
}): AiMessageDto {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    suggestions: (message.suggestions as AiProductSuggestion[] | null) ?? [],
    createdAt: message.createdAt.toISOString(),
  };
}
