<script setup lang="ts">
import type { FormulaChangeDto } from '@kosvia/shared';

const props = defineProps<{ change: FormulaChangeDto }>();

const format = useFormat();

const expanded = ref(false);

const hasDetails = computed(
  () => props.change.addedIngredients.length > 0 || props.change.removedIngredients.length > 0,
);
</script>

<template>
  <div class="rounded-xl border border-lavender bg-lavender-soft/40 p-4">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-3 text-left"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <span class="flex items-center gap-2">
        <BaseBadge tone="lavender" size="xs">
          {{ $t('PRODUCT.FORMULA_CHANGE.BADGE') }}
        </BaseBadge>
        <span class="text-sm text-ink-soft">
          {{ $t('PRODUCT.FORMULA_CHANGE.TITLE', { date: format.dateShort(change.changedAt) }) }}
        </span>
      </span>
      <BaseIcon
        name="chevron-down"
        :size="16"
        class="shrink-0 text-ink-faint transition-transform"
        :class="expanded ? 'rotate-180' : ''"
      />
    </button>

    <div v-if="expanded" class="mt-3 space-y-2 text-sm text-ink-soft">
      <p v-if="change.addedIngredients.length">
        <span class="font-medium text-ink">
          {{ $t('PRODUCT.FORMULA_CHANGE.ADDED') }}
        </span>
        {{ change.addedIngredients.join(', ') }}
      </p>
      <p v-if="change.removedIngredients.length">
        <span class="font-medium text-ink">
          {{ $t('PRODUCT.FORMULA_CHANGE.REMOVED') }}
        </span>
        {{ change.removedIngredients.join(', ') }}
      </p>
      <p v-if="!hasDetails && change.isReordered">
        {{ $t('PRODUCT.FORMULA_CHANGE.REORDERED') }}
      </p>
      <p class="text-xs text-ink-muted">
        {{ $t('PRODUCT.FORMULA_CHANGE.DISCLAIMER') }}
      </p>
    </div>
  </div>
</template>
