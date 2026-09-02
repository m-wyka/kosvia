import { beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { resetTestGlobals } from '@@/tests/setup';
import BaseToaster from '@@/layers/core/app/components/base/BaseToaster.vue';

declare const useToast: typeof import('@@/layers/core/app/composables/useToast').useToast;

describe('BaseToaster', () => {
  beforeEach(() => {
    resetTestGlobals();
  });

  it('stacks every toast raised in quick succession', async () => {
    const component = mount(BaseToaster);
    const { success } = useToast();

    success('Saved Ceramide Barrier Cream');
    success('Saved Gentle Cleansing Gel');
    success('Saved Daily Mineral SPF');
    await nextTick();

    const text = component.text();
    expect(text).toContain('Ceramide Barrier Cream');
    expect(text).toContain('Gentle Cleansing Gel');
    expect(text).toContain('Daily Mineral SPF');
  });
});
