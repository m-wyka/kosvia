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

const resource = useAdminResource<IngredientRow>('/admin/ingredients');
const { concerns, goals } = useProfileOptions();

const columns: TableColumn[] = [
  { key: 'inciName', label: 'INCI' },
  { key: 'tags', label: 'Tags', secondary: true },
  { key: 'sensitivityImpact', label: 'Tolerance', align: 'center', secondary: true, width: 'w-28' },
  { key: 'products', label: 'Used in', align: 'right', width: 'w-24' },
  { key: 'actions', label: '', align: 'right', width: 'w-24' },
];

const modalOpen = ref(false);
const editing = ref<IngredientRow | null>(null);
const form = reactive({
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
});

function openCreate() {
  editing.value = null;
  Object.assign(form, {
    inciName: '', commonName: '', description: '', concerns: '', functions: '',
    tags: [], comedogenicRating: '', sensitivityImpact: 0, goodForSkinTypes: [],
    isActiveIngredient: false, targetsConcernSlugs: [], supportsGoalSlugs: [],
  });
  modalOpen.value = true;
}

function openEdit(row: IngredientRow) {
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
}

async function save() {
  const body = {
    inciName: form.inciName,
    commonName: form.commonName || undefined,
    description: form.description || undefined,
    concerns: form.concerns || undefined,
    functions: form.functions.split(',').map((entry) => entry.trim()).filter(Boolean),
    tags: form.tags,
    comedogenicRating: form.comedogenicRating === '' ? undefined : Number(form.comedogenicRating),
    sensitivityImpact: Number(form.sensitivityImpact),
    goodForSkinTypes: form.goodForSkinTypes,
    isActiveIngredient: form.isActiveIngredient,
    targetsConcernSlugs: form.targetsConcernSlugs,
    supportsGoalSlugs: form.supportsGoalSlugs,
  };
  const result = editing.value
    ? await resource.update(editing.value.id, body, 'Ingredient saved — affected product scores recomputed')
    : await resource.create(body, 'Ingredient created');
  if (result) modalOpen.value = false;
}

const TOLERANCE_LABEL: Record<number, string> = {
  [-2]: 'Often reactive',
  [-1]: 'Sometimes reactive',
  0: 'Neutral',
  1: 'Well tolerated',
  2: 'Calming',
};

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

useSeo({ title: 'Ingredients · Admin', description: 'Manage the INCI reference.', noindex: true });
</script>

