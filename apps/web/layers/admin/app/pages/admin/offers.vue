<script setup lang="ts">
import type { ProductSummaryDto, StoreDto } from '@kosvia/shared';
import type { TableColumn } from '../../components/Table.vue';

definePageMeta({ layout: 'admin', middleware: 'admin' });

interface OfferRow {
  id: string;
  price: string | number;
  currency: string;
  url: string | null;
  availability: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
  lastCheckedAt: string;
  product: { id: string; name: string; slug: string; brand: { name: string } };
  store: { id: string; name: string };
}

const AVAILABILITY = ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'UNKNOWN'] as const;
const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 280;
const SEARCH_PAGE_SIZE = 6;

const EMPTY_FORM = {
  productId: '',
  productLabel: '',
  storeId: '',
  price: '' as string | number,
  url: '',
  availability: 'IN_STOCK' as OfferRow['availability'],
};

const api = useApi();
const { rows, total, pageCount, page, search, pending, error, saving, refresh, create, remove } =
  useAdminResource<OfferRow>('/admin/offers');
const { data: stores } = await useApiFetch<StoreDto[]>('/stores', { key: 'stores' });
const { t } = useI18n();
const vocab = useVocabulary();
const format = useFormat();

const modalOpen = ref(false);
const productSearch = ref('');
const productResults = ref<ProductSummaryDto[]>([]);
const searching = ref(false);
const form = reactive({ ...EMPTY_FORM });

const columns = computed<TableColumn[]>(() => [
  { key: 'product', label: t('ADMIN.OFFERS.COL_PRODUCT') },
  { key: 'store', label: t('ADMIN.OFFERS.COL_STORE'), secondary: true },
  { key: 'price', label: t('ADMIN.OFFERS.COL_PRICE'), align: 'right', width: 'w-32' },
  {
    key: 'availability',
    label: t('ADMIN.OFFERS.COL_AVAILABILITY'),
    align: 'center',
    secondary: true,
    width: 'w-32',
  },
  { key: 'lastCheckedAt', label: t('ADMIN.OFFERS.COL_CHECKED'), align: 'right', secondary: true },
  { key: 'actions', label: '', align: 'right', width: 'w-16' },
]);

const storeOptions = computed(() => [
  { value: '', label: t('ADMIN.OFFERS.STORE_PLACEHOLDER') },
  ...(stores.value ?? []).map((store) => ({ value: store.id, label: store.name })),
]);

const availabilityOptions = computed(() =>
  AVAILABILITY.map((value) => ({ value, label: vocab.availability(value) })),
);

const productLabelOf = (product: { brand: { name: string }; name: string }): string =>
  `${product.brand.name} ${product.name}`;

const searchProducts = async (term: string) => {
  if (term.trim().length < MIN_SEARCH_LENGTH) {
    productResults.value = [];
    return;
  }
  searching.value = true;
  try {
    const response = await api<{ items: ProductSummaryDto[] }>(
      `/products?q=${encodeURIComponent(term)}&pageSize=${SEARCH_PAGE_SIZE}`,
    );
    productResults.value = response.items;
  } finally {
    searching.value = false;
  }
};

const openCreate = () => {
  Object.assign(form, EMPTY_FORM);
  productSearch.value = '';
  productResults.value = [];
  modalOpen.value = true;
};

const openEdit = (row: OfferRow) => {
  Object.assign(form, {
    productId: row.product.id,
    productLabel: productLabelOf(row.product),
    storeId: row.store.id,
    price: Number(row.price),
    url: row.url ?? '',
    availability: row.availability,
  });
  modalOpen.value = true;
};

const pickProduct = (product: ProductSummaryDto) => {
  form.productId = product.id;
  form.productLabel = productLabelOf(product);
  productResults.value = [];
  productSearch.value = '';
};

const save = async () => {
  const result = await create(
    {
      productId: form.productId,
      storeId: form.storeId,
      price: Number(form.price),
      url: form.url || undefined,
      availability: form.availability,
    },
    t('ADMIN.OFFERS.SAVED'),
  );
  if (result) {
    modalOpen.value = false;
  }
};

watchDebounced(productSearch, searchProducts, { debounce: SEARCH_DEBOUNCE_MS });

