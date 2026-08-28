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

const LABELS: Record<string, string> = {
  humectant: 'Hydrating',
  emollient: 'Softening',
  occlusive: 'Sealing',
  antioxidant: 'Antioxidant',
  exfoliant: 'Exfoliating',
  fragrance: 'Fragrance',
  preservative: 'Preservative',
  soothing: 'Soothing',
  brightening: 'Brightening',
  'barrier-support': 'Barrier support',
  'uv-filter': 'UV filter',
  surfactant: 'Cleansing',
  solvent: 'Base',
  thickener: 'Texture',
  emulsifier: 'Emulsifier',
  'sebum-regulating': 'Oil balancing',
  retinoid: 'Retinoid',
  peptide: 'Peptide',
  'ph-adjuster': 'pH adjuster',
  colorant: 'Colour',
};

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

const label = computed(() => LABELS[props.tag] ?? props.tag.replace(/-/g, ' '));
const tone = computed(() => TONES[props.tag] ?? 'neutral');
</script>

<template>
  <BaseBadge :tone="tone" :size="size ?? 'xs'">{{ label }}</BaseBadge>
</template>
