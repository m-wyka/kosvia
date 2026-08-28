/**
 * Locale-aware formatting.
 *
 * `formatPrice` in @kosvia/shared is the API's own formatter and stays English.
 * The UI needs the reader's conventions instead: "59.99 PLN" in English,
 * "59,99 zł" in Polish.
 */
export function useFormat() {
  const { locale, t } = useI18n();

  const numberFormat = computed(
    () =>
      new Intl.NumberFormat(locale.value === 'pl' ? 'pl-PL' : 'en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
  );

  const currencyUnit = computed(() => (locale.value === 'pl' ? 'zł' : 'PLN'));

  function price(value: number | null | undefined, currency?: string): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return t('COMMON.NOT_AVAILABLE');
    }
    const unit = currency && currency !== 'PLN' ? currency : currencyUnit.value;
    return `${numberFormat.value.format(value)} ${unit}`;
  }

  /** Price per 100 ml/g — the only fair comparison across different sizes. */
  function pricePer100(
    value: number | null | undefined,
    unit: string | null | undefined,
  ): string | null {
    if (value === null || value === undefined) return null;
    return t('PRODUCT.PER_HUNDRED', { price: price(value), unit: unit ?? 'ml' });
  }

  function date(value: string | Date): string {
    return new Intl.DateTimeFormat(locale.value === 'pl' ? 'pl-PL' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(typeof value === 'string' ? new Date(value) : value);
  }

  function dateShort(value: string | Date): string {
    return new Intl.DateTimeFormat(locale.value === 'pl' ? 'pl-PL' : 'en-GB', {
      day: 'numeric',
      month: 'short',
    }).format(typeof value === 'string' ? new Date(value) : value);
  }

  return { price, pricePer100, date, dateShort, currencyUnit };
}
