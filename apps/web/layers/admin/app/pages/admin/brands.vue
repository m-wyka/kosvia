<script setup lang="ts">
import type { BrandDto } from '@kosvia/shared';
import type { TableColumn } from '../../components/Table.vue';

definePageMeta({ layout: 'admin', middleware: 'admin' });

type BrandRow = BrandDto & { _count: { products: number } };

const resource = useAdminResource<BrandRow>('/admin/brands');

const columns: TableColumn[] = [
  { key: 'name', label: 'Brand' },
  { key: 'slug', label: 'Slug', secondary: true },
  { key: 'flags', label: 'Ethics', secondary: true },
  { key: 'products', label: 'Products', align: 'right', width: 'w-24' },
  { key: 'actions', label: '', align: 'right', width: 'w-24' },
];

const editing = ref<BrandRow | null>(null);
const modalOpen = ref(false);
const form = reactive({ name: '', slug: '', description: '', isVegan: false, isCrueltyFree: false });

function openCreate() {
  editing.value = null;
  Object.assign(form, { name: '', slug: '', description: '', isVegan: false, isCrueltyFree: false });
  modalOpen.value = true;
}

function openEdit(brand: BrandRow) {
  editing.value = brand;
  Object.assign(form, {
    name: brand.name,
    slug: brand.slug,
    description: brand.description ?? '',
    isVegan: brand.isVegan,
    isCrueltyFree: brand.isCrueltyFree,
  });
  modalOpen.value = true;
}

async function save() {
  const body = {
    name: form.name,
    slug: form.slug || undefined,
    description: form.description || undefined,
    isVegan: form.isVegan,
    isCrueltyFree: form.isCrueltyFree,
  };
  const result = editing.value
    ? await resource.update(editing.value.id, body, 'Brand saved')
    : await resource.create(body, 'Brand created');
  if (result) modalOpen.value = false;
}

async function confirmDelete(brand: BrandRow) {
  if (!confirm(`Delete ${brand.name}? This cannot be undone.`)) return;
  await resource.remove(brand.id, 'Brand deleted');
}

useSeo({ title: 'Brands · Admin', description: 'Manage brands.', noindex: true });
</script>

<template>
  <div>
    <AdminPageHeader title="Brands" :count="resource.total.value" description="Who makes the products.">
      <template #actions>
        <BaseButton size="sm" @click="openCreate">
          <template #icon><BaseIcon name="plus" :size="15" /></template>
          New brand
        </BaseButton>
      </template>
    </AdminPageHeader>

    <AdminToolbar
      v-model:search="resource.search.value"
      :page="resource.page.value"
      :page-count="resource.pageCount.value"
      :total="resource.total.value"
      placeholder="Search brands…"
      @update:page="resource.page.value = $event"
    />

    <BaseErrorState v-if="resource.error.value" @retry="resource.refresh()" />

    <AdminTable
      v-else
      :columns="columns"
      :rows="resource.rows.value"
      :loading="resource.pending.value"
      empty-title="No brands yet"
    >
      <template #cell-name="{ row }">
        <span class="font-medium text-ink">{{ row.name }}</span>
      </template>
      <template #cell-slug="{ row }">
        <code class="text-xs text-ink-muted">{{ row.slug }}</code>
      </template>
      <template #cell-flags="{ row }">
        <span class="flex flex-wrap gap-1">
          <BaseBadge v-if="row.isVegan" tone="lavender" size="xs">Vegan</BaseBadge>
          <BaseBadge v-if="row.isCrueltyFree" tone="sage" size="xs">Cruelty-free</BaseBadge>
          <span v-if="!row.isVegan && !row.isCrueltyFree" class="text-xs text-ink-faint">—</span>
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
            :aria-label="`Edit ${row.name}`"
            @click="openEdit(row)"
          >
            <BaseIcon name="edit" :size="15" />
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint transition-colors hover:text-critical"
            :aria-label="`Delete ${row.name}`"
            @click="confirmDelete(row)"
          >
            <BaseIcon name="trash" :size="15" />
          </button>
        </span>
      </template>
    </AdminTable>

    <BaseModal
      v-model:open="modalOpen"
      :title="editing ? `Edit ${editing.name}` : 'New brand'"
      size="sm"
    >
      <div class="space-y-4">
        <BaseInput v-model="form.name" label="Name" required />
        <BaseInput v-model="form.slug" label="Slug" hint="Leave empty to generate from the name." />
        <BaseTextarea v-model="form.description" label="Description" :rows="3" />
        <div class="space-y-3 rounded-lg border border-line bg-surface-muted p-4">
          <BaseSwitch v-model="form.isVegan" label="Vegan" />
          <BaseSwitch v-model="form.isCrueltyFree" label="Cruelty-free" />
        </div>
      </div>
      <template #footer>
        <BaseButton variant="ghost" @click="modalOpen = false">Cancel</BaseButton>
        <BaseButton :loading="resource.saving.value" :disabled="!form.name" @click="save">
          {{ editing ? 'Save changes' : 'Create brand' }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
