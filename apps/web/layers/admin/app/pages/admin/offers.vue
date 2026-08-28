<script setup lang="ts">
import { formatPrice, type ProductSummaryDto, type StoreDto } from '@kosvia/shared';
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

const api = useApi();
const resource = useAdminResource<OfferRow>('/admin/offers');
const { data: stores } = await useApiFetch<StoreDto[]>('/stores', { key: 'stores' });

const columns: TableColumn[] = [
  { key: 'product', label: 'Product' },
  { key: 'store', label: 'Store', secondary: true },
  { key: 'price', label: 'Price', align: 'right', width: 'w-32' },
  { key: 'availability', label: 'Availability', align: 'center', secondary: true, width: 'w-32' },
  { key: 'lastCheckedAt', label: 'Checked', align: 'right', secondary: true },
  { key: 'actions', label: '', align: 'right', width: 'w-16' },
];

const modalOpen = ref(false);
const productSearch = ref('');
const productResults = ref<ProductSummaryDto[]>([]);
const searching = ref(false);

const form = reactive({
  productId: '',
  productLabel: '',
  storeId: '',
  price: '' as string | number,
  url: '',
  availability: 'IN_STOCK' as OfferRow['availability'],
});

watchDebounced(
  productSearch,
  async (term) => {
    if (term.trim().length < 2) {
      productResults.value = [];
      return;
    }
    searching.value = true;
    try {
      const response = await api<{ items: ProductSummaryDto[] }>(
        `/products?q=${encodeURIComponent(term)}&pageSize=6`,
      );
      productResults.value = response.items;
    } finally {
      searching.value = false;
    }
  },
  { debounce: 280 },
);

function openCreate() {
  Object.assign(form, { productId: '', productLabel: '', storeId: '', price: '', url: '', availability: 'IN_STOCK' });
  productSearch.value = '';
  productResults.value = [];
  modalOpen.value = true;
}

function openEdit(row: OfferRow) {
  Object.assign(form, {
    productId: row.product.id,
    productLabel: `${row.product.brand.name} ${row.product.name}`,
    storeId: row.store.id,
    price: Number(row.price),
    url: row.url ?? '',
    availability: row.availability,
  });
  modalOpen.value = true;
}

function pickProduct(product: ProductSummaryDto) {
  form.productId = product.id;
  form.productLabel = `${product.brand.name} ${product.name}`;
  productResults.value = [];
  productSearch.value = '';
}

async function save() {
  const result = await resource.create(
    {
      productId: form.productId,
      storeId: form.storeId,
      price: Number(form.price),
      url: form.url || undefined,
      availability: form.availability,
    },
    'Offer saved — lowest price recomputed',
  );
  if (result) modalOpen.value = false;
}

const AVAILABILITY = ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'UNKNOWN'] as const;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

useSeo({ title: 'Offers · Admin', description: 'Manage store offers.', noindex: true });
</script>

<template>
  <div>
    <AdminPageHeader
      title="Offers"
      :count="resource.total.value"
      description="Saving an offer writes a price-history entry and recomputes the product's lowest price."
    >
      <template #actions>
        <BaseButton size="sm" @click="openCreate">
          <template #icon><BaseIcon name="plus" :size="15" /></template>
          New offer
        </BaseButton>
      </template>
    </AdminPageHeader>

    <AdminToolbar
      v-model:search="resource.search.value"
      :page="resource.page.value"
      :page-count="resource.pageCount.value"
      :total="resource.total.value"
      placeholder="Search by product name…"
      @update:page="resource.page.value = $event"
    />

    <BaseErrorState v-if="resource.error.value" @retry="resource.refresh()" />

    <AdminTable
      v-else
      :columns="columns"
      :rows="resource.rows.value"
      :loading="resource.pending.value"
      empty-title="No offers found"
    >
      <template #cell-product="{ row }">
        <span class="min-w-0">
          <NuxtLink :to="`/products/${row.product.slug}`" class="text-sm font-medium text-ink hover:underline">
            {{ row.product.name }}
          </NuxtLink>
          <span class="block text-xs text-ink-muted">{{ row.product.brand.name }}</span>
        </span>
      </template>
      <template #cell-store="{ row }">
        <span class="text-sm text-ink-soft">{{ row.store.name }}</span>
      </template>
      <template #cell-price="{ row }">
        <span class="text-sm font-medium whitespace-nowrap tabular-nums text-ink">
          {{ formatPrice(Number(row.price), row.currency) }}
        </span>
      </template>
      <template #cell-availability="{ row }">
        <BaseBadge
          :tone="row.availability === 'IN_STOCK' ? 'sage' : row.availability === 'LOW_STOCK' ? 'caution' : 'neutral'"
          size="xs"
        >{{ row.availability.replace('_', ' ').toLowerCase() }}</BaseBadge>
      </template>
      <template #cell-lastCheckedAt="{ row }">
        <span class="text-xs text-ink-muted">{{ formatDate(row.lastCheckedAt) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <span class="flex justify-end gap-0.5">
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint hover:text-ink"
            aria-label="Edit offer"
            @click="openEdit(row)"
          >
            <BaseIcon name="edit" :size="15" />
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint hover:text-critical"
            aria-label="Delete offer"
            @click="resource.remove(row.id, 'Offer deleted')"
          >
            <BaseIcon name="trash" :size="15" />
          </button>
        </span>
      </template>
    </AdminTable>

    <BaseModal v-model:open="modalOpen" title="Store offer" size="sm">
      <div class="space-y-4">
        <div>
          <p class="mb-1.5 text-sm font-medium text-ink-soft">Product</p>
          <div
            v-if="form.productId"
            class="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-muted px-3.5 py-2.5"
          >
            <span class="truncate text-sm text-ink">{{ form.productLabel }}</span>
            <button
              type="button"
              class="shrink-0 text-xs text-ink-muted hover:text-ink"
              @click="form.productId = ''"
            >Change</button>
          </div>
          <template v-else>
            <BaseInput v-model="productSearch" placeholder="Search products…">
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
            <p v-else-if="searching" class="mt-2 text-xs text-ink-muted">Searching…</p>
          </template>
        </div>

        <div>
          <label for="offer-store" class="mb-1.5 block text-sm font-medium text-ink-soft">Store</label>
          <select
            id="offer-store"
            v-model="form.storeId"
            class="h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm"
          >
            <option value="" disabled>Choose a store</option>
            <option v-for="store in stores" :key="store.id" :value="store.id">{{ store.name }}</option>
          </select>
        </div>

        <BaseInput v-model="form.price" label="Price (PLN)" type="number" required />
        <BaseInput v-model="form.url" label="Product URL" placeholder="https://…" />

        <div>
          <label for="offer-availability" class="mb-1.5 block text-sm font-medium text-ink-soft">
            Availability
          </label>
          <select
            id="offer-availability"
            v-model="form.availability"
            class="h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm"
          >
            <option v-for="value in AVAILABILITY" :key="value" :value="value">
              {{ value.replace('_', ' ').toLowerCase() }}
            </option>
          </select>
        </div>
      </div>

      <template #footer>
        <BaseButton variant="ghost" @click="modalOpen = false">Cancel</BaseButton>
        <BaseButton
          :loading="resource.saving.value"
          :disabled="!form.productId || !form.storeId || !form.price"
          @click="save"
        >Save offer</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
