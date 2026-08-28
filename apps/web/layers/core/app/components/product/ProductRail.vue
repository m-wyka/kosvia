<script setup lang="ts">
import type { ProductSummaryDto } from "@kosvia/shared";

/**
 * A horizontally scrolling product row.
 *
 * Deliberately a scroll container rather than a carousel library: it is
 * keyboard- and touch-native, needs no JavaScript to work, and the arrow
 * buttons are a progressive enhancement on top.
 */
const props = defineProps<{
  title: string;
  subtitle?: string | null;
  products: ProductSummaryDto[];
  seeAllTo?: string;
  loading?: boolean;
}>();

const track = ref<HTMLElement | null>(null);
const atStart = ref(true);
const atEnd = ref(false);

function updateEdges() {
  const el = track.value;
  if (!el) {return;}
  atStart.value = el.scrollLeft <= 4;
  atEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
}

function scrollBy(direction: -1 | 1) {
  track.value?.scrollBy({
    left: direction * Math.round(track.value.clientWidth * 0.8),
    behavior: "smooth",
  });
}

onMounted(updateEdges);
watch(
  () => props.products,
  () => nextTick(updateEdges),
);
</script>

<template>
  <section class="min-w-0">
    <header class="mb-3.5 flex items-end justify-between gap-4 sm:mb-4">
      <div class="min-w-0">
        <h2 class="font-display text-xl text-ink sm:text-2xl">{{ title }}</h2>
        <p v-if="subtitle" class="mt-1 text-sm text-ink-muted">
          {{ subtitle }}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <NuxtLinkLocale
          v-if="seeAllTo"
          :to="seeAllTo"
          class="text-sm font-medium text-ink-soft underline-offset-4 transition-colors hover:text-ink hover:underline"
          >{{ $t("COMMON.SEE_ALL") }}</NuxtLinkLocale
        >
        <div class="hidden gap-1 sm:flex">
          <button
            type="button"
            class="flex size-8 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:border-line-strong hover:bg-surface disabled:opacity-35"
            :disabled="atStart"
            :aria-label="$t('PRODUCT.SCROLL_LEFT')"
            @click="scrollBy(-1)"
          >
            <BaseIcon name="chevron-left" :size="16" />
          </button>
          <button
            type="button"
            class="flex size-8 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:border-line-strong hover:bg-surface disabled:opacity-35"
            :disabled="atEnd"
            :aria-label="$t('PRODUCT.SCROLL_RIGHT')"
            @click="scrollBy(1)"
          >
            <BaseIcon name="chevron-right" :size="16" />
          </button>
        </div>
      </div>
    </header>

    <div
      ref="track"
      class="hide-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 sm:mx-0 sm:gap-4 sm:px-0"
      @scroll.passive="updateEdges"
    >
      <template v-if="loading">
        <div
          v-for="index in 5"
          :key="`s-${index}`"
          class="w-54 shrink-0 sm:w-60"
        >
          <ProductCardSkeleton />
        </div>
      </template>
      <ProductCard
        v-for="product in products"
        v-else
        :key="product.id"
        :product="product"
        variant="rail"
        class="snap-start"
      />
    </div>
  </section>
</template>
