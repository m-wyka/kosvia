import type { ProductSummaryDto } from '@kosvia/shared';

/**
 * The compare button, everywhere it appears. A click on a full tray never
 * falls through silently: it says which ceiling was hit and offers the way out.
 */
export const useCompareAction = () => {
  const { maxItems } = storeToRefs(useCompareStore());
  const { toggle } = useCompareStore();
  const { isPremium } = storeToRefs(useAuthStore());
  const toast = useToast();
  const { t } = useI18n();

  const announceTrayIsFull = (): void => {
    const limit = maxItems.value;
    if (isPremium.value) {
      toast.notify(t('COMPARE.TRAY.FULL_PREMIUM', { limit }, limit), {
        label: t('COMPARE.TRAY.COMPARE'),
        to: '/compare',
      });
      return;
    }
    toast.notify(t('COMPARE.TRAY.FULL_FREE', { limit }, limit), {
      label: t('PREMIUM.UNLOCK'),
      to: '/pricing',
    });
  };

  const handleCompareClick = (product: ProductSummaryDto): void => {
    if (toggle(product) === 'full') {
      announceTrayIsFull();
    }
  };

  return { handleCompareClick };
};
