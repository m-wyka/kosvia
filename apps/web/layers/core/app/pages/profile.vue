<script setup lang="ts">
import type {
  AccountExportDto,
  ConsentType,
  BeautyProfileDto,
  BrandDto,
  IngredientDto,
  IngredientSummaryDto,
  UpdateBeautyProfilePayload,
} from '@kosvia/shared';

definePageMeta({ middleware: 'auth' });

const { user, displayName } = storeToRefs(useAuthStore());
const { markProfileComplete, logout, hasConsent, setConsent, setDeletionScheduledFor } =
  useAuthStore();
const format = useFormat();
const api = useApi();
const toast = useToast();
const message = useApiMessage();
const router = useRouter();
const localePath = useLocalePath();
const { concerns, goals, brands } = useProfileOptions();
const { t } = useI18n();
const vocab = useVocabulary();

const {
  data: profile,
  pending,
  error,
  refresh,
} = await useApiFetch<BeautyProfileDto | null>('/profile', { key: 'profile' });

const ingredientQuery = ref('');
const { data: ingredientResults, status: ingredientStatus } = await useApiFetch<IngredientDto[]>(
  () => `/ingredients?q=${encodeURIComponent(ingredientQuery.value)}`,
  { key: 'excluded-ingredient-search', watch: [ingredientQuery], default: () => [] },
);

const saving = ref(false);

const form = reactive({
  skinType: 'UNKNOWN' as BeautyProfileDto['skinType'],
  sensitivity: 'UNKNOWN' as BeautyProfileDto['sensitivity'],
  budget: 'NO_LIMIT' as BeautyProfileDto['budget'],
  fragrancePreference: 'NO_PREFERENCE' as BeautyProfileDto['fragrancePreference'],
  veganPreference: false,
  crueltyFreePreference: false,
  concernSlugs: [] as string[],
  goalSlugs: [] as string[],
  preferredBrands: [] as BrandDto[],
  excludedBrands: [] as BrandDto[],
  excludedIngredients: [] as IngredientSummaryDto[],
  allergenIngredients: [] as IngredientSummaryDto[],
});

const fillFormFrom = (value: BeautyProfileDto) => {
  form.skinType = value.skinType;
  form.sensitivity = value.sensitivity;
  form.budget = value.budget;
  form.fragrancePreference = value.fragrancePreference;
  form.veganPreference = value.veganPreference;
  form.crueltyFreePreference = value.crueltyFreePreference;
  form.concernSlugs = value.concerns.map((item) => item.slug);
  form.goalSlugs = value.goals.map((item) => item.slug);
  form.preferredBrands = value.preferredBrands as BrandDto[];
  form.excludedBrands = value.excludedBrands as BrandDto[];
  form.excludedIngredients = value.excludedIngredients.filter(
    (entry) => entry.reason === 'PREFERENCE',
  );
  form.allergenIngredients = value.excludedIngredients.filter(
    (entry) => entry.reason === 'ALLERGY',
  );
};

const toPayload = (): UpdateBeautyProfilePayload => ({
  skinType: form.skinType,
  sensitivity: form.sensitivity,
  budget: form.budget,
  fragrancePreference: form.fragrancePreference,
  veganPreference: form.veganPreference,
  crueltyFreePreference: form.crueltyFreePreference,
  concernSlugs: form.concernSlugs,
  goalSlugs: form.goalSlugs,
  preferredBrandIds: form.preferredBrands.map((brand) => brand.id),
  excludedBrandIds: form.excludedBrands.map((brand) => brand.id),
  excludedIngredients: [
    ...form.allergenIngredients.map((item) => ({
      ingredientId: item.id,
      reason: 'ALLERGY' as const,
    })),
    ...form.excludedIngredients.map((item) => ({
      ingredientId: item.id,
      reason: 'PREFERENCE' as const,
    })),
  ],
});

const save = async () => {
  saving.value = true;
  try {
    const updated = await api<BeautyProfileDto>('/profile', { method: 'PATCH', body: toPayload() });
    markProfileComplete(updated);
    await refresh();
    toast.success(t('PROFILE.SAVED'));
  } catch (caught) {
    toast.error(message(caught));
  } finally {
    saving.value = false;
  }
};

const signOut = async () => {
  await logout();
  await router.push(localePath('/'));
};

const consentBusy = ref<ConsentType | null>(null);
const exporting = ref(false);
const deleteModalOpen = ref(false);
const deletePassword = ref('');
const deleting = ref(false);
const cancellingDeletion = ref(false);

const PRIVACY_CONSENTS: Array<{ type: ConsentType; label: string; hint: string }> = [
  { type: 'BEAUTY_PROFILE_HEALTH', label: 'CONSENT.HEALTH_LABEL', hint: 'CONSENT.HEALTH_HINT' },
  { type: 'AI_PROCESSING', label: 'CONSENT.AI_LABEL', hint: 'CONSENT.AI_HINT' },
  { type: 'MARKETING_EMAIL', label: 'CONSENT.MARKETING_LABEL', hint: 'CONSENT.MARKETING_HINT' },
];

