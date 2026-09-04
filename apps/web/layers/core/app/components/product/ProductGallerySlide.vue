<script setup lang="ts">
import type { ProductDto } from '@kosvia/shared';

type GalleryView = 'photo' | 'label' | 'actives' | 'texture';

const props = withDefaults(
  defineProps<{
    product: ProductDto;
    view: GalleryView;
    eager?: boolean;
    zoomed?: boolean;
    zoomOrigin?: string;
  }>(),
  { eager: false, zoomed: false, zoomOrigin: '50% 50%' },
);

const { t } = useI18n();
const vocab = useVocabulary();

const INCI_PREVIEW_COUNT = 16;
const TEXTURE_PALETTES = [
  ['--color-blush-soft', '--color-peach-soft'],
  ['--color-lavender-soft', '--color-blush-soft'],
  ['--color-sage-soft', '--color-sand-soft'],
  ['--color-peach-soft', '--color-sand-soft'],
  ['--color-lavender-soft', '--color-sage-soft'],
];

const fullName = computed(() => `${props.product.brand.name} ${props.product.name}`);

const categoryName = computed(() =>
  vocab.category(props.product.category.slug, props.product.category.name),
);

const inciPreview = computed(() =>
  props.product.ingredients.slice(0, INCI_PREVIEW_COUNT).map((entry) => entry.ingredient),
);

const hiddenInciCount = computed(() =>
  Math.max(props.product.ingredients.length - inciPreview.value.length, 0),
);

const inciLine = computed(() => {
  const names = inciPreview.value.map((ingredient) => ingredient.inciName).join(', ');
  if (!hiddenInciCount.value) {
    return names;
  }
  return `${names}${t('PRODUCT.GALLERY.MORE_INCI', { count: hiddenInciCount.value })}`;
});

const activeIngredients = computed(() =>
  props.product.ingredients
    .filter((entry) => entry.ingredient.isActiveIngredient)
    .map((entry) => entry.ingredient),
);

const textureStyle = computed(() => {
  const seed = [...props.product.slug].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const [first, second] = TEXTURE_PALETTES[seed % TEXTURE_PALETTES.length]!;
  return {
    backgroundImage: [
      `radial-gradient(circle at 28% 24%, var(${first}), transparent 58%)`,
      `radial-gradient(circle at 74% 68%, var(${second}), transparent 62%)`,
    ].join(', '),
  };
});

const imageStyle = computed(() => ({
  transform: props.zoomed ? 'scale(2.25)' : undefined,
  transformOrigin: props.zoomOrigin,
}));
</script>

<template>
  <div class="relative size-full overflow-hidden rounded-xl border border-line bg-surface">
    <ProductImage
      v-if="view === 'photo'"
      :src="product.imageUrl"
      :alt="fullName"
      ratio="square"
      fit="contain"
      :eager="eager"
      sizes="(max-width: 1024px) 100vw, 30rem"
      class="size-full rounded-none transition-transform duration-base ease-out-soft"
      :style="imageStyle"
    />

    <div v-else-if="view === 'label'" class="flex aspect-square flex-col bg-canvas-deep p-5 sm:p-6">
      <p class="text-2xs font-medium tracking-widest text-ink-muted uppercase">
        {{ product.brand.name }}
      </p>
      <p class="mt-1 font-display text-lg leading-tight text-ink">
        {{ product.name }}
      </p>
      <p v-if="product.volume" class="mt-0.5 text-xs text-ink-muted">
        {{ formatVolume(product.volume, product.volumeUnit) }}
      </p>

      <p class="mt-5 text-2xs font-medium tracking-widest text-ink-muted uppercase">
        {{ $t('PRODUCT.GALLERY.INCI') }}
      </p>
      <p
        class="mt-2 min-h-0 flex-1 overflow-hidden font-mono text-2xs leading-relaxed text-ink-soft"
      >
        {{ inciLine }}
      </p>
    </div>

    <div
      v-else-if="view === 'actives'"
      class="flex aspect-square flex-col p-5 sm:p-6"
      :style="textureStyle"
    >
      <p class="text-2xs font-medium tracking-widest text-ink-muted uppercase">
        {{ $t('PRODUCT.LIST.ACTIVES') }}
      </p>
      <p class="mt-1 font-display text-xl leading-tight text-ink">
        {{
          $t(
            'PRODUCT.GALLERY.ACTIVES_COUNT',
            { count: activeIngredients.length },
            activeIngredients.length,
          )
        }}
      </p>

      <ul
        v-if="activeIngredients.length"
        class="mt-4 flex flex-wrap content-start gap-1.5 overflow-hidden"
      >
        <li
          v-for="ingredient in activeIngredients"
          :key="ingredient.id"
          class="rounded-pill border border-line bg-surface/80 px-2.5 py-1 text-xs text-ink-soft"
        >
          {{ ingredient.commonName ?? ingredient.inciName }}
        </li>
      </ul>
      <p v-else class="mt-4 text-sm text-ink-muted">
        {{ $t('PRODUCT.GALLERY.NO_ACTIVES') }}
      </p>
    </div>

    <div
      v-else
      class="flex aspect-square flex-col items-center justify-center gap-3 p-6 text-center"
      :style="textureStyle"
    >
      <span
        class="flex size-14 items-center justify-center rounded-full bg-surface/70 text-ink-soft"
      >
        <BaseIcon name="droplet" :size="24" />
      </span>
      <p class="font-display text-lg text-ink">
        {{ categoryName }}
      </p>
      <p class="max-w-56 text-xs leading-relaxed text-ink-muted">
        {{ $t('PRODUCT.GALLERY.TEXTURE_NOTE') }}
      </p>
    </div>

    <span
      v-if="view !== 'photo'"
      class="absolute top-3 right-3 rounded-pill bg-surface/85 px-2.5 py-1 text-2xs font-medium text-ink-muted"
    >
      {{ $t('PRODUCT.GALLERY.PLACEHOLDER') }}
    </span>
  </div>
</template>
