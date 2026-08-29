<script setup lang="ts">
import { MATCH_WEIGHT_KEYS, type MatchWeights, type MatchWeightSetDto } from '@kosvia/shared';

definePageMeta({ layout: 'admin', middleware: 'admin' });

const MAX_WEIGHT = 50;

const GROUP_LABEL_KEY: Record<keyof MatchWeights, string> = {
  skinType: 'MATCH_GROUP.SKIN_TYPE',
  concerns: 'MATCH_GROUP.CONCERNS',
  goals: 'MATCH_GROUP.GOALS',
  ingredientQuality: 'MATCH_GROUP.INGREDIENT_QUALITY',
  fragrance: 'MATCH_GROUP.FRAGRANCE',
  sensitivity: 'MATCH_GROUP.SENSITIVITY',
  budget: 'MATCH_GROUP.BUDGET',
  ethics: 'MATCH_GROUP.ETHICS',
  brandPreference: 'MATCH_GROUP.BRAND_PREFERENCE',
  shelfContext: 'MATCH_GROUP.SHELF_CONTEXT',
};

const api = useApi();
const toast = useToast();
const message = useApiMessage();
const { t } = useI18n();
const format = useFormat();

const { data, pending, error, refresh } = await useApiFetch<MatchWeightSetDto[]>(
  '/admin/match-weights',
  { key: 'admin-match-weights' },
);

const sets = computed(() => data.value ?? []);
const active = computed(() => sets.value.find((set) => set.isActive) ?? sets.value[0] ?? null);

const form = reactive<MatchWeights>({ ...(active.value?.weights ?? ({} as MatchWeights)) });
const note = ref('');
const saving = ref(false);

watch(
  active,
  (value) => {
    if (value) {
      Object.assign(form, value.weights);
    }
  },
  { immediate: true },
);

const save = async (activate: boolean) => {
  saving.value = true;
  try {
    const created = await api<MatchWeightSetDto>('/admin/match-weights', {
      method: 'POST',
      body: { weights: form, note: note.value || undefined, activate },
    });
    note.value = '';
    await refresh();
    toast.success(
      activate
        ? t('ADMIN.MATCH_WEIGHTS.ACTIVATED', { version: created.version })
        : t('ADMIN.MATCH_WEIGHTS.SAVED'),
    );
  } catch (caught) {
    toast.error(message(caught));
  } finally {
    saving.value = false;
  }
};

const activateVersion = async (version: number) => {
  saving.value = true;
  try {
    await api(`/admin/match-weights/${version}/activate`, { method: 'POST' });
    await refresh();
    toast.success(t('ADMIN.MATCH_WEIGHTS.ACTIVATED', { version }));
  } catch (caught) {
    toast.error(message(caught));
  } finally {
    saving.value = false;
  }
};

useSeo(() => ({
  title: t('SEO.ADMIN.MATCH_WEIGHTS'),
  description: t('SEO.ADMIN.MATCH_WEIGHTS_DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div>
    <AdminPageHeader
      :title="$t('ADMIN.MATCH_WEIGHTS.TITLE')"
      :description="$t('ADMIN.MATCH_WEIGHTS.SUBTITLE')"
    />

    <BaseErrorState v-if="error" @retry="refresh()" />

    <div v-else class="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <BaseCard>
        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-for="key in MATCH_WEIGHT_KEYS"
            :key="key"
            v-model.number="form[key]"
            :label="$t(GROUP_LABEL_KEY[key])"
            type="number"
            min="0"
            :max="MAX_WEIGHT"
            step="0.5"
          />
        </div>
        <BaseTextarea
          v-model="note"
          class="mt-5"
          :label="$t('ADMIN.MATCH_WEIGHTS.NOTE')"
          :placeholder="$t('ADMIN.MATCH_WEIGHTS.NOTE_PLACEHOLDER')"
          :rows="2"
        />
        <div class="mt-5 flex flex-wrap justify-end gap-2">
          <BaseButton variant="secondary" :loading="saving" @click="save(false)">
            {{ $t('ADMIN.MATCH_WEIGHTS.SAVE_DRAFT') }}
          </BaseButton>
          <BaseButton :loading="saving" @click="save(true)">
            {{ $t('ADMIN.MATCH_WEIGHTS.SAVE_ACTIVATE') }}
          </BaseButton>
        </div>
      </BaseCard>

      <BaseCard>
        <BaseSkeleton v-if="pending" height="8rem" />
        <ul v-else class="space-y-3">
          <li
            v-for="set in sets"
            :key="set.version"
            class="flex items-start justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0"
          >
            <div class="min-w-0">
              <p class="flex items-center gap-2 text-sm font-medium text-ink">
                {{
                  set.version === 0
                    ? $t('ADMIN.MATCH_WEIGHTS.DEFAULTS')
                    : $t('ADMIN.MATCH_WEIGHTS.VERSION', { version: set.version })
                }}
                <BaseBadge v-if="set.isActive" tone="positive" size="xs">
                  {{ $t('ADMIN.MATCH_WEIGHTS.ACTIVE') }}
                </BaseBadge>
              </p>
              <p v-if="set.note" class="mt-0.5 text-xs text-ink-muted">{{ set.note }}</p>
              <p v-if="set.version > 0" class="mt-0.5 text-2xs text-ink-faint">
                {{ format.date(set.createdAt) }}
              </p>
            </div>
            <BaseButton
              v-if="!set.isActive && set.version > 0"
              variant="ghost"
              size="sm"
              :disabled="saving"
              @click="activateVersion(set.version)"
            >
              {{ $t('ADMIN.MATCH_WEIGHTS.ACTIVATE') }}
            </BaseButton>
          </li>
        </ul>
      </BaseCard>
    </div>
  </div>
</template>
