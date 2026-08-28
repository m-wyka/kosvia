<script setup lang="ts">
import { formatPrice, SKIN_TYPES, type BrandDto, type CategoryDto, type ProductDto, type SkinType } from '@kosvia/shared';
import type { TableColumn } from '../../components/Table.vue';

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

const api = useApi();
const resource = useAdminResource<ProductRow>('/admin/products');

const { data: brands } = await useApiFetch<BrandDto[]>('/brands', { key: 'brands' });
const { data: categories } = await useApiFetch<CategoryDto[]>('/categories', { key: 'categories' });

/** Only leaf categories can hold products, so those are the only options offered. */
const categoryOptions = computed(() => {
  const output: Array<{ id: string; name: string }> = [];
  const walk = (nodes: CategoryDto[], trail: string[]) => {
    for (const node of nodes) {
      if (!node.children?.length) output.push({ id: node.id, name: [...trail, node.name].join(' › ') });
      else walk(node.children, [...trail, node.name]);
    }
  };
  walk(categories.value ?? [], []);
  return output;
});

const columns: TableColumn[] = [
  { key: 'name', label: 'Product' },
  { key: 'brand', label: 'Brand', secondary: true },
  { key: 'category', label: 'Category', secondary: true },
  { key: 'ingredientScore', label: 'Score', align: 'center', width: 'w-20' },
  { key: 'lowestPrice', label: 'From', align: 'right', width: 'w-28' },
  { key: 'status', label: 'Status', align: 'center', width: 'w-24' },
  { key: 'actions', label: '', align: 'right', width: 'w-24' },
];

const modalOpen = ref(false);
const editing = ref<ProductRow | null>(null);
const loadingDetail = ref(false);
const form = reactive({
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
  highlights: '',
  isFragranceFree: false,
  isVegan: false,
  isCrueltyFree: false,
  isActive: true,
  targetSkinTypes: [] as SkinType[],
});

function reset() {
  Object.assign(form, {
    name: '', slug: '', brandId: '', categoryId: '', ean: '', description: '', usage: '',
    imageUrl: '', volume: '', volumeUnit: 'ml', highlights: '', isFragranceFree: false,
    isVegan: false, isCrueltyFree: false, isActive: true, targetSkinTypes: [],
  });
}

function openCreate() {
  editing.value = null;
  reset();
  modalOpen.value = true;
}

async function openEdit(row: ProductRow) {
  editing.value = row;
  modalOpen.value = true;
  loadingDetail.value = true;
  try {
    const detail = await api<ProductDto & { isActive: boolean }>(`/admin/products/${row.id}`);
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
}

async function save() {
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
    highlights: form.highlights.split('\n').map((line) => line.trim()).filter(Boolean),
    isFragranceFree: form.isFragranceFree,
    isVegan: form.isVegan,
    isCrueltyFree: form.isCrueltyFree,
    isActive: form.isActive,
    targetSkinTypes: form.targetSkinTypes,
  };
  const result = editing.value
    ? await resource.update(editing.value.id, body, 'Product saved')
    : await resource.create(body, 'Product created');
  if (result) modalOpen.value = false;
}

function toggleSkinType(type: SkinType) {
  form.targetSkinTypes = form.targetSkinTypes.includes(type)
    ? form.targetSkinTypes.filter((entry) => entry !== type)
    : [...form.targetSkinTypes, type];
}

useSeo({ title: 'Products · Admin', description: 'Manage the catalogue.', noindex: true });
</script>

