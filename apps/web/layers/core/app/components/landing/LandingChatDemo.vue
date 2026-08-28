<template>
  <BaseCard class="space-y-4 shadow-md">
    <div class="flex justify-end">
      <p class="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm text-ink-inverse">
        I need a moisturiser under 70 PLN for combination, slightly sensitive skin.
      </p>
    </div>

    <div class="flex gap-2.5">
      <span class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-blush-soft text-blush-deep">
        <BaseIcon name="sparkles" :size="14" />
      </span>
      <div class="min-w-0 flex-1 space-y-3">
        <p class="rounded-2xl rounded-tl-md bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-soft">
          The closest fit is Pura Vive Oil-Free Gel Cream at 37,99 PLN — it targets your
          dehydration and redness, is fragrance-free, and fills the gap in your shelf.
        </p>

        <div class="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
          <div class="size-12 shrink-0 overflow-hidden rounded-md">
            <ProductImage src="/img/product/pura-vive-oil-free-gel-cream.svg" alt="" ratio="square" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-ink">Pura Vive Oil-Free Gel Cream</p>
            <p class="text-xs text-ink-muted">92% match · 37,99 PLN</p>
          </div>
          <BaseBadge tone="sage" size="xs">Best match</BaseBadge>
        </div>
      </div>
    </div>

    <p class="border-t border-line pt-3 text-xs text-ink-muted">
      Every product named comes from our database — the AI never invents one.
    </p>
  </BaseCard>
</template>
