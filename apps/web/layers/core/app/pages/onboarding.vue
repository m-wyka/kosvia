<script setup lang="ts">
import type {
  BeautyProfileDto,
  BrandDto,
  BudgetTier,
  FragrancePreference,
  SensitivityLevel,
  SkinType,
  UpdateBeautyProfilePayload,
} from '@kosvia/shared';

definePageMeta({
  layout: 'focused',
  middleware: [
    'auth',
    () => {
      const { needsOnboarding } = storeToRefs(useAuthStore());
      if (!needsOnboarding.value) {
        return navigateTo(useLocalePath()('/profile'));
      }
    },
  ],
});

const { profile: existingProfile } = storeToRefs(useAuthStore());
const { markProfileComplete } = useAuthStore();
const router = useRouter();
const localePath = useLocalePath();
const api = useApi();
const message = useApiMessage();
const { concerns, goals, brands } = useProfileOptions();
const { t } = useI18n();
const vocab = useVocabulary();

const steps = [
  { key: 'skin', title: 'ONBOARDING.SKIN_TITLE', subtitle: 'ONBOARDING.SKIN_SUBTITLE' },
  { key: 'concerns', title: 'ONBOARDING.CONCERNS_TITLE', subtitle: 'ONBOARDING.CONCERNS_SUBTITLE' },
  { key: 'goals', title: 'ONBOARDING.GOALS_TITLE', subtitle: 'ONBOARDING.GOALS_SUBTITLE' },
  {
    key: 'preferences',
    title: 'ONBOARDING.PREFERENCES_TITLE',
    subtitle: 'ONBOARDING.PREFERENCES_SUBTITLE',
  },
  { key: 'budget', title: 'ONBOARDING.BUDGET_TITLE', subtitle: 'ONBOARDING.BUDGET_SUBTITLE' },
];

const existing = existingProfile.value;

const form = reactive({
  skinType: (existing?.skinType ?? 'UNKNOWN') as SkinType,
  sensitivity: (existing?.sensitivity ?? 'UNKNOWN') as SensitivityLevel,
  concernSlugs: existing?.concerns?.map((concern) => concern.slug) ?? [],
  goalSlugs: existing?.goals?.map((goal) => goal.slug) ?? [],
  fragrancePreference: (existing?.fragrancePreference ?? 'NO_PREFERENCE') as FragrancePreference,
  veganPreference: existing?.veganPreference ?? false,
  crueltyFreePreference: existing?.crueltyFreePreference ?? false,
  excludedBrands: (existing?.excludedBrands ?? []) as BrandDto[],
  budget: (existing?.budget ?? 'NO_LIMIT') as BudgetTier,
});

const step = ref(0);
const saving = ref(false);
const error = ref('');

const currentStep = computed(() => steps[step.value]!);
const progress = computed(() => ((step.value + 1) / steps.length) * 100);
const isLast = computed(() => step.value === steps.length - 1);

const toPayload = (): UpdateBeautyProfilePayload => ({
  skinType: form.skinType,
  sensitivity: form.sensitivity,
  budget: form.budget,
  fragrancePreference: form.fragrancePreference,
  veganPreference: form.veganPreference,
  crueltyFreePreference: form.crueltyFreePreference,
  concernSlugs: form.concernSlugs,
  goalSlugs: form.goalSlugs,
  excludedBrandIds: form.excludedBrands.map((brand) => brand.id),
});

const save = async () => {
  saving.value = true;
  error.value = '';
  try {
    const profile = await api<BeautyProfileDto>('/profile', { method: 'PATCH', body: toPayload() });
    markProfileComplete(profile);
    await router.push(localePath('/dashboard'));
  } catch (caught) {
    error.value = message(caught);
  } finally {
    saving.value = false;
  }
};

const goToNextStep = async () => {
  if (isLast.value) {
    await save();
    return;
  }
  step.value += 1;
};

