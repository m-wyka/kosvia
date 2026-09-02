import { beforeEach, describe, expect, it } from 'vitest';
import type { ProductSummaryDto, ShelfItemDto } from '@kosvia/shared';
import { resetTestGlobals, setApiHandler, setSignedIn } from '@@/tests/setup';
import { useShelf } from '@@/layers/core/app/composables/useShelf';

declare const useToast: typeof import('@@/layers/core/app/composables/useToast').useToast;

const product = (id: string, name: string): ProductSummaryDto =>
  ({ id, name, slug: id }) as ProductSummaryDto;

const shelfItem = (product: ProductSummaryDto, isFavorite: boolean): ShelfItemDto =>
  ({ id: `item-${product.id}`, product, isFavorite }) as ShelfItemDto;

const fakeShelf = (initial: ShelfItemDto[] = []) => {
  const items = [...initial];
  setApiHandler((url, options) => {
    if (url === '/shelf' && options?.method === 'POST') {
      const body = options.body as { productId: string; isFavorite?: boolean };
      items.push(shelfItem(product(body.productId, body.productId), body.isFavorite ?? false));
      return Promise.resolve(null);
    }
    if (options?.method === 'PATCH') {
      const target = items.find((item) => url.endsWith(item.id));
      if (target) {
        target.isFavorite = (options.body as { isFavorite: boolean }).isFavorite;
      }
      return Promise.resolve(null);
    }
    return Promise.resolve(items);
  });
  return items;
};

describe('useShelf.toggleFavorite', () => {
  beforeEach(() => {
    resetTestGlobals();
    setSignedIn(true);
  });

  it('announces every product saved in a row, not just the first', async () => {
    fakeShelf();
    const { toggleFavorite } = useShelf();

    await toggleFavorite(product('p1', 'Ceramide Cream'));
    await toggleFavorite(product('p2', 'Cleansing Gel'));
    await toggleFavorite(product('p3', 'Mineral SPF'));

    const messages = useToast().toasts.value.map((toast) => toast.message);
    expect(messages).toHaveLength(3);
  });

  it('confirms favouriting a product that is already on the shelf', async () => {
    const existing = product('p9', 'Barrier Balm');
    fakeShelf([shelfItem(existing, false)]);
    const { refresh, toggleFavorite } = useShelf();
    await refresh(true);

    await toggleFavorite(existing);

    expect(useToast().toasts.value.map((toast) => toast.message)).toEqual([
      'Barrier Balm added to favourites',
    ]);
  });

  it('confirms removing a favourite too', async () => {
    const existing = product('p9', 'Barrier Balm');
    fakeShelf([shelfItem(existing, true)]);
    const { refresh, toggleFavorite } = useShelf();
    await refresh(true);

    await toggleFavorite(existing);

    expect(useToast().toasts.value.map((toast) => toast.message)).toEqual([
      'Barrier Balm removed from favourites',
    ]);
  });
});
