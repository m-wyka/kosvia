<script setup lang="ts">
import type { IngredientTag } from '@kosvia/shared';

/**
 * Ingredient function tags.
 *
 * The vocabulary is deliberately descriptive — "fragrance", "exfoliant",
 * "preservative" — never evaluative. Nothing in Kosvia labels an ingredient
 * good or bad; we say what it does and let the reader decide.
 */
const props = defineProps<{ tag: IngredientTag | string; size?: 'xs' | 'sm' }>();

const vocab = useVocabulary();

const TONES: Record<string, 'sage' | 'lavender' | 'peach' | 'blush' | 'sand' | 'neutral' | 'info'> = {
  humectant: 'info',
  emollient: 'sand',
  occlusive: 'sand',
  antioxidant: 'sage',
  exfoliant: 'peach',
  fragrance: 'blush',
  soothing: 'sage',
  brightening: 'lavender',
  'barrier-support': 'sage',
  'uv-filter': 'peach',
  retinoid: 'peach',
  peptide: 'lavender',
  'sebum-regulating': 'info',
};

const label = computed(() => vocab.tag(props.tag));
const tone = computed(() => TONES[props.tag] ?? 'neutral');
</script>

<template>
  <BaseBadge :tone="tone" :size="size ?? 'xs'">{{ label }}</BaseBadge>
</template>
