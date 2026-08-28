import type { LocalisedText, SkinType } from '@kosvia/shared';
import { toTranslationKey } from './useVocabulary';

const MATCH_CODE_PREFIX = 'match:';
const MONEY_PARAMS = new Set(['price', 'amount', 'floor']);

export const useLocalisedText = () => {
  const { t, te } = useI18n();
  const vocab = useVocabulary();
  const format = useFormat();

  const identifierParams: Record<string, (value: string) => string> = {
    category: (value) => vocab.category(value).toLowerCase(),
    step: (value) => vocab.routineStep(value).toLowerCase(),
  };

  const identifierListParams: Record<string, (value: string) => string> = {
    concerns: (value) => vocab.concern(value).toLowerCase(),
    goals: (value) => vocab.goal(value).toLowerCase(),
    skinTypes: (value) => vocab.skinType(value as SkinType).toLowerCase(),
  };

  const translationKeyFor = (code: string): string => {
    if (code.startsWith(MATCH_CODE_PREFIX)) {
      return `MATCH.${toTranslationKey(code.slice(MATCH_CODE_PREFIX.length))}`;
    }
    return `GENERATED.${toTranslationKey(code)}`;
  };

  const localiseParam = (name: string, value: unknown): string | number => {
    if (Array.isArray(value)) {
      const translateItem = identifierListParams[name];
      return translateItem ? value.map(translateItem).join(', ') : value.join(', ');
    }
    if (typeof value === 'string' && identifierParams[name]) {
      return identifierParams[name](value);
    }
    if (typeof value === 'number' && MONEY_PARAMS.has(name)) {
      return format.price(value);
    }
    return value as string | number;
  };

  return (entry: LocalisedText | null | undefined): string => {
    if (!entry) {
      return '';
    }

    const key = translationKeyFor(entry.code);
    if (!te(key)) {
      return entry.text;
    }

    const params = Object.fromEntries(
      Object.entries(entry.params ?? {}).map(([name, value]) => [name, localiseParam(name, value)]),
    );

    if (typeof entry.params?.count === 'number') {
      return t(key, params, entry.params.count);
    }
    return t(key, params);
  };
};
