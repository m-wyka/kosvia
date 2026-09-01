<script setup lang="ts">
import {
  SKIN_TYPES,
  type BrandDto,
  type CategoryDto,
  type LabelImportResultDto,
  type ProductDto,
  type SkinType,
} from '@kosvia/shared';
import type { TableColumn } from '@@/layers/admin/app/components/Table.vue';

definePageMeta({ layout: 'admin', middleware: 'admin' });

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  ean: string | null;
  isActive: boolean;
  ingredientScore: number;
  lowestPrice: string | number | null;
  brand: { id: string; name: string };
  category: { id: string; name: string };
  _count: { offers: number; ingredients: number };
}

const CATEGORY_TRAIL_SEPARATOR = ' › ';

const EMPTY_FORM = {
  name: '',
  slug: '',
  brandId: '',
  categoryId: '',
  ean: '',
  description: '',
  usage: '',
  imageUrl: '',
  volume: '' as string | number,
  volumeUnit: 'ml',
  paoMonths: '' as string | number,
  highlights: '',
  isFragranceFree: false,
  isVegan: false,
  isCrueltyFree: false,
  isActive: true,
  targetSkinTypes: [] as SkinType[],
};

const api = useApi();
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
} = useAdminResource<ProductRow>('/admin/products');
const { t } = useI18n();
const vocab = useVocabulary();
const format = useFormat();

const { data: brands } = await useApiFetch<BrandDto[]>('/brands', { key: 'brands' });
const { data: categories } = await useApiFetch<CategoryDto[]>('/categories', {
  key: 'categories',
});

const modalOpen = ref(false);
const editing = ref<ProductRow | null>(null);
const loadingDetail = ref(false);
const form = reactive({ ...EMPTY_FORM });
const labelText = ref('');
const importingLabel = ref(false);
const labelResult = ref<LabelImportResultDto | null>(null);
const toast = useToast();
const apiMessage = useApiMessage();

const labelResultSummary = computed(() => {
  const result = labelResult.value;
  if (!result) {
    return '';
  }
  return t('ADMIN.PRODUCTS.LABEL_RESULT', {
    matched: result.matched,
    total: result.total,
    ratio: Math.round(result.recognizedRatio * 100),
  });
});

const collectLeafCategories = (
  nodes: CategoryDto[],
  trail: string[],
  output: Array<{ value: string; label: string }>,
) => {
  for (const node of nodes) {
    const label = vocab.category(node.slug, node.name);
    if (node.children?.length) {
      collectLeafCategories(node.children, [...trail, label], output);
      continue;
    }
    output.push({ value: node.id, label: [...trail, label].join(CATEGORY_TRAIL_SEPARATOR) });
  }
};

const categoryOptions = computed(() => {
  const leaves: Array<{ value: string; label: string }> = [];
  collectLeafCategories(categories.value ?? [], [], leaves);
  return [{ value: '', label: t('ADMIN.PRODUCTS.CATEGORY_PLACEHOLDER') }, ...leaves];
});

const brandOptions = computed(() => [
  { value: '', label: t('ADMIN.PRODUCTS.BRAND_PLACEHOLDER') },
  ...(brands.value ?? []).map((brand) => ({ value: brand.id, label: brand.name })),
]);

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: t('ADMIN.PRODUCTS.COL_PRODUCT') },
  { key: 'brand', label: t('ADMIN.PRODUCTS.COL_BRAND'), secondary: true },
  { key: 'category', label: t('ADMIN.PRODUCTS.COL_CATEGORY'), secondary: true },
  { key: 'ingredientScore', label: t('ADMIN.PRODUCTS.COL_SCORE'), align: 'center', width: 'w-20' },
  { key: 'lowestPrice', label: t('ADMIN.PRODUCTS.COL_FROM'), align: 'right', width: 'w-28' },
  { key: 'status', label: t('ADMIN.PRODUCTS.COL_STATUS'), align: 'center', width: 'w-24' },
  { key: 'actions', label: '', align: 'right', width: 'w-24' },
]);

const resetForm = () => {
  Object.assign(form, EMPTY_FORM, { targetSkinTypes: [] });
};

