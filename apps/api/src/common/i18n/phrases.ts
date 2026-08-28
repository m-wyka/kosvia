import type { LocalisedText, MatchReason } from '@kosvia/shared';
import { PHRASES } from './phrases.generated';

/**
 * The server's half of the translation layer.
 *
 * Nearly everything Kosvia says is translated in the browser: the API sends
 * `{ code, text, params }` and the client renders it. The one place that cannot
 * work is the offline AI provider, which composes a paragraph out of those
 * fragments — by the time the answer reaches the client it is a single string
 * with no codes left to translate. So the server renders those fragments
 * itself, from the very same phrase table the web app uses (copied in by
 * `scripts/sync-phrases.mjs`, guarded by a test).
 *
 * Kept deliberately small: interpolation, vocabulary params, money params and
 * plurals. It is not a general i18n runtime and should not grow into one.
 */

export type AnswerLocale = keyof typeof PHRASES;

/**
 * A Personal Match reason as a translatable sentence. The `match:` prefix says
 * which namespace the code belongs to; everything else the API composes lives
 * in `GENERATED`.
 */
export function toLocalisedReason(reason: MatchReason): LocalisedText {
  return {
    code: `match:${reason.code}`,
    text: reason.label,
    ...(reason.params ? { params: reason.params as LocalisedText['params'] } : {}),
  };
}

/** `already-owned` → `ALREADY_OWNED`, matching the key style in the JSON. */
export function toTranslationKey(identifier: string): string {
  return identifier.replace(/-/g, '_').toUpperCase();
}

type Bag = Record<string, unknown>;

function lookup(locale: AnswerLocale, path: string[]): string | null {
  let node: unknown = PHRASES[locale];
  for (const segment of path) {
    if (typeof node !== 'object' || node === null) return null;
    node = (node as Bag)[segment];
  }
  return typeof node === 'string' ? node : null;
}

/**
 * Polish splits plurals three ways where English splits two, so a `count`
 * message carries three variants separated by `|`. Same rule as the web app's
 * i18n config, kept in step by `phrases.spec.ts`.
 */
function pluralIndex(count: number, locale: AnswerLocale): number {
  if (locale !== 'pl') return count === 1 ? 0 : 1;
  if (count === 1) return 0;
  const mod10 = count % 10;
  const mod100 = count % 100;
  const few = mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14);
  return few ? 1 : 2;
}

function selectPlural(message: string, count: number, locale: AnswerLocale): string {
  const variants = message.split('|').map((part) => part.trim());
  if (variants.length < 2) return message;
  return variants[Math.min(pluralIndex(count, locale), variants.length - 1)] ?? message;
}

function interpolate(message: string, params: Record<string, string | number>): string {
  return message.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/**
 * Money in the reader's conventions: "59.99 PLN" in English, "59,99 zł" in
 * Polish. Mirrors the web app's `useFormat().price`; `formatPrice` in
 * @kosvia/shared stays the API's own English formatter.
 */
export function formatMoney(
  value: number | null | undefined,
  locale: AnswerLocale,
  currency?: string,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const formatted = new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  const unit = currency && currency !== 'PLN' ? currency : locale === 'pl' ? 'zł' : 'PLN';
  return `${formatted} ${unit}`;
}

/** A vocabulary term — a skin type, concern, goal, category or routine step. */
export function vocabTerm(
  kind: 'SKIN_TYPE' | 'CONCERN' | 'GOAL' | 'CATEGORY' | 'ROUTINE_STEP',
  value: string,
  locale: AnswerLocale,
): string {
  return lookup(locale, ['VOCAB', kind, toTranslationKey(value)]) ?? value;
}

/** Params the API sends as identifiers rather than display strings. */
const LIST_PARAMS: Record<string, Parameters<typeof vocabTerm>[0] | null> = {
  skinTypes: 'SKIN_TYPE',
  concerns: 'CONCERN',
  goals: 'GOAL',
  // INCI names are not translated — "Parfum" is "Parfum" in every language.
  ingredients: null,
};
const TERM_PARAMS: Record<string, Parameters<typeof vocabTerm>[0]> = {
  skinType: 'SKIN_TYPE',
  category: 'CATEGORY',
  step: 'ROUTINE_STEP',
};
const MONEY_PARAMS = new Set(['price', 'amount', 'floor']);

/**
 * Renders one API-generated sentence in `locale`.
 *
 * Falls back to the English `text` the caller already computed whenever the
 * code is unknown, so a new message ships without breaking anything.
 */
export function renderLocalised(entry: LocalisedText, locale: AnswerLocale): string {
  const isMatchReason = entry.code.startsWith('match:');
  const path = isMatchReason
    ? ['MATCH', toTranslationKey(entry.code.slice('match:'.length))]
    : ['GENERATED', toTranslationKey(entry.code)];

  const message = lookup(locale, path);
  if (message === null) return entry.text;

  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(entry.params ?? {})) {
    if (Array.isArray(value)) {
      const kind = LIST_PARAMS[name];
      params[name] = kind
        ? value.map((item) => vocabTerm(kind, String(item), locale).toLowerCase()).join(', ')
        : value.join(', ');
    } else if (typeof value === 'string' && TERM_PARAMS[name]) {
      params[name] = vocabTerm(TERM_PARAMS[name]!, value, locale).toLowerCase();
    } else if (typeof value === 'number' && MONEY_PARAMS.has(name)) {
      params[name] = formatMoney(value, locale);
    } else {
      params[name] = value;
    }
  }

  const count = entry.params?.count;
  const selected = typeof count === 'number' ? selectPlural(message, count, locale) : message;
  return interpolate(selected, params);
}
