import type { ProductSummaryDto, ShelfItemDto } from '@kosvia/shared';

export const useShelf = () => {
  const api = useApi();
  const { isAuthenticated } = storeToRefs(useAuthStore());
  const toast = useToast();
  const message = useApiMessage();
  const { t } = useI18n();

  const items = useState<ShelfItemDto[]>('shelf-items', () => []);
  const loaded = useState('shelf-loaded', () => false);
  const busy = ref(false);

  const productIds = computed(() => items.value.map((item) => item.product.id));
  const favoriteIds = computed(() =>
    items.value.filter((item) => item.isFavorite).map((item) => item.product.id),
  );

  const refresh = async (force = false): Promise<void> => {
    if (!isAuthenticated.value) {
      items.value = [];
      return;
    }
    if (loaded.value && !force) {
      return;
    }
    items.value = await api<ShelfItemDto[]>('/shelf');
    loaded.value = true;
  };

  const has = (productId: string): boolean => {
    return productIds.value.includes(productId);
  };

  const requireAuth = (): boolean => {
    if (isAuthenticated.value) {
      return true;
    }
    toast.notify(t('SHELF.SIGN_IN_PROMPT'), { label: t('COMMON.SIGN_IN'), to: '/login' });
    return false;
  };

  const runMutation = async (mutation: () => Promise<unknown>): Promise<boolean> => {
    busy.value = true;
    try {
      await mutation();
      await refresh(true);
      return true;
    } catch (error) {
      toast.error(message(error));
      return false;
    } finally {
      busy.value = false;
    }
  };

  const announceSaved = (translationKey: string, product: ProductSummaryDto): void => {
    toast.success(t(translationKey, { name: product.name }), {
      label: t('SHELF.VIEW_SHELF'),
      to: '/shelf',
    });
  };

  const add = async (product: ProductSummaryDto): Promise<void> => {
    if (!requireAuth()) {
      return;
    }
    const added = await runMutation(() =>
      api('/shelf', { method: 'POST', body: { productId: product.id } }),
    );
    if (added) {
      announceSaved('SHELF.ADDED', product);
    }
  };

  const remove = async (itemId: string): Promise<void> => {
    await runMutation(() => api(`/shelf/${itemId}`, { method: 'DELETE' }));
  };

  const toggleFavorite = async (product: ProductSummaryDto): Promise<void> => {
    if (!requireAuth()) {
      return;
    }
    const existing = items.value.find((item) => item.product.id === product.id);
    if (existing) {
      const becomesFavorite = !existing.isFavorite;
      const updated = await runMutation(() =>
        api(`/shelf/${existing.id}`, {
          method: 'PATCH',
          body: { isFavorite: becomesFavorite },
        }),
      );
      if (!updated) {
        return;
      }
      if (becomesFavorite) {
        announceSaved('SHELF.FAVORITED', product);
        return;
      }
      toast.notify(t('SHELF.UNFAVORITED', { name: product.name }));
      return;
    }
    const saved = await runMutation(() =>
      api('/shelf', { method: 'POST', body: { productId: product.id, isFavorite: true } }),
    );
    if (saved) {
      announceSaved('SHELF.SAVED', product);
    }
  };

  return { items, busy, productIds, favoriteIds, refresh, has, add, remove, toggleFavorite };
};
