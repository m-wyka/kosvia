import type { LocalisedText, ProductSummaryDto } from '@kosvia/shared';
import type { AnswerLocale } from '../../../common/i18n/phrases';

/**
 * AIProvider — the seam between Kosvia and whichever model we run on.
 *
 * The contract is deliberately narrow, and every method receives *already
 * retrieved* structured data. A provider is asked to write prose about facts we
 * hand it; it is never asked to recall a price, an ingredient, a product name
 * or whether something is in stock. That rule is what keeps the AI layer from
 * inventing a catalogue.
 */

export type { AnswerLocale };

export const LOCALE_NAMES: Record<AnswerLocale, string> = { en: 'English', pl: 'Polish' };

export interface AdvisorContext {
  /** The user's question, verbatim. */
  question: string;
  /** Language the answer must be written in. */
  locale: AnswerLocale;
  /** Short plain-language description of the user's profile, or null. */
  profileSummary: string | null;
  /** What the user already owns, as "Brand Product (category)" lines. */
  shelfSummary: string[];
  /** Products retrieved by the backend. The ONLY products that may be named. */
  retrieved: RetrievedProduct[];
  /** Earlier turns, oldest first. */
  history: Array<{ role: 'USER' | 'ASSISTANT'; content: string }>;
  /** What the retrieval layer understood the user to be asking for. */
  intentSummary: string;
  /** True when the retrieved products form a whole routine, not a shortlist. */
  isRoutine?: boolean;
  routineTotal?: number | null;
  routineNotes?: LocalisedText[];
  /** Structured read of the question, so a provider can restate it in any language. */
  intent?: { routineStep: string | null; maxPrice: number | null };
  /** Set on a retry after the medical-language check rejected the first answer. */
  rewriteInstruction?: string;
}

export interface RetrievedProduct {
  role: 'best-match' | 'cheaper' | 'alternative' | 'already-owned';
  /** Overrides the role's default card label — e.g. a routine step name. */
  label?: LocalisedText;
  product: ProductSummaryDto;
  matchScore: number | null;
  /**
   * Carried as `{ code, text, params }` rather than plain strings: the offline
   * provider composes its answer from these and has to do so in the reader's
   * language. The model-backed provider only ever reads `text`.
   */
  reasons: LocalisedText[];
  warnings: LocalisedText[];
}

export interface ProductAnalysisContext {
  locale: AnswerLocale;
  product: ProductSummaryDto;
  ingredientHighlights: Array<{ name: string; tags: string[]; note: string | null }>;
  ingredientScore: number;
  notes: LocalisedText[];
}

export interface RecommendationExplanationContext {
  locale: AnswerLocale;
  product: ProductSummaryDto;
  score: number;
  reasons: LocalisedText[];
  warnings: LocalisedText[];
  profileSummary: string | null;
}

export interface AIProvider {
  readonly name: string;
  /** Conversational answer for the AI Beauty Shopper. */
  generateResponse(context: AdvisorContext): Promise<string>;
  /** Plain-language read of a single formula. */
  analyzeProduct(context: ProductAnalysisContext): Promise<string>;
  /** Turns a deterministic Personal Match breakdown into a sentence or two. */
  explainRecommendation(context: RecommendationExplanationContext): Promise<string>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');

/**
 * Shared guardrails. Both providers honour these; the mock does so by
 * construction, the model-backed one by instruction.
 */
export const SAFETY_RULES = [
  'You are Kosvia, an assistant that helps people choose cosmetics.',
  'You may ONLY mention products that appear in the RETRIEVED PRODUCTS block. Never invent a product, brand, price, ingredient, store or availability.',
  'Prices, match scores and ingredients are given to you. Repeat them exactly or not at all — never estimate.',
  'If nothing suitable was retrieved, say so plainly and suggest changing the filters.',
  'Kosvia is not a medical service. Do not diagnose, and do not claim a product will cure or treat a condition.',
  'Describe ingredients informationally. Never call an ingredient toxic, dangerous or bad.',
  'Be concise and concrete. Two or three short paragraphs at most, no bullet-point walls.',
  'Write the answer in the language named in the prompt. Product, brand and INCI names stay as given.',
  'Do not repeat the full product cards — the interface renders them beneath your answer.',
].join('\n');
