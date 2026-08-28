<script setup lang="ts">
import type { StoreDto } from '@kosvia/shared';
import type { TableColumn } from '../../components/Table.vue';

definePageMeta({ layout: 'admin', middleware: 'admin' });

type StoreRow = StoreDto & { affiliateUrlTemplate: string | null; _count: { offers: number } };

const resource = useAdminResource<StoreRow>('/admin/stores', { paginated: false });

const columns: TableColumn[] = [
  { key: 'name', label: 'Store' },
  { key: 'websiteUrl', label: 'Website', secondary: true },
  { key: 'affiliate', label: 'Affiliate template', secondary: true },
  { key: 'offers', label: 'Offers', align: 'right', width: 'w-24' },
  { key: 'actions', label: '', align: 'right', width: 'w-24' },
];

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
    ? await resource.update(editing.value.id, body, 'Store saved')
    : await resource.create(body, 'Store created');
  if (result) modalOpen.value = false;
}

useSeo({ title: 'Stores · Admin', description: 'Manage demo retailers.', noindex: true });
</script>

<template>
  <div>
    <AdminPageHeader
      title="Stores"
      :count="resource.total.value"
      description="Demo retailers. Real integrations are deliberately out of scope for now."
    >
      <template #actions>
        <BaseButton size="sm" @click="openCreate">
          <template #icon><BaseIcon name="plus" :size="15" /></template>
          New store
        </BaseButton>
      </template>
    </AdminPageHeader>

    <BaseErrorState v-if="resource.error.value" @retry="resource.refresh()" />

    <AdminTable
      v-else
      :columns="columns"
      :rows="resource.rows.value"
      :loading="resource.pending.value"
      empty-title="No stores yet"
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
        <span v-else class="text-xs text-ink-faint">Not set</span>
      </template>
      <template #cell-offers="{ row }">
        <span class="tabular-nums text-ink-soft">{{ row._count?.offers ?? 0 }}</span>
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
            @click="resource.remove(row.id, 'Store deleted')"
          >
            <BaseIcon name="trash" :size="15" />
          </button>
        </span>
      </template>
    </AdminTable>

    <BaseModal v-model:open="modalOpen" :title="editing ? `Edit ${editing.name}` : 'New store'" size="sm">
      <div class="space-y-4">
        <BaseInput v-model="form.name" label="Name" required />
        <BaseInput v-model="form.slug" label="Slug" hint="Leave empty to generate from the name." />
        <BaseInput v-model="form.websiteUrl" label="Website URL" placeholder="https://…" />
        <BaseInput
          v-model="form.affiliateUrlTemplate"
          label="Affiliate URL template"
          placeholder="https://store.example/p/{sku}?ref=kosvia"
          hint="Used once affiliate programmes are connected. Unused today."
        />
      </div>
      <template #footer>
        <BaseButton variant="ghost" @click="modalOpen = false">Cancel</BaseButton>
        <BaseButton :loading="resource.saving.value" :disabled="!form.name" @click="save">
          {{ editing ? 'Save changes' : 'Create store' }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
