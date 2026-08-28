<script setup lang="ts">
import {
  BUDGET_OPTIONS,
  FRAGRANCE_OPTIONS,
  SENSITIVITY_OPTIONS,
  SKIN_TYPE_OPTIONS,
  type BeautyProfileDto,
  type BrandDto,
  type BudgetTier,
  type FragrancePreference,
  type SensitivityLevel,
  type SkinType,
  type UpdateBeautyProfilePayload,
} from '@kosvia/shared';

definePageMeta({ layout: 'focused', middleware: 'auth' });

const auth = useAuthStore();
const router = useRouter();
const api = useApi();
const message = useApiMessage();
const { concerns, goals, brands } = useProfileOptions();

// Null before onboarding has ever run, which is the common case on this page.
const existing = await auth.loadProfile();

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

const steps = [
  { key: 'skin', title: 'Your skin', subtitle: 'The starting point for everything else.' },
  { key: 'concerns', title: 'What bothers you', subtitle: 'Pick as many as apply — or none.' },
  { key: 'goals', title: 'What you want', subtitle: 'What should a good routine be doing for you?' },
  { key: 'preferences', title: 'Your preferences', subtitle: 'Rules we should never break.' },
  { key: 'budget', title: 'Your budget', subtitle: 'What a single product is usually worth to you.' },
];

const step = ref(0);
const currentStep = computed(() => steps[step.value]!);
const saving = ref(false);
const error = ref('');
const progress = computed(() => ((step.value + 1) / steps.length) * 100);
const isLast = computed(() => step.value === steps.length - 1);

function next() {
  if (isLast.value) return save();
  step.value += 1;
}

async function save() {
  saving.value = true;
  error.value = '';
  try {
    const payload: UpdateBeautyProfilePayload = {
      skinType: form.skinType,
      sensitivity: form.sensitivity,
      budget: form.budget,
      fragrancePreference: form.fragrancePreference,
      veganPreference: form.veganPreference,
      crueltyFreePreference: form.crueltyFreePreference,
      concernSlugs: form.concernSlugs,
      goalSlugs: form.goalSlugs,
      excludedBrandIds: form.excludedBrands.map((brand) => brand.id),
    };
    const profile = await api<BeautyProfileDto>('/profile', { method: 'PATCH', body: payload });
    auth.markProfileComplete(profile);
    await router.push('/dashboard');
  } catch (caught) {
    error.value = message(caught);
  } finally {
    saving.value = false;
  }
}

useSeo({
  title: 'Set up your beauty profile',
  description: 'Tell Kosvia about your skin so every product gets a personal match score.',
  noindex: true,
});
</script>

<template>
  <div class="w-full max-w-2xl">
    <div class="mb-8">
      <div class="mb-2 flex items-center justify-between text-xs text-ink-muted">
        <span>Step {{ step + 1 }} of {{ steps.length }}</span>
        <button
          v-if="!isLast"
          type="button"
          class="underline-offset-4 hover:text-ink hover:underline"
          @click="save"
        >Skip the rest</button>
      </div>
      <div class="h-1 overflow-hidden rounded-pill bg-line" role="progressbar" :aria-valuenow="step + 1" aria-valuemin="1" :aria-valuemax="steps.length">
        <div
          class="h-full rounded-pill bg-ink transition-[width] duration-[--duration-slow] ease-[--ease-out-soft]"
          :style="{ width: `${progress}%` }"
        />
      </div>
    </div>

    <h1 class="font-display text-3xl text-ink">{{ currentStep.title }}</h1>
    <p class="mt-2 text-sm text-ink-muted">{{ currentStep.subtitle }}</p>

    <div class="mt-8 min-h-[19rem]">
      <div v-if="currentStep.key === 'skin'" class="space-y-8">
        <BaseRadioGroup v-model="form.skinType" :options="SKIN_TYPE_OPTIONS" label="Skin type" />
        <BaseRadioGroup
          v-model="form.sensitivity"
          :options="SENSITIVITY_OPTIONS"
          label="How reactive is your skin?"
        />
      </div>

      <ProfileChoiceGrid
        v-else-if="currentStep.key === 'concerns'"
        v-model="form.concernSlugs"
        :items="concerns"
      />

      <ProfileChoiceGrid
        v-else-if="currentStep.key === 'goals'"
        v-model="form.goalSlugs"
        :items="goals"
      />

      <div v-else-if="currentStep.key === 'preferences'" class="space-y-8">
        <BaseRadioGroup
          v-model="form.fragrancePreference"
          :options="FRAGRANCE_OPTIONS"
          label="Fragrance"
          :columns="3"
        />

        <div class="space-y-4 rounded-lg border border-line bg-surface p-4">
          <BaseSwitch
            v-model="form.veganPreference"
            label="Prefer vegan formulas"
            hint="We will rank vegan products higher and flag ones that are not."
          />
          <div class="border-t border-line pt-4">
            <BaseSwitch
              v-model="form.crueltyFreePreference"
              label="Prefer cruelty-free brands"
              hint="Based on what the brand states."
            />
          </div>
        </div>

        <BaseSelect
          v-model="form.excludedBrands"
          :options="brands"
          option-label="name"
          track-by="id"
          label="Brands to skip"
          placeholder="Search brands…"
          hint="Anything you never want to see recommended."
          multiple
        />
      </div>

      <BaseRadioGroup
        v-else-if="currentStep.key === 'budget'"
        v-model="form.budget"
        :options="BUDGET_OPTIONS"
        label="Typical budget for one product"
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
      <BaseButton
        variant="ghost"
        :disabled="step === 0"
        @click="step = Math.max(0, step - 1)"
      >Back</BaseButton>
      <BaseButton size="lg" :loading="saving" @click="next">
        {{ isLast ? 'See my matches' : 'Continue' }}
        <template #icon><BaseIcon v-if="!isLast" name="arrow-right" :size="17" /></template>
      </BaseButton>
    </div>
  </div>
</template>