useSeo(() => ({
  title: t('SEO.ONBOARDING.TITLE'),
  description: t('SEO.ONBOARDING.DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div class="w-full max-w-2xl">
    <div class="mb-8">
      <div class="mb-2 flex items-center justify-between text-xs text-ink-muted">
        <span>{{ $t('ONBOARDING.STEP', { current: step + 1, total: steps.length }) }}</span>
        <button
          v-if="!isLast"
          type="button"
          class="underline-offset-4 hover:text-ink hover:underline"
          @click="save"
        >
          {{ $t('ONBOARDING.SKIP') }}
        </button>
      </div>
      <div
        class="h-1 overflow-hidden rounded-pill bg-line"
        role="progressbar"
        :aria-valuenow="step + 1"
        aria-valuemin="1"
        :aria-valuemax="steps.length"
      >
        <div
          class="h-full rounded-pill bg-ink transition-[width] duration-[--duration-slow] ease-[--ease-out-soft]"
          :style="{ width: `${progress}%` }"
        />
      </div>
    </div>

    <h1 class="font-display text-3xl text-ink">{{ $t(currentStep.title) }}</h1>
    <p class="mt-2 text-sm text-ink-muted">{{ $t(currentStep.subtitle) }}</p>

    <div class="mt-8 min-h-[19rem]">
      <div v-if="currentStep.key === 'skin'" class="space-y-8">
        <BaseRadioGroup
          v-model="form.skinType"
          :options="vocab.skinTypeOptions.value"
          :label="$t('ONBOARDING.SKIN_TYPE_LABEL')"
        />
        <BaseRadioGroup
          v-model="form.sensitivity"
          :options="vocab.sensitivityOptions.value"
          :label="$t('ONBOARDING.SENSITIVITY_LABEL')"
        />
      </div>

      <ProfileChoiceGrid
        v-else-if="currentStep.key === 'concerns'"
        v-model="form.concernSlugs"
        :items="concerns"
        kind="concern"
      />

      <ProfileChoiceGrid
        v-else-if="currentStep.key === 'goals'"
        v-model="form.goalSlugs"
        :items="goals"
        kind="goal"
      />

      <div v-else-if="currentStep.key === 'preferences'" class="space-y-8">
        <BaseRadioGroup
          v-model="form.fragrancePreference"
          :options="vocab.fragranceOptions.value"
          :label="$t('ONBOARDING.FRAGRANCE_LABEL')"
          :columns="3"
        />

        <div class="space-y-4 rounded-lg border border-line bg-surface p-4">
          <BaseSwitch
            v-model="form.veganPreference"
            :label="$t('ONBOARDING.VEGAN_LABEL')"
            :hint="$t('ONBOARDING.VEGAN_HINT')"
          />
          <div class="border-t border-line pt-4">
            <BaseSwitch
              v-model="form.crueltyFreePreference"
              :label="$t('ONBOARDING.CRUELTY_FREE_LABEL')"
              :hint="$t('ONBOARDING.CRUELTY_FREE_HINT')"
            />
          </div>
        </div>

        <BaseSelect
          v-model="form.excludedBrands"
          :options="brands"
          option-label="name"
          track-by="id"
          :label="$t('ONBOARDING.EXCLUDED_BRANDS')"
          :placeholder="$t('ONBOARDING.BRAND_PLACEHOLDER')"
          :hint="$t('ONBOARDING.EXCLUDED_BRANDS_HINT')"
          multiple
        />
      </div>

      <BaseRadioGroup
        v-else-if="currentStep.key === 'budget'"
        v-model="form.budget"
        :options="vocab.budgetOptions.value"
        :label="$t('ONBOARDING.BUDGET_LABEL')"
        :columns="3"
      />
    </div>

    <p
      v-if="error"
      class="mt-4 flex items-start gap-2 rounded-lg bg-critical-soft px-3.5 py-2.5 text-sm text-critical"
      role="alert"
    >
      <BaseIcon name="alert" :size="15" class="mt-0.5 shrink-0" />
      {{ error }}
    </p>

    <div class="mt-8 flex items-center justify-between gap-3 border-t border-line pt-6">
      <BaseButton variant="ghost" :disabled="step === 0" @click="step = Math.max(0, step - 1)">
        {{ $t('COMMON.BACK') }}
      </BaseButton>
      <BaseButton size="lg" :loading="saving" @click="goToNextStep">
        {{ isLast ? $t('ONBOARDING.FINISH') : $t('COMMON.CONTINUE') }}
        <template #icon><BaseIcon v-if="!isLast" name="arrow-right" :size="17" /></template>
      </BaseButton>
    </div>
  </div>
</template>
