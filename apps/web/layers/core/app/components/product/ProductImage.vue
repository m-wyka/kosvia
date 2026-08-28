<script setup lang="ts">
/**
 * The only place a product image is rendered.
 *
 * Handles the three states an image actually has — loading, loaded, failed —
 * and always reserves the aspect ratio so the grid never reflows underneath
 * the reader.
 */
const props = withDefaults(
  defineProps<{
    src?: string | null;
    alt: string;
    ratio?: 'square' | 'portrait' | 'wide';
    /** `contain` for packshots, `cover` for lifestyle art. */
    fit?: 'contain' | 'cover';
    eager?: boolean;
    sizes?: string;
  }>(),
  { ratio: 'portrait', fit: 'cover' },
);

const status = ref<'loading' | 'loaded' | 'error'>(props.src ? 'loading' : 'error');
watch(() => props.src, (next) => { status.value = next ? 'loading' : 'error'; });

const ratios = { square: 'aspect-square', portrait: 'aspect-[4/5]', wide: 'aspect-[16/10]' };
</script>

<template>
  <div
    class="relative overflow-hidden rounded-lg bg-surface-muted"
    :class="ratios[ratio]"
  >
    <div v-if="status === 'loading'" class="skeleton absolute inset-0" />

    <img
      v-if="src && status !== 'error'"
      :src="src"
      :alt="alt"
      :loading="eager ? 'eager' : 'lazy'"
      :fetchpriority="eager ? 'high' : 'auto'"
      :sizes="sizes"
      decoding="async"
      class="absolute inset-0 size-full transition-opacity duration-[--duration-slow]"
      :class="[fit === 'contain' ? 'object-contain' : 'object-cover', status === 'loaded' ? 'opacity-100' : 'opacity-0']"
      @load="status = 'loaded'"
      @error="status = 'error'"
    >

    <div
      v-else-if="status === 'error'"
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-canvas-deep text-ink-faint"
    >
      <BaseIcon name="droplet" :size="26" />
      <span class="px-3 text-center text-2xs">{{ $t('PRODUCT.IMAGE_UNAVAILABLE') }}</span>
    </div>

    <slot />
  </div>
</template>
