const DEFAULT_CURRENCY = 'PLN';
const DEFAULT_VOLUME_UNIT = 'ml';

export const useFormat = () => {
  const { locale, t } = useI18n();

  const intlLocale = computed(() => (locale.value === 'pl' ? 'pl-PL' : 'en-GB'));

  const numberFormat = computed(
    () =>
      new Intl.NumberFormat(intlLocale.value, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
  );

  const currencyUnit = computed(() => (locale.value === 'pl' ? 'zł' : DEFAULT_CURRENCY));

  const price = (value: number | null | undefined, currency?: string): string => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return t('COMMON.NOT_AVAILABLE');
    }
    const unit = currency && currency !== DEFAULT_CURRENCY ? currency : currencyUnit.value;
    return `${numberFormat.value.format(value)} ${unit}`;
  };

  const pricePer100 = (
    value: number | null | undefined,
    unit: string | null | undefined,
  ): string | null => {
    if (value === null || value === undefined) {
      return null;
    }
    return t('PRODUCT.PER_HUNDRED', { price: price(value), unit: unit ?? DEFAULT_VOLUME_UNIT });
  };

  const toDate = (value: string | Date): Date => {
    return typeof value === 'string' ? new Date(value) : value;
  };

  const date = (value: string | Date): string => {
    return new Intl.DateTimeFormat(intlLocale.value, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(toDate(value));
  };

  const dateShort = (value: string | Date): string => {
    return new Intl.DateTimeFormat(intlLocale.value, {
      day: 'numeric',
      month: 'short',
    }).format(toDate(value));
  };

  const monthsSince = (value: string | Date): number => {
    const start = toDate(value);
    const now = new Date();
    const wholeMonths =
      (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    return now.getDate() >= start.getDate() ? wholeMonths : wholeMonths - 1;
  };

  const addMonths = (value: string | Date, months: number): Date => {
    const result = toDate(value);
    return new Date(result.getFullYear(), result.getMonth() + months, result.getDate());
  };

  return { price, pricePer100, date, dateShort, monthsSince, addMonths, currencyUnit };
};
