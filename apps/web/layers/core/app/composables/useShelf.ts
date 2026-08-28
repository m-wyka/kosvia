import type { ProductSummaryDto, ShelfItemDto } from '@kosvia/shared';

/**
 * Shelf actions shared by the product page, the cards and the shelf itself.
 *
 * Kept as a composable rather than a store because the shelf is server state:
 * the source of truth is the API, and every mutation refetches rather than
 * guessing at the new list.
 */
export function useShelf() {
  const api = useApi();
  const auth = useAuthStore();
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

  async function refresh(force = false): Promise<void> {
    if (!auth.isAuthenticated) {
      items.value = [];
      return;
    }
    if (loaded.value && !force) return;
    items.value = await api<ShelfItemDto[]>('/shelf');
    loaded.value = true;
  }

  function has(productId: string): boolean {
    return productIds.value.includes(productId);
  }

  async function add(product: ProductSummaryDto): Promise<void> {
    if (!requireAuth()) return;
    busy.value = true;
    try {
      await api('/shelf', { method: 'POST', body: { productId: product.id } });
      await refresh(true);
      toast.success(t('SHELF.ADDED', { name: product.name }), {
        label: t('SHELF.VIEW_SHELF'),
        to: '/shelf',
      });
    } catch (error) {
      toast.error(message(error));
    } finally {
      busy.value = false;
    }
  }

  async function remove(itemId: string): Promise<void> {
    busy.value = true;
    try {
      await api(`/shelf/${itemId}`, { method: 'DELETE' });
      await refresh(true);
    } catch (error) {
      toast.error(message(error));
    } finally {
      busy.value = false;
    }
  }

  /** Adds the product first if it is not on the shelf yet — favouriting implies owning. */
  async function toggleFavorite(product: ProductSummaryDto): Promise<void> {
    if (!requireAuth()) return;
    const existing = items.value.find((item) => item.product.id === product.id);
    busy.value = true;
    try {
      if (!existing) {
        await api('/shelf', { method: 'POST', body: { productId: product.id, isFavorite: true } });
        toast.success(t('SHELF.SAVED', { name: product.name }), {
          label: t('SHELF.VIEW_SHELF'),
          to: '/shelf',
        });
      } else {
        await api(`/shelf/${existing.id}`, { method: 'PATCH', body: { isFavorite: !existing.isFavorite } });
      }
      await refresh(true);
    } catch (error) {
      toast.error(message(error));
    } finally {
      busy.value = false;
    }
  }

  function requireAuth(): boolean {
    if (auth.isAuthenticated) return true;
    toast.notify(t('SHELF.SIGN_IN_PROMPT'), { label: t('COMMON.SIGN_IN'), to: '/login' });
    return false;
  }

  return { items, busy, productIds, favoriteIds, refresh, has, add, remove, toggleFavorite };
}
