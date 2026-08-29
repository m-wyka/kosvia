<script setup lang="ts">
import type { ImportRunDto } from '@kosvia/shared';
import type { TableColumn } from '../../components/Table.vue';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const { t } = useI18n();
const format = useFormat();

const { data, pending, error, refresh } = useApiFetch<ImportRunDto[]>('/admin/import/runs', {
  key: 'admin-import-runs',
});

const rows = computed(() => data.value ?? []);

const columns = computed<TableColumn[]>(() => [
  { key: 'source', label: t('ADMIN.IMPORTS.COL_SOURCE') },
  { key: 'status', label: t('ADMIN.IMPORTS.COL_STATUS'), width: 'w-32' },
  { key: 'params', label: t('ADMIN.IMPORTS.COL_PARAMS'), secondary: true },
  { key: 'created', label: t('ADMIN.IMPORTS.COL_CREATED'), align: 'right', width: 'w-20' },
  { key: 'updated', label: t('ADMIN.IMPORTS.COL_UPDATED'), align: 'right', width: 'w-20' },
  { key: 'skipped', label: t('ADMIN.IMPORTS.COL_SKIPPED'), align: 'right', width: 'w-20' },
  { key: 'queued', label: t('ADMIN.IMPORTS.COL_QUEUED'), align: 'right', width: 'w-24' },
  { key: 'failed', label: t('ADMIN.IMPORTS.COL_FAILED'), align: 'right', width: 'w-20' },
  { key: 'startedAt', label: t('ADMIN.IMPORTS.COL_STARTED'), secondary: true, width: 'w-40' },
]);

const statusTone = (status: ImportRunDto['status']) => {
  if (status === 'COMPLETED') {
    return 'positive';
  }
  if (status === 'RUNNING') {
    return 'info';
  }
  return 'critical';
};

const paramsSummary = (params: ImportRunDto['params']) =>
  params
    ? Object.entries(params)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(' · ')
    : '';

useSeo(() => ({
  title: t('SEO.ADMIN.IMPORTS'),
  description: t('SEO.ADMIN.IMPORTS_DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div>
    <AdminPageHeader
      :title="$t('ADMIN.IMPORTS.TITLE')"
      :count="rows.length"
      :description="$t('ADMIN.IMPORTS.SUBTITLE')"
    />

    <p
      class="mb-4 rounded-lg bg-info-soft px-3.5 py-2.5 font-mono text-xs leading-relaxed text-info"
    >
      {{ $t('ADMIN.IMPORTS.HOW_TO') }}
    </p>

    <BaseErrorState v-if="error" @retry="refresh()" />

    <AdminTable
      v-else
      :columns="columns"
      :rows="rows"
      :loading="pending"
      :empty-title="$t('ADMIN.IMPORTS.EMPTY')"
    >
      <template #cell-source="{ row }">
        <span class="flex items-center gap-2 text-sm text-ink">
          {{ row.source.name }}
          <BaseBadge v-if="row.isDryRun" tone="neutral" size="xs">
            {{ $t('ADMIN.IMPORTS.DRY_RUN') }}
          </BaseBadge>
        </span>
      </template>
      <template #cell-status="{ row }">
        <span class="block">
          <BaseBadge :tone="statusTone(row.status)" size="xs">
            {{ $t(`ADMIN.IMPORTS.STATUS_${row.status}`) }}
          </BaseBadge>
          <span
            v-if="row.errors.length"
            class="mt-1 block max-w-xs truncate text-2xs text-critical"
          >
            {{ $t('ADMIN.IMPORTS.ERRORS', { count: row.errors.length, last: row.errors.at(-1) }) }}
          </span>
        </span>
      </template>
      <template #cell-params="{ row }">
        <span class="font-mono text-xs text-ink-muted">{{ paramsSummary(row.params) }}</span>
      </template>
      <template #cell-startedAt="{ row }">
        <span class="text-xs text-ink-muted">{{ format.date(row.startedAt) }}</span>
      </template>
    </AdminTable>
  </div>
</template>
