<script setup lang="ts">
import { APP_REVIEW_SORTS } from '@kosvia/shared';
import type { AppReviewDto, AppReviewListResult, AppReviewSort } from '@kosvia/shared';

const DEFAULT_SORT: AppReviewSort = 'newest';
const STAR_LEVELS = [5, 4, 3, 2, 1];

const isAppReviewSort = (value: unknown): value is AppReviewSort =>
  typeof value === 'string' && (APP_REVIEW_SORTS as readonly string[]).includes(value);

const api = useApi();
const toast = useToast();
const message = useApiMessage();
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { isAuthenticated } = storeToRefs(useAuthStore());

const sort = computed({
  get: () => (isAppReviewSort(route.query.sort) ? route.query.sort : DEFAULT_SORT),
  set: (value: AppReviewSort) =>
    router.push({ query: { ...route.query, sort: value, page: undefined } }),
});
const page = computed(() => {
  const parsed = Number(route.query.page ?? 1);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
});

const sortOptions = computed(() => [
  { value: 'newest' as AppReviewSort, label: t('REVIEWS.SORT_NEWEST') },
  { value: 'oldest' as AppReviewSort, label: t('REVIEWS.SORT_OLDEST') },
  { value: 'rating-desc' as AppReviewSort, label: t('REVIEWS.SORT_RATING_DESC') },
  { value: 'rating-asc' as AppReviewSort, label: t('REVIEWS.SORT_RATING_ASC') },
]);

const listUrl = computed(() => {
  const params = new URLSearchParams({ sort: sort.value });
  if (page.value > 1) {
    params.set('page', String(page.value));
  }
  return `/app-reviews?${params.toString()}`;
});

const { data, pending, error, refresh } = await useApiFetch<AppReviewListResult>(
  () => listUrl.value,
  { key: 'app-reviews', watch: [listUrl] },
);

const summary = computed(() => data.value?.summary ?? null);

const distributionPercent = (starLevel: number): string => {
  if (!summary.value || summary.value.count === 0) {
    return '0%';
  }
  const count = summary.value.distribution[starLevel - 1] ?? 0;
  return `${(count / summary.value.count) * 100}%`;
};

const myReview = ref<AppReviewDto | null>(null);

const loadMyReview = async () => {
  if (!isAuthenticated.value) {
    myReview.value = null;
    return;
  }
  myReview.value = await api<AppReviewDto | null>('/app-reviews/me');
};

const handleSaved = async (review: AppReviewDto) => {
  myReview.value = review;
  await refresh();
};

const removeMyReview = async () => {
  if (!window.confirm(t('REVIEWS.CONFIRM_DELETE'))) {
    return;
  }
  try {
    await api('/app-reviews/me', { method: 'DELETE' });
    myReview.value = null;
    await refresh();
    toast.notify(t('REVIEWS.DELETED'));
  } catch (caught) {
    toast.error(message(caught));
  }
};

