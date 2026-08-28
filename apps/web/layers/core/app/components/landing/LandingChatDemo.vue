<script setup lang="ts">
const format = useFormat();
</script>

<template>
  <BaseCard class="space-y-4 shadow-md">
    <div class="flex justify-end">
      <p class="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm text-ink-inverse">
        {{ $t('LANDING.AI.DEMO_QUESTION') }}
      </p>
    </div>

    <div class="flex gap-2.5">
      <span class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-blush-soft text-blush-deep">
        <BaseIcon name="sparkles" :size="14" />
      </span>
      <div class="min-w-0 flex-1 space-y-3">
        <p class="rounded-2xl rounded-tl-md bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-soft">
          {{ $t('LANDING.AI.DEMO_ANSWER') }}
        </p>

        <div class="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
          <div class="size-12 shrink-0 overflow-hidden rounded-md">
            <ProductImage src="/img/product/pura-vive-oil-free-gel-cream.svg" alt="" ratio="square" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-ink">Pura Vive Oil-Free Gel Cream</p>
            <p class="text-xs text-ink-muted">
              {{ $t('PRODUCT.MATCH', { score: 92 }) }} · {{ format.price(37.99) }}
            </p>
          </div>
          <BaseBadge tone="sage" size="xs">{{ $t('LANDING.AI.DEMO_BADGE') }}</BaseBadge>
        </div>
      </div>
    </div>

    <p class="border-t border-line pt-3 text-xs text-ink-muted">
      {{ $t('LANDING.AI.DEMO_NOTE') }}
    </p>
  </BaseCard>
</template>
