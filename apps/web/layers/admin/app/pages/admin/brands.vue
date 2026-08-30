<script setup lang="ts">
import type { BrandDto } from '@kosvia/shared';
import type { TableColumn } from '@@/layers/admin/app/components/Table.vue';

definePageMeta({ layout: 'admin', middleware: 'admin' });

type BrandRow = BrandDto & { _count: { products: number } };

const EMPTY_FORM = { name: '', slug: '', description: '', isVegan: false, isCrueltyFree: false };

const {
  rows,
  total,
  pageCount,
  page,
  search,
  pending,
  error,
  saving,
  refresh,
  create,
  update,
  remove,
} = useAdminResource<BrandRow>('/admin/brands');
const { t } = useI18n();

const editing = ref<BrandRow | null>(null);
const modalOpen = ref(false);
const form = reactive({ ...EMPTY_FORM });

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('ADMIN.BRANDS.COL_NAME') },
  { key: 'slug', label: t('ADMIN.BRANDS.COL_SLUG'), secondary: true },
  { key: 'flags', label: t('ADMIN.BRANDS.COL_ETHICS'), secondary: true },
  { key: 'products', label: t('ADMIN.BRANDS.COL_PRODUCTS'), align: 'right', width: 'w-24' },
  { key: 'actions', label: '', align: 'right', width: 'w-24' },
]);

const openCreate = () => {
  editing.value = null;
  Object.assign(form, EMPTY_FORM);
  modalOpen.value = true;
};

const openEdit = (brand: BrandRow) => {
  editing.value = brand;
  Object.assign(form, {
    name: brand.name,
    slug: brand.slug,
    description: brand.description ?? '',
    isVegan: brand.isVegan,
    isCrueltyFree: brand.isCrueltyFree,
  });
  modalOpen.value = true;
};

const save = async () => {
  const body = {
    name: form.name,
    slug: form.slug || undefined,
    description: form.description || undefined,
    isVegan: form.isVegan,
    isCrueltyFree: form.isCrueltyFree,
  };
  const result = editing.value
    ? await update(editing.value.id, body, t('ADMIN.BRANDS.SAVED'))
    : await create(body, t('ADMIN.BRANDS.CREATED'));
  if (result) {
    modalOpen.value = false;
  }
};

const confirmDelete = async (brand: BrandRow) => {
  if (!confirm(t('ADMIN.CONFIRM_DELETE', { name: brand.name }))) {
    return;
  }
  await remove(brand.id, t('ADMIN.BRANDS.DELETED'));
};

useSeo(() => ({
  title: t('SEO.ADMIN.BRANDS'),
  description: t('SEO.ADMIN.BRANDS_DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div>
    <AdminPageHeader
      :title="$t('ADMIN.BRANDS.TITLE')"
      :count="total"
      :description="$t('ADMIN.BRANDS.SUBTITLE')"
    >
      <template #actions>
        <BaseButton size="sm" @click="openCreate">
          <template #icon><BaseIcon name="plus" :size="15" /></template>
          {{ $t('ADMIN.BRANDS.NEW') }}
        </BaseButton>
      </template>
    </AdminPageHeader>

    <AdminToolbar
      v-model:search="search"
      :page="page"
      :page-count="pageCount"
      :total="total"
      :placeholder="$t('ADMIN.BRANDS.SEARCH_PLACEHOLDER')"
      @update:page="page = $event"
    />

    <BaseErrorState v-if="error" @retry="refresh()" />

    <AdminTable
      v-else
      :columns="columns"
      :rows="rows"
      :loading="pending"
      :empty-title="$t('ADMIN.BRANDS.EMPTY')"
    >
      <template #cell-name="{ row }">
        <span class="font-medium text-ink">{{ row.name }}</span>
      </template>
      <template #cell-slug="{ row }">
        <code class="text-xs text-ink-muted">{{ row.slug }}</code>
      </template>
      <template #cell-flags="{ row }">
        <span class="flex flex-wrap gap-1">
          <BaseBadge v-if="row.isVegan" tone="lavender" size="xs">
            {{ $t('ADMIN.BRANDS.VEGAN') }}
          </BaseBadge>
          <BaseBadge v-if="row.isCrueltyFree" tone="sage" size="xs">
            {{ $t('ADMIN.BRANDS.CRUELTY_FREE') }}
          </BaseBadge>
          <span v-if="!row.isVegan && !row.isCrueltyFree" class="text-xs text-ink-faint">
            {{ $t('COMMON.NOT_AVAILABLE') }}
          </span>
        </span>
      </template>
      <template #cell-products="{ row }">
        <span class="tabular-nums text-ink-soft">{{ row._count?.products ?? 0 }}</span>
      </template>
      <template #cell-actions="{ row }">
        <span class="flex justify-end gap-0.5">
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint transition-colors hover:text-ink"
            :aria-label="$t('ADMIN.BRANDS.EDIT', { name: row.name })"
            @click="openEdit(row)"
          >
            <BaseIcon name="edit" :size="15" />
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint transition-colors hover:text-critical"
            :aria-label="$t('COMMON.DELETE')"
            @click="confirmDelete(row)"
          >
            <BaseIcon name="trash" :size="15" />
          </button>
        </span>
      </template>
    </AdminTable>

    <BaseModal
      v-model:open="modalOpen"
      :title="editing ? $t('ADMIN.BRANDS.EDIT', { name: editing.name }) : $t('ADMIN.BRANDS.NEW')"
      size="sm"
    >
      <div class="space-y-4">
        <BaseInput v-model="form.name" :label="$t('ADMIN.BRANDS.FIELD_NAME')" required />
        <BaseInput
          v-model="form.slug"
          :label="$t('ADMIN.BRANDS.FIELD_SLUG')"
          :hint="$t('ADMIN.BRANDS.SLUG_HINT')"
        />
        <BaseTextarea
          v-model="form.description"
          :label="$t('ADMIN.BRANDS.FIELD_DESCRIPTION')"
          :rows="3"
        />
        <div class="space-y-3 rounded-lg border border-line bg-surface-muted p-4">
          <BaseSwitch v-model="form.isVegan" :label="$t('ADMIN.BRANDS.VEGAN')" />
          <BaseSwitch v-model="form.isCrueltyFree" :label="$t('ADMIN.BRANDS.CRUELTY_FREE')" />
        </div>
      </div>
      <template #footer>
        <BaseButton variant="ghost" @click="modalOpen = false">
          {{ $t('COMMON.CANCEL') }}
        </BaseButton>
        <BaseButton :loading="saving" :disabled="!form.name" @click="save">
          {{ editing ? $t('ADMIN.BRANDS.SAVE_CHANGES') : $t('ADMIN.BRANDS.CREATE') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
