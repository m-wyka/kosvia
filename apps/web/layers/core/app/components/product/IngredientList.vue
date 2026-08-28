<script setup lang="ts">
import type { ProductIngredientDto } from '@kosvia/shared';

/**
 * The INCI list, grouped by what each ingredient is doing.
 *
 * The full ordered list still matters (position implies concentration) so it
 * stays available underneath — grouping is a reading aid, not a replacement.
 */
const props = defineProps<{ ingredients: ProductIngredientDto[] }>();

/** Group keys map onto PRODUCT.LIST.* translations. */
const GROUPS: Array<{ key: string; tags: string[] }> = [
  { key: 'ACTIVES', tags: ['retinoid', 'exfoliant', 'brightening', 'peptide', 'uv-filter'] },
  { key: 'HYDRATION', tags: ['humectant', 'emollient', 'occlusive', 'barrier-support'] },
  { key: 'SOOTHING', tags: ['soothing', 'antioxidant'] },
  { key: 'FRAGRANCE', tags: ['fragrance'] },
  {
    key: 'BASE',
    tags: ['solvent', 'thickener', 'emulsifier', 'preservative', 'ph-adjuster', 'surfactant', 'colorant'],
  },
];

const grouped = computed(() => {
  const used = new Set<string>();
  const result = GROUPS.map((group) => {
    const members = props.ingredients.filter((entry) => {
      if (used.has(entry.ingredient.id)) return false;
      const match =
        (group.key === 'ACTIVES' && entry.ingredient.isActiveIngredient) ||
        entry.ingredient.tags.some((tag) => group.tags.includes(tag));
      if (match) used.add(entry.ingredient.id);
      return match;
    });
    return { ...group, members };
  }).filter((group) => group.members.length > 0);

  const rest = props.ingredients.filter((entry) => !used.has(entry.ingredient.id));
  if (rest.length) {
    result.push({ key: 'OTHER', tags: [], members: rest });
  }
  return result;
});

const expanded = ref<string | null>(null);
const showFullList = ref(false);

const fullList = computed(() =>
  [...props.ingredients].sort((a, b) => a.position - b.position).map((entry) => entry.ingredient.inciName),
);
</script>

<template>
  <div class="space-y-6">
    <section v-for="group in grouped" :key="group.key">
      <h3 class="text-sm font-semibold text-ink">{{ $t(`PRODUCT.LIST.${group.key}`) }}</h3>
      <p class="mt-0.5 text-xs text-ink-muted">{{ $t(`PRODUCT.LIST.${group.key}_BODY`) }}</p>

      <ul class="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        <li v-for="entry in group.members" :key="entry.ingredient.id">
          <button
            type="button"
            class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted"
            :aria-expanded="expanded === entry.ingredient.id"
            @click="expanded = expanded === entry.ingredient.id ? null : entry.ingredient.id"
          >
            <span class="mt-0.5 w-6 shrink-0 text-2xs tabular-nums text-ink-faint">
              {{ entry.position }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-medium text-ink">
                {{ entry.ingredient.commonName ?? entry.ingredient.inciName }}
              </span>
              <span
                v-if="entry.ingredient.commonName"
                class="block text-xs text-ink-muted"
              >{{ entry.ingredient.inciName }}</span>
              <span class="mt-1.5 flex flex-wrap gap-1">
                <IngredientBadge
                  v-for="tag in entry.ingredient.tags.slice(0, 3)"
                  :key="tag"
                  :tag="tag"
                />
              </span>
            </span>
            <BaseIcon
              name="chevron-down"
              :size="16"
              class="mt-1 shrink-0 text-ink-faint transition-transform duration-[--duration-fast]"
              :class="expanded === entry.ingredient.id && 'rotate-180'"
            />
          </button>

          <div
            v-if="expanded === entry.ingredient.id"
            class="animate-fade-up border-t border-line bg-surface-muted px-4 py-3.5 pl-13"
          >
            <p v-if="entry.ingredient.description" class="text-sm leading-relaxed text-ink-soft">
              {{ entry.ingredient.description }}
            </p>
            <p
              v-if="entry.ingredient.concerns"
              class="mt-2.5 flex items-start gap-2 rounded-md bg-caution-soft px-3 py-2 text-xs text-caution"
            >
              <BaseIcon name="info" :size="14" class="mt-px shrink-0" />
              <span>{{ entry.ingredient.concerns }}</span>
            </p>
            <NuxtLinkLocale
              :to="`/ingredients/${entry.ingredient.slug}`"
              class="mt-3 inline-flex items-center gap-1 text-xs font-medium text-ink-soft underline-offset-4 hover:underline"
            >
              {{ $t('PRODUCT.LIST.MORE_ABOUT') }}
              <BaseIcon name="chevron-right" :size="12" />
            </NuxtLinkLocale>
          </div>
        </li>
      </ul>
    </section>

    <div class="rounded-lg border border-line bg-surface-muted p-4">
      <button
        type="button"
        class="flex w-full items-center justify-between text-sm font-medium text-ink-soft"
        :aria-expanded="showFullList"
        @click="showFullList = !showFullList"
      >
        {{ $t('PRODUCT.LIST.FULL_LIST') }}
        <BaseIcon
          name="chevron-down"
          :size="16"
          class="transition-transform"
          :class="showFullList && 'rotate-180'"
        />
      </button>
      <p v-if="showFullList" class="mt-3 text-xs leading-relaxed break-words text-ink-muted">
        {{ fullList.join(', ') }}
      </p>
    </div>
  </div>
</template>