const openCreate = () => {
  editing.value = null;
  resetForm();
  modalOpen.value = true;
};

const openEdit = async (row: ProductRow) => {
  editing.value = row;
  modalOpen.value = true;
  loadingDetail.value = true;
  labelResult.value = null;
  try {
    const detail = await api<ProductDto & { isActive: boolean; paoMonths: number | null }>(
      `/admin/products/${row.id}`,
    );
    labelText.value = detail.ingredients.map((entry) => entry.ingredient.inciName).join(', ');
    Object.assign(form, {
      name: detail.name,
      slug: detail.slug,
      brandId: detail.brand.id,
      categoryId: detail.category.id,
      ean: detail.ean ?? '',
      description: detail.description ?? '',
      usage: detail.usage ?? '',
      imageUrl: detail.imageUrl ?? '',
      volume: detail.volume ?? '',
      volumeUnit: detail.volumeUnit ?? 'ml',
      paoMonths: detail.paoMonths ?? '',
      highlights: detail.highlights.join('\n'),
      isFragranceFree: detail.isFragranceFree,
      isVegan: detail.isVegan,
      isCrueltyFree: detail.isCrueltyFree,
      isActive: detail.isActive ?? true,
      targetSkinTypes: [],
    });
  } finally {
    loadingDetail.value = false;
  }
};

const save = async () => {
  const body = {
    name: form.name,
    slug: form.slug || undefined,
    brandId: form.brandId,
    categoryId: form.categoryId,
    ean: form.ean || null,
    description: form.description || undefined,
    usage: form.usage || undefined,
    imageUrl: form.imageUrl || undefined,
    volume: form.volume === '' ? undefined : Number(form.volume),
    volumeUnit: form.volumeUnit,
    paoMonths: form.paoMonths === '' ? null : Number(form.paoMonths),
    highlights: form.highlights
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    isFragranceFree: form.isFragranceFree,
    isVegan: form.isVegan,
    isCrueltyFree: form.isCrueltyFree,
    isActive: form.isActive,
    targetSkinTypes: form.targetSkinTypes,
  };
  const result = editing.value
    ? await update(editing.value.id, body, t('ADMIN.PRODUCTS.SAVED'))
    : await create(body, t('ADMIN.PRODUCTS.CREATED'));
  if (result) {
    modalOpen.value = false;
  }
};

const importLabel = async () => {
  const product = editing.value;
  if (!product || !labelText.value.trim()) {
    return;
  }
  importingLabel.value = true;
  try {
    labelResult.value = await api<LabelImportResultDto>(
      `/admin/products/${product.id}/ingredients/label`,
      { method: 'PUT', body: { rawLabel: labelText.value } },
    );
    toast.success(t('ADMIN.PRODUCTS.LABEL_IMPORTED'));
    await refresh();
  } catch (caught) {
    toast.error(apiMessage(caught));
  } finally {
    importingLabel.value = false;
  }
};

const toggleSkinType = (type: SkinType) => {
  form.targetSkinTypes = form.targetSkinTypes.includes(type)
    ? form.targetSkinTypes.filter((entry) => entry !== type)
    : [...form.targetSkinTypes, type];
};

