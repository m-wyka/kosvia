/**
 * Runtime vue-i18n options.
 *
 * Polish has three plural forms where English has two, so "1 produkt /
 * 2 produkty / 5 produktów" needs a rule of its own — the default
 * `count === 1 ? 0 : 1` would render "5 produkty".
 */
export default defineI18nConfig(() => ({
  legacy: false,
  fallbackLocale: 'en',
  pluralRules: {
    /**
     * CLDR plural categories for Polish:
     *   one  — exactly 1
     *   few  — ends in 2-4, but not 12-14
     *   many — everything else, including 0
     */
    pl: (choice: number, choicesLength: number): number => {
      if (choicesLength < 3) return choice === 1 ? 0 : 1;
      if (choice === 1) return 0;

      const lastDigit = choice % 10;
      const lastTwoDigits = choice % 100;
      const few = lastDigit >= 2 && lastDigit <= 4 && !(lastTwoDigits >= 12 && lastTwoDigits <= 14);

      return few ? 1 : 2;
    },
  },
}));
