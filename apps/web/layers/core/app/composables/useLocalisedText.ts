import type { LocalisedText, SkinType } from '@kosvia/shared';
import { toTranslationKey } from './useVocabulary';

/**
 * Renders a sentence the API generated, in the reader's language.
 *
 * The backend returns `{ code, text, params }` for every sentence it composes —
 * routine observations, comparison verdicts, alternative reasons. We translate
 * on the code and interpolate the params; anything we do not recognise falls
 * back to the API's English `text`, so a new message shipped by the backend
 * degrades gracefully instead of showing a raw key.
 *
 * Some params are themselves identifiers (a category slug, a routine step) and
 * are run through the vocabulary before interpolation.
 */
export function useLocalisedText() {
  const { t, te } = useI18n();
  const vocab = useVocabulary();
  const format = useFormat();

  /** Params the API sends as identifiers rather than display strings. */
  const VOCAB_PARAMS: Record<string, (value: string) => string> = {
    category: (value) => vocab.category(value).toLowerCase(),
    step: (value) => vocab.routineStep(value).toLowerCase(),
  };

  /**
   * List params that are identifiers too. INCI names are deliberately absent:
   * "Parfum" is "Parfum" in every language.
   */
  const VOCAB_LIST_PARAMS: Record<string, (value: string) => string> = {
    concerns: (value) => vocab.concern(value).toLowerCase(),
    goals: (value) => vocab.goal(value).toLowerCase(),
    skinTypes: (value) => vocab.skinType(value as SkinType).toLowerCase(),
  };

  /** Params that are money and should follow the locale's currency style. */
  const MONEY_PARAMS = new Set(['price', 'amount', 'floor']);

  return function localise(entry: LocalisedText | null | undefined): string {
    if (!entry) return '';

    // A routine step can forward a Personal Match reason verbatim, which lives
    // in its own namespace. Both prefixes are written out literally so the
    // key-usage check can see which namespaces this file reaches into.
    const isMatchReason = entry.code.startsWith('match:');
    const key = isMatchReason
      ? `MATCH.${toTranslationKey(entry.code.slice('match:'.length))}`
      : `GENERATED.${toTranslationKey(entry.code)}`;
    if (!te(key)) return entry.text;

    const params: Record<string, string | number> = {};
    for (const [name, value] of Object.entries(entry.params ?? {})) {
      if (Array.isArray(value)) {
        const term = VOCAB_LIST_PARAMS[name];
        params[name] = term ? value.map(term).join(', ') : value.join(', ');
      } else if (typeof value === 'string' && VOCAB_PARAMS[name]) {
        params[name] = VOCAB_PARAMS[name]!(value);
      } else if (typeof value === 'number' && MONEY_PARAMS.has(name)) {
        params[name] = format.price(value);
      } else {
        params[name] = value;
      }
    }

    // A count param means the message may be pluralised.
    if (typeof entry.params?.count === 'number') {
      return t(key, params, entry.params.count);
    }
    return t(key, params);
  };
}
