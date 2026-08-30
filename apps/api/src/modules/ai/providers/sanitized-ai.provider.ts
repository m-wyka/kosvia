import type {
  AdvisorContext,
  AIProvider,
  IngredientDescription,
  IngredientDescriptionContext,
  ProductAnalysisContext,
  RecommendationExplanationContext,
} from './ai-provider.interface';

/**
 * Data minimisation for the model boundary (02_RODO.md §6).
 *
 * Every provider extends this class, so the only way to reach a model is
 * through `sanitize()`: identifying fields are dropped by name and anything
 * that looks like an e-mail address is redacted from every string, however
 * deep it sits. The unit test feeds an e-mail into every slot of every
 * context and asserts it never comes out.
 */
export abstract class SanitizedAIProvider implements AIProvider {
  abstract readonly name: string;

  generateResponse(context: AdvisorContext): Promise<string> {
    return this.generate(sanitize(context));
  }

  analyzeProduct(context: ProductAnalysisContext): Promise<string> {
    return this.analyze(sanitize(context));
  }

  explainRecommendation(context: RecommendationExplanationContext): Promise<string> {
    return this.explain(sanitize(context));
  }

  describeIngredient(context: IngredientDescriptionContext): Promise<IngredientDescription | null> {
    return this.describe(sanitize(context));
  }

  protected abstract describe(
    context: IngredientDescriptionContext,
  ): Promise<IngredientDescription | null>;
  protected abstract generate(context: AdvisorContext): Promise<string>;
  protected abstract analyze(context: ProductAnalysisContext): Promise<string>;
  protected abstract explain(context: RecommendationExplanationContext): Promise<string>;
}

/** Keys that can only ever carry identity, never product facts. */
const IDENTIFYING_KEYS = new Set([
  'email',
  'userId',
  'user',
  'ip',
  'ipHash',
  'passwordHash',
  'userAgent',
  'conversationId',
]);

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
export const EMAIL_REDACTION = '[e-mail removed]';

export const sanitize = <T>(value: T): T => walk(value) as T;

const walk = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value.replace(EMAIL_PATTERN, EMAIL_REDACTION);
  }
  if (Array.isArray(value)) {
    return value.map(walk);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (IDENTIFYING_KEYS.has(key)) {
        continue;
      }
      out[key] = walk(entry);
    }
    return out;
  }
  return value;
};
