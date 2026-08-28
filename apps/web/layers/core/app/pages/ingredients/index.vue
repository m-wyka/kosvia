<script setup lang="ts">
import { INGREDIENT_TAGS, type IngredientDto } from '@kosvia/shared';

const route = useRoute();
const router = useRouter();

const search = ref(String(route.query.q ?? ''));
const tag = computed(() => (route.query.tag as string) ?? '');

watchDebounced(
  search,
  (value) => router.replace({ query: { ...route.query, q: value || undefined } }),
  { debounce: 300 },
);

const { data, pending, error, refresh } = await useApiFetch<IngredientDto[]>(
  () => {
    const params = new URLSearchParams();
    if (route.query.q) params.set('q', String(route.query.q));
    if (route.query.tag) params.set('tag', String(route.query.tag));
    params.set('take', '120');
    return `/ingredients?${params.toString()}`;
  },
  { key: 'ingredient-library', watch: [() => route.query], default: () => [] },
);

function setTag(next: string) {
  router.replace({ query: { ...route.query, tag: tag.value === next ? undefined : next } });
}

useSeo({
  title: 'Cosmetic ingredient library',
  description:
    'Look up any INCI ingredient: what it does, which skin types it suits, and what is worth knowing before you use it.',
  path: '/ingredients',
});
</script>

<template>
  <div class="container-page py-8 sm:py-12">
    <header class="mb-8 max-w-2xl">
      <h1 class="font-display text-3xl text-ink sm:text-4xl">Ingredient library</h1>
      <p class="mt-2 text-base text-ink-muted">
        What each INCI name actually does. We describe function and tolerance —
        we never label an ingredient good or bad.
      </p>
    </header>

    <div class="mb-6 space-y-4">
      <BaseInput v-model="search" placeholder="Search by INCI or common name" class="max-w-md">
        <template #prefix><BaseIcon name="search" :size="16" /></template>
      </BaseInput>

      <div class="hide-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
        <button
          v-for="option in INGREDIENT_TAGS"
          :key="option"
          type="button"
          class="shrink-0 rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors"
          :class="
            tag === option
              ? 'border-ink bg-ink text-ink-inverse'
              : 'border-line text-ink-muted hover:border-line-strong hover:text-ink'
          "
          @click="setTag(option)"
        >{{ option.replace('-', ' ') }}</button>
      </div>
    </div>

    <BaseErrorState v-if="error" @retry="refresh()" />

    <div v-else-if="pending" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <BaseSkeleton v-for="index in 9" :key="index" height="8rem" rounded="var(--radius-xl)" />
    </div>

    <BaseEmptyState
      v-else-if="!data?.length"
      icon="search"
      title="No ingredients matched"
      description="Try a different spelling, or clear the filter."
    />

    <ul v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="ingredient in data" :key="ingredient.id">
        <NuxtLink
          :to="`/ingredients/${ingredient.slug}`"
          class="flex h-full flex-col rounded-xl border border-line bg-surface p-4
                 transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md"
        >
          <p class="text-sm font-semibold text-ink">
            {{ ingredient.commonName ?? ingredient.inciName }}
          </p>
          <p v-if="ingredient.commonName" class="text-xs text-ink-muted">{{ ingredient.inciName }}</p>
          <p class="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-muted">
            {{ ingredient.description }}
          </p>
          <span class="mt-3 flex flex-wrap gap-1">
            <IngredientBadge v-for="entry in ingredient.tags.slice(0, 3)" :key="entry" :tag="entry" />
          </span>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
