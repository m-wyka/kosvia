import { Injectable } from '@nestjs/common';
import type { LocalisedText } from '@kosvia/shared';
import { formatMoney, renderLocalised, vocabTerm } from '../../../common/i18n/phrases';
import { SanitizedAIProvider } from './sanitized-ai.provider';
import type {
  AdvisorContext,
  AnswerLocale,
  ProductAnalysisContext,
  RecommendationExplanationContext,
} from './ai-provider.interface';

/**
 * Sentence fragments per language.
 *
 * The offline provider composes prose from retrieved data, so it needs its own
 * phrasing for each locale — it has no model to write for it. Kept small on
 * purpose: this is a fallback that must work with no network and no API key.
 * The *contents* of the sentences — match reasons, routine notes — are rendered
 * from the shared phrase table instead, so they read the same here as they do
 * anywhere else in the interface.
 */
const COPY: Record<AnswerLocale, Record<string, (v: Record<string, string>) => string>> = {
  en: {
    nothing: (v) =>
      `I looked for ${v.intent}, but nothing in the catalogue fits closely enough to recommend.`,
    widen: () =>
      'Try widening the budget or relaxing one preference — I will run the search again.',
    owned: (v) =>
      `You already have ${v.products} on your shelf, which covers a lot of this already.`,
    best: (v) =>
      `The closest fit is ${v.product} at ${v.price}${v.score ? `, a ${v.score}% match` : ''}${v.reason ? ` — ${v.reason}` : ''}.`,
    warning: (v) => `One thing to weigh up: ${v.warning}.`,
    cheaper: (v) =>
      `If you would rather spend less, ${v.product} comes in at ${v.price}${v.score ? ` and still scores ${v.score}%` : ''}.`,
    noProfile: () =>
      'These scores are based on formula quality alone — complete your beauty profile and I can rank them against your skin.',
    routine: (v) =>
      `Here is a ${v.count}-step routine built around your profile${v.total ? `, coming to ${v.total}` : ''}: ${v.steps}.`,
    routineNone: () => 'I could not put a routine together inside that budget.',
    intentAny: () => 'products',
    intentStep: (v) => `a ${v.step}`,
    intentUnder: (v) => `${v.what} under ${v.price}`,
    formulaScore: (v) => `${v.product} scores ${v.score} out of 100 on formula quality.`,
    keyIngredients: (v) => `The ingredients doing most of the work here are ${v.ingredients}.`,
    matchScore: (v) => `${v.product} comes out at ${v.score}%.`,
    mostlyBecause: (v) => `That is mostly because ${v.reasons}.`,
    nothingPulling: () => 'There is not much in your profile pulling it up or down.',
    against: (v) => `Working against it: ${v.warnings}.`,
  },
  pl: {
    nothing: (v) =>
      `Szukałam ${v.intent}, ale nic w katalogu nie pasuje na tyle dobrze, żeby to polecić.`,
    widen: () =>
      'Spróbuj podnieść budżet albo poluzować jedną preferencję — przeszukam katalog jeszcze raz.',
    owned: (v) => `Masz już na półce ${v.products}, co w dużej mierze to pokrywa.`,
    best: (v) =>
      `Najbliżej jest ${v.product} za ${v.price}${v.score ? `, ${v.score}% dopasowania` : ''}${v.reason ? ` — ${v.reason}` : ''}.`,
    warning: (v) => `Jedna rzecz do rozważenia: ${v.warning}.`,
    cheaper: (v) =>
      `Jeśli wolisz wydać mniej, ${v.product} kosztuje ${v.price}${v.score ? ` i wciąż ma ${v.score}% dopasowania` : ''}.`,
    noProfile: () =>
      'Te wyniki opierają się wyłącznie na jakości składu — uzupełnij profil, a ocenię je pod Twoją skórę.',
    routine: (v) =>
      `Oto ${v.count}-etapowa rutyna dobrana pod Twój profil${v.total ? `, w sumie ${v.total}` : ''}: ${v.steps}.`,
    routineNone: () => 'Nie udało mi się złożyć rutyny w tym budżecie.',
    intentAny: () => 'produktów',
    intentStep: (v) => `produktu z kategorii ${v.step}`,
    intentUnder: (v) => `${v.what} do ${v.price}`,
    formulaScore: (v) => `${v.product} ma ${v.score} na 100 punktów za jakość składu.`,
    keyIngredients: (v) => `Najwięcej pracy wykonują tu składniki: ${v.ingredients}.`,
    matchScore: (v) => `${v.product} wypada na ${v.score}%.`,
    mostlyBecause: (v) => `Głównie dlatego, że ${v.reasons}.`,
    nothingPulling: () =>
      'W Twoim profilu nie ma nic, co mocno podnosiłoby lub obniżało ten wynik.',
    against: (v) => `Na minus: ${v.warnings}.`,
  },
};

