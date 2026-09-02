<script setup lang="ts">
import type { TableColumn } from '@@/layers/admin/app/components/Table.vue';

definePageMeta({ layout: 'admin', middleware: 'admin' });

interface FormulaChangeRow {
  id: string;
  productId: string;
  compositionHash: string;
  createdAt: string;
  product: { name: string; slug: string; brand: { name: string } };
  source: { code: string } | null;
}

const { rows, total, pageCount, page, search, pending, error, refresh } =
  useAdminResource<FormulaChangeRow>('/admin/formula-changes');
const { t } = useI18n();
const format = useFormat();

const columns = computed<TableColumn[]>(() => [
  { key: 'createdAt', label: t('ADMIN.COL_WHEN'), width: 'w-44' },
  { key: 'product', label: t('ADMIN.FIELD_PRODUCT') },
  { key: 'source', label: t('ADMIN.FORMULA_CHANGES.COL_SOURCE'), secondary: true, width: 'w-40' },
  {
    key: 'compositionHash',
    label: t('ADMIN.FORMULA_CHANGES.COL_HASH'),
    secondary: true,
    width: 'w-40',
  },
]);

const HASH_PREVIEW_LENGTH = 12;

useSeo(() => ({
  title: t('SEO.ADMIN.FORMULA_CHANGES'),
  description: t('SEO.ADMIN.FORMULA_CHANGES_DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div>
    <AdminPageHeader
      :title="$t('ADMIN.FORMULA_CHANGES.TITLE')"
      :count="total"
      :description="$t('ADMIN.FORMULA_CHANGES.SUBTITLE')"
    />

    <AdminToolbar
      v-model:search="search"
      :page="page"
      :page-count="pageCount"
      :total="total"
      :placeholder="$t('ADMIN.SEARCH_PRODUCT_PLACEHOLDER')"
      @update:page="page = $event"
    />

    <BaseErrorState v-if="error" @retry="refresh()" />

    <AdminTable
      v-else
      :columns="columns"
      :rows="rows"
      :loading="pending"
      :empty-title="$t('ADMIN.FORMULA_CHANGES.EMPTY')"
    >
      <template #cell-createdAt="{ row }">
        <span class="text-xs text-ink-muted">{{ format.date(row.createdAt) }}</span>
      </template>
      <template #cell-product="{ row }">
        <NuxtLinkLocale
          :to="`/products/${row.product.slug}`"
          class="text-sm font-medium text-ink underline-offset-4 hover:underline"
        >
          {{ row.product.name }}
        </NuxtLinkLocale>
        <span class="block text-xs text-ink-muted">{{ row.product.brand.name }}</span>
      </template>
      <template #cell-source="{ row }">
        <span class="font-mono text-xs text-ink-muted">{{ row.source?.code ?? '—' }}</span>
      </template>
      <template #cell-compositionHash="{ row }">
        <span class="font-mono text-2xs text-ink-faint">
          {{ row.compositionHash.slice(0, HASH_PREVIEW_LENGTH) }}
        </span>
      </template>
    </AdminTable>
  </div>
</template>
