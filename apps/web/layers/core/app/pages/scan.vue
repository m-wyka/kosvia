<script setup lang="ts">
/**
 * Scan is prominent in the mobile navigation because it is where the product is
 * headed. Until the camera pipeline exists, this page is honest about that and
 * routes people to the search that does work today.
 */
import type { ProductSummaryDto } from '@kosvia/shared';

const api = useApi();
const router = useRouter();
const localePath = useLocalePath();
const { t } = useI18n();

const ean = ref('');
const looking = ref(false);
const notFound = ref(false);

async function lookup() {
  const code = ean.value.trim();
  if (!code) {return;}
  looking.value = true;
  notFound.value = false;
  try {
    const response = await api<{ items: ProductSummaryDto[] }>(
      `/products?q=${encodeURIComponent(code)}&pageSize=1`,
    );
    const first = response.items[0];
    if (first) {
      await router.push(localePath(`/products/${first.slug}`));
    } else {
      notFound.value = true;
    }
  } finally {
    looking.value = false;
  }
}

useSeo(() => ({
  title: t('SCAN.TITLE'),
  description: t('SEO.SCAN.DESCRIPTION'),
  path: '/scan',
}));
</script>

<template>
  <div class="container-page max-w-lg py-10 sm:py-16">
    <div class="text-center">
      <span class="mx-auto flex size-14 items-center justify-center rounded-2xl bg-ink text-ink-inverse">
        <BaseIcon name="scan" :size="26" />
      </span>
      <h1 class="mt-5 font-display text-3xl text-ink">{{ $t('SCAN.TITLE') }}</h1>
      <p class="mt-2 text-sm text-ink-muted">{{ $t('SCAN.SUBTITLE') }}</p>
    </div>

    <form class="mt-8 space-y-4" @submit.prevent="lookup">
      <BaseInput
        v-model="ean"
        :label="$t('SCAN.LABEL')"
        inputmode="numeric"
        :placeholder="$t('SCAN.PLACEHOLDER')"
        :error="notFound ? $t('SCAN.NOT_FOUND') : undefined"
      >
        <template #prefix><BaseIcon name="tag" :size="16" /></template>
      </BaseInput>
      <BaseButton type="submit" size="lg" block :loading="looking">
        {{ $t('SCAN.LOOK_UP') }}
      </BaseButton>
    </form>

    <div class="mt-10 rounded-xl border border-dashed border-line-strong bg-surface-muted p-5">
      <p class="text-sm font-medium text-ink">{{ $t('SCAN.MEANTIME_TITLE') }}</p>
      <p class="mt-1 text-sm text-ink-muted">{{ $t('SCAN.MEANTIME_BODY') }}</p>
      <div class="mt-4 flex flex-wrap gap-2">
        <BaseButton to="/products" variant="secondary" size="sm">
          {{ $t('SCAN.SEARCH_CTA') }}
        </BaseButton>
        <BaseButton to="/ai" variant="ghost" size="sm">{{ $t('SCAN.AI_CTA') }}</BaseButton>
      </div>
    </div>
  </div>
</template>
