<script setup lang="ts">
/**
 * Scan is prominent in the mobile navigation because it is where the product is
 * headed. Until the camera pipeline exists, this page is honest about that and
 * routes people to the search that does work today.
 */
import type { ProductSummaryDto } from '@kosvia/shared';

const api = useApi();
const router = useRouter();

const ean = ref('');
const looking = ref(false);
const notFound = ref(false);

async function lookup() {
  const code = ean.value.trim();
  if (!code) return;
  looking.value = true;
  notFound.value = false;
  try {
    const response = await api<{ items: ProductSummaryDto[] }>(
      `/products?q=${encodeURIComponent(code)}&pageSize=1`,
    );
    const first = response.items[0];
    if (first) {
      await router.push(`/products/${first.slug}`);
    } else {
      notFound.value = true;
    }
  } finally {
    looking.value = false;
  }
}

useSeo({
  title: 'Scan a product',
  description: 'Look up a cosmetic by its barcode number.',
  path: '/scan',
});
</script>

<template>
  <div class="container-page max-w-lg py-10 sm:py-16">
    <div class="text-center">
      <span class="mx-auto flex size-14 items-center justify-center rounded-2xl bg-ink text-ink-inverse">
        <BaseIcon name="scan" :size="26" />
      </span>
      <h1 class="mt-5 font-display text-3xl text-ink">Scan a product</h1>
      <p class="mt-2 text-sm text-ink-muted">
        Camera scanning is not in this build yet. Type the barcode number and we will
        look it up in the catalogue.
      </p>
    </div>

    <form class="mt-8 space-y-4" @submit.prevent="lookup">
      <BaseInput
        v-model="ean"
        label="Barcode (EAN)"
        inputmode="numeric"
        placeholder="5901234567890"
        :error="notFound ? 'No product with that barcode in our catalogue yet.' : undefined"
      >
        <template #prefix><BaseIcon name="tag" :size="16" /></template>
      </BaseInput>
      <BaseButton type="submit" size="lg" block :loading="looking">Look it up</BaseButton>
    </form>

    <div class="mt-10 rounded-xl border border-dashed border-line-strong bg-surface-muted p-5">
      <p class="text-sm font-medium text-ink">In the meantime</p>
      <p class="mt-1 text-sm text-ink-muted">
        Search by name or brand — it is faster than typing thirteen digits.
      </p>
      <div class="mt-4 flex flex-wrap gap-2">
        <BaseButton to="/products" variant="secondary" size="sm">Search the catalogue</BaseButton>
        <BaseButton to="/ai" variant="ghost" size="sm">Ask the AI shopper</BaseButton>
      </div>
    </div>
  </div>
</template>
