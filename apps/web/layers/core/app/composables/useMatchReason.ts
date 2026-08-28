import type { MatchReason } from '@kosvia/shared';
import { toTranslationKey } from './useVocabulary';

export const useMatchReason = () => {
  const { t, te } = useI18n();
  const vocab = useVocabulary();

  const joinList = (values: string[]) => values.join(', ');

  return (reason: MatchReason): string => {
    const key = `MATCH.${toTranslationKey(reason.code)}`;
    if (!te(key)) {
      return reason.label;
    }

    const params = reason.params ?? {};

    return t(key, {
      skinType: params.skinType ? vocab.skinType(params.skinType).toLowerCase() : '',
      skinTypes: params.skinTypes
        ? joinList(params.skinTypes.map((value) => vocab.skinType(value).toLowerCase()))
        : '',
      concerns: params.concerns
        ? joinList(params.concerns.map((slug) => vocab.concern(slug).toLowerCase()))
        : '',
      goals: params.goals
        ? joinList(params.goals.map((slug) => vocab.goal(slug).toLowerCase()))
        : '',
      ingredients: params.ingredients ? joinList(params.ingredients) : '',
      budget: params.budget ?? '',
    });
  };
};