/**
 * The default provider. Composes an answer from the structured data the
 * retrieval layer already produced — no network call, no API key, fully
 * deterministic, and safe by construction because it can only reference
 * products it was handed.
 *
 * This is what makes `npm run dev` work offline on a fresh clone.
 */
@Injectable()
export class MockAIProvider extends SanitizedAIProvider {
  readonly name = 'mock';

  /** Offline, there is nothing to write from — the entry stays undescribed rather than invented. */
  protected async describe(): Promise<null> {
    return null;
  }

  protected async generate(context: AdvisorContext): Promise<string> {
    const { retrieved, profileSummary } = context;
    const locale = context.locale ?? 'pl';
    const copy = COPY[locale] ?? COPY.en;
    const say = (entry: LocalisedText) => renderLocalised(entry, locale);
    const list = (entries: LocalisedText[]) =>
      entries.map((entry) => say(entry).toLowerCase()).join(', ');

    if (!retrieved.length) {
      return [copy.nothing!({ intent: this.describeIntent(context) }), copy.widen!({})].join(
        '\n\n',
      );
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
          ? copy.routine!({
              count: String(steps.length),
              total: context.routineTotal ? formatMoney(context.routineTotal, locale) : '',
              steps: steps
                .map(
                  (entry) =>
                    `${entry.label ? say(entry.label) : ''} — ${entry.product.brand.name} ${entry.product.name}`,
                )
                .join('; '),
            })
          : copy.routineNone!({}),
      );
      for (const note of context.routineNotes ?? []) paragraphs.push(say(note));
      return paragraphs.join('\n\n');
    }

    if (owned.length) {
      paragraphs.push(
        copy.owned!({
          products: owned
            .map((entry) => `${entry.product.brand.name} ${entry.product.name}`)
            .join(', '),
        }),
      );
    }

    if (best) {
      paragraphs.push(
        copy.best!({
          product: `${best.product.brand.name} ${best.product.name}`,
          price: formatMoney(best.product.lowestPrice, locale),
          score: best.matchScore ? String(best.matchScore) : '',
          reason: list(best.reasons.slice(0, 2)),
        }),
      );
      if (best.warnings.length) {
        paragraphs.push(copy.warning!({ warning: say(best.warnings[0]!).toLowerCase() }));
      }
    }

    if (cheaper && cheaper.product.id !== best?.product.id) {
      paragraphs.push(
        copy.cheaper!({
          product: `${cheaper.product.brand.name} ${cheaper.product.name}`,
          price: formatMoney(cheaper.product.lowestPrice, locale),
          score: cheaper.matchScore ? String(cheaper.matchScore) : '',
        }),
      );
    }

    if (!profileSummary) paragraphs.push(copy.noProfile!({}));

    return paragraphs.join('\n\n');
  }

  protected async analyze(context: ProductAnalysisContext): Promise<string> {
    const { product, ingredientHighlights, ingredientScore, notes } = context;
    const locale = context.locale ?? 'pl';
    const copy = COPY[locale] ?? COPY.en;
    const named = ingredientHighlights.slice(0, 4).map((entry) => entry.name);

    const lines = [
      copy.formulaScore!({
        product: `${product.brand.name} ${product.name}`,
        score: String(ingredientScore),
      }),
    ];
    if (named.length) lines.push(copy.keyIngredients!({ ingredients: named.join(', ') }));
    lines.push(...notes.slice(0, 2).map((note) => renderLocalised(note, locale)));
    return lines.join(' ');
  }

  protected async explain(context: RecommendationExplanationContext): Promise<string> {
    const { score, reasons, warnings, product } = context;
    const locale = context.locale ?? 'pl';
    const copy = COPY[locale] ?? COPY.en;
    const list = (entries: LocalisedText[]) =>
      entries.map((entry) => renderLocalised(entry, locale).toLowerCase()).join(', ');

    const parts = [
      copy.matchScore!({ product: `${product.brand.name} ${product.name}`, score: String(score) }),
      reasons.length
        ? copy.mostlyBecause!({ reasons: list(reasons.slice(0, 3)) })
        : copy.nothingPulling!({}),
    ];
    if (warnings.length) parts.push(copy.against!({ warnings: list(warnings.slice(0, 2)) }));
    return parts.join(' ');
  }

  /**
   * Restates what the question was understood to be asking for. Built from the
   * structured intent rather than the English `intentSummary`, which exists for
   * the model-backed prompt and the conversation record.
   */
  private describeIntent(context: AdvisorContext): string {
    const locale = context.locale ?? 'pl';
    const copy = COPY[locale] ?? COPY.en;
    const step = context.intent?.routineStep;
    const what = step
      ? copy.intentStep!({ step: vocabTerm('ROUTINE_STEP', step, locale).toLowerCase() })
      : copy.intentAny!({});
    const maxPrice = context.intent?.maxPrice;
    return maxPrice ? copy.intentUnder!({ what, price: formatMoney(maxPrice, locale) }) : what;
  }
}
