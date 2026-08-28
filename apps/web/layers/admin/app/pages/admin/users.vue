<script setup lang="ts">
import type { TableColumn } from '../../components/Table.vue';

definePageMeta({ layout: 'admin', middleware: 'admin' });

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  subscriptionStatus: 'FREE' | 'PREMIUM' | 'CANCELLED';
  createdAt: string;
  _count: { shelfItems: number; priceAlerts: number; conversations: number };
}

const auth = useAuthStore();
const resource = useAdminResource<UserRow>('/admin/users');

const columns: TableColumn[] = [
  { key: 'user', label: 'User' },
  { key: 'role', label: 'Role', width: 'w-28' },
  { key: 'subscriptionStatus', label: 'Plan', secondary: true, width: 'w-28' },
  { key: 'activity', label: 'Activity', secondary: true },
  { key: 'createdAt', label: 'Joined', secondary: true, align: 'right' },
  { key: 'actions', label: '', align: 'right', width: 'w-20' },
];

async function setRole(user: UserRow, role: 'USER' | 'ADMIN') {
  await resource.patch(user.id, { role }, `${user.email} is now ${role.toLowerCase()}`);
}

async function confirmDelete(user: UserRow) {
  if (!confirm(`Delete ${user.email}? Their shelf, alerts and conversations go with them.`)) return;
  await resource.remove(user.id, 'User deleted');
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

useSeo({ title: 'Users · Admin', description: 'Manage user accounts.', noindex: true });
</script>

<template>
  <div>
    <AdminPageHeader title="Users" :count="resource.total.value" description="Accounts and their activity." />

    <AdminToolbar
      v-model:search="resource.search.value"
      :page="resource.page.value"
      :page-count="resource.pageCount.value"
      :total="resource.total.value"
      placeholder="Search by email or name…"
      @update:page="resource.page.value = $event"
    />

    <BaseErrorState v-if="resource.error.value" @retry="resource.refresh()" />

    <AdminTable
      v-else
      :columns="columns"
      :rows="resource.rows.value"
      :loading="resource.pending.value"
      empty-title="No users found"
    >
      <template #cell-user="{ row }">
        <span class="flex items-center gap-3">
          <BaseAvatar :name="row.name ?? row.email" :size="32" />
          <span class="min-w-0">
            <span class="block truncate text-sm font-medium text-ink">{{ row.name ?? '—' }}</span>
            <span class="block truncate text-xs text-ink-muted">{{ row.email }}</span>
          </span>
        </span>
      </template>

      <template #cell-role="{ row }">
        <select
          :value="row.role"
          class="h-8 rounded-md border border-line bg-surface px-2 text-xs"
          :disabled="row.id === auth.user?.id"
          :aria-label="`Role for ${row.email}`"
          @change="setRole(row, ($event.target as HTMLSelectElement).value as 'USER' | 'ADMIN')"
        >
          <option value="USER">User</option>
          <option value="ADMIN">Admin</option>
        </select>
      </template>

      <template #cell-subscriptionStatus="{ row }">
        <BaseBadge :tone="row.subscriptionStatus === 'PREMIUM' ? 'blush' : 'neutral'" size="xs">
          {{ row.subscriptionStatus.toLowerCase() }}
        </BaseBadge>
      </template>

      <template #cell-activity="{ row }">
        <span class="text-xs text-ink-muted">
          {{ row._count.shelfItems }} shelf · {{ row._count.priceAlerts }} alerts ·
          {{ row._count.conversations }} chats
        </span>
      </template>

      <template #cell-createdAt="{ row }">
        <span class="text-xs text-ink-muted">{{ formatDate(row.createdAt) }}</span>
      </template>

      <template #cell-actions="{ row }">
        <button
          v-if="row.id !== auth.user?.id"
          type="button"
          class="rounded-md p-1.5 text-ink-faint transition-colors hover:text-critical"
          :aria-label="`Delete ${row.email}`"
          @click="confirmDelete(row)"
        >
          <BaseIcon name="trash" :size="15" />
        </button>
      </template>
    </AdminTable>
  </div>
</template>
