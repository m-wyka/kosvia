<script setup lang="ts">
import type { AiMessageDto } from '@kosvia/shared';

defineProps<{ message: AiMessageDto }>();

const ROLE_TONE = {
  'best-match': 'sage',
  cheaper: 'lavender',
  alternative: 'neutral',
  'already-owned': 'peach',
} as const;

const { t } = useI18n();
const format = useFormat();
const localise = useLocalisedText();

const roleLabel = (role: keyof typeof ROLE_TONE) =>
  t(`AI.ROLE.${role.replace(/-/g, '_').toUpperCase()}`);
</script>

<template>
  <div v-if="message.role === 'USER'" class="flex justify-end">
    <p
      class="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm leading-relaxed text-ink-inverse"
    >
      {{ message.content }}
    </p>
  </div>

  <div v-else class="flex gap-2.5">
    <span
      class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-blush-soft text-blush-deep"
      aria-hidden="true"
    >
      <BaseIcon name="sparkles" :size="14" />
    </span>

    <div class="min-w-0 flex-1 space-y-3">
      <div class="rounded-2xl rounded-tl-md bg-surface px-4 py-3">
        <p class="text-sm leading-relaxed whitespace-pre-line text-ink-soft">
          {{ message.content }}
        </p>
      </div>

      <ul v-if="message.suggestions.length" class="space-y-2.5">
        <li v-for="suggestion in message.suggestions" :key="suggestion.product.id">
          <NuxtLinkLocale
            :to="`/products/${suggestion.product.slug}`"
            class="group flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md"
          >
            <ProductImage
              :src="suggestion.product.imageUrl"
              :alt="suggestion.product.name"
              ratio="square"
              class="w-14 shrink-0 rounded-md"
            />
            <span class="min-w-0 flex-1">
              <BaseBadge :tone="ROLE_TONE[suggestion.role]" size="xs">
                {{ suggestion.label ? localise(suggestion.label) : roleLabel(suggestion.role) }}
              </BaseBadge>
              <span class="mt-1.5 block truncate text-2xs tracking-wide text-ink-muted uppercase">
                {{ suggestion.product.brand.name }}
              </span>
              <span class="block truncate text-sm font-medium text-ink">
                {{ suggestion.product.name }}
              </span>
              <span v-if="suggestion.reason" class="mt-0.5 block truncate text-xs text-ink-muted">
                {{ localise(suggestion.reason) }}
              </span>
            </span>
            <span class="shrink-0 text-right">
              <span
                v-if="suggestion.product.personalMatch"
                class="block text-sm font-semibold tabular-nums text-sage"
              >
                {{ suggestion.product.personalMatch.score }}%
              </span>
              <span class="block text-sm font-semibold tabular-nums text-ink">
                {{ format.price(suggestion.product.lowestPrice) }}
              </span>
            </span>
          </NuxtLinkLocale>
        </li>
      </ul>
    </div>
  </div>
</template>
