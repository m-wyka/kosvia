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
const { t } = useI18n();
const vocab = useVocabulary();

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('ADMIN.CATEGORIES.COL_NAME') },
  { key: 'parent', label: t('ADMIN.CATEGORIES.COL_PARENT'), secondary: true },
  { key: 'routineStep', label: t('ADMIN.CATEGORIES.COL_STEP'), secondary: true },
  { key: 'products', label: t('ADMIN.CATEGORIES.COL_PRODUCTS'), align: 'right', width: 'w-24' },
  { key: 'actions', label: '', align: 'right', width: 'w-24' },
]);

const routineStepOptions = computed(() =>
  ROUTINE_STEPS.map((value) => ({ value, label: vocab.routineStep(value) })),
);

const parentSelectOptions = computed(() => [
  { value: '', label: t('ADMIN.CATEGORIES.PARENT_NONE') },
  ...parentOptions.value,
]);

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
    ? await resource.update(editing.value.id, body, t('ADMIN.CATEGORIES.SAVED'))
    : await resource.create(body, t('ADMIN.CATEGORIES.CREATED'));
  if (result) modalOpen.value = false;
}

useSeo(() => ({
  title: t('SEO.ADMIN.CATEGORIES'),
  description: t('SEO.ADMIN.CATEGORIES_DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div>
    <AdminPageHeader
      :title="$t('ADMIN.CATEGORIES.TITLE')"
      :count="resource.total.value"
      :description="$t('ADMIN.CATEGORIES.SUBTITLE')"
    >
      <template #actions>
        <BaseButton size="sm" @click="openCreate">
          <template #icon><BaseIcon name="plus" :size="15" /></template>
          {{ $t('ADMIN.CATEGORIES.NEW') }}
        </BaseButton>
      </template>
    </AdminPageHeader>

    <BaseErrorState v-if="resource.error.value" @retry="resource.refresh()" />

    <AdminTable
      v-else
      :columns="columns"
      :rows="resource.rows.value"
      :loading="resource.pending.value"
      :empty-title="$t('ADMIN.CATEGORIES.EMPTY')"
    >
      <template #cell-name="{ row }">
        <span class="flex items-center gap-2">
          <span v-if="row.parentId" class="text-ink-faint" aria-hidden="true">└</span>
          <span class="font-medium text-ink">{{ vocab.category(row.slug, row.name) }}</span>
          <code class="text-2xs text-ink-faint">{{ row.slug }}</code>
        </span>
      </template>
      <template #cell-parent="{ row }">
        <span class="text-sm text-ink-muted">
          {{ row.parent ? vocab.category(row.parent.id, row.parent.name) : $t('COMMON.NOT_AVAILABLE') }}
        </span>
      </template>
      <template #cell-routineStep="{ row }">
        <BaseBadge tone="neutral" size="xs">{{ vocab.routineStep(row.routineStep) }}</BaseBadge>
      </template>
      <template #cell-products="{ row }">
        <span class="tabular-nums text-ink-soft">{{ row._count?.products ?? 0 }}</span>
      </template>
      <template #cell-actions="{ row }">
        <span class="flex justify-end gap-0.5">
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint hover:text-ink"
            :aria-label="$t('ADMIN.CATEGORIES.EDIT', { name: row.name })"
            @click="openEdit(row)"
          >
            <BaseIcon name="edit" :size="15" />
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint hover:text-critical"
            :aria-label="$t('COMMON.DELETE')"
            @click="resource.remove(row.id, t('ADMIN.CATEGORIES.DELETED'))"
          >
            <BaseIcon name="trash" :size="15" />
          </button>
        </span>
      </template>
    </AdminTable>

    <BaseModal
      v-model:open="modalOpen"
      :title="
        editing ? $t('ADMIN.CATEGORIES.EDIT', { name: editing.name }) : $t('ADMIN.CATEGORIES.NEW')
      "
      size="sm"
    >
      <div class="space-y-4">
        <BaseInput v-model="form.name" :label="$t('ADMIN.BRANDS.FIELD_NAME')" required />
        <BaseInput
          v-model="form.slug"
          :label="$t('ADMIN.BRANDS.FIELD_SLUG')"
          :hint="$t('ADMIN.BRANDS.SLUG_HINT')"
        />

        <BaseNativeSelect
          v-model="form.parentId"
          :options="parentSelectOptions"
          :label="$t('ADMIN.CATEGORIES.PARENT_LABEL')"
        />

        <BaseNativeSelect
          v-model="form.routineStep"
          :options="routineStepOptions"
          :label="$t('ADMIN.CATEGORIES.STEP_LABEL')"
          :hint="$t('ADMIN.CATEGORIES.STEP_HINT')"
        />

        <BaseInput v-model="form.sortOrder" :label="$t('ADMIN.CATEGORIES.SORT_ORDER')" type="number" />
      </div>
      <template #footer>
        <BaseButton variant="ghost" @click="modalOpen = false">{{ $t('COMMON.CANCEL') }}</BaseButton>
        <BaseButton :loading="resource.saving.value" :disabled="!form.name" @click="save">
          {{ editing ? $t('ADMIN.BRANDS.SAVE_CHANGES') : $t('ADMIN.CATEGORIES.CREATE') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
