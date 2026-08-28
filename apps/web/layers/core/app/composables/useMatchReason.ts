import type { MatchReason } from '@kosvia/shared';
import { toTranslationKey } from './useVocabulary';

/**
 * Renders a Personal Match reason in the reader's language.
 *
 * The API sends a stable `code`, an English `label` and the raw `params` behind
 * the sentence. We translate on the code and interpolate the params, so
 * "Targets dehydration, redness" becomes "Działa na: odwodnienie,
 * zaczerwienienia" rather than a half-translated hybrid.
 *
 * An unrecognised code falls back to the API's English label — a new reason
 * shipped by the backend degrades to English instead of showing a raw key.
 */
export function useMatchReason() {
  const { t, te } = useI18n();
  const vocab = useVocabulary();

  return function reasonLabel(reason: MatchReason): string {
    const key = `MATCH.${toTranslationKey(reason.code)}`;
    if (!te(key)) return reason.label;

    const params = reason.params ?? {};
    const list = (values: string[]) => values.join(', ');

    return t(key, {
      skinType: params.skinType ? vocab.skinType(params.skinType).toLowerCase() : '',
      skinTypes: params.skinTypes
        ? list(params.skinTypes.map((value) => vocab.skinType(value).toLowerCase()))
        : '',
      concerns: params.concerns
        ? list(params.concerns.map((slug) => vocab.concern(slug).toLowerCase()))
        : '',
      goals: params.goals ? list(params.goals.map((slug) => vocab.goal(slug).toLowerCase())) : '',
      ingredients: params.ingredients ? list(params.ingredients) : '',
      budget: params.budget ?? '',
    });
  };
}
