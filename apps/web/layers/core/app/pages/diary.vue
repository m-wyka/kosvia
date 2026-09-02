<script setup lang="ts">
import type { SkinDiaryMonthDto } from '@kosvia/shared';

definePageMeta({ middleware: 'auth' });

const { hasConsent } = useAuthStore();
const { t, locale } = useI18n();

const localIsoDate = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const today = localIsoDate(new Date());
const hasHealthConsent = computed(() => hasConsent('BEAUTY_PROFILE_HEALTH'));

const month = ref(today.slice(0, 7));
const selectedDate = ref(today);

const { data, pending, error, refresh } = await useApiFetch<SkinDiaryMonthDto>(
  () => `/diary?month=${month.value}`,
  {
    key: 'diary-month',
    watch: [month],
    immediate: hasHealthConsent.value,
    server: false,
  },
);

const monthLabel = computed(() => {
  const [year, monthNumber] = month.value.split('-').map(Number);
  return new Intl.DateTimeFormat(locale.value === 'pl' ? 'pl-PL' : 'en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year!, monthNumber! - 1, 1));
});

const selectedEntry = computed(
  () => data.value?.entries.find((entry) => entry.date === selectedDate.value) ?? null,
);

const shiftMonth = (offset: number) => {
  const [year, monthNumber] = month.value.split('-').map(Number);
  const shifted = new Date(year!, monthNumber! - 1 + offset, 1);
  month.value = localIsoDate(shifted).slice(0, 7);
};

const handleSelect = (date: string) => {
  selectedDate.value = date;
};

watch(hasHealthConsent, (isGranted) => {
  if (isGranted) {
    refresh();
  }
});

useSeo(() => ({
  title: t('SEO.DIARY.TITLE'),
  description: t('SEO.DIARY.DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div class="container-page py-8 sm:py-12">
    <header class="mb-8 max-w-2xl">
      <h1 class="font-display text-3xl text-ink sm:text-4xl">
        {{ $t('DIARY.TITLE') }}
      </h1>
      <p class="mt-2 text-sm leading-relaxed text-ink-muted">
        {{ $t('DIARY.SUBTITLE') }}
      </p>
    </header>

    <div v-if="!hasHealthConsent" class="py-8">
      <AccountConsentGate
        type="BEAUTY_PROFILE_HEALTH"
        :title="$t('DIARY.CONSENT.TITLE')"
        :body="$t('DIARY.CONSENT.BODY')"
        :checkbox-label="$t('CONSENT.HEALTH_LABEL')"
        :confirm-label="$t('DIARY.CONSENT.CONFIRM')"
      />
    </div>

    <template v-else>
      <BaseErrorState v-if="error" @retry="refresh()" />

      <PremiumPrompt
        v-if="!error && data?.historyLimited"
        :message="$t('DIARY.HISTORY_LIMITED')"
        class="mb-6"
      />

      <div v-if="!error" class="grid items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section>
          <div class="mb-4 flex items-center justify-between gap-3">
            <h2 class="font-display text-xl text-ink capitalize">
              {{ monthLabel }}
            </h2>
            <span class="flex gap-1">
              <BaseButton
                variant="secondary"
                size="sm"
                :aria-label="$t('DIARY.PREVIOUS_MONTH')"
                @click="shiftMonth(-1)"
              >
                <template #icon>
                  <BaseIcon name="chevron-left" :size="16" />
                </template>
              </BaseButton>
              <BaseButton
                variant="secondary"
                size="sm"
                :disabled="month >= today.slice(0, 7)"
                :aria-label="$t('DIARY.NEXT_MONTH')"
                @click="shiftMonth(1)"
              >
                <template #icon>
                  <BaseIcon name="chevron-right" :size="16" />
                </template>
              </BaseButton>
            </span>
          </div>

          <BaseSkeleton v-if="pending" height="20rem" rounded="var(--radius-xl)" />
          <DiaryMonthGrid
            v-else
            :month="month"
            :entries="data?.entries ?? []"
            :selected-date="selectedDate"
            @select="handleSelect"
          />

          <p class="mt-4 text-xs leading-relaxed text-ink-muted">
            {{ $t('DIARY.DISCLAIMER') }}
          </p>
        </section>

        <div class="space-y-4">
          <DiaryEntryForm
            :date="selectedDate"
            :entry="selectedEntry"
            @saved="refresh()"
            @deleted="refresh()"
          />
          <DiaryStatsCard v-if="data && data.stats.loggedDays > 0" :stats="data.stats" />
        </div>
      </div>
    </template>
  </div>
</template>
