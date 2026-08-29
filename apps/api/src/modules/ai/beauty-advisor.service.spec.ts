import { BeautyAdvisorService } from './beauty-advisor.service';
import type { PrismaService } from '../../common/prisma/prisma.service';
import type { RecommendationService } from '../recommendation/recommendation.service';
import type { ProductsService } from '../products/products.service';
import type { ViewerContext } from '../profile/viewer-context.service';

const ANON: ViewerContext = { userId: null, profile: null };

const withBudget = (budget: 'UNDER_50' | 'NO_LIMIT'): ViewerContext => ({
  userId: 'u1',
  profile: {
    skinType: 'COMBINATION',
    sensitivity: 'MEDIUM',
    budget,
    fragrancePreference: 'NO_PREFERENCE',
    veganPreference: false,
    crueltyFreePreference: false,
    concernSlugs: [],
    goalSlugs: [],
    preferredBrandIds: [],
    excludedBrandIds: [],
    excludedIngredientIds: [],
    allergenIngredientIds: [],
  },
});

/**
 * Intent parsing is what keeps prices and product types out of the model's
 * hands, so it is tested as ordinary logic rather than trusted to a prompt.
 */
describe('BeautyAdvisorService.parseIntent', () => {
  const service = new BeautyAdvisorService(
    {} as PrismaService,
    {} as RecommendationService,
    {} as ProductsService,
  );

  it.each([
    ['I need a moisturizer', 'MOISTURIZER'],
    ['recommend a gentle cleanser', 'CLEANSER'],
    ['which vitamin c serum should I buy?', 'SERUM'],
    ['I want an spf for daily use', 'SPF'],
    ['looking for an eye cream', 'EYE'],
    ['a good shampoo please', 'HAIR'],
  ])('recognises the routine step in %p', (question, step) => {
    expect(service.parseIntent(question, ANON).routineStep).toBe(step);
  });

  it('leaves the step open when the question does not name one', () => {
    expect(service.parseIntent('what should I buy next?', ANON).routineStep).toBeNull();
  });

  it.each([
    ['a moisturizer under 70 PLN', 70],
    ['something for max 45 zł', 45],
    ['I have up to 120 pln', 120],
    ['coś do 60 zl', 60],
  ])('extracts the budget from %p', (question, expected) => {
    expect(service.parseIntent(question, ANON).maxPrice).toBe(expected);
  });

  it('falls back to the profile budget when the question does not mention one', () => {
    expect(service.parseIntent('recommend a serum', withBudget('UNDER_50')).maxPrice).toBe(50);
    expect(service.parseIntent('recommend a serum', withBudget('NO_LIMIT')).maxPrice).toBeNull();
  });

  it('lets an explicit budget in the question override the profile', () => {
    expect(service.parseIntent('a serum under 150 PLN', withBudget('UNDER_50')).maxPrice).toBe(150);
  });

  it('detects a request for something cheaper', () => {
    expect(service.parseIntent('find me a cheaper alternative', ANON).wantsCheaper).toBe(true);
    expect(service.parseIntent('which moisturizer is best?', ANON).wantsCheaper).toBe(false);
  });

  it('detects a shelf check', () => {
    expect(service.parseIntent('do I already have something similar?', ANON).wantsShelfCheck).toBe(
      true,
    );
  });

  it('detects a full-routine request', () => {
    const intent = service.parseIntent('I have 150 PLN for a basic routine', ANON);
    expect(intent.wantsRoutine).toBe(true);
    expect(intent.maxPrice).toBe(150);
  });

  it('summarises what it understood, for the answer and for debugging', () => {
    const intent = service.parseIntent('a moisturizer under 70 PLN', withBudget('NO_LIMIT'));
    expect(intent.summary).toContain('moisturizer');
    expect(intent.summary).toContain('70');
  });
});
