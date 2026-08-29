import type {
  AdvisorContext,
  ProductAnalysisContext,
  RecommendationExplanationContext,
} from './ai-provider.interface';
import { EMAIL_REDACTION, SanitizedAIProvider, sanitize } from './sanitized-ai.provider';

const EMAIL = 'anna.kowalska@example.com';

/** Records exactly what reaches the model. */
class RecordingProvider extends SanitizedAIProvider {
  readonly name = 'recording';
  received: unknown[] = [];

  protected async generate(context: AdvisorContext): Promise<string> {
    this.received.push(context);
    return 'ok';
  }

  protected async analyze(context: ProductAnalysisContext): Promise<string> {
    this.received.push(context);
    return 'ok';
  }

  protected async explain(context: RecommendationExplanationContext): Promise<string> {
    this.received.push(context);
    return 'ok';
  }
}

/** Puts the e-mail (and an identity key) into every string slot of an object. */
const poison = <T>(value: T): T => {
  if (typeof value === 'string') {
    return `${value} ${EMAIL}` as T;
  }
  if (Array.isArray(value)) {
    return value.map(poison) as T;
  }
  if (value && typeof value === 'object') {
    return {
      ...Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, poison(entry)])),
      email: EMAIL,
      userId: 'user-123',
    } as T;
  }
  return value;
};

const product = {
  id: 'p1',
  ean: null,
  name: 'Serum',
  slug: 'serum',
  imageUrl: null,
  volume: 30,
  volumeUnit: 'ml',
  isFragranceFree: true,
  isVegan: false,
  isCrueltyFree: false,
  brand: { id: 'b1', name: 'Brand', slug: 'brand', logo: null },
  category: { id: 'c1', name: 'Serums', slug: 'serums', parentId: null, description: null },
  lowestPrice: 49.99,
  lowestPriceStore: null,
  ingredientScore: 70,
};

describe('SanitizedAIProvider', () => {
  it('never lets an e-mail address or identity key reach the model', async () => {
    const provider = new RecordingProvider();
    const advisor: AdvisorContext = poison({
      question: 'what should I buy',
      locale: 'en',
      profileSummary: 'combination skin',
      shelfSummary: ['Brand Serum (serums)'],
      retrieved: [
        {
          role: 'best-match',
          product,
          matchScore: 80,
          reasons: [{ code: 'x', text: 'fits your budget' }],
          warnings: [],
        },
      ],
      history: [{ role: 'USER', content: 'hi' }],
      intentSummary: 'serum under 100',
    });
    await provider.generateResponse(advisor);
    await provider.analyzeProduct(
      poison({
        locale: 'en',
        product,
        ingredientHighlights: [{ name: 'Niacinamide', tags: ['brightening'], note: null }],
        ingredientScore: 70,
        notes: [],
      }),
    );
    await provider.explainRecommendation(
      poison({
        locale: 'en',
        product,
        score: 80,
        reasons: [{ code: 'x', text: 'fits' }],
        warnings: [],
        profileSummary: 'dry skin',
      }),
    );

    const payload = JSON.stringify(provider.received);
    expect(payload).not.toContain(EMAIL);
    expect(payload).not.toContain('user-123');
    expect(payload).not.toContain('"email"');
    expect(payload).toContain(EMAIL_REDACTION);
    expect(payload).toContain('Niacinamide');
  });

  it('leaves non-identifying structure intact', () => {
    expect(sanitize({ question: 'hello', retrieved: [{ matchScore: 5 }] })).toEqual({
      question: 'hello',
      retrieved: [{ matchScore: 5 }],
    });
  });
});
