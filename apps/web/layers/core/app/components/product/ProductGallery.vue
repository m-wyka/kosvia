<script setup lang="ts">
import type { ProductDto } from '@kosvia/shared';

const VIEWS = ['photo', 'label', 'actives', 'texture'] as const;

type GalleryView = (typeof VIEWS)[number];

defineProps<{ product: ProductDto }>();

const { t } = useI18n();

const THUMB_ICONS = {
  photo: 'scan',
  label: 'tag',
  actives: 'molecule',
  texture: 'droplet',
} as const;

const stage = ref<HTMLElement | null>(null);
const activeIndex = ref(0);
const isZooming = ref(false);
const zoomOrigin = ref('50% 50%');
const lightboxOpen = ref(false);

const viewLabels = computed<Record<GalleryView, string>>(() => ({
  photo: t('PRODUCT.GALLERY.PHOTO'),
  label: t('PRODUCT.GALLERY.LABEL'),
  actives: t('PRODUCT.LIST.ACTIVES'),
  texture: t('PRODUCT.GALLERY.TEXTURE'),
}));

const activeView = computed(() => VIEWS[activeIndex.value] ?? 'photo');
const isFirstView = computed(() => activeIndex.value === 0);
const isLastView = computed(() => activeIndex.value === VIEWS.length - 1);

const goToView = (index: number) => {
  const element = stage.value;
  const clamped = Math.min(Math.max(index, 0), VIEWS.length - 1);
  activeIndex.value = clamped;
  if (!element) {
    return;
  }
  element.scrollTo({ left: clamped * element.clientWidth, behavior: 'smooth' });
};

const goToPreviousView = () => {
  goToView(activeIndex.value - 1);
};

const goToNextView = () => {
  goToView(activeIndex.value + 1);
};

const handleStageScroll = () => {
  const element = stage.value;
  if (!element) {
    return;
  }
  activeIndex.value = Math.round(element.scrollLeft / element.clientWidth);
};

const handlePointerEnter = (event: PointerEvent) => {
  if (event.pointerType !== 'mouse') {
    return;
  }
  isZooming.value = true;
};

const handlePointerMove = (event: PointerEvent) => {
  if (!isZooming.value) {
    return;
  }
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const horizontal = ((event.clientX - bounds.left) / bounds.width) * 100;
  const vertical = ((event.clientY - bounds.top) / bounds.height) * 100;
  zoomOrigin.value = `${horizontal}% ${vertical}%`;
};

const handlePointerLeave = () => {
  isZooming.value = false;
  zoomOrigin.value = '50% 50%';
};

const openLightbox = () => {
  isZooming.value = false;
  lightboxOpen.value = true;
};
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="relative">
      <div
        ref="stage"
        class="hide-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blush"
        tabindex="0"
        role="group"
        :aria-label="$t('PRODUCT.GALLERY.ARIA')"
        @scroll="handleStageScroll"
        @keydown.left.prevent="goToPreviousView"
        @keydown.right.prevent="goToNextView"
      >
        <div v-for="(view, index) in VIEWS" :key="view" class="w-full shrink-0 snap-center">
          <button
            type="button"
            class="block w-full cursor-zoom-in"
            :aria-label="$t('PRODUCT.GALLERY.OPEN', { name: viewLabels[view] })"
            @pointerenter="handlePointerEnter"
            @pointermove="handlePointerMove"
            @pointerleave="handlePointerLeave"
            @click="openLightbox"
          >
            <ProductGallerySlide
              :product="product"
              :view="view"
              :eager="index === 0"
              :zoomed="isZooming && view === 'photo' && index === activeIndex"
              :zoom-origin="zoomOrigin"
            />
          </button>
        </div>
      </div>

      <button
        v-if="!isFirstView"
        type="button"
        class="absolute top-1/2 left-3 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface/90 text-ink-soft shadow-sm transition-colors hover:text-ink sm:flex"
        :aria-label="$t('PRODUCT.GALLERY.PREVIOUS')"
        @click="goToPreviousView"
      >
        <BaseIcon name="chevron-left" :size="18" />
      </button>

      <button
        v-if="!isLastView"
        type="button"
        class="absolute top-1/2 right-3 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface/90 text-ink-soft shadow-sm transition-colors hover:text-ink sm:flex"
        :aria-label="$t('PRODUCT.GALLERY.NEXT')"
        @click="goToNextView"
      >
        <BaseIcon name="chevron-right" :size="18" />
      </button>

      <span
        class="pointer-events-none absolute bottom-3 left-3 rounded-pill bg-ink/75 px-2.5 py-1 text-2xs font-medium text-ink-inverse tabular-nums"
      >
        {{ $t('PRODUCT.GALLERY.COUNTER', { current: activeIndex + 1, total: VIEWS.length }) }}
      </span>
    </div>

    <ul class="grid grid-cols-4 gap-2">
      <li v-for="(view, index) in VIEWS" :key="view">
        <button
          type="button"
          class="flex aspect-square w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border bg-surface transition-colors"
          :class="
            index === activeIndex
              ? 'border-ink text-ink'
              : 'border-line text-ink-muted hover:border-line-strong hover:text-ink-soft'
          "
          :aria-label="$t('PRODUCT.GALLERY.SHOW', { name: viewLabels[view] })"
          :aria-current="index === activeIndex"
          @click="goToView(index)"
        >
          <ProductImage
            v-if="view === 'photo'"
            :src="product.imageUrl"
            :alt="product.name"
            ratio="square"
            fit="contain"
            class="size-full rounded-none border-0"
          />
          <template v-else>
            <BaseIcon :name="THUMB_ICONS[view]" :size="17" />
            <span class="px-1 text-center text-2xs leading-tight">
              {{ viewLabels[view] }}
            </span>
          </template>
        </button>
      </li>
    </ul>

    <BaseModal v-model:open="lightboxOpen" :title="viewLabels[activeView]" size="full">
      <div class="flex flex-col gap-4">
        <ProductGallerySlide :product="product" :view="activeView" />
        <ul class="flex flex-wrap justify-center gap-2">
          <li v-for="(view, index) in VIEWS" :key="view">
            <button
              type="button"
              class="rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors"
              :class="
                index === activeIndex
                  ? 'border-ink bg-ink text-ink-inverse'
                  : 'border-line text-ink-soft hover:border-line-strong hover:text-ink'
              "
              :aria-current="index === activeIndex"
              @click="goToView(index)"
            >
              {{ viewLabels[view] }}
            </button>
          </li>
        </ul>
      </div>
    </BaseModal>
  </div>
</template>
