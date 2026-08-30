<script setup lang="ts">
import type { AuditLogDto } from '@kosvia/shared';
import type { TableColumn } from '@@/layers/admin/app/components/Table.vue';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const MAX_DIFF_PREVIEW = 140;

const { rows, total, pageCount, page, search, pending, error, refresh } =
  useAdminResource<AuditLogDto>('/admin/audit');
const { t } = useI18n();
const format = useFormat();

const columns = computed<TableColumn[]>(() => [
  { key: 'createdAt', label: t('ADMIN.AUDIT.COL_WHEN'), width: 'w-44' },
  { key: 'actorEmail', label: t('ADMIN.AUDIT.COL_WHO'), secondary: true },
  { key: 'action', label: t('ADMIN.AUDIT.COL_ACTION'), width: 'w-44' },
  { key: 'entityId', label: t('ADMIN.AUDIT.COL_TARGET'), secondary: true, width: 'w-56' },
  { key: 'diff', label: t('ADMIN.AUDIT.COL_DIFF'), secondary: true },
]);

const diffPreview = (diff: AuditLogDto['diff']): string => {
  if (!diff || !Object.keys(diff).length) {
    return '';
  }
  const text = JSON.stringify(diff);
  return text.length > MAX_DIFF_PREVIEW ? `${text.slice(0, MAX_DIFF_PREVIEW)}…` : text;
};

useSeo(() => ({
  title: t('SEO.ADMIN.AUDIT'),
  description: t('SEO.ADMIN.AUDIT_DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div>
    <AdminPageHeader
      :title="$t('ADMIN.AUDIT.TITLE')"
      :count="total"
      :description="$t('ADMIN.AUDIT.SUBTITLE')"
    />

    <AdminToolbar
      v-model:search="search"
      :page="page"
      :page-count="pageCount"
      :total="total"
      :placeholder="$t('ADMIN.AUDIT.SEARCH_PLACEHOLDER')"
      @update:page="page = $event"
    />

    <BaseErrorState v-if="error" @retry="refresh()" />

    <AdminTable
      v-else
      :columns="columns"
      :rows="rows"
      :loading="pending"
      :empty-title="$t('ADMIN.AUDIT.EMPTY')"
    >
      <template #cell-createdAt="{ row }">
        <span class="text-xs text-ink-muted">{{ format.date(row.createdAt) }}</span>
      </template>
      <template #cell-actorEmail="{ row }">
        <span class="text-xs text-ink-muted">
          {{ row.actorEmail ?? $t('ADMIN.AUDIT.SYSTEM') }}
        </span>
      </template>
      <template #cell-action="{ row }">
        <span class="font-mono text-xs text-ink">{{ row.action }}</span>
      </template>
      <template #cell-entityId="{ row }">
        <span class="block truncate font-mono text-xs text-ink-muted">{{ row.entityId }}</span>
      </template>
      <template #cell-diff="{ row }">
        <span
          class="block max-w-md truncate font-mono text-2xs text-ink-faint"
          :title="JSON.stringify(row.diff)"
        >
          {{ diffPreview(row.diff) }}
        </span>
      </template>
    </AdminTable>
  </div>
</template>
