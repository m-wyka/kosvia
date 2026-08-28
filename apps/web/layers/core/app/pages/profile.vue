<script setup lang="ts">
import {
  BUDGET_OPTIONS,
  FRAGRANCE_OPTIONS,
  SENSITIVITY_OPTIONS,
  SKIN_TYPE_OPTIONS,
  type BeautyProfileDto,
  type BrandDto,
  type IngredientDto,
  type UpdateBeautyProfilePayload,
} from '@kosvia/shared';

definePageMeta({ middleware: 'auth' });

const auth = useAuthStore();
const api = useApi();
const toast = useToast();
const message = useApiMessage();
const router = useRouter();
const { concerns, goals, brands } = useProfileOptions();

const { data: profile, pending, error, refresh } = await useApiFetch<BeautyProfileDto | null>(
  '/profile',
  { key: 'profile' },
);

/** Ingredient search is remote — the library is far too big to ship to the client. */
const ingredientQuery = ref('');
const { data: ingredientResults, status: ingredientStatus } = await useApiFetch<IngredientDto[]>(
  () => `/ingredients?q=${encodeURIComponent(ingredientQuery.value)}`,
  { key: 'excluded-ingredient-search', watch: [ingredientQuery], default: () => [] },
);

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
  excludedIngredients: [] as IngredientDto[],
});

watchEffect(() => {
  const value = profile.value;
  // `""` for "no profile yet" would pass a plain truthiness check on some
  // transports; require the shape we actually read from.
  if (!value || typeof value !== 'object') return;
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
  form.excludedIngredients = value.excludedIngredients as IngredientDto[];
});

const saving = ref(false);

async function save() {
  saving.value = true;
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
      preferredBrandIds: form.preferredBrands.map((brand) => brand.id),
      excludedBrandIds: form.excludedBrands.map((brand) => brand.id),
      excludedIngredientIds: form.excludedIngredients.map((item) => item.id),
    };
    const updated = await api<BeautyProfileDto>('/profile', { method: 'PATCH', body: payload });
    auth.markProfileComplete(updated);
    await refresh();
    toast.success('Profile updated — your matches have been recalculated');
  } catch (caught) {
    toast.error(message(caught));
  } finally {
    saving.value = false;
  }
}

async function signOut() {
  await auth.logout();
  await router.push('/');
}

useSeo({ title: 'Your beauty profile', description: 'Edit your Kosvia beauty profile.', noindex: true });
</script>

<template>
  <div class="container-page max-w-3xl py-8 sm:py-12">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <BaseAvatar :name="auth.user?.name ?? auth.user?.email" :size="52" />
        <div class="min-w-0">
          <h1 class="font-display text-2xl text-ink">{{ auth.displayName }}</h1>
          <p class="truncate text-sm text-ink-muted">{{ auth.user?.email }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <BaseBadge v-if="auth.user?.subscriptionStatus === 'PREMIUM'" tone="blush">Premium</BaseBadge>
        <BaseButton variant="ghost" size="sm" @click="signOut">Sign out</BaseButton>
      </div>
    </header>

    <BaseErrorState v-if="error" class="mt-8" @retry="refresh()" />

    <div v-else-if="pending" class="mt-10 space-y-6">
      <BaseSkeleton height="3rem" />
      <BaseSkeleton height="12rem" />
      <BaseSkeleton height="12rem" />
    </div>

    <form v-else class="mt-10 space-y-8" @submit.prevent="save">
      <BaseCard>
        <h2 class="font-display text-xl text-ink">Your skin</h2>
        <div class="mt-5 space-y-7">
          <BaseRadioGroup v-model="form.skinType" :options="SKIN_TYPE_OPTIONS" label="Skin type" />
          <BaseRadioGroup
            v-model="form.sensitivity"
            :options="SENSITIVITY_OPTIONS"
            label="How reactive is your skin?"
          />
        </div>
      </BaseCard>

      <BaseCard>
        <h2 class="font-display text-xl text-ink">What bothers you</h2>
        <p class="mt-1 text-sm text-ink-muted">Products addressing these will score higher.</p>
        <ProfileChoiceGrid v-model="form.concernSlugs" :items="concerns" class="mt-4" />
      </BaseCard>

      <BaseCard>
        <h2 class="font-display text-xl text-ink">What you want</h2>
        <p class="mt-1 text-sm text-ink-muted">The direction a good routine should be pulling in.</p>
        <ProfileChoiceGrid v-model="form.goalSlugs" :items="goals" class="mt-4" />
      </BaseCard>

      <BaseCard>
        <h2 class="font-display text-xl text-ink">Preferences</h2>
        <div class="mt-5 space-y-7">
          <BaseRadioGroup
            v-model="form.fragrancePreference"
            :options="FRAGRANCE_OPTIONS"
            label="Fragrance"
            :columns="3"
          />
          <BaseRadioGroup v-model="form.budget" :options="BUDGET_OPTIONS" label="Budget per product" :columns="3" />

          <div class="space-y-4 rounded-lg border border-line bg-surface-muted p-4">
            <BaseSwitch v-model="form.veganPreference" label="Prefer vegan formulas" />
            <div class="border-t border-line pt-4">
              <BaseSwitch v-model="form.crueltyFreePreference" label="Prefer cruelty-free brands" />
            </div>
          </div>
        </div>
      </BaseCard>

      <BaseCard>
        <h2 class="font-display text-xl text-ink">Brands and ingredients</h2>
        <div class="mt-5 space-y-5">
          <BaseSelect
            v-model="form.preferredBrands"
            :options="brands"
            option-label="name"
            track-by="id"
            label="Brands you like"
            placeholder="Search brands…"
            multiple
          />
          <BaseSelect
            v-model="form.excludedBrands"
            :options="brands"
            option-label="name"
            track-by="id"
            label="Brands to skip"
            placeholder="Search brands…"
            multiple
          />
          <BaseSelect
            v-model="form.excludedIngredients"
            :options="ingredientResults ?? []"
            option-label="inciName"
            track-by="id"
            label="Ingredients to avoid"
            placeholder="Search by INCI name…"
            hint="Products containing these will be marked and pushed down your results."
            :loading="ingredientStatus === 'pending'"
            multiple
            @search-change="ingredientQuery = $event"
          />
        </div>
      </BaseCard>

      <div class="sticky bottom-20 z-10 flex justify-end lg:bottom-4">
        <BaseButton type="submit" size="lg" :loading="saving" class="shadow-lg">
          Save profile
        </BaseButton>
      </div>
    </form>
  </div>
</template>