useSeo(() => ({
  title: t('SEO.ADMIN.OFFERS'),
  description: t('SEO.ADMIN.OFFERS_DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div>
    <AdminPageHeader
      :title="$t('ADMIN.OFFERS.TITLE')"
      :count="total"
      :description="$t('ADMIN.OFFERS.SUBTITLE')"
    >
      <template #actions>
        <BaseButton size="sm" @click="openCreate">
          <template #icon><BaseIcon name="plus" :size="15" /></template>
          {{ $t('ADMIN.OFFERS.NEW') }}
        </BaseButton>
      </template>
    </AdminPageHeader>

    <AdminToolbar
      v-model:search="search"
      :page="page"
      :page-count="pageCount"
      :total="total"
      :placeholder="$t('ADMIN.OFFERS.SEARCH_PLACEHOLDER')"
      @update:page="page = $event"
    />

    <BaseErrorState v-if="error" @retry="refresh()" />

    <AdminTable
      v-else
      :columns="columns"
      :rows="rows"
      :loading="pending"
      :empty-title="$t('ADMIN.OFFERS.EMPTY')"
    >
      <template #cell-product="{ row }">
        <span class="min-w-0">
          <NuxtLinkLocale
            :to="`/products/${row.product.slug}`"
            class="text-sm font-medium text-ink hover:underline"
          >
            {{ row.product.name }}
          </NuxtLinkLocale>
          <span class="block text-xs text-ink-muted">{{ row.product.brand.name }}</span>
        </span>
      </template>
      <template #cell-store="{ row }">
        <span class="text-sm text-ink-soft">{{ row.store.name }}</span>
      </template>
      <template #cell-price="{ row }">
        <span class="text-sm font-medium whitespace-nowrap tabular-nums text-ink">
          {{ format.price(Number(row.price), row.currency) }}
        </span>
      </template>
      <template #cell-availability="{ row }">
        <BaseBadge
          :tone="
            row.availability === 'IN_STOCK'
              ? 'sage'
              : row.availability === 'LOW_STOCK'
                ? 'caution'
                : 'neutral'
          "
          size="xs"
        >
          {{ vocab.availability(row.availability) }}
        </BaseBadge>
      </template>
      <template #cell-lastCheckedAt="{ row }">
        <span class="text-xs text-ink-muted">{{ format.dateShort(row.lastCheckedAt) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <span class="flex justify-end gap-0.5">
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint hover:text-ink"
            :aria-label="$t('ADMIN.OFFERS.EDIT_ARIA')"
            @click="openEdit(row)"
          >
            <BaseIcon name="edit" :size="15" />
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint hover:text-critical"
            :aria-label="$t('ADMIN.OFFERS.DELETE_ARIA')"
            @click="remove(row.id, t('ADMIN.OFFERS.DELETED'))"
          >
            <BaseIcon name="trash" :size="15" />
          </button>
        </span>
      </template>
    </AdminTable>

    <BaseModal v-model:open="modalOpen" :title="$t('ADMIN.OFFERS.MODAL_TITLE')" size="sm">
      <div class="space-y-4">
        <div>
          <p class="mb-1.5 text-sm font-medium text-ink-soft">
            {{ $t('ADMIN.OFFERS.PRODUCT_LABEL') }}
          </p>
          <div
            v-if="form.productId"
            class="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-muted px-3.5 py-2.5"
          >
            <span class="truncate text-sm text-ink">{{ form.productLabel }}</span>
            <button
              type="button"
              class="shrink-0 text-xs text-ink-muted hover:text-ink"
              @click="form.productId = ''"
            >
              {{ $t('ADMIN.OFFERS.CHANGE') }}
            </button>
          </div>
          <template v-else>
            <BaseInput
              v-model="productSearch"
              :placeholder="$t('ADMIN.OFFERS.PRODUCT_PLACEHOLDER')"
            >
              <template #prefix><BaseIcon name="search" :size="16" /></template>
            </BaseInput>
            <ul v-if="productResults.length" class="mt-2 space-y-1">
              <li v-for="product in productResults" :key="product.id">
                <button
                  type="button"
                  class="w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface-muted"
                  @click="pickProduct(product)"
                >
                  <span class="block font-medium text-ink">{{ product.name }}</span>
                  <span class="block text-xs text-ink-muted">{{ product.brand.name }}</span>
                </button>
              </li>
            </ul>
            <p v-else-if="searching" class="mt-2 text-xs text-ink-muted">
              {{ $t('ADMIN.OFFERS.SEARCHING') }}
            </p>
          </template>
        </div>

        <BaseNativeSelect
          v-model="form.storeId"
          :options="storeOptions"
          :label="$t('ADMIN.OFFERS.STORE_LABEL')"
        />

        <BaseInput
          v-model="form.price"
          :label="$t('ADMIN.OFFERS.PRICE_LABEL')"
          type="number"
          required
        />
        <BaseInput
          v-model="form.url"
          :label="$t('ADMIN.OFFERS.URL_LABEL')"
          placeholder="https://…"
        />

        <BaseNativeSelect
          v-model="form.availability"
          :options="availabilityOptions"
          :label="$t('ADMIN.OFFERS.AVAILABILITY_LABEL')"
        />
      </div>

      <template #footer>
        <BaseButton variant="ghost" @click="modalOpen = false">
          {{ $t('COMMON.CANCEL') }}
        </BaseButton>
        <BaseButton
          :loading="saving"
          :disabled="!form.productId || !form.storeId || !form.price"
          @click="save"
        >
          {{ $t('ADMIN.OFFERS.SAVE') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
