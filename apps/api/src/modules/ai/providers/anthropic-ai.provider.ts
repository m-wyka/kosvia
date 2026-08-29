import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { LocalisedText } from '@kosvia/shared';
import { formatPrice } from '@kosvia/shared';
import {
  LOCALE_NAMES,
  SAFETY_RULES,
  type AdvisorContext,
  type AIProvider,
  type ProductAnalysisContext,
  type RecommendationExplanationContext,
} from './ai-provider.interface';
import { MockAIProvider } from './mock-ai.provider';

/**
 * Generated sentences as prompt material. The model is told which language to
 * answer in and translates these itself, so the English `text` is what it sees —
 * only the offline provider renders them from the phrase table.
 */
const sentences = (entries: LocalisedText[]): string =>
  entries.map((entry) => entry.text).join('; ');

/**
 * Claude-backed provider. Enabled with AI_PROVIDER=anthropic and an AI_API_KEY.
 *
 * The model receives only what the retrieval layer already looked up, wrapped
 * in explicit guardrails. If the call fails for any reason we fall back to the
 * deterministic provider rather than showing the user an error — a slightly
 * plainer answer beats a broken chat.
 */
@Injectable()
export class AnthropicAIProvider implements AIProvider {
  readonly name = 'anthropic';
  private readonly logger = new Logger(AnthropicAIProvider.name);
  private readonly client: Anthropic;
  private readonly fallback = new MockAIProvider();

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async generateResponse(context: AdvisorContext): Promise<string> {
    const retrieved = context.retrieved.length
      ? context.retrieved
          .map((entry, index) =>
            [
              `${index + 1}. [${entry.role}] ${entry.product.brand.name} ${entry.product.name}`,
              `   category: ${entry.product.category.name}`,
              `   price: ${formatPrice(entry.product.lowestPrice)}${
                entry.product.lowestPriceStore ? ` at ${entry.product.lowestPriceStore.name}` : ''
              }`,
              `   personal match: ${entry.matchScore ?? 'n/a'}`,
              entry.reasons.length ? `   in its favour: ${sentences(entry.reasons)}` : '',
              entry.warnings.length ? `   against it: ${sentences(entry.warnings)}` : '',
            ]
              .filter(Boolean)
              .join('\n'),
          )
          .join('\n\n')
      : '(nothing matched the search)';

    const prompt = [
      `ANSWER LANGUAGE: ${LOCALE_NAMES[context.locale]}`,
      '',
      `USER QUESTION: ${context.question}`,
      '',
      `WHAT KOSVIA SEARCHED FOR: ${context.intentSummary}`,
      ...(context.isRoutine
        ? [
            '',
            `THIS IS A FULL ROUTINE, NOT A SHORTLIST. Describe the plan as a whole${
              context.routineTotal ? ` (total ${context.routineTotal.toFixed(2)} PLN)` : ''
            }, one sentence per step.`,
            ...(context.routineNotes?.length
              ? [`NOTES TO WORK IN: ${sentences(context.routineNotes)}`]
              : []),
          ]
        : []),
      '',
      `USER PROFILE: ${context.profileSummary ?? '(no beauty profile yet)'}`,
      '',
      `ON THEIR SHELF: ${context.shelfSummary.length ? context.shelfSummary.join('; ') : '(nothing yet)'}`,
      '',
      'RETRIEVED PRODUCTS (the only products you may mention):',
      retrieved,
    ].join('\n');

    return this.complete(prompt, () => this.fallback.generateResponse(context), context.history);
  }

  async analyzeProduct(context: ProductAnalysisContext): Promise<string> {
    const prompt = [
      `Explain this formula to a shopper in two or three sentences.`,
      `ANSWER LANGUAGE: ${LOCALE_NAMES[context.locale]}`,
      '',
      `PRODUCT: ${context.product.brand.name} ${context.product.name} (${context.product.category.name})`,
      `INGREDIENT SCORE: ${context.ingredientScore}/100`,
      'KEY INGREDIENTS:',
      ...context.ingredientHighlights.map(
        (entry) =>
          `- ${entry.name} [${entry.tags.join(', ')}]${entry.note ? ` — ${entry.note}` : ''}`,
      ),
      context.notes.length ? `NOTES: ${sentences(context.notes)}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return this.complete(prompt, () => this.fallback.analyzeProduct(context));
  }

  async explainRecommendation(context: RecommendationExplanationContext): Promise<string> {
    const prompt = [
      'Explain this Personal Match score in two or three sentences, in second person.',
      'The score and the reasons were computed by Kosvia — restate them, do not recalculate.',
      `ANSWER LANGUAGE: ${LOCALE_NAMES[context.locale]}`,
      '',
      `PRODUCT: ${context.product.brand.name} ${context.product.name}`,
      `SCORE: ${context.score}%`,
      `IN ITS FAVOUR: ${sentences(context.reasons) || 'nothing notable'}`,
      `AGAINST IT: ${sentences(context.warnings) || 'nothing notable'}`,
      `PROFILE: ${context.profileSummary ?? '(no profile)'}`,
    ].join('\n');

    return this.complete(prompt, () => this.fallback.explainRecommendation(context));
  }

  private async complete(
    prompt: string,
    fallback: () => Promise<string>,
    history: AdvisorContext['history'] = [],
  ): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        // Effort is kept low: this is grounded rewriting of data we already
        // have, not a reasoning problem.
        output_config: { effort: 'low' },
        system: SAFETY_RULES,
        messages: [
          ...history.slice(-6).map((turn) => ({
            role: turn.role === 'USER' ? ('user' as const) : ('assistant' as const),
            content: turn.content,
          })),
          { role: 'user' as const, content: prompt },
        ],
      });

      if (response.stop_reason === 'refusal') {
        this.logger.warn('Model declined the request; using the deterministic provider.');
        return fallback();
      }

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();

      return text || fallback();
    } catch (error) {
      this.logger.error(
        `Claude request failed, falling back to the deterministic provider: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return fallback();
    }
  }
}
