<script setup lang="ts">
import type { SkinDiaryEntryDto } from '@kosvia/shared';

interface CalendarCell {
  date: string;
  dayNumber: number;
  entry: SkinDiaryEntryDto | null;
  isFuture: boolean;
}

const props = defineProps<{ month: string; entries: SkinDiaryEntryDto[]; selectedDate: string }>();
const emit = defineEmits<{ select: [string] }>();

const { t } = useI18n();

const DAYS_IN_WEEK = 7;

const OVERALL_TONES: Record<number, string> = {
  1: 'bg-critical-soft',
  2: 'bg-caution-soft',
  3: 'bg-sand-soft',
  4: 'bg-sage-soft',
  5: 'bg-sage',
};

const dayHeaders = computed(() => [
  t('SHELF.PLAN.DAY.MONDAY'),
  t('SHELF.PLAN.DAY.TUESDAY'),
  t('SHELF.PLAN.DAY.WEDNESDAY'),
  t('SHELF.PLAN.DAY.THURSDAY'),
  t('SHELF.PLAN.DAY.FRIDAY'),
  t('SHELF.PLAN.DAY.SATURDAY'),
  t('SHELF.PLAN.DAY.SUNDAY'),
]);

const localIsoDate = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const cells = computed<Array<CalendarCell | null>>(() => {
  const [year, monthNumber] = props.month.split('-').map(Number);
  const firstDay = new Date(year!, monthNumber! - 1, 1);
  const daysInMonth = new Date(year!, monthNumber!, 0).getDate();
  const mondayFirstOffset = (firstDay.getDay() + 6) % DAYS_IN_WEEK;
  const today = localIsoDate(new Date());
  const entryByDate = new Map(props.entries.map((entry) => [entry.date, entry]));

  const leadingBlanks: Array<CalendarCell | null> = Array.from(
    { length: mondayFirstOffset },
    () => null,
  );
  const monthCells = Array.from({ length: daysInMonth }, (unused, index) => {
    const date = `${props.month}-${String(index + 1).padStart(2, '0')}`;
    return {
      date,
      dayNumber: index + 1,
      entry: entryByDate.get(date) ?? null,
      isFuture: date > today,
    };
  });
  return [...leadingBlanks, ...monthCells];
});
</script>

<template>
  <div>
    <div class="grid grid-cols-7 gap-1 text-center">
      <span
        v-for="header in dayHeaders"
        :key="header"
        class="text-2xs font-semibold tracking-widest text-ink-faint uppercase"
      >
        {{ header }}
      </span>
    </div>
    <div class="mt-1.5 grid grid-cols-7 gap-1">
      <template v-for="(cell, index) in cells" :key="index">
        <span v-if="!cell" />
        <button
          v-else
          type="button"
          class="relative flex aspect-square flex-col items-center justify-center rounded-lg border text-sm tabular-nums transition-colors"
          :class="[
            cell.entry ? OVERALL_TONES[cell.entry.overall] : 'bg-surface',
            cell.date === selectedDate
              ? 'border-ink font-semibold text-ink'
              : 'border-line text-ink-soft',
            cell.isFuture ? 'opacity-40' : 'hover:border-line-strong',
          ]"
          :disabled="cell.isFuture"
          :aria-label="cell.date"
          :aria-pressed="cell.date === selectedDate"
          @click="emit('select', cell.date)"
        >
          {{ cell.dayNumber }}
          <span v-if="cell.entry?.flags.length" class="mt-0.5 flex gap-0.5">
            <span
              v-for="flag in cell.entry.flags"
              :key="flag"
              class="size-1 rounded-full bg-ink/50"
            />
          </span>
        </button>
      </template>
    </div>
  </div>
</template>