useSeo(() => ({
  title: t('SEO.ADMIN.PRODUCTS'),
  description: t('SEO.ADMIN.PRODUCTS_DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div>
    <AdminPageHeader
      :title="$t('ADMIN.PRODUCTS.TITLE')"
      :count="total"
      :description="$t('ADMIN.PRODUCTS.SUBTITLE')"
    >
      <template #actions>
        <BaseButton size="sm" @click="openCreate">
          <template #icon><BaseIcon name="plus" :size="15" /></template>
          {{ $t('ADMIN.PRODUCTS.NEW') }}
        </BaseButton>
      </template>
    </AdminPageHeader>

    <AdminToolbar
      v-model:search="search"
      :page="page"
      :page-count="pageCount"
      :total="total"
      :placeholder="$t('ADMIN.PRODUCTS.SEARCH_PLACEHOLDER')"
      @update:page="page = $event"
    />

    <BaseErrorState v-if="error" @retry="refresh()" />

    <AdminTable
      v-else
      :columns="columns"
      :rows="rows"
      :loading="pending"
      :empty-title="$t('ADMIN.PRODUCTS.EMPTY')"
    >
      <template #cell-name="{ row }">
        <span class="min-w-0">
          <NuxtLinkLocale
            :to="`/products/${row.slug}`"
            class="text-sm font-medium text-ink hover:underline"
          >
            {{ row.name }}
          </NuxtLinkLocale>
          <span class="block text-xs text-ink-muted">
            {{
              $t('ADMIN.PRODUCTS.META', {
                ingredients: row._count?.ingredients ?? 0,
                offers: row._count?.offers ?? 0,
              })
            }}
          </span>
        </span>
      </template>
      <template #cell-brand="{ row }">
        <span class="text-sm text-ink-soft">{{ row.brand.name }}</span>
      </template>
      <template #cell-category="{ row }">
        <span class="text-sm text-ink-muted">{{ row.category.name }}</span>
      </template>
      <template #cell-ingredientScore="{ row }">
        <span class="text-sm font-medium tabular-nums text-ink">{{ row.ingredientScore }}</span>
      </template>
      <template #cell-lowestPrice="{ row }">
        <span class="text-sm whitespace-nowrap tabular-nums text-ink-soft">
          {{ row.lowestPrice ? format.price(Number(row.lowestPrice)) : $t('COMMON.NOT_AVAILABLE') }}
        </span>
      </template>
      <template #cell-status="{ row }">
        <BaseBadge :tone="row.isActive ? 'sage' : 'neutral'" size="xs">
          {{ row.isActive ? $t('ADMIN.PRODUCTS.LIVE') : $t('ADMIN.PRODUCTS.HIDDEN') }}
        </BaseBadge>
      </template>
      <template #cell-actions="{ row }">
        <span class="flex justify-end gap-0.5">
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint hover:text-ink"
            :aria-label="$t('ADMIN.PRODUCTS.EDIT', { name: row.name })"
            @click="openEdit(row)"
          >
            <BaseIcon name="edit" :size="15" />
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint hover:text-critical"
            :aria-label="$t('COMMON.DELETE')"
            @click="remove(row.id, t('ADMIN.PRODUCTS.DELETED'))"
          >
            <BaseIcon name="trash" :size="15" />
          </button>
        </span>
      </template>
    </AdminTable>

    <BaseModal
      v-model:open="modalOpen"
      :title="
        editing ? $t('ADMIN.PRODUCTS.EDIT', { name: editing.name }) : $t('ADMIN.PRODUCTS.NEW')
      "
      size="lg"
    >
      <div v-if="loadingDetail" class="space-y-4">
        <BaseSkeleton height="2.75rem" />
        <BaseSkeleton height="2.75rem" />
        <BaseSkeleton height="6rem" />
      </div>

      <div v-else class="space-y-5">
        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput v-model="form.name" :label="$t('ADMIN.PRODUCTS.FIELD_NAME')" required />
          <BaseInput
            v-model="form.slug"
            :label="$t('ADMIN.PRODUCTS.FIELD_SLUG')"
            :hint="$t('ADMIN.PRODUCTS.SLUG_HINT')"
          />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <BaseNativeSelect
            v-model="form.brandId"
            :options="brandOptions"
            :label="$t('ADMIN.PRODUCTS.BRAND_LABEL')"
          />
          <BaseNativeSelect
            v-model="form.categoryId"
            :options="categoryOptions"
            :label="$t('ADMIN.PRODUCTS.CATEGORY_LABEL')"
          />
        </div>

        <div class="grid gap-4 sm:grid-cols-4">
          <BaseInput
            v-model="form.ean"
            :label="$t('ADMIN.PRODUCTS.FIELD_EAN')"
            placeholder="5901234567890"
          />
          <BaseInput
            v-model="form.volume"
            :label="$t('ADMIN.PRODUCTS.FIELD_VOLUME')"
            type="number"
          />
          <BaseInput
            v-model="form.volumeUnit"
            :label="$t('ADMIN.PRODUCTS.FIELD_UNIT')"
            placeholder="ml"
          />
          <BaseInput
            v-model="form.paoMonths"
            :label="$t('ADMIN.PRODUCTS.FIELD_PAO')"
            :hint="$t('ADMIN.PRODUCTS.FIELD_PAO_HINT')"
            type="number"
          />
        </div>

        <BaseTextarea
          v-model="form.description"
          :label="$t('ADMIN.PRODUCTS.FIELD_DESCRIPTION')"
          :rows="4"
        />
        <BaseTextarea v-model="form.usage" :label="$t('ADMIN.PRODUCTS.FIELD_USAGE')" :rows="2" />
        <BaseTextarea
          v-model="form.highlights"
          :label="$t('ADMIN.PRODUCTS.FIELD_HIGHLIGHTS')"
          :rows="3"
          :hint="$t('ADMIN.PRODUCTS.HIGHLIGHTS_HINT')"
        />
        <BaseInput
          v-model="form.imageUrl"
          :label="$t('ADMIN.PRODUCTS.FIELD_IMAGE')"
          placeholder="/img/product/slug.svg"
        />

        <div>
          <p class="mb-2 text-sm font-medium text-ink-soft">
            {{ $t('ADMIN.PRODUCTS.POSITIONED_FOR') }}
          </p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="type in SKIN_TYPES.filter((entry) => entry !== 'UNKNOWN')"
              :key="type"
              type="button"
              class="rounded-pill border px-2.5 py-1 text-xs transition-colors"
              :class="
                form.targetSkinTypes.includes(type)
                  ? 'border-ink bg-ink text-ink-inverse'
                  : 'border-line text-ink-muted'
              "
              @click="toggleSkinType(type)"
            >
              {{ vocab.skinType(type) }}
            </button>
          </div>
        </div>

        <div class="grid gap-3 rounded-lg border border-line bg-surface-muted p-4 sm:grid-cols-2">
          <BaseSwitch v-model="form.isFragranceFree" :label="$t('SEARCH.FILTER.FRAGRANCE_FREE')" />
          <BaseSwitch v-model="form.isVegan" :label="$t('SEARCH.FILTER.VEGAN')" />
          <BaseSwitch v-model="form.isCrueltyFree" :label="$t('SEARCH.FILTER.CRUELTY_FREE')" />
          <BaseSwitch v-model="form.isActive" :label="$t('ADMIN.PRODUCTS.VISIBLE')" />
        </div>

        <div v-if="editing" class="space-y-3 rounded-lg border border-line p-4">
          <BaseTextarea
            v-model="labelText"
            :label="$t('ADMIN.PRODUCTS.LABEL_TITLE')"
            :hint="$t('ADMIN.PRODUCTS.LABEL_HINT')"
            :placeholder="$t('ADMIN.PRODUCTS.LABEL_PLACEHOLDER')"
            :rows="4"
          />
          <div class="flex flex-wrap items-center justify-between gap-3">
            <span v-if="labelResult" class="text-xs text-ink-muted">
              {{ labelResultSummary }}
            </span>
            <BaseButton
              size="sm"
              variant="secondary"
              :loading="importingLabel"
              :disabled="!labelText.trim()"
              @click="importLabel"
            >
              {{ $t('ADMIN.PRODUCTS.LABEL_IMPORT') }}
            </BaseButton>
          </div>
          <p
            v-if="labelResult?.unmatched.length"
            class="rounded-lg bg-warning-soft px-3.5 py-2.5 text-xs leading-relaxed text-warning"
          >
            {{ $t('ADMIN.PRODUCTS.LABEL_UNMATCHED', { tokens: labelResult.unmatched.join(', ') }) }}
          </p>
        </div>
        <p v-else class="rounded-lg bg-info-soft px-3.5 py-2.5 text-xs leading-relaxed text-info">
          {{ $t('ADMIN.PRODUCTS.INGREDIENT_NOTE') }}
        </p>
      </div>

      <template #footer>
        <BaseButton variant="ghost" @click="modalOpen = false">
          {{ $t('COMMON.CANCEL') }}
        </BaseButton>
        <BaseButton
          :loading="saving"
          :disabled="!form.name || !form.brandId || !form.categoryId"
          @click="save"
        >
          {{ editing ? $t('ADMIN.BRANDS.SAVE_CHANGES') : $t('ADMIN.PRODUCTS.CREATE') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
