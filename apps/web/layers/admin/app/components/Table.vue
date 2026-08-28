<script setup lang="ts" generic="T extends { id: string }">
/**
 * The admin table.
 *
 * One component for every resource: pass columns and rows, override any cell
 * with a scoped slot. Loading, empty and error states are handled here so no
 * admin page has to think about them.
 */
export interface TableColumn {
  key: string;
  label: string;
  /** Tailwind width class, e.g. `w-32`. */
  width?: string;
  align?: 'left' | 'right' | 'center';
  /** Hidden below `sm` — use for secondary columns on narrow screens. */
  secondary?: boolean;
}

defineProps<{
  columns: TableColumn[];
  rows: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}>();

defineEmits<{ retry: [] }>();
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-line bg-surface">
    <div v-if="loading" class="divide-y divide-line">
      <div v-for="index in 6" :key="index" class="flex items-center gap-4 px-4 py-3.5">
        <BaseSkeleton height="1rem" width="30%" />
        <BaseSkeleton height="1rem" width="20%" />
        <BaseSkeleton height="1rem" width="15%" />
      </div>
    </div>

    <BaseEmptyState
      v-else-if="!rows.length"
      compact
      class="rounded-none border-0 bg-transparent"
      :title="emptyTitle ?? 'Nothing here yet'"
      :description="emptyDescription"
    >
      <slot name="empty-action" />
    </BaseEmptyState>

    <div v-else class="hide-scrollbar overflow-x-auto">
      <table class="w-full min-w-[40rem] text-sm">
        <thead>
          <tr class="border-b border-line bg-surface-muted/60">
            <th
              v-for="column in columns"
              :key="column.key"
              scope="col"
              class="px-4 py-2.5 text-xs font-semibold tracking-wide text-ink-muted uppercase"
              :class="[
                column.width,
                column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left',
                column.secondary && 'hidden sm:table-cell',
              ]"
            >{{ column.label }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-for="row in rows" :key="row.id" class="transition-colors hover:bg-surface-muted/50">
            <td
              v-for="column in columns"
              :key="column.key"
              class="px-4 py-3 align-middle"
              :class="[
                column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left',
                column.secondary && 'hidden sm:table-cell',
              ]"
            >
              <slot :name="`cell-${column.key}`" :row="row">
                {{ (row as Record<string, unknown>)[column.key] ?? '—' }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
