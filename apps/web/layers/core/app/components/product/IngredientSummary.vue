<script setup lang="ts">
import type { IngredientScoreBreakdownDto, ProductIngredientDto } from '@kosvia/shared';

const MAX_HIGHLIGHTS = 5;
const MAX_TAGS_PER_HIGHLIGHT = 2;

const props = defineProps<{
  ingredients: ProductIngredientDto[];
  breakdown?: IngredientScoreBreakdownDto | null;
  score: number;
}>();

const { t } = useI18n();
const localise = useLocalisedText();

const highlights = computed(() =>
  props.ingredients
    .filter((entry) => entry.ingredient.isActiveIngredient)
    .slice(0, MAX_HIGHLIGHTS)
    .map((entry) => ({
      name: entry.ingredient.commonName ?? entry.ingredient.inciName,
      tags: entry.ingredient.tags.slice(0, MAX_TAGS_PER_HIGHLIGHT),
    })),
);

const stats = computed(() => [
  {
    label: t('PRODUCT.ANALYSIS.ACTIVE_COUNT'),
    value: props.breakdown?.activeCount ?? highlights.value.length,
  },
  {
    label: t('PRODUCT.ANALYSIS.SUPPORTIVE_COUNT'),
    value: props.breakdown?.supportiveCount ?? t('COMMON.NOT_AVAILABLE'),
  },
  { label: t('PRODUCT.ANALYSIS.TOTAL_COUNT'), value: props.ingredients.length },
]);
</script>

<template>
  <BaseCard>
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="font-display text-xl text-ink">{{ $t('PRODUCT.ANALYSIS.TITLE') }}</h2>
        <p class="mt-1 text-sm text-ink-muted">{{ $t('PRODUCT.ANALYSIS.SUBTITLE') }}</p>
      </div>
      <div class="text-right">
        <p class="text-3xl font-semibold tabular-nums text-ink">
          {{ score }}
          <span class="text-lg text-ink-muted">/100</span>
        </p>
        <p class="text-xs text-ink-muted">{{ $t('PRODUCT.ANALYSIS.SCORE') }}</p>
      </div>
    </div>

    <dl class="mt-5 grid grid-cols-3 gap-3">
      <div v-for="stat in stats" :key="stat.label" class="rounded-lg bg-surface-muted px-3 py-2.5">
        <dt class="text-2xs leading-tight text-ink-muted">{{ stat.label }}</dt>
        <dd class="mt-0.5 text-lg font-semibold tabular-nums text-ink">{{ stat.value }}</dd>
      </div>
    </dl>

    <div v-if="highlights.length" class="mt-5">
      <p class="mb-2 text-sm font-medium text-ink-soft">{{ $t('PRODUCT.ANALYSIS.HIGHLIGHTS') }}</p>
      <ul class="space-y-2">
        <li
          v-for="item in highlights"
          :key="item.name"
          class="flex flex-wrap items-center gap-2 text-sm text-ink"
        >
          <span class="font-medium">{{ item.name }}</span>
          <IngredientBadge v-for="tag in item.tags" :key="tag" :tag="tag" />
        </li>
      </ul>
    </div>

    <ul v-if="breakdown?.notes.length" class="mt-5 space-y-2">
      <li
        v-for="note in breakdown.notes"
        :key="note.code"
        class="flex items-start gap-2 rounded-md bg-surface-muted px-3 py-2 text-xs leading-relaxed text-ink-soft"
      >
        <BaseIcon name="info" :size="14" class="mt-px shrink-0 text-ink-faint" />
        <span>{{ localise(note) }}</span>
      </li>
    </ul>
  </BaseCard>
</template>
