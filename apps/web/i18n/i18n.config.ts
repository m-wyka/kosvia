const POLISH_FORM_COUNT = 3;

const isPolishFewForm = (count: number): boolean => {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  const endsInTwoToFour = lastDigit >= 2 && lastDigit <= 4;
  const isTeen = lastTwoDigits >= 12 && lastTwoDigits <= 14;
  return endsInTwoToFour && !isTeen;
};

const polishPluralIndex = (choice: number, choicesLength: number): number => {
  if (choicesLength < POLISH_FORM_COUNT) {
    return choice === 1 ? 0 : 1;
  }
  if (choice === 1) {
    return 0;
  }
  return isPolishFewForm(choice) ? 1 : 2;
};

export default defineI18nConfig(() => ({
  legacy: false,
  fallbackLocale: 'en',
  pluralRules: {
    pl: polishPluralIndex,
  },
}));
