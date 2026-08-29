<script setup lang="ts">
import { INGREDIENT_TAGS, SKIN_TYPES, type SkinType } from '@kosvia/shared';
import type { TableColumn } from '../../components/Table.vue';

definePageMeta({ layout: 'admin', middleware: 'admin' });

interface IngredientRow {
  id: string;
  inciName: string;
  commonName: string | null;
  description: string | null;
  concerns: string | null;
  functions: string[];
  tags: string[];
  comedogenicRating: number | null;
  sensitivityImpact: number;
  goodForSkinTypes: SkinType[];
  isActiveIngredient: boolean;
  targetsConcerns: Array<{ slug: string; name: string }>;
  supportsGoals: Array<{ slug: string; name: string }>;
  _count: { products: number };
}

const TOLERANCE_VALUES = [-2, -1, 0, 1, 2];
const TOLERANCE_KEYS: Record<number, string> = {
  '-2': 'MINUS_2',
  '-1': 'MINUS_1',
  0: 'ZERO',
  1: 'PLUS_1',
  2: 'PLUS_2',
};

const EMPTY_FORM = {
  inciName: '',
  commonName: '',
  description: '',
  concerns: '',
  functions: '',
  tags: [] as string[],
  comedogenicRating: '' as string | number,
  sensitivityImpact: 0,
  goodForSkinTypes: [] as SkinType[],
  isActiveIngredient: false,
  targetsConcernSlugs: [] as string[],
  supportsGoalSlugs: [] as string[],
};

const {
  rows,
  total,
  pageCount,
  page,
  search,
  pending,
  error,
  saving,
  refresh,
  create,
  update,
  remove,
} = useAdminResource<IngredientRow>('/admin/ingredients');
const { concerns, goals } = useProfileOptions();
const { t } = useI18n();
const vocab = useVocabulary();

const modalOpen = ref(false);
const editing = ref<IngredientRow | null>(null);
const form = reactive({ ...EMPTY_FORM });

const columns = computed<TableColumn[]>(() => [
  { key: 'inciName', label: t('ADMIN.INGREDIENTS.COL_INCI') },
  { key: 'tags', label: t('ADMIN.INGREDIENTS.COL_TAGS'), secondary: true },
  {
    key: 'sensitivityImpact',
    label: t('ADMIN.INGREDIENTS.COL_TOLERANCE'),
    align: 'center',
    secondary: true,
    width: 'w-28',
  },
  { key: 'products', label: t('ADMIN.INGREDIENTS.COL_USED_IN'), align: 'right', width: 'w-24' },
  { key: 'actions', label: '', align: 'right', width: 'w-24' },
]);

const toleranceLabel = (value: number) =>
  t(`ADMIN.INGREDIENTS.TOLERANCE.${TOLERANCE_KEYS[value] ?? 'ZERO'}`);

const toleranceOptions = computed(() =>
  TOLERANCE_VALUES.map((value) => ({ value, label: `${value} — ${toleranceLabel(value)}` })),
);

const splitList = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const openCreate = () => {
  editing.value = null;
  Object.assign(form, EMPTY_FORM, {
    tags: [],
    goodForSkinTypes: [],
    targetsConcernSlugs: [],
    supportsGoalSlugs: [],
  });
  modalOpen.value = true;
};

const openEdit = (row: IngredientRow) => {
  editing.value = row;
  Object.assign(form, {
    inciName: row.inciName,
    commonName: row.commonName ?? '',
    description: row.description ?? '',
    concerns: row.concerns ?? '',
    functions: row.functions.join(', '),
    tags: [...row.tags],
    comedogenicRating: row.comedogenicRating ?? '',
    sensitivityImpact: row.sensitivityImpact,
    goodForSkinTypes: [...row.goodForSkinTypes],
    isActiveIngredient: row.isActiveIngredient,
    targetsConcernSlugs: row.targetsConcerns.map((entry) => entry.slug),
    supportsGoalSlugs: row.supportsGoals.map((entry) => entry.slug),
  });
  modalOpen.value = true;
};

const save = async () => {
  const body = {
    inciName: form.inciName,
    commonName: form.commonName || undefined,
    description: form.description || undefined,
    concerns: form.concerns || undefined,
    functions: splitList(form.functions),
    tags: form.tags,
    comedogenicRating: form.comedogenicRating === '' ? undefined : Number(form.comedogenicRating),
    sensitivityImpact: Number(form.sensitivityImpact),
    goodForSkinTypes: form.goodForSkinTypes,
    isActiveIngredient: form.isActiveIngredient,
    targetsConcernSlugs: form.targetsConcernSlugs,
    supportsGoalSlugs: form.supportsGoalSlugs,
  };
  const result = editing.value
    ? await update(editing.value.id, body, t('ADMIN.INGREDIENTS.SAVED'))
    : await create(body, t('ADMIN.INGREDIENTS.CREATED'));
  if (result) {
    modalOpen.value = false;
  }
};