const toggleConsent = async (type: ConsentType, granted: boolean) => {
  if (
    type === 'BEAUTY_PROFILE_HEALTH' &&
    !granted &&
    !window.confirm(t('PROFILE.PRIVACY.HEALTH_WITHDRAW_CONFIRM'))
  ) {
    return;
  }
  consentBusy.value = type;
  try {
    await setConsent(type, granted);
    toast.success(t('PROFILE.PRIVACY.CONSENT_SAVED'));
  } catch (caught) {
    toast.error(message(caught));
  } finally {
    consentBusy.value = null;
  }
};

const exportData = async () => {
  exporting.value = true;
  try {
    const data = await api<AccountExportDto>('/account/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `kosvia-export-${data.exportedAt.slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (caught) {
    toast.error(message(caught));
  } finally {
    exporting.value = false;
  }
};

const requestDeletion = async () => {
  deleting.value = true;
  try {
    await api('/account', { method: 'DELETE', body: { password: deletePassword.value } });
    deleteModalOpen.value = false;
    toast.success(t('PROFILE.PRIVACY.DELETE_SCHEDULED'));
    await logout();
    await router.push(localePath('/'));
  } catch (caught) {
    toast.error(message(caught));
  } finally {
    deleting.value = false;
  }
};

const cancelDeletion = async () => {
  cancellingDeletion.value = true;
  try {
    await api('/account/deletion/cancel', { method: 'POST' });
    setDeletionScheduledFor(null);
    toast.success(t('PROFILE.PRIVACY.DELETE_CANCELLED'));
  } catch (caught) {
    toast.error(message(caught));
  } finally {
    cancellingDeletion.value = false;
  }
};

watchEffect(() => {
  const value = profile.value;
  if (!value || typeof value !== 'object') {
    return;
  }
  fillFormFrom(value);
});

useSeo(() => ({
  title: t('SEO.PROFILE.TITLE'),
  description: t('SEO.PROFILE.DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div class="container-page max-w-3xl py-8 sm:py-12">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <BaseAvatar :name="user?.name ?? user?.email" :size="52" />
        <div class="min-w-0">
          <h1 class="font-display text-2xl text-ink">{{ displayName }}</h1>
          <p class="truncate text-sm text-ink-muted">{{ user?.email }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <BaseBadge v-if="user?.subscriptionStatus === 'PREMIUM'" tone="blush">
          {{ $t('PROFILE.PREMIUM') }}
        </BaseBadge>
        <BaseButton variant="ghost" size="sm" @click="signOut">
          {{ $t('COMMON.SIGN_OUT') }}
        </BaseButton>
      </div>
    </header>

    <div
      v-if="user?.deletionScheduledFor"
      class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-critical-soft px-4 py-3 text-sm text-critical"
      role="alert"
    >
      <span>
        {{ $t('PROFILE.PRIVACY.DELETE_PENDING', { date: format.date(user.deletionScheduledFor) }) }}
      </span>
      <BaseButton
        size="sm"
        variant="secondary"
        :loading="cancellingDeletion"
        @click="cancelDeletion"
      >
        {{ $t('PROFILE.PRIVACY.DELETE_CANCEL') }}
      </BaseButton>
    </div>

    <BaseErrorState v-if="error" class="mt-8" @retry="refresh()" />

    <div v-else-if="pending" class="mt-10 space-y-6">
      <BaseSkeleton height="3rem" />
      <BaseSkeleton height="12rem" />
      <BaseSkeleton height="12rem" />
    </div>

    <form v-else class="mt-10 space-y-8" @submit.prevent="save">
      <BaseCard>
        <h2 class="font-display text-xl text-ink">{{ $t('PROFILE.SKIN_TITLE') }}</h2>
        <div class="mt-5 space-y-7">
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
      </BaseCard>

      <BaseCard>
        <h2 class="font-display text-xl text-ink">{{ $t('PROFILE.CONCERNS_TITLE') }}</h2>
        <p class="mt-1 text-sm text-ink-muted">{{ $t('PROFILE.CONCERNS_SUBTITLE') }}</p>
        <ProfileChoiceGrid
          v-model="form.concernSlugs"
          :items="concerns"
          kind="concern"
          class="mt-4"
        />
      </BaseCard>

      <BaseCard>
        <h2 class="font-display text-xl text-ink">{{ $t('PROFILE.GOALS_TITLE') }}</h2>
        <p class="mt-1 text-sm text-ink-muted">{{ $t('PROFILE.GOALS_SUBTITLE') }}</p>
        <ProfileChoiceGrid v-model="form.goalSlugs" :items="goals" kind="goal" class="mt-4" />
      </BaseCard>

      <BaseCard>
        <h2 class="font-display text-xl text-ink">{{ $t('PROFILE.PREFERENCES_TITLE') }}</h2>
        <div class="mt-5 space-y-7">
          <BaseRadioGroup
            v-model="form.fragrancePreference"
            :options="vocab.fragranceOptions.value"
            :label="$t('ONBOARDING.FRAGRANCE_LABEL')"
            :columns="3"
          />
          <BaseRadioGroup
            v-model="form.budget"
            :options="vocab.budgetOptions.value"
            :label="$t('PROFILE.BUDGET_LABEL')"
            :columns="3"
          />

          <div class="space-y-4 rounded-lg border border-line bg-surface-muted p-4">
            <BaseSwitch v-model="form.veganPreference" :label="$t('ONBOARDING.VEGAN_LABEL')" />
            <div class="border-t border-line pt-4">
              <BaseSwitch
                v-model="form.crueltyFreePreference"
                :label="$t('ONBOARDING.CRUELTY_FREE_LABEL')"
              />
            </div>
          </div>
        </div>
      </BaseCard>

      <BaseCard>
        <h2 class="font-display text-xl text-ink">{{ $t('PROFILE.BRANDS_TITLE') }}</h2>
        <div class="mt-5 space-y-5">
          <BaseSelect
            v-model="form.preferredBrands"
            :options="brands"
            option-label="name"
            track-by="id"
            :label="$t('PROFILE.PREFERRED_BRANDS')"
            :placeholder="$t('COMMON.SEARCH_BRANDS')"
            multiple
          />
          <BaseSelect
            v-model="form.excludedBrands"
            :options="brands"
            option-label="name"
            track-by="id"
            :label="$t('ONBOARDING.EXCLUDED_BRANDS')"
            :placeholder="$t('COMMON.SEARCH_BRANDS')"
            multiple
          />
          <BaseSelect
            v-model="form.allergenIngredients"
            :options="ingredientResults ?? []"
            option-label="inciName"
            track-by="id"
            :label="$t('PROFILE.ALLERGEN_INGREDIENTS')"
            :placeholder="$t('PROFILE.INGREDIENT_PLACEHOLDER')"
            :hint="$t('PROFILE.ALLERGEN_INGREDIENTS_HINT')"
            :loading="ingredientStatus === 'pending'"
            multiple
            @search-change="ingredientQuery = $event"
          />
          <BaseSelect
            v-model="form.excludedIngredients"
            :options="ingredientResults ?? []"
            option-label="inciName"
            track-by="id"
            :label="$t('PROFILE.EXCLUDED_INGREDIENTS')"
            :placeholder="$t('PROFILE.INGREDIENT_PLACEHOLDER')"
            :hint="$t('PROFILE.EXCLUDED_INGREDIENTS_HINT')"
            :loading="ingredientStatus === 'pending'"
            multiple
            @search-change="ingredientQuery = $event"
          />
        </div>
      </BaseCard>

      <div class="sticky bottom-20 z-10 flex justify-end lg:bottom-4">
        <BaseButton type="submit" size="lg" :loading="saving" class="shadow-lg">
          {{ $t('PROFILE.SAVE') }}
        </BaseButton>
      </div>
    </form>

    <BaseCard class="mt-10">
      <h2 class="font-display text-xl text-ink">{{ $t('PROFILE.PRIVACY.TITLE') }}</h2>
      <p class="mt-1 text-sm text-ink-muted">{{ $t('PROFILE.PRIVACY.SUBTITLE') }}</p>

      <div class="mt-5 space-y-4">
        <BaseSwitch
          v-for="consent in PRIVACY_CONSENTS"
          :key="consent.type"
          :model-value="hasConsent(consent.type)"
          :label="$t(consent.label)"
          :hint="$t(consent.hint)"
          :disabled="consentBusy === consent.type"
          @update:model-value="toggleConsent(consent.type, Boolean($event))"
        />
      </div>

      <div class="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <BaseButton variant="secondary" size="sm" :loading="exporting" @click="exportData">
          {{ $t('PROFILE.PRIVACY.EXPORT') }}
        </BaseButton>
        <BaseButton variant="danger" size="sm" @click="deleteModalOpen = true">
          {{ $t('PROFILE.PRIVACY.DELETE') }}
        </BaseButton>
        <NuxtLinkLocale
          to="/privacy"
          class="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          {{ $t('CONSENT.PRIVACY_LINK') }}
        </NuxtLinkLocale>
      </div>
    </BaseCard>

    <BaseModal v-model:open="deleteModalOpen" :title="$t('PROFILE.PRIVACY.DELETE_TITLE')">
      <p class="text-sm leading-relaxed text-ink-soft">
        {{ $t('PROFILE.PRIVACY.DELETE_BODY') }}
      </p>
      <BaseInput
        v-model="deletePassword"
        class="mt-4"
        :label="$t('AUTH.PASSWORD')"
        type="password"
        autocomplete="current-password"
      />
      <template #footer>
        <BaseButton variant="ghost" @click="deleteModalOpen = false">
          {{ $t('COMMON.CANCEL') }}
        </BaseButton>
        <BaseButton
          variant="danger"
          :loading="deleting"
          :disabled="!deletePassword"
          @click="requestDeletion"
        >
          {{ $t('PROFILE.PRIVACY.DELETE_CONFIRM') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
