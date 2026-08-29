<script setup lang="ts">
import type { PersonalMatchDto } from '@kosvia/shared';

const props = defineProps<{ match: PersonalMatchDto; slug: string }>();

const { isAuthenticated } = storeToRefs(useAuthStore());
const api = useApi();
const reasonLabel = useMatchReason();
const { locale } = useI18n();

const open = ref(false);
const explanation = ref<string | null>(null);
const explaining = ref(false);

const maxImpact = computed(() =>
  Math.max(
    1,
    ...[...props.match.reasons, ...props.match.warnings].map((entry) => Math.abs(entry.impact)),
  ),
);

const loadExplanation = async () => {
  explaining.value = true;
  try {
    const result = await api<{ explanation: string }>(
      `/ai/products/${props.slug}/why?locale=${locale.value}`,
    );
    explanation.value = result.explanation;
  } catch {
    explanation.value = null;
  } finally {
    explaining.value = false;
  }
};

const toggleExplanation = async () => {
  open.value = !open.value;
  if (!open.value || explanation.value || explaining.value) {
    return;
  }
  await loadExplanation();
};
</script>

<template>
  <BaseCard>
    <div class="flex items-start gap-4">
      <MatchScore :match="match" size="lg" :show-label="false" animate />
      <div class="min-w-0 flex-1">
        <h2 class="font-display text-xl text-ink">
          {{
            match.personalised
              ? $t('PRODUCT.MATCH_PANEL.PERSONAL_TITLE')
              : $t('PRODUCT.MATCH_PANEL.GENERIC_TITLE')
          }}
        </h2>
        <p class="mt-1 text-sm text-ink-muted">
          <template v-if="match.personalised">
            {{ $t('PRODUCT.MATCH_PANEL.PERSONAL_BODY') }}
          </template>
          <template v-else-if="isAuthenticated">
            {{ $t('PRODUCT.MATCH_PANEL.GENERIC_BODY_AUTHED') }}
          </template>
          <template v-else>
            {{ $t('PRODUCT.MATCH_PANEL.GENERIC_BODY_ANON') }}
          </template>
        </p>

        <BaseButton
          v-if="!match.personalised"
          :to="isAuthenticated ? '/onboarding' : '/register'"
          size="sm"
          class="mt-3"
        >
          {{
            isAuthenticated
              ? $t('PRODUCT.MATCH_PANEL.COMPLETE_PROFILE')
              : $t('PRODUCT.MATCH_PANEL.GET_PERSONAL_SCORE')
          }}
        </BaseButton>
      </div>
    </div>

    <button
      v-if="match.reasons.length || match.warnings.length"
      type="button"
      class="mt-5 flex w-full items-center justify-between rounded-lg border border-line px-4 py-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
      :aria-expanded="open"
      @click="toggleExplanation"
    >
      {{ $t('PRODUCT.MATCH_PANEL.WHY') }}
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
          {{ $t('PRODUCT.MATCH_PANEL.IN_FAVOUR') }}
        </p>
        <ul class="space-y-2">
          <li v-for="reason in match.reasons" :key="reason.code" class="flex items-center gap-3">
            <span class="min-w-0 flex-1 text-sm text-ink-soft">{{ reasonLabel(reason) }}</span>
            <span class="h-1.5 w-16 shrink-0 overflow-hidden rounded-pill bg-line">
              <span
                class="block h-full rounded-pill bg-sage"
                :style="{ width: `${(reason.impact / maxImpact) * 100}%` }"
              />
            </span>
            <span class="w-8 shrink-0 text-right text-xs tabular-nums text-sage">
              +{{ reason.impact }}
            </span>
          </li>
        </ul>
      </div>

      <div v-if="match.warnings.length">
        <p class="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          {{ $t('PRODUCT.MATCH_PANEL.AGAINST') }}
        </p>
        <ul class="space-y-2">
          <li v-for="warning in match.warnings" :key="warning.code" class="flex items-center gap-3">
            <span class="min-w-0 flex-1 text-sm text-ink-soft">{{ reasonLabel(warning) }}</span>
            <span class="h-1.5 w-16 shrink-0 overflow-hidden rounded-pill bg-line">
              <span
                class="block h-full rounded-pill bg-caution"
                :style="{ width: `${(Math.abs(warning.impact) / maxImpact) * 100}%` }"
              />
            </span>
            <span class="w-8 shrink-0 text-right text-xs tabular-nums text-caution">
              {{ warning.impact }}
            </span>
          </li>
        </ul>
      </div>

      <div class="rounded-lg bg-surface-muted p-4">
        <p
          class="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase"
        >
          <BaseIcon name="sparkles" :size="12" />
          {{ $t('PRODUCT.MATCH_PANEL.PLAIN_LANGUAGE') }}
        </p>
        <BaseSkeleton v-if="explaining" :lines="2" height="0.875rem" />
        <p v-else-if="explanation" class="text-sm leading-relaxed text-ink-soft">
          {{ explanation }}
        </p>
        <p v-else class="text-sm text-ink-muted">
          {{ $t('PRODUCT.MATCH_PANEL.NO_EXPLANATION') }}
        </p>
      </div>
    </div>
  </BaseCard>
</template>