const goToPage = (nextPage: number) => {
  router.push({ query: { ...route.query, page: nextPage === 1 ? undefined : nextPage } });
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

onMounted(loadMyReview);
watch(isAuthenticated, loadMyReview);
watch(data, (result) => {
  if (result && page.value > result.pageCount) {
    goToPage(result.pageCount);
  }
});

useSeo(() => ({
  title: t('SEO.REVIEWS.TITLE'),
  description: t('SEO.REVIEWS.DESCRIPTION'),
  path: '/reviews',
}));
</script>

<template>
  <div class="container-page py-8 sm:py-12">
    <header class="mb-8">
      <h1 class="font-display text-3xl text-ink sm:text-4xl">{{ $t('REVIEWS.TITLE') }}</h1>
      <p class="mt-2 text-sm text-ink-muted">{{ $t('REVIEWS.SUBTITLE') }}</p>
    </header>

    <div class="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div class="space-y-6">
        <section
          v-if="summary"
          class="rounded-2xl border border-line bg-surface p-6"
          :aria-label="$t('REVIEWS.SUMMARY_COUNT', summary.count)"
        >
          <div class="flex items-center gap-4">
            <span class="font-display text-5xl leading-none text-ink">
              {{ summary.average ?? '–' }}
            </span>
            <div class="space-y-1">
              <ReviewStars :rating="summary.average ?? 0" :size="20" />
              <p class="text-sm text-ink-muted">
                {{ $t('REVIEWS.SUMMARY_COUNT', summary.count) }}
              </p>
            </div>
          </div>
          <ul class="mt-5 space-y-1.5">
            <li v-for="starLevel in STAR_LEVELS" :key="starLevel" class="flex items-center gap-2">
              <span class="w-4 text-right text-xs tabular-nums text-ink-muted">
                {{ starLevel }}
              </span>
              <BaseIcon name="star-filled" :size="12" class="text-caution" />
              <span class="h-2 flex-1 overflow-hidden rounded-pill bg-surface-muted">
                <span
                  class="block h-full rounded-pill bg-sage"
                  :style="{ width: distributionPercent(starLevel) }"
                />
              </span>
              <span class="w-8 text-right text-xs tabular-nums text-ink-faint">
                {{ summary.distribution[starLevel - 1] }}
              </span>
            </li>
          </ul>
        </section>

        <section class="rounded-2xl border border-line bg-surface p-6">
          <template v-if="!isAuthenticated">
            <h2 class="font-display text-xl text-ink">{{ $t('REVIEWS.LOGIN_TITLE') }}</h2>
            <p class="mt-2 text-sm leading-relaxed text-ink-muted">
              {{ $t('REVIEWS.LOGIN_BODY') }}
            </p>
            <BaseButton to="/login" class="mt-4">
              {{ $t('REVIEWS.LOGIN_CTA') }}
            </BaseButton>
          </template>

          <template v-else-if="myReview">
            <div class="flex items-center justify-between gap-3">
              <h2 class="font-display text-xl text-ink">{{ $t('REVIEWS.YOUR_REVIEW') }}</h2>
              <button
                type="button"
                class="rounded-md p-2 text-ink-faint transition-colors hover:text-critical cursor-pointer"
                :aria-label="$t('REVIEWS.DELETE')"
                @click="removeMyReview"
              >
                <BaseIcon name="trash" :size="16" />
              </button>
            </div>
            <ReviewCard :review="myReview" class="mt-4" />
          </template>

          <template v-else>
            <h2 class="font-display text-xl text-ink">{{ $t('REVIEWS.FORM_TITLE') }}</h2>
            <ReviewForm class="mt-4" @saved="handleSaved" />
          </template>
        </section>
      </div>

      <div>
        <div class="mb-4 flex items-center justify-end gap-3">
          <span class="shrink-0 text-sm text-ink-muted">
            {{ $t('REVIEWS.SORT_LABEL') }}
          </span>
          <BaseNativeSelect v-model="sort" :options="sortOptions" size="sm" class="max-w-48" />
        </div>

        <BaseErrorState v-if="error" @retry="refresh()" />

        <div v-else-if="pending" class="space-y-3">
          <BaseSkeleton v-for="index in 4" :key="index" height="7rem" rounded="var(--radius-xl)" />
        </div>

        <BaseEmptyState
          v-else-if="!data?.items.length"
          icon="star"
          :title="$t('REVIEWS.EMPTY_TITLE')"
          :description="$t('REVIEWS.EMPTY_BODY')"
        />

        <template v-else>
          <ul class="space-y-4">
            <li v-for="review in data.items" :key="review.id">
              <ReviewCard :review="review" />
            </li>
          </ul>

          <nav
            v-if="data.pageCount > 1"
            class="mt-8 flex items-center justify-center gap-2"
            :aria-label="$t('SEARCH.PAGE', { page, total: data.pageCount })"
          >
            <BaseButton
              variant="secondary"
              size="sm"
              :disabled="page <= 1"
              @click="goToPage(page - 1)"
            >
              {{ $t('COMMON.PREVIOUS') }}
            </BaseButton>
            <span class="px-3 text-sm tabular-nums text-ink-muted">
              {{ $t('SEARCH.PAGE', { page, total: data.pageCount }) }}
            </span>
            <BaseButton
              variant="secondary"
              size="sm"
              :disabled="page >= data.pageCount"
              @click="goToPage(page + 1)"
            >
              {{ $t('COMMON.NEXT') }}
            </BaseButton>
          </nav>
        </template>
      </div>
    </div>
  </div>
</template>
