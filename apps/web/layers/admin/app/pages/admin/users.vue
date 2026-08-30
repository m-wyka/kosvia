<script setup lang="ts">
import type { TableColumn } from '@@/layers/admin/app/components/Table.vue';

definePageMeta({ layout: 'admin', middleware: 'admin' });

type UserRole = 'USER' | 'ADMIN';

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  subscriptionStatus: 'FREE' | 'PREMIUM' | 'CANCELLED';
  createdAt: string;
  _count: { shelfItems: number; priceAlerts: number; conversations: number };
}

const { user: currentUser } = storeToRefs(useAuthStore());
const { rows, total, pageCount, page, search, pending, error, refresh, patch, remove } =
  useAdminResource<UserRow>('/admin/users');
const { t } = useI18n();
const format = useFormat();

const columns = computed<TableColumn[]>(() => [
  { key: 'user', label: t('ADMIN.USERS.COL_USER') },
  { key: 'role', label: t('ADMIN.USERS.COL_ROLE'), width: 'w-28' },
  { key: 'subscriptionStatus', label: t('ADMIN.USERS.COL_PLAN'), secondary: true, width: 'w-28' },
  { key: 'activity', label: t('ADMIN.USERS.COL_ACTIVITY'), secondary: true },
  { key: 'createdAt', label: t('ADMIN.USERS.COL_JOINED'), secondary: true, align: 'right' },
  { key: 'actions', label: '', align: 'right', width: 'w-20' },
]);

const roleLabel = (role: UserRole): string =>
  role === 'ADMIN' ? t('ADMIN.USERS.ROLE_ADMIN') : t('ADMIN.USERS.ROLE_USER');

const setRole = async (user: UserRow, role: UserRole) => {
  await patch(
    user.id,
    { role },
    t('ADMIN.USERS.ROLE_CHANGED', { email: user.email, role: roleLabel(role) }),
  );
};

const confirmDelete = async (user: UserRow) => {
  if (!confirm(t('ADMIN.USERS.CONFIRM_DELETE', { email: user.email }))) {
    return;
  }
  await remove(user.id, t('ADMIN.USERS.DELETED'));
};

useSeo(() => ({
  title: t('SEO.ADMIN.USERS'),
  description: t('SEO.ADMIN.USERS_DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div>
    <AdminPageHeader
      :title="$t('ADMIN.USERS.TITLE')"
      :count="total"
      :description="$t('ADMIN.USERS.SUBTITLE')"
    />

    <AdminToolbar
      v-model:search="search"
      :page="page"
      :page-count="pageCount"
      :total="total"
      :placeholder="$t('ADMIN.USERS.SEARCH_PLACEHOLDER')"
      @update:page="page = $event"
    />

    <BaseErrorState v-if="error" @retry="refresh()" />

    <AdminTable
      v-else
      :columns="columns"
      :rows="rows"
      :loading="pending"
      :empty-title="$t('ADMIN.USERS.EMPTY')"
    >
      <template #cell-user="{ row }">
        <span class="flex items-center gap-3">
          <BaseAvatar :name="row.name ?? row.email" :size="32" />
          <span class="min-w-0">
            <span class="block truncate text-sm font-medium text-ink">
              {{ row.name ?? $t('COMMON.NOT_AVAILABLE') }}
            </span>
            <span class="block truncate text-xs text-ink-muted">{{ row.email }}</span>
          </span>
        </span>
      </template>

      <template #cell-role="{ row }">
        <select
          :value="row.role"
          class="h-8 rounded-md border border-line bg-surface px-2 text-xs"
          :disabled="row.id === currentUser?.id"
          :aria-label="$t('ADMIN.USERS.ROLE_ARIA', { email: row.email })"
          @change="setRole(row, ($event.target as HTMLSelectElement).value as 'USER' | 'ADMIN')"
        >
          <option value="USER">{{ $t('ADMIN.USERS.ROLE_USER') }}</option>
          <option value="ADMIN">{{ $t('ADMIN.USERS.ROLE_ADMIN') }}</option>
        </select>
      </template>

      <template #cell-subscriptionStatus="{ row }">
        <BaseBadge :tone="row.subscriptionStatus === 'PREMIUM' ? 'blush' : 'neutral'" size="xs">
          {{ $t(`ADMIN.USERS.PLAN.${row.subscriptionStatus}`) }}
        </BaseBadge>
      </template>

      <template #cell-activity="{ row }">
        <span class="text-xs text-ink-muted">
          {{
            $t('ADMIN.USERS.ACTIVITY', {
              shelf: row._count.shelfItems,
              alerts: row._count.priceAlerts,
              chats: row._count.conversations,
            })
          }}
        </span>
      </template>

      <template #cell-createdAt="{ row }">
        <span class="text-xs text-ink-muted">{{ format.date(row.createdAt) }}</span>
      </template>

      <template #cell-actions="{ row }">
        <button
          v-if="row.id !== currentUser?.id"
          type="button"
          class="rounded-md p-1.5 text-ink-faint transition-colors hover:text-critical"
          :aria-label="$t('ADMIN.USERS.DELETE_ARIA', { email: row.email })"
          @click="confirmDelete(row)"
        >
          <BaseIcon name="trash" :size="15" />
        </button>
      </template>
    </AdminTable>
  </div>
</template>
