<script setup lang="ts">
import { SKIN_DIARY_FLAGS, type SkinDiaryFlag, type SkinDiaryStatsDto } from '@kosvia/shared';

const props = defineProps<{ stats: SkinDiaryStatsDto }>();

const { t } = useI18n();

const flagLabel = (flag: SkinDiaryFlag): string => {
  if (flag === 'breakouts') {
    return t('DIARY.FLAG.BREAKOUTS');
  }
  if (flag === 'dryness') {
    return t('DIARY.FLAG.DRYNESS');
  }
  if (flag === 'irritation') {
    return t('DIARY.FLAG.IRRITATION');
  }
  return t('DIARY.FLAG.REDNESS');
};

const flagRows = computed(() =>
  SKIN_DIARY_FLAGS.map((flag) => ({
    flag,
    label: flagLabel(flag),
    current: props.stats.flagCounts[flag],
    previous: props.stats.previousMonthFlagCounts[flag],
  })).filter((row) => row.current > 0 || row.previous > 0),
);
</script>

<template>
  <BaseCard>
    <h2 class="text-sm font-semibold text-ink">
      {{ $t('DIARY.STATS.TITLE') }}
    </h2>
    <dl class="mt-3 space-y-1.5 text-sm">
      <div class="flex items-center justify-between gap-2">
        <dt class="text-ink-muted">{{ $t('DIARY.STATS.LOGGED_DAYS') }}</dt>
        <dd class="font-medium tabular-nums text-ink">{{ stats.loggedDays }}</dd>
      </div>
      <div v-if="stats.averageOverall !== null" class="flex items-center justify-between gap-2">
        <dt class="text-ink-muted">{{ $t('DIARY.STATS.AVERAGE') }}</dt>
        <dd class="font-medium tabular-nums text-ink">{{ stats.averageOverall }} / 5</dd>
      </div>
    </dl>

    <template v-if="flagRows.length">
      <h3 class="mt-4 text-xs font-medium tracking-wide text-ink-muted uppercase">
        {{ $t('DIARY.STATS.VS_LAST_MONTH') }}
      </h3>
      <ul class="mt-2 space-y-1 text-sm">
        <li v-for="row in flagRows" :key="row.flag" class="flex items-center justify-between gap-2">
          <span class="text-ink-muted">{{ row.label }}</span>
          <span class="tabular-nums text-ink">
            {{ row.current }}
            <span class="text-ink-faint">/ {{ row.previous }}</span>
          </span>
        </li>
      </ul>
    </template>
  </BaseCard>
</template>