<template>
  <div>
    <AdminPageHeader
      title="Ingredients"
      :count="resource.total.value"
      description="The reference the whole analysis engine reads from. Editing one recomputes every affected product score."
    >
      <template #actions>
        <BaseButton size="sm" @click="openCreate">
          <template #icon><BaseIcon name="plus" :size="15" /></template>
          New ingredient
        </BaseButton>
      </template>
    </AdminPageHeader>

    <AdminToolbar
      v-model:search="resource.search.value"
      :page="resource.page.value"
      :page-count="resource.pageCount.value"
      :total="resource.total.value"
      placeholder="Search by INCI or common name…"
      @update:page="resource.page.value = $event"
    />

    <BaseErrorState v-if="resource.error.value" @retry="resource.refresh()" />

    <AdminTable
      v-else
      :columns="columns"
      :rows="resource.rows.value"
      :loading="resource.pending.value"
      empty-title="No ingredients found"
    >
      <template #cell-inciName="{ row }">
        <span class="min-w-0">
          <span class="flex items-center gap-2">
            <span class="font-medium text-ink">{{ row.inciName }}</span>
            <BaseBadge v-if="row.isActiveIngredient" tone="peach" size="xs">Active</BaseBadge>
          </span>
          <span v-if="row.commonName" class="block text-xs text-ink-muted">{{ row.commonName }}</span>
        </span>
      </template>
      <template #cell-tags="{ row }">
        <span class="flex flex-wrap gap-1">
          <IngredientBadge v-for="tag in row.tags.slice(0, 3)" :key="tag" :tag="tag" />
          <span v-if="row.tags.length > 3" class="text-2xs text-ink-faint">+{{ row.tags.length - 3 }}</span>
        </span>
      </template>
      <template #cell-sensitivityImpact="{ row }">
        <span class="text-xs text-ink-muted">{{ TOLERANCE_LABEL[row.sensitivityImpact] ?? '—' }}</span>
      </template>
      <template #cell-products="{ row }">
        <span class="tabular-nums text-ink-soft">{{ row._count?.products ?? 0 }}</span>
      </template>
      <template #cell-actions="{ row }">
        <span class="flex justify-end gap-0.5">
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint hover:text-ink"
            :aria-label="`Edit ${row.inciName}`"
            @click="openEdit(row)"
          >
            <BaseIcon name="edit" :size="15" />
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint hover:text-critical"
            :aria-label="`Delete ${row.inciName}`"
            @click="resource.remove(row.id, 'Ingredient deleted')"
          >
            <BaseIcon name="trash" :size="15" />
          </button>
        </span>
      </template>
    </AdminTable>

    <BaseModal
      v-model:open="modalOpen"
      :title="editing ? `Edit ${editing.inciName}` : 'New ingredient'"
      size="lg"
    >
      <div class="space-y-5">
        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput v-model="form.inciName" label="INCI name" required />
          <BaseInput v-model="form.commonName" label="Common name" placeholder="Vitamin B3" />
        </div>

        <BaseTextarea
          v-model="form.description"
          label="Description"
          :rows="3"
          hint="Describe what it does. Never label an ingredient toxic or bad."
        />
        <BaseTextarea
          v-model="form.concerns"
          label="Worth knowing"
          :rows="2"
          hint="Neutral note shown in a caution box — e.g. increases sun sensitivity."
        />
        <BaseInput
          v-model="form.functions"
          label="Functions"
          hint="Comma separated, e.g. Binds water in the skin, Improves texture"
        />

        <div>
          <p class="mb-2 text-sm font-medium text-ink-soft">Tags</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="tag in INGREDIENT_TAGS"
              :key="tag"
              type="button"
              class="rounded-pill border px-2.5 py-1 text-xs transition-colors"
              :class="form.tags.includes(tag) ? 'border-ink bg-ink text-ink-inverse' : 'border-line text-ink-muted hover:border-line-strong'"
              @click="form.tags = toggle(form.tags, tag)"
            >{{ tag.replace('-', ' ') }}</button>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput
            v-model="form.comedogenicRating"
            label="Comedogenic rating"
            type="number"
            hint="0-5, or leave empty."
          />
          <div>
            <label for="tolerance" class="mb-1.5 block text-sm font-medium text-ink-soft">
              Tolerance impact
            </label>
            <select
              id="tolerance"
              v-model.number="form.sensitivityImpact"
              class="h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm"
            >
              <option v-for="value in [-2, -1, 0, 1, 2]" :key="value" :value="value">
                {{ value }} — {{ TOLERANCE_LABEL[value] }}
              </option>
            </select>
          </div>
        </div>

        <div>
          <p class="mb-2 text-sm font-medium text-ink-soft">Commonly suits</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="type in SKIN_TYPES.filter((entry) => entry !== 'UNKNOWN')"
              :key="type"
              type="button"
              class="rounded-pill border px-2.5 py-1 text-xs capitalize transition-colors"
              :class="form.goodForSkinTypes.includes(type) ? 'border-ink bg-ink text-ink-inverse' : 'border-line text-ink-muted'"
              @click="form.goodForSkinTypes = toggle(form.goodForSkinTypes, type) as SkinType[]"
            >{{ type.toLowerCase() }}</button>
          </div>
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <p class="mb-2 text-sm font-medium text-ink-soft">Targets concerns</p>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="concern in concerns"
                :key="concern.slug"
                type="button"
                class="rounded-pill border px-2.5 py-1 text-xs transition-colors"
                :class="form.targetsConcernSlugs.includes(concern.slug) ? 'border-ink bg-ink text-ink-inverse' : 'border-line text-ink-muted'"
                @click="form.targetsConcernSlugs = toggle(form.targetsConcernSlugs, concern.slug)"
              >{{ concern.name }}</button>
            </div>
          </div>
          <div>
            <p class="mb-2 text-sm font-medium text-ink-soft">Supports goals</p>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="goal in goals"
                :key="goal.slug"
                type="button"
                class="rounded-pill border px-2.5 py-1 text-xs transition-colors"
                :class="form.supportsGoalSlugs.includes(goal.slug) ? 'border-ink bg-ink text-ink-inverse' : 'border-line text-ink-muted'"
                @click="form.supportsGoalSlugs = toggle(form.supportsGoalSlugs, goal.slug)"
              >{{ goal.name }}</button>
            </div>
          </div>
        </div>

        <div class="rounded-lg border border-line bg-surface-muted p-4">
          <BaseSwitch
            v-model="form.isActiveIngredient"
            label="Headline active ingredient"
            hint="Actives carry more weight in the formula score."
          />
        </div>
      </div>

      <template #footer>
        <BaseButton variant="ghost" @click="modalOpen = false">Cancel</BaseButton>
        <BaseButton :loading="resource.saving.value" :disabled="!form.inciName" @click="save">
          {{ editing ? 'Save changes' : 'Create ingredient' }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
