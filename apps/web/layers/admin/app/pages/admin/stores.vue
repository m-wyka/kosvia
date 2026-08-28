<script setup lang="ts">
import type { StoreDto } from '@kosvia/shared';
import type { TableColumn } from '../../components/Table.vue';

definePageMeta({ layout: 'admin', middleware: 'admin' });

type StoreRow = StoreDto & { affiliateUrlTemplate: string | null; _count: { offers: number } };

const resource = useAdminResource<StoreRow>('/admin/stores', { paginated: false });
const { t } = useI18n();

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('ADMIN.STORES.COL_STORE') },
  { key: 'websiteUrl', label: t('ADMIN.STORES.COL_WEBSITE'), secondary: true },
  { key: 'affiliate', label: t('ADMIN.STORES.COL_AFFILIATE'), secondary: true },
  { key: 'offers', label: t('ADMIN.STORES.COL_OFFERS'), align: 'right', width: 'w-24' },
  { key: 'actions', label: '', align: 'right', width: 'w-24' },
]);

const modalOpen = ref(false);
const editing = ref<StoreRow | null>(null);
const form = reactive({ name: '', slug: '', websiteUrl: '', affiliateUrlTemplate: '' });

function openCreate() {
  editing.value = null;
  Object.assign(form, { name: '', slug: '', websiteUrl: '', affiliateUrlTemplate: '' });
  modalOpen.value = true;
}

function openEdit(store: StoreRow) {
  editing.value = store;
  Object.assign(form, {
    name: store.name,
    slug: store.slug,
    websiteUrl: store.websiteUrl ?? '',
    affiliateUrlTemplate: store.affiliateUrlTemplate ?? '',
  });
  modalOpen.value = true;
}

async function save() {
  const body = {
    name: form.name,
    slug: form.slug || undefined,
    websiteUrl: form.websiteUrl || undefined,
    affiliateUrlTemplate: form.affiliateUrlTemplate || undefined,
  };
  const result = editing.value
    ? await resource.update(editing.value.id, body, t('ADMIN.STORES.SAVED'))
    : await resource.create(body, t('ADMIN.STORES.CREATED'));
  if (result) modalOpen.value = false;
}

useSeo(() => ({
  title: t('SEO.ADMIN.STORES'),
  description: t('SEO.ADMIN.STORES_DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div>
    <AdminPageHeader
      :title="$t('ADMIN.STORES.TITLE')"
      :count="resource.total.value"
      :description="$t('ADMIN.STORES.SUBTITLE')"
    >
      <template #actions>
        <BaseButton size="sm" @click="openCreate">
          <template #icon><BaseIcon name="plus" :size="15" /></template>
          {{ $t('ADMIN.STORES.NEW') }}
        </BaseButton>
      </template>
    </AdminPageHeader>

    <BaseErrorState v-if="resource.error.value" @retry="resource.refresh()" />

    <AdminTable
      v-else
      :columns="columns"
      :rows="resource.rows.value"
      :loading="resource.pending.value"
      :empty-title="$t('ADMIN.STORES.EMPTY')"
    >
      <template #cell-name="{ row }">
        <span class="font-medium text-ink">{{ row.name }}</span>
      </template>
      <template #cell-websiteUrl="{ row }">
        <span class="text-xs text-ink-muted">{{ row.websiteUrl ?? '—' }}</span>
      </template>
      <template #cell-affiliate="{ row }">
        <code v-if="row.affiliateUrlTemplate" class="text-2xs text-ink-muted">
          {{ row.affiliateUrlTemplate }}
        </code>
        <span v-else class="text-xs text-ink-faint">{{ $t('ADMIN.STORES.NOT_SET') }}</span>
      </template>
      <template #cell-offers="{ row }">
        <span class="tabular-nums text-ink-soft">{{ row._count?.offers ?? 0 }}</span>
      </template>
      <template #cell-actions="{ row }">
        <span class="flex justify-end gap-0.5">
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint hover:text-ink"
            :aria-label="$t('ADMIN.STORES.EDIT', { name: row.name })"
            @click="openEdit(row)"
          >
            <BaseIcon name="edit" :size="15" />
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint hover:text-critical"
            :aria-label="$t('COMMON.DELETE')"
            @click="resource.remove(row.id, t('ADMIN.STORES.DELETED'))"
          >
            <BaseIcon name="trash" :size="15" />
          </button>
        </span>
      </template>
    </AdminTable>

    <BaseModal
      v-model:open="modalOpen"
      :title="editing ? $t('ADMIN.STORES.EDIT', { name: editing.name }) : $t('ADMIN.STORES.NEW')"
      size="sm"
    >
      <div class="space-y-4">
        <BaseInput v-model="form.name" :label="$t('ADMIN.STORES.FIELD_NAME')" required />
        <BaseInput
          v-model="form.slug"
          :label="$t('ADMIN.STORES.FIELD_SLUG')"
          :hint="$t('ADMIN.STORES.SLUG_HINT')"
        />
        <BaseInput
          v-model="form.websiteUrl"
          :label="$t('ADMIN.STORES.FIELD_WEBSITE')"
          placeholder="https://…"
        />
        <BaseInput
          v-model="form.affiliateUrlTemplate"
          :label="$t('ADMIN.STORES.FIELD_AFFILIATE')"
          placeholder="https://store.example/p/{sku}?ref=kosvia"
          :hint="$t('ADMIN.STORES.AFFILIATE_HINT')"
        />
      </div>
      <template #footer>
        <BaseButton variant="ghost" @click="modalOpen = false">{{ $t('COMMON.CANCEL') }}</BaseButton>
        <BaseButton :loading="resource.saving.value" :disabled="!form.name" @click="save">
          {{ editing ? $t('ADMIN.BRANDS.SAVE_CHANGES') : $t('ADMIN.STORES.CREATE') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
