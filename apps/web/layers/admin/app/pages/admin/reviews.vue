<script setup lang="ts">
import type { TableColumn } from '@@/layers/admin/app/components/Table.vue';
import type { AppReviewStatus } from '@kosvia/shared';

definePageMeta({ layout: 'admin', middleware: 'admin' });

interface ReviewRow {
  id: string;
  rating: number;
  body: string;
  status: AppReviewStatus;
  createdAt: string;
  user: { email: string; name: string | null };
}

const { rows, total, pageCount, page, search, pending, error, refresh, patch, remove } =
  useAdminResource<ReviewRow>('/admin/app-reviews');
const { t } = useI18n();
const format = useFormat();

const columns = computed<TableColumn[]>(() => [
  { key: 'author', label: t('ADMIN.REVIEWS.COL_AUTHOR') },
  { key: 'rating', label: t('ADMIN.REVIEWS.COL_RATING'), width: 'w-28' },
  { key: 'body', label: t('ADMIN.REVIEWS.COL_BODY') },
  { key: 'status', label: t('ADMIN.REVIEWS.COL_STATUS'), width: 'w-28' },
  { key: 'createdAt', label: t('ADMIN.REVIEWS.COL_CREATED'), secondary: true, align: 'right' },
  { key: 'actions', label: '', align: 'right', width: 'w-32' },
]);

const toggleStatus = async (review: ReviewRow) => {
  const nextStatus: AppReviewStatus = review.status === 'VISIBLE' ? 'HIDDEN' : 'VISIBLE';
  await patch(
    review.id,
    { status: nextStatus },
    nextStatus === 'HIDDEN' ? t('ADMIN.REVIEWS.HIDDEN_DONE') : t('ADMIN.REVIEWS.SHOWN_DONE'),
  );
};

const confirmDelete = async (review: ReviewRow) => {
  if (!confirm(t('ADMIN.REVIEWS.CONFIRM_DELETE', { email: review.user.email }))) {
    return;
  }
  await remove(review.id, t('ADMIN.REVIEWS.DELETED'));
};

useSeo(() => ({
  title: t('SEO.ADMIN.REVIEWS'),
  description: t('SEO.ADMIN.REVIEWS_DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div>
    <AdminPageHeader
      :title="$t('ADMIN.REVIEWS.TITLE')"
      :count="total"
      :description="$t('ADMIN.REVIEWS.SUBTITLE')"
    />

    <AdminToolbar
      v-model:search="search"
      :page="page"
      :page-count="pageCount"
      :total="total"
      :placeholder="$t('ADMIN.REVIEWS.SEARCH_PLACEHOLDER')"
      @update:page="page = $event"
    />

    <BaseErrorState v-if="error" @retry="refresh()" />

    <AdminTable
      v-else
      :columns="columns"
      :rows="rows"
      :loading="pending"
      :empty-title="$t('ADMIN.REVIEWS.EMPTY')"
    >
      <template #cell-author="{ row }">
        <span class="flex items-center gap-3">
          <BaseAvatar :name="row.user.name ?? row.user.email" :size="32" />
          <span class="min-w-0">
            <span class="block truncate text-sm font-medium text-ink">
              {{ row.user.name ?? $t('COMMON.NOT_AVAILABLE') }}
            </span>
            <span class="block truncate text-xs text-ink-muted">{{ row.user.email }}</span>
          </span>
        </span>
      </template>

      <template #cell-rating="{ row }">
        <ReviewStars :rating="row.rating" :size="14" />
      </template>

      <template #cell-body="{ row }">
        <span class="line-clamp-2 max-w-md text-xs leading-relaxed text-ink-muted">
          {{ row.body }}
        </span>
      </template>

      <template #cell-status="{ row }">
        <BaseBadge :tone="row.status === 'VISIBLE' ? 'positive' : 'neutral'" size="xs">
          {{
            row.status === 'VISIBLE'
              ? $t('ADMIN.REVIEWS.STATUS_VISIBLE')
              : $t('ADMIN.REVIEWS.STATUS_HIDDEN')
          }}
        </BaseBadge>
      </template>

      <template #cell-createdAt="{ row }">
        <span class="text-xs text-ink-muted">{{ format.date(row.createdAt) }}</span>
      </template>

      <template #cell-actions="{ row }">
        <span class="flex items-center justify-end gap-1">
          <BaseButton variant="ghost" size="sm" @click="toggleStatus(row)">
            {{ row.status === 'VISIBLE' ? $t('ADMIN.REVIEWS.HIDE') : $t('ADMIN.REVIEWS.UNHIDE') }}
          </BaseButton>
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint transition-colors hover:text-critical"
            :aria-label="$t('ADMIN.REVIEWS.DELETE_ARIA', { email: row.user.email })"
            @click="confirmDelete(row)"
          >
            <BaseIcon name="trash" :size="15" />
          </button>
        </span>
      </template>
    </AdminTable>
  </div>
</template>
