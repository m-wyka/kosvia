<script setup lang="ts">
import type { PersonalMatchDto } from '@kosvia/shared';

/**
 * The Personal Match panel with its "Why?" breakdown.
 *
 * The numbers are the deterministic ones from the API. The optional AI
 * paragraph is fetched separately and clearly labelled as an explanation of
 * that score, never as its source.
 */
const props = defineProps<{ match: PersonalMatchDto; slug: string }>();

const auth = useAuthStore();
const api = useApi();

const open = ref(false);
const explanation = ref<string | null>(null);
const explaining = ref(false);

async function explain() {
  open.value = !open.value;
  if (!open.value || explanation.value || explaining.value) return;
  explaining.value = true;
  try {
    const result = await api<{ explanation: string }>(`/ai/products/${props.slug}/why`);
    explanation.value = result.explanation;
  } catch {
    explanation.value = null;
  } finally {
    explaining.value = false;
  }
}

const maxImpact = computed(() =>
  Math.max(1, ...[...props.match.reasons, ...props.match.warnings].map((entry) => Math.abs(entry.impact))),
);
</script>

<template>
  <BaseCard>
    <div class="flex items-start gap-4">
      <MatchScore :match="match" size="lg" :show-label="false" animate />
      <div class="min-w-0 flex-1">
        <h2 class="font-display text-xl text-ink">
          {{ match.personalised ? 'Your Personal Match' : 'Formula score' }}
        </h2>
        <p class="mt-1 text-sm text-ink-muted">
          <template v-if="match.personalised">
            Computed from your profile, your shelf and this ingredient list.
          </template>
          <template v-else-if="auth.isAuthenticated">
            Based on formula quality alone — complete your profile to make it personal.
          </template>
          <template v-else>
            Based on formula quality alone. Sign in to score it against your skin.
          </template>
        </p>

        <BaseButton
          v-if="!match.personalised"
          :to="auth.isAuthenticated ? '/onboarding' : '/register'"
          size="sm"
          class="mt-3"
        >{{ auth.isAuthenticated ? 'Complete my profile' : 'Get my personal score' }}</BaseButton>
      </div>
    </div>

    <button
      v-if="match.reasons.length || match.warnings.length"
      type="button"
      class="mt-5 flex w-full items-center justify-between rounded-lg border border-line px-4 py-3
             text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
      :aria-expanded="open"
      @click="explain"
    >
      Why this score?
      <BaseIcon
        name="chevron-down"
        :size="16"
        class="text-ink-faint transition-transform duration-[--duration-fast]"
        :class="open && 'rotate-180'"
      />
    </button>

    <div v-if="open" class="animate-fade-up mt-4 space-y-4">
      <div v-if="match.reasons.length">
        <p class="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Working in its favour
        </p>
        <ul class="space-y-2">
          <li
            v-for="reason in match.reasons"
            :key="reason.code"
            class="flex items-center gap-3"
          >
            <span class="min-w-0 flex-1 text-sm text-ink-soft">{{ reason.label }}</span>
            <span class="h-1.5 w-16 shrink-0 overflow-hidden rounded-pill bg-line">
              <span
                class="block h-full rounded-pill bg-sage"
                :style="{ width: `${(reason.impact / maxImpact) * 100}%` }"
              />
            </span>
            <span class="w-8 shrink-0 text-right text-xs tabular-nums text-sage">+{{ reason.impact }}</span>
          </li>
        </ul>
      </div>

      <div v-if="match.warnings.length">
        <p class="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Worth weighing up
        </p>
        <ul class="space-y-2">
          <li
            v-for="warning in match.warnings"
            :key="warning.code"
            class="flex items-center gap-3"
          >
            <span class="min-w-0 flex-1 text-sm text-ink-soft">{{ warning.label }}</span>
            <span class="h-1.5 w-16 shrink-0 overflow-hidden rounded-pill bg-line">
              <span
                class="block h-full rounded-pill bg-caution"
                :style="{ width: `${(Math.abs(warning.impact) / maxImpact) * 100}%` }"
              />
            </span>
            <span class="w-8 shrink-0 text-right text-xs tabular-nums text-caution">{{ warning.impact }}</span>
          </li>
        </ul>
      </div>

      <div class="rounded-lg bg-surface-muted p-4">
        <p class="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          <BaseIcon name="sparkles" :size="12" />
          In plain language
        </p>
        <BaseSkeleton v-if="explaining" :lines="2" height="0.875rem" />
        <p v-else-if="explanation" class="text-sm leading-relaxed text-ink-soft">{{ explanation }}</p>
        <p v-else class="text-sm text-ink-muted">
          The breakdown above is the whole story for this one.
        </p>
      </div>
    </div>
  </BaseCard>
</template>
