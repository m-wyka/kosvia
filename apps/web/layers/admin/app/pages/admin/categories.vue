<script setup lang="ts">
import type { TableColumn } from '../../components/Table.vue';

definePageMeta({ layout: 'admin', middleware: 'admin' });

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  routineStep: string;
  sortOrder: number;
  parent: { id: string; name: string } | null;
  _count: { products: number };
}

const ROUTINE_STEPS = [
  'CLEANSER', 'TONER', 'EXFOLIANT', 'SERUM', 'EYE', 'MOISTURIZER',
  'SPF', 'MASK', 'TREATMENT', 'BODY', 'HAIR', 'MAKEUP', 'OTHER',
];

const resource = useAdminResource<CategoryRow>('/admin/categories', { paginated: false });

const columns: TableColumn[] = [
  { key: 'name', label: 'Category' },
  { key: 'parent', label: 'Parent', secondary: true },
  { key: 'routineStep', label: 'Routine step', secondary: true },
  { key: 'products', label: 'Products', align: 'right', width: 'w-24' },
  { key: 'actions', label: '', align: 'right', width: 'w-24' },
];

const modalOpen = ref(false);
const editing = ref<CategoryRow | null>(null);
const form = reactive({
  name: '',
  slug: '',
  description: '',
  parentId: '',
  routineStep: 'OTHER',
  sortOrder: 0,
});

const parentOptions = computed(() =>
  resource.rows.value
    .filter((row) => row.id !== editing.value?.id)
    .map((row) => ({ value: row.id, label: row.name })),
);

function openCreate() {
  editing.value = null;
  Object.assign(form, { name: '', slug: '', description: '', parentId: '', routineStep: 'OTHER', sortOrder: 0 });
  modalOpen.value = true;
}

function openEdit(category: CategoryRow) {
  editing.value = category;
  Object.assign(form, {
    name: category.name,
    slug: category.slug,
    description: '',
    parentId: category.parentId ?? '',
    routineStep: category.routineStep,
    sortOrder: category.sortOrder,
  });
  modalOpen.value = true;
}

async function save() {
  const body = {
    name: form.name,
    slug: form.slug || undefined,
    description: form.description || undefined,
    parentId: form.parentId || null,
    routineStep: form.routineStep,
    sortOrder: Number(form.sortOrder) || 0,
  };
  const result = editing.value
    ? await resource.update(editing.value.id, body, 'Category saved')
    : await resource.create(body, 'Category created');
  if (result) modalOpen.value = false;
}

useSeo({ title: 'Categories · Admin', description: 'Manage the category tree.', noindex: true });
</script>

<template>
  <div>
    <AdminPageHeader
      title="Categories"
      :count="resource.total.value"
      description="The tree that drives navigation, filtering and routine analysis."
    >
      <template #actions>
        <BaseButton size="sm" @click="openCreate">
          <template #icon><BaseIcon name="plus" :size="15" /></template>
          New category
        </BaseButton>
      </template>
    </AdminPageHeader>

    <BaseErrorState v-if="resource.error.value" @retry="resource.refresh()" />

    <AdminTable
      v-else
      :columns="columns"
      :rows="resource.rows.value"
      :loading="resource.pending.value"
      empty-title="No categories yet"
    >
      <template #cell-name="{ row }">
        <span class="flex items-center gap-2">
          <span v-if="row.parentId" class="text-ink-faint" aria-hidden="true">└</span>
          <span class="font-medium text-ink">{{ row.name }}</span>
          <code class="text-2xs text-ink-faint">{{ row.slug }}</code>
        </span>
      </template>
      <template #cell-parent="{ row }">
        <span class="text-sm text-ink-muted">{{ row.parent?.name ?? '—' }}</span>
      </template>
      <template #cell-routineStep="{ row }">
        <BaseBadge tone="neutral" size="xs">{{ row.routineStep.toLowerCase() }}</BaseBadge>
      </template>
      <template #cell-products="{ row }">
        <span class="tabular-nums text-ink-soft">{{ row._count?.products ?? 0 }}</span>
      </template>
      <template #cell-actions="{ row }">
        <span class="flex justify-end gap-0.5">
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint hover:text-ink"
            :aria-label="`Edit ${row.name}`"
            @click="openEdit(row)"
          >
            <BaseIcon name="edit" :size="15" />
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint hover:text-critical"
            :aria-label="`Delete ${row.name}`"
            @click="resource.remove(row.id, 'Category deleted')"
          >
            <BaseIcon name="trash" :size="15" />
          </button>
        </span>
      </template>
    </AdminTable>

    <BaseModal v-model:open="modalOpen" :title="editing ? `Edit ${editing.name}` : 'New category'" size="sm">
      <div class="space-y-4">
        <BaseInput v-model="form.name" label="Name" required />
        <BaseInput v-model="form.slug" label="Slug" hint="Leave empty to generate from the name." />

        <div>
          <label for="parent" class="mb-1.5 block text-sm font-medium text-ink-soft">Parent category</label>
          <select
            id="parent"
            v-model="form.parentId"
            class="h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm"
          >
            <option value="">None — top level</option>
            <option v-for="option in parentOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div>
          <label for="step" class="mb-1.5 block text-sm font-medium text-ink-soft">Routine step</label>
          <select
            id="step"
            v-model="form.routineStep"
            class="h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm"
          >
            <option v-for="step in ROUTINE_STEPS" :key="step" :value="step">{{ step.toLowerCase() }}</option>
          </select>
          <p class="mt-1.5 text-xs text-ink-muted">
            Drives alternatives, routine gap analysis and the routine builder.
          </p>
        </div>

        <BaseInput v-model="form.sortOrder" label="Sort order" type="number" />
      </div>
      <template #footer>
        <BaseButton variant="ghost" @click="modalOpen = false">Cancel</BaseButton>
        <BaseButton :loading="resource.saving.value" :disabled="!form.name" @click="save">
          {{ editing ? 'Save changes' : 'Create category' }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
