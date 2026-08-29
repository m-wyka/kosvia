<script setup lang="ts">
import { pricePerHundred, type ProductDto, type ProductOfferDto } from '@kosvia/shared';

const props = defineProps<{ product: ProductDto }>();

const vocab = useVocabulary();
const format = useFormat();

const isOutOfStock = (offer: ProductOfferDto): boolean => offer.availability === 'OUT_OF_STOCK';

const stockRank = (offer: ProductOfferDto): number => (isOutOfStock(offer) ? 1 : 0);

const offers = computed(() =>
  [...props.product.offers].sort(
    (first, second) => stockRank(first) - stockRank(second) || first.price - second.price,
  ),
);

const bestPrice = computed(() => offers.value.find((offer) => !isOutOfStock(offer))?.price ?? null);
</script>

<template>
  <BaseCard :padded="false" class="overflow-hidden">
    <header class="flex items-baseline justify-between gap-4 border-b border-line px-5 py-4">
      <div>
        <h2 class="font-display text-xl text-ink">{{ $t('PRODUCT.OFFERS.TITLE') }}</h2>
        <p class="mt-0.5 text-xs text-ink-muted">{{ $t('PRODUCT.OFFERS.SUBTITLE') }}</p>
      </div>
      <span class="shrink-0 text-xs text-ink-muted">
        {{ $t('PRODUCT.OFFERS.COUNT', offers.length) }}
      </span>
    </header>

    <ul v-if="offers.length" class="divide-y divide-line">
      <li
        v-for="offer in offers"
        :key="offer.id"
        class="px-5 py-3.5"
        :class="offer.availability === 'OUT_OF_STOCK' && 'opacity-60'"
      >
        <div class="flex items-start justify-between gap-3">
          <span class="flex min-w-0 items-start gap-2.5">
            <BaseIcon name="store" :size="16" class="mt-0.5 shrink-0 text-ink-faint" />
            <span class="min-w-0">
              <span class="block text-sm leading-snug font-medium text-ink">
                {{ offer.store.name }}
              </span>
              <span
                class="block text-xs"
                :class="{
                  'text-positive': offer.availability === 'IN_STOCK',
                  'text-caution': offer.availability === 'LOW_STOCK',
                  'text-ink-muted': ['OUT_OF_STOCK', 'UNKNOWN'].includes(offer.availability),
                }"
              >
                {{ vocab.availability(offer.availability) }}
              </span>
            </span>
          </span>

          <span class="shrink-0 text-right">
            <span class="block text-sm font-semibold tabular-nums text-ink">
              {{ format.price(offer.price, offer.currency) }}
            </span>
            <span
              v-if="pricePerHundred(offer.price, product.volume, product.volumeUnit)"
              class="block text-2xs tabular-nums text-ink-muted"
            >
              {{
                format.pricePer100(
                  pricePerHundred(offer.price, product.volume, product.volumeUnit),
                  product.volumeUnit,
                )
              }}
            </span>
          </span>
        </div>

        <div class="mt-2.5 flex items-center justify-between gap-3">
          <BaseBadge v-if="offer.price === bestPrice" tone="sage" size="xs">
            {{ $t('PRODUCT.OFFERS.BEST_PRICE') }}
          </BaseBadge>
          <span v-else aria-hidden="true" />
          <BaseButton
            v-if="offer.url && offer.availability !== 'OUT_OF_STOCK'"
            :href="offer.url"
            size="sm"
            variant="secondary"
            target="_blank"
            rel="noopener nofollow"
          >
            {{ $t('PRODUCT.OFFERS.VISIT') }}
          </BaseButton>
        </div>
      </li>
    </ul>

    <p v-else class="px-5 py-8 text-center text-sm text-ink-muted">
      {{ $t('PRODUCT.OFFERS.NONE') }}
    </p>
  </BaseCard>
</template>