<template>
  <div>
    <AdminPageHeader
      title="Products"
      :count="resource.total.value"
      description="Saving a product recomputes its ingredient score."
    >
      <template #actions>
        <BaseButton size="sm" @click="openCreate">
          <template #icon><BaseIcon name="plus" :size="15" /></template>
          New product
        </BaseButton>
      </template>
    </AdminPageHeader>

    <AdminToolbar
      v-model:search="resource.search.value"
      :page="resource.page.value"
      :page-count="resource.pageCount.value"
      :total="resource.total.value"
      placeholder="Search by name, slug, EAN or brand…"
      @update:page="resource.page.value = $event"
    />

    <BaseErrorState v-if="resource.error.value" @retry="resource.refresh()" />

    <AdminTable
      v-else
      :columns="columns"
      :rows="resource.rows.value"
      :loading="resource.pending.value"
      empty-title="No products found"
    >
      <template #cell-name="{ row }">
        <span class="min-w-0">
          <NuxtLink :to="`/products/${row.slug}`" class="text-sm font-medium text-ink hover:underline">
            {{ row.name }}
          </NuxtLink>
          <span class="block text-xs text-ink-muted">
            {{ row._count?.ingredients ?? 0 }} ingredients · {{ row._count?.offers ?? 0 }} offers
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
          {{ row.lowestPrice ? formatPrice(Number(row.lowestPrice)) : '—' }}
        </span>
      </template>
      <template #cell-status="{ row }">
        <BaseBadge :tone="row.isActive ? 'sage' : 'neutral'" size="xs">
          {{ row.isActive ? 'Live' : 'Hidden' }}
        </BaseBadge>
      </template>
      <template #cell-actions="{ row }">
        <span class="flex justify-end gap-0.5">
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint hover:text-ink"
            :aria-label="`Edit ${row.name}`"
            @click="openEdit(row)"
          >
            <BaseIcon name="edit" :size="15" />
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-ink-faint hover:text-critical"
            :aria-label="`Delete ${row.name}`"
            @click="resource.remove(row.id, 'Product deleted')"
          >
            <BaseIcon name="trash" :size="15" />
          </button>
        </span>
      </template>
    </AdminTable>

    <BaseModal
      v-model:open="modalOpen"
      :title="editing ? `Edit ${editing.name}` : 'New product'"
      size="lg"
    >
      <div v-if="loadingDetail" class="space-y-4">
        <BaseSkeleton height="2.75rem" />
        <BaseSkeleton height="2.75rem" />
        <BaseSkeleton height="6rem" />
      </div>

      <div v-else class="space-y-5">
        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput v-model="form.name" label="Name" required />
          <BaseInput v-model="form.slug" label="Slug" hint="Leave empty to generate." />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label for="brand" class="mb-1.5 block text-sm font-medium text-ink-soft">Brand</label>
            <select
              id="brand"
              v-model="form.brandId"
              class="h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm"
            >
              <option value="" disabled>Choose a brand</option>
              <option v-for="brand in brands" :key="brand.id" :value="brand.id">{{ brand.name }}</option>
            </select>
          </div>
          <div>
            <label for="category" class="mb-1.5 block text-sm font-medium text-ink-soft">Category</label>
            <select
              id="category"
              v-model="form.categoryId"
              class="h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm"
            >
              <option value="" disabled>Choose a category</option>
              <option v-for="category in categoryOptions" :key="category.id" :value="category.id">
                {{ category.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <BaseInput v-model="form.ean" label="EAN" placeholder="5901234567890" />
          <BaseInput v-model="form.volume" label="Volume" type="number" />
          <BaseInput v-model="form.volumeUnit" label="Unit" placeholder="ml" />
        </div>

        <BaseTextarea v-model="form.description" label="Description" :rows="4" />
        <BaseTextarea v-model="form.usage" label="How to use it" :rows="2" />
        <BaseTextarea
          v-model="form.highlights"
          label="Highlights"
          :rows="3"
          hint="One per line. Factual, not marketing copy."
        />
        <BaseInput v-model="form.imageUrl" label="Image URL" placeholder="/img/product/slug.svg" />

        <div>
          <p class="mb-2 text-sm font-medium text-ink-soft">Positioned for</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="type in SKIN_TYPES.filter((entry) => entry !== 'UNKNOWN')"
              :key="type"
              type="button"
              class="rounded-pill border px-2.5 py-1 text-xs capitalize transition-colors"
              :class="form.targetSkinTypes.includes(type) ? 'border-ink bg-ink text-ink-inverse' : 'border-line text-ink-muted'"
              @click="toggleSkinType(type)"
            >{{ type.toLowerCase() }}</button>
          </div>
        </div>

        <div class="grid gap-3 rounded-lg border border-line bg-surface-muted p-4 sm:grid-cols-2">
          <BaseSwitch v-model="form.isFragranceFree" label="Fragrance-free" />
          <BaseSwitch v-model="form.isVegan" label="Vegan" />
          <BaseSwitch v-model="form.isCrueltyFree" label="Cruelty-free" />
          <BaseSwitch v-model="form.isActive" label="Visible in the catalogue" />
        </div>

        <p class="rounded-lg bg-info-soft px-3.5 py-2.5 text-xs leading-relaxed text-info">
          The ingredient list is not editable here yet — it is seeded and recomputed on save.
          Editing formulas is the next step for this screen.
        </p>
      </div>

      <template #footer>
        <BaseButton variant="ghost" @click="modalOpen = false">Cancel</BaseButton>
        <BaseButton
          :loading="resource.saving.value"
          :disabled="!form.name || !form.brandId || !form.categoryId"
          @click="save"
        >{{ editing ? 'Save changes' : 'Create product' }}</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
