<script setup lang="ts">
import type { TaxonomyItemDto } from '@kosvia/shared';

/** `kind` selects the vocabulary the item slugs are translated against. */

/** Multi-select chips for concerns and goals. Big, tappable, keyboard-friendly. */
const model = defineModel<string[]>({ required: true });

const props = defineProps<{
  items: TaxonomyItemDto[];
  columns?: 2 | 3;
  kind: 'concern' | 'goal';
}>();

const vocab = useVocabulary();

const entries = computed(() =>
  props.items.map((item) => ({
    slug: item.slug,
    name: props.kind === 'concern' ? vocab.concern(item.slug, item.name) : vocab.goal(item.slug, item.name),
    hint:
      props.kind === 'concern'
        ? vocab.concernHint(item.slug, item.description)
        : vocab.goalHint(item.slug, item.description),
  })),
);

function toggle(slug: string) {
  model.value = model.value.includes(slug)
    ? model.value.filter((entry) => entry !== slug)
    : [...model.value, slug];
}
</script>

<template>
  <div class="grid gap-2.5 sm:grid-cols-2" :class="columns === 3 && 'lg:grid-cols-3'">
    <button
      v-for="item in entries"
      :key="item.slug"
      type="button"
      class="flex items-start gap-3 rounded-lg border bg-surface p-3.5 text-left
             transition-all duration-[--duration-fast] hover:border-ink-faint"
      :class="model.includes(item.slug) ? 'border-ink bg-surface-muted shadow-xs' : 'border-line'"
      :aria-pressed="model.includes(item.slug)"
      @click="toggle(item.slug)"
    >
      <span
        class="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-xs border transition-colors"
        :class="model.includes(item.slug) ? 'border-ink bg-ink text-white' : 'border-line-strong'"
        aria-hidden="true"
      >
        <BaseIcon v-if="model.includes(item.slug)" name="check" :size="12" :stroke-width="2.4" />
      </span>
      <span class="min-w-0">
        <span class="block text-sm font-medium text-ink">{{ item.name }}</span>
        <span v-if="item.hint" class="mt-0.5 block text-xs leading-snug text-ink-muted">
          {{ item.hint }}
        </span>
      </span>
    </button>
  </div>
</template>
