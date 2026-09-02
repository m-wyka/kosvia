import { beforeEach, describe, expect, it } from 'vitest';
import type { ProductSummaryDto } from '@kosvia/shared';
import { resetTestGlobals, setPremium } from '@@/tests/setup';
import { useCompareAction } from '@@/layers/core/app/composables/useCompareAction';

declare const useToast: typeof import('@@/layers/core/app/composables/useToast').useToast;

const product = (id: string): ProductSummaryDto =>
  ({ id, name: id, slug: id }) as ProductSummaryDto;

const fillTray = (count: number): void => {
  const { handleCompareClick } = useCompareAction();
  for (let index = 0; index < count; index += 1) {
    handleCompareClick(product(`product-${index}`));
  }
};

describe('useCompareAction', () => {
  beforeEach(() => {
    resetTestGlobals();
  });

  it('adds without interrupting while the tray has room', () => {
    const { handleCompareClick } = useCompareAction();
    handleCompareClick(product('first'));
    expect(useToast().toasts.value).toHaveLength(0);
  });

  it('never leaves a click on a full free tray unanswered', () => {
    fillTray(2);
    const { handleCompareClick } = useCompareAction();
    handleCompareClick(product('third'));

    const toasts = useToast().toasts.value;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.message).toContain('2');
    expect(toasts[0]!.action).toEqual({ label: 'Unlock Premium', to: '/pricing' });
  });

  it('sends a premium viewer to the comparison, since there is nothing left to sell', () => {
    setPremium(true);
    fillTray(4);
    const { handleCompareClick } = useCompareAction();
    handleCompareClick(product('fifth'));

    const toasts = useToast().toasts.value;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.message).toContain('4');
    expect(toasts[0]!.action?.to).toBe('/compare');
  });

  it('still removes a product that is already in a full tray', () => {
    fillTray(2);
    const { handleCompareClick } = useCompareAction();
    handleCompareClick(product('product-0'));

    expect(useToast().toasts.value).toHaveLength(0);
  });
});