const toggleInList = (list: string[], value: string): string[] => {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
};

useSeo(() => ({
  title: t('SEO.ADMIN.INGREDIENTS'),
  description: t('SEO.ADMIN.INGREDIENTS_DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div>
    <AdminPageHeader
      :title="$t('ADMIN.INGREDIENTS.TITLE')"
      :count="total"
      :description="$t('ADMIN.INGREDIENTS.SUBTITLE')"
    >
      <template #actions>
        <BaseButton size="sm" @click="openCreate">
          <template #icon><BaseIcon name="plus" :size="15" /></template>
          {{ $t('ADMIN.INGREDIENTS.NEW') }}
        </BaseButton>
      </template>
    </AdminPageHeader>

    <AdminToolbar
      v-model:search="search"
      :page="page"
      :page-count="pageCount"
      :total="total"
      :placeholder="$t('ADMIN.INGREDIENTS.SEARCH_PLACEHOLDER')"
      @update:page="page = $event"
    />

    <BaseErrorState v-if="error" @retry="refresh()" />

    <AdminTable
      v-else
      :columns="columns"
      :rows="rows"
      :loading="pending"
      :empty-title="$t('ADMIN.INGREDIENTS.EMPTY')"
    >
      <template #cell-inciName="{ row }">
        <span class="min-w-0">
          <span class="flex items-center gap-2">
            <span class="font-medium text-ink">{{ row.inciName }}</span>
            <BaseBadge v-if="row.isActiveIngredient" tone="peach" size="xs">
              {{ $t('ADMIN.INGREDIENTS.ACTIVE') }}
            </BaseBadge>
          </span>
          <span v-if="row.commonName" class="block text-xs text-ink-muted">
            {{ row.commonName }}
          </span>
        </span>
      </template>
      <template #cell-tags="{ row }">
        <span class="flex flex-wrap gap-1">
          <IngredientBadge v-for="tag in row.tags.slice(0, 3)" :key="tag" :tag="tag" />
          <span v-if="row.tags.length > 3" class="text-2xs text-ink-faint">
            +{{ row.tags.length - 3 }}
          </span>
        </span>
      </template>
      <template #cell-sensitivityImpact="{ row }">
        <span class="text-xs text-ink-muted">{{ toleranceLabel(row.sensitivityImpact) }}</span>
      </template>
      <template #cell-products="{ row }">
        <span class="tabular-nums text-ink-soft">{{ row._count?.products ?? 0 }}</span>
      </template>
      <template #cell-actions="{ row }">
        <span class="flex justify-end gap-0.5">
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint hover:text-ink"
            :aria-label="$t('ADMIN.INGREDIENTS.EDIT', { name: row.inciName })"
            @click="openEdit(row)"
          >
            <BaseIcon name="edit" :size="15" />
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint hover:text-critical"
            :aria-label="$t('COMMON.DELETE')"
            @click="remove(row.id, t('ADMIN.INGREDIENTS.DELETED'))"
          >
            <BaseIcon name="trash" :size="15" />
          </button>
        </span>
      </template>
    </AdminTable>

    <BaseModal
      v-model:open="modalOpen"
      :title="
        editing
          ? $t('ADMIN.INGREDIENTS.EDIT', { name: editing.inciName })
          : $t('ADMIN.INGREDIENTS.NEW')
      "
      size="lg"
    >
      <div class="space-y-5">
        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput v-model="form.inciName" :label="$t('ADMIN.INGREDIENTS.FIELD_INCI')" required />
          <BaseInput
            v-model="form.commonName"
            :label="$t('ADMIN.INGREDIENTS.FIELD_COMMON')"
            placeholder="Vitamin B3"
          />
        </div>

        <BaseTextarea
          v-model="form.description"
          :label="$t('ADMIN.INGREDIENTS.FIELD_DESCRIPTION')"
          :rows="3"
          :hint="$t('ADMIN.INGREDIENTS.DESCRIPTION_HINT')"
        />
        <BaseTextarea
          v-model="form.concerns"
          :label="$t('ADMIN.INGREDIENTS.FIELD_CONCERNS')"
          :rows="2"
          :hint="$t('ADMIN.INGREDIENTS.CONCERNS_HINT')"
        />
        <BaseInput
          v-model="form.functions"
          :label="$t('ADMIN.INGREDIENTS.FIELD_FUNCTIONS')"
          :hint="$t('ADMIN.INGREDIENTS.FUNCTIONS_HINT')"
        />

        <div>
          <p class="mb-2 text-sm font-medium text-ink-soft">
            {{ $t('ADMIN.INGREDIENTS.TAGS_LABEL') }}
          </p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="tag in INGREDIENT_TAGS"
              :key="tag"
              type="button"
              class="rounded-pill border px-2.5 py-1 text-xs transition-colors"
              :class="
                form.tags.includes(tag)
                  ? 'border-ink bg-ink text-ink-inverse'
                  : 'border-line text-ink-muted hover:border-line-strong'
              "
              @click="form.tags = toggleInList(form.tags, tag)"
            >
              {{ vocab.tag(tag) }}
            </button>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="form.comedogenicRating"
            :label="$t('ADMIN.INGREDIENTS.COMEDOGENIC')"
            type="number"
            :hint="$t('ADMIN.INGREDIENTS.COMEDOGENIC_HINT')"
          />
          <BaseNativeSelect
            v-model.number="form.sensitivityImpact"
            :options="toleranceOptions"
            :label="$t('ADMIN.INGREDIENTS.TOLERANCE_LABEL')"
          />
        </div>

        <div>
          <p class="mb-2 text-sm font-medium text-ink-soft">
            {{ $t('ADMIN.INGREDIENTS.SUITS_LABEL') }}
          </p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="type in SKIN_TYPES.filter((entry) => entry !== 'UNKNOWN')"
              :key="type"
              type="button"
              class="rounded-pill border px-2.5 py-1 text-xs transition-colors"
              :class="
                form.goodForSkinTypes.includes(type)
                  ? 'border-ink bg-ink text-ink-inverse'
                  : 'border-line text-ink-muted'
              "
              @click="
                form.goodForSkinTypes = toggleInList(form.goodForSkinTypes, type) as SkinType[]
              "
            >
              {{ vocab.skinType(type) }}
            </button>
          </div>
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <p class="mb-2 text-sm font-medium text-ink-soft">
              {{ $t('ADMIN.INGREDIENTS.TARGETS_LABEL') }}
            </p>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="concern in concerns"
                :key="concern.slug"
                type="button"
                class="rounded-pill border px-2.5 py-1 text-xs transition-colors"
                :class="
                  form.targetsConcernSlugs.includes(concern.slug)
                    ? 'border-ink bg-ink text-ink-inverse'
                    : 'border-line text-ink-muted'
                "
                @click="
                  form.targetsConcernSlugs = toggleInList(form.targetsConcernSlugs, concern.slug)
                "
              >
                {{ vocab.concern(concern.slug, concern.name) }}
              </button>
            </div>
          </div>
          <div>
            <p class="mb-2 text-sm font-medium text-ink-soft">
              {{ $t('ADMIN.INGREDIENTS.SUPPORTS_LABEL') }}
            </p>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="goal in goals"
                :key="goal.slug"
                type="button"
                class="rounded-pill border px-2.5 py-1 text-xs transition-colors"
                :class="
                  form.supportsGoalSlugs.includes(goal.slug)
                    ? 'border-ink bg-ink text-ink-inverse'
                    : 'border-line text-ink-muted'
                "
                @click="form.supportsGoalSlugs = toggleInList(form.supportsGoalSlugs, goal.slug)"
              >
                {{ vocab.goal(goal.slug, goal.name) }}
              </button>
            </div>
          </div>
        </div>

        <div class="rounded-lg border border-line bg-surface-muted p-4">
          <BaseSwitch
            v-model="form.isActiveIngredient"
            :label="$t('ADMIN.INGREDIENTS.ACTIVE_LABEL')"
            :hint="$t('ADMIN.INGREDIENTS.ACTIVE_HINT')"
          />
        </div>
      </div>

      <template #footer>
        <BaseButton variant="ghost" @click="modalOpen = false">
          {{ $t('COMMON.CANCEL') }}
        </BaseButton>
        <BaseButton :loading="saving" :disabled="!form.inciName" @click="save">
          {{ editing ? $t('ADMIN.BRANDS.SAVE_CHANGES') : $t('ADMIN.INGREDIENTS.CREATE') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
