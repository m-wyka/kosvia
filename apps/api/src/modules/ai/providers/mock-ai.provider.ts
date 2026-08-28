import { Injectable } from '@nestjs/common';
import { formatPrice } from '@kosvia/shared';
import type {
  AdvisorContext,
  AIProvider,
  ProductAnalysisContext,
  RecommendationExplanationContext,
} from './ai-provider.interface';

/**
 * The default provider. Composes an answer from the structured data the
 * retrieval layer already produced — no network call, no API key, fully
 * deterministic, and safe by construction because it can only reference
 * products it was handed.
 *
 * This is what makes `npm run dev` work offline on a fresh clone.
 */
@Injectable()
export class MockAIProvider implements AIProvider {
  readonly name = 'mock';

  async generateResponse(context: AdvisorContext): Promise<string> {
    const { retrieved, profileSummary, intentSummary } = context;

    if (!retrieved.length) {
      return [
        `I looked for ${intentSummary}, but nothing in the catalogue fits closely enough to recommend.`,
        'Try widening the budget or relaxing one preference — I will run the search again.',
      ].join('\n\n');
    }

    const owned = retrieved.filter((entry) => entry.role === 'already-owned');
    const best = retrieved.find((entry) => entry.role === 'best-match');
    const cheaper = retrieved.find((entry) => entry.role === 'cheaper');

    const paragraphs: string[] = [];

    // A routine is a different answer shape: describe the whole plan, not one
    // product out of it.
    if (context.isRoutine) {
      const steps = retrieved.filter((entry) => entry.role === 'best-match');
      paragraphs.push(
        steps.length
          ? `Here is a ${steps.length}-step routine built around your profile${
              context.routineTotal ? `, coming to ${formatPrice(context.routineTotal)}` : ''
            }: ${steps
              .map((entry) => `${entry.label ?? 'a product'} — ${entry.product.brand.name} ${entry.product.name}`)
              .join('; ')}.`
          : 'I could not put a routine together inside that budget.',
      );
      for (const note of context.routineNotes ?? []) paragraphs.push(note);
      return paragraphs.join('\n\n');
    }

    if (owned.length) {
      paragraphs.push(
        `You already have ${owned
          .map((entry) => `${entry.product.brand.name} ${entry.product.name}`)
          .join(' and ')} on your shelf, which covers a lot of this already.`,
      );
    }

    if (best) {
      const reason = best.reasons.slice(0, 2).join(', and ').toLowerCase();
      paragraphs.push(
        `The closest fit is ${best.product.brand.name} ${best.product.name} at ${formatPrice(
          best.product.lowestPrice,
        )}${best.matchScore ? `, a ${best.matchScore}% match` : ''}${reason ? ` — ${reason}` : ''}.`,
      );
      if (best.warnings.length) {
        paragraphs.push(`One thing to weigh up: ${best.warnings[0].toLowerCase()}.`);
      }
    }

    if (cheaper && cheaper.product.id !== best?.product.id) {
      paragraphs.push(
        `If you would rather spend less, ${cheaper.product.brand.name} ${cheaper.product.name} comes in at ${formatPrice(
          cheaper.product.lowestPrice,
        )}${cheaper.matchScore ? ` and still scores ${cheaper.matchScore}%` : ''}.`,
      );
    }

    if (!profileSummary) {
      paragraphs.push(
        'These scores are based on formula quality alone — complete your beauty profile and I can rank them against your skin.',
      );
    }

    return paragraphs.join('\n\n');
  }

  async analyzeProduct(context: ProductAnalysisContext): Promise<string> {
    const { product, ingredientHighlights, ingredientScore, notes } = context;
    const named = ingredientHighlights.slice(0, 4).map((entry) => entry.name);

    const lines = [
      `${product.brand.name} ${product.name} scores ${ingredientScore} out of 100 on formula quality.`,
    ];
    if (named.length) {
      lines.push(`The ingredients doing most of the work here are ${named.join(', ')}.`);
    }
    lines.push(...notes.slice(0, 2));
    return lines.join(' ');
  }

  async explainRecommendation(context: RecommendationExplanationContext): Promise<string> {
    const { score, reasons, warnings, product } = context;
    const parts = [
      `${product.brand.name} ${product.name} comes out at ${score}%.`,
      reasons.length
        ? `That is mostly because ${reasons.slice(0, 3).join(', ').toLowerCase()}.`
        : 'There is not much in your profile pulling it up or down.',
    ];
    if (warnings.length) {
      parts.push(`Working against it: ${warnings.slice(0, 2).join(', ').toLowerCase()}.`);
    }
    return parts.join(' ');
  }
}
