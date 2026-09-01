<script setup lang="ts">
import type { RoutinePlanAssignmentDto, RoutinePlanDto } from '@kosvia/shared';

defineProps<{ plan: RoutinePlanDto }>();

const { t } = useI18n();
const localise = useLocalisedText();

const dayLabels = computed(() => [
  t('SHELF.PLAN.DAY.MONDAY'),
  t('SHELF.PLAN.DAY.TUESDAY'),
  t('SHELF.PLAN.DAY.WEDNESDAY'),
  t('SHELF.PLAN.DAY.THURSDAY'),
  t('SHELF.PLAN.DAY.FRIDAY'),
  t('SHELF.PLAN.DAY.SATURDAY'),
  t('SHELF.PLAN.DAY.SUNDAY'),
]);

const assignmentKey = (assignment: RoutinePlanAssignmentDto, index: number): string => {
  return `${assignment.productId}-${index}`;
};
</script>

<template>
  <div>
    <div class="overflow-x-auto rounded-xl border border-line bg-surface">
      <div class="grid min-w-224 grid-cols-7 divide-x divide-line">
        <div v-for="day in plan.days" :key="day.day" class="min-w-0 p-3">
          <p class="text-2xs font-semibold tracking-widest text-ink-faint uppercase">
            {{ dayLabels[day.day] }}
          </p>

          <p class="mt-3 text-2xs font-medium tracking-wide text-ink-muted uppercase">
            {{ $t('SHELF.PLAN.MORNING') }}
          </p>
          <ul class="mt-1.5 space-y-1">
            <li v-for="(assignment, index) in day.morning" :key="assignmentKey(assignment, index)">
              <NuxtLinkLocale
                :to="`/products/${assignment.productSlug}`"
                class="block truncate rounded-md bg-surface-muted px-2 py-1 text-xs text-ink-soft transition-colors hover:text-ink"
                :title="localise(assignment.reason)"
              >
                {{ assignment.productName }}
              </NuxtLinkLocale>
            </li>
          </ul>

          <p class="mt-3 text-2xs font-medium tracking-wide text-ink-muted uppercase">
            {{ $t('SHELF.PLAN.EVENING') }}
          </p>
          <ul class="mt-1.5 space-y-1">
            <li v-for="(assignment, index) in day.evening" :key="assignmentKey(assignment, index)">
              <NuxtLinkLocale
                :to="`/products/${assignment.productSlug}`"
                class="block truncate rounded-md bg-lavender-soft/50 px-2 py-1 text-xs text-ink-soft transition-colors hover:text-ink"
                :title="localise(assignment.reason)"
              >
                {{ assignment.productName }}
              </NuxtLinkLocale>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <p v-if="plan.unscheduled.length" class="mt-3 text-sm text-ink-muted">
      {{ $t('SHELF.PLAN.UNSCHEDULED') }}
      <template v-for="(assignment, index) in plan.unscheduled" :key="assignment.productId">
        <template v-if="index > 0">,</template>
        <NuxtLinkLocale
          :to="`/products/${assignment.productSlug}`"
          class="text-ink-soft underline-offset-4 hover:underline"
        >
          {{ assignment.productName }}
        </NuxtLinkLocale>
      </template>
    </p>

    <p v-for="note in plan.notes" :key="note.code" class="mt-2 text-xs text-ink-faint">
      {{ localise(note) }}
    </p>
  </div>
</template>
