<script setup lang="ts">
const { t } = useI18n();

const rows = computed(() => [
  { name: 'Sodium Hyaluronate', inci: t('LANDING.INGREDIENTS.DEMO_ROW_1'), tags: ['humectant'] },
  { name: 'Niacinamide', inci: t('LANDING.INGREDIENTS.DEMO_ROW_2'), tags: ['brightening', 'barrier-support'] },
  { name: 'Ceramide NP', inci: t('LANDING.INGREDIENTS.DEMO_ROW_3'), tags: ['barrier-support', 'emollient'] },
  { name: 'Parfum', inci: t('LANDING.INGREDIENTS.DEMO_ROW_4'), tags: ['fragrance'] },
]);
</script>

<template>
  <BaseCard :padded="false" class="overflow-hidden shadow-md">
    <div class="border-b border-line px-5 py-4">
      <p class="text-sm font-semibold text-ink">{{ $t('LANDING.INGREDIENTS.DEMO_TITLE') }}</p>
      <p class="text-xs text-ink-muted">{{ $t('LANDING.INGREDIENTS.DEMO_SUBTITLE') }}</p>
    </div>
    <ul class="divide-y divide-line">
      <li v-for="(row, index) in rows" :key="row.name" class="flex items-start gap-3 px-5 py-3.5">
        <span class="mt-0.5 w-5 shrink-0 text-2xs tabular-nums text-ink-faint">{{ index + 1 }}</span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium text-ink">{{ row.name }}</span>
          <span class="block text-xs text-ink-muted">{{ row.inci }}</span>
        </span>
        <span class="flex shrink-0 flex-wrap justify-end gap-1">
          <IngredientBadge v-for="tag in row.tags" :key="tag" :tag="tag" />
        </span>
      </li>
    </ul>
    <p class="border-t border-line bg-surface-muted px-5 py-3 text-xs text-ink-muted">
      {{ $t('LANDING.INGREDIENTS.DEMO_NOTE') }}
    </p>
  </BaseCard>
</template>
