<script setup lang="ts">
import type { AlternativeGroupDto } from '@kosvia/shared';

const props = defineProps<{ slug: string }>();

const { data, pending, error, refresh } = await useApiFetch<AlternativeGroupDto[]>(
  () => `/products/${props.slug}/alternatives`,
  { key: `alternatives-${props.slug}`, lazy: true, default: () => [] },
);

const active = ref<string | null>(null);
watchEffect(() => {
  if (!active.value && data.value?.length) active.value = data.value[0]!.kind;
});

const groups = computed(() => data.value ?? []);
const current = computed(
  () => groups.value.find((group) => group.kind === active.value) ?? groups.value[0] ?? null,
);
</script>

<template>
  <section>
    <div class="mb-4">
      <h2 class="font-display text-2xl text-ink">{{ $t('PRODUCT.ALTERNATIVES.TITLE') }}</h2>
      <p class="mt-1 text-sm text-ink-muted">{{ $t('PRODUCT.ALTERNATIVES.SUBTITLE') }}</p>
    </div>

    <BaseErrorState v-if="error" compact @retry="refresh()" />

    <div v-else-if="pending" class="space-y-4">
      <BaseSkeleton height="2.25rem" width="60%" rounded="var(--radius-pill)" />
      <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <ProductCardSkeleton v-for="index in 4" :key="index" />
      </div>
    </div>

    <BaseEmptyState
      v-else-if="!groups.length"
      icon="compare"
      :title="$t('PRODUCT.ALTERNATIVES.EMPTY_TITLE')"
      :description="$t('PRODUCT.ALTERNATIVES.EMPTY_BODY')"
      compact
    />

    <template v-else>
      <BaseTabs
        v-if="active"
        v-model="active"
        :tabs="
          groups.map((group) => ({
            value: group.kind,
            label: $t(`PRODUCT.ALTERNATIVES.KIND.${group.kind.replace(/-/g, '_').toUpperCase()}`),
            count: group.products.length,
          }))
        "
      />

      <p v-if="current" class="mt-3 text-sm text-ink-muted">{{ current.description }}</p>

      <div v-if="current" class="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <ProductCard
          v-for="product in current.products"
          :key="product.id"
          :product="product"
          :note="product.alternativeReason"
          show-compare
        />
      </div>
    </template>
  </section>
</template>
