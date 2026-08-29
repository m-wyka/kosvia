<script setup lang="ts">
import {
  ALIAS_KINDS,
  TOKEN_STATUSES,
  type AliasKind,
  type PaginatedResult,
  type TokenResolutionDto,
  type TokenStatus,
  type UnmatchedTokenDto,
} from '@kosvia/shared';
import type { TableColumn } from '../../components/Table.vue';

definePageMeta({ layout: 'admin', middleware: 'admin' });

interface IngredientOption {
  id: string;
  inciName: string;
  commonName: string | null;
}

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;
const MAX_SEARCH_RESULTS = 8;
const PERCENT_SCALE = 100;

const api = useApi();
const toast = useToast();
const message = useApiMessage();
const { t } = useI18n();

const status = ref<TokenStatus>('PENDING');
const page = ref(1);
const saving = ref(false);

const queueUrl = computed(() => {
  const params = new URLSearchParams({
    status: status.value,
    page: String(page.value),
    pageSize: String(PAGE_SIZE),
  });
  return `/admin/inci/queue?${params.toString()}`;
});

const { data, pending, error, refresh } = useApiFetch<PaginatedResult<UnmatchedTokenDto>>(
  () => queueUrl.value,
  { key: 'admin-inci-queue', watch: [queueUrl] },
);

const rows = computed(() => data.value?.items ?? []);
const total = computed(() => data.value?.total ?? 0);
const pageCount = computed(() => data.value?.pageCount ?? 1);

const statusTabs = computed(() =>
  TOKEN_STATUSES.map((value) => ({ value, label: t(`ADMIN.INCI_QUEUE.STATUS_${value}`) })),
);

const columns = computed<TableColumn[]>(() => [
  { key: 'normalized', label: t('ADMIN.INCI_QUEUE.COL_TOKEN') },
  { key: 'rawSamples', label: t('ADMIN.INCI_QUEUE.COL_SAMPLES'), secondary: true },
  {
    key: 'occurrenceCount',
    label: t('ADMIN.INCI_QUEUE.COL_COUNT'),
    align: 'right',
    width: 'w-24',
  },
  { key: 'suggestion', label: t('ADMIN.INCI_QUEUE.COL_SUGGESTION'), secondary: true },
  { key: 'actions', label: '', align: 'right', width: 'w-64' },
]);

const mapModalOpen = ref(false);
const newModalOpen = ref(false);
const selectedToken = ref<UnmatchedTokenDto | null>(null);
const ingredientSearch = ref('');
const debouncedIngredientSearch = refDebounced(ingredientSearch, SEARCH_DEBOUNCE_MS);
const ingredientResults = ref<IngredientOption[]>([]);
const selectedIngredientId = ref('');
const aliasKind = ref<AliasKind>('SYNONYM');
const newIngredientName = ref('');
const newIngredientCommonName = ref('');

const aliasKindOptions = computed(() =>
  ALIAS_KINDS.map((value) => ({ value, label: t(`ADMIN.INCI_QUEUE.KIND_${value}`) })),
);

const isPending = computed(() => status.value === 'PENDING');

const firstSample = (token: UnmatchedTokenDto): string => token.rawSamples[0] ?? token.normalized;

const runMutation = async <T,>(action: () => Promise<T>, successMessage: (result: T) => string) => {
  saving.value = true;
  try {
    const result = await action();
    await refresh();
    toast.success(successMessage(result));
    return result;
  } catch (caught) {
    toast.error(message(caught));
    return null;
  } finally {
    saving.value = false;
  }
};

const resolvedMessage = (result: TokenResolutionDto) =>
  t('ADMIN.INCI_QUEUE.RESOLVED', {
    rows: result.rematchedRows,
    products: result.affectedProducts,
  });

const toPercent = (score: number): number => Math.round(score * PERCENT_SCALE);

const acceptSuggestion = (token: UnmatchedTokenDto) => {
  const suggested = token.suggestedIngredient;
  if (!suggested) {
    return;
  }
  return runMutation(
    () =>
      api<TokenResolutionDto>(`/admin/inci/queue/${token.id}/map`, {
        method: 'POST',
        body: { ingredientId: suggested.id, kind: 'TYPO' },
      }),
    resolvedMessage,
  );
};

const openMap = (token: UnmatchedTokenDto) => {
  selectedToken.value = token;
  ingredientSearch.value = firstSample(token);
  ingredientResults.value = [];
  selectedIngredientId.value = '';
  aliasKind.value = /^ci \d{5}$/.test(token.normalized) ? 'CI_NUMBER' : 'SYNONYM';
  mapModalOpen.value = true;
};

const openNew = (token: UnmatchedTokenDto) => {
  selectedToken.value = token;
  newIngredientName.value = firstSample(token);
  newIngredientCommonName.value = '';
  newModalOpen.value = true;
};

const confirmMap = async () => {
  const token = selectedToken.value;
  if (!token || !selectedIngredientId.value) {
    return;
  }
  const result = await runMutation(
    () =>
      api<TokenResolutionDto>(`/admin/inci/queue/${token.id}/map`, {
        method: 'POST',
        body: { ingredientId: selectedIngredientId.value, kind: aliasKind.value },
      }),
    resolvedMessage,
  );
  if (result) {
    mapModalOpen.value = false;
  }
};

const confirmNew = async () => {
  const token = selectedToken.value;
  if (!token || !newIngredientName.value.trim()) {
    return;
  }
  const result = await runMutation(
    () =>
      api<TokenResolutionDto>(`/admin/inci/queue/${token.id}/new-ingredient`, {
        method: 'POST',
        body: {
          inciName: newIngredientName.value.trim(),
          commonName: newIngredientCommonName.value.trim() || undefined,
        },
      }),
    resolvedMessage,
  );
  if (result) {
    newModalOpen.value = false;
  }
};

const ignoreToken = (token: UnmatchedTokenDto) =>
  runMutation(
    () => api(`/admin/inci/queue/${token.id}/ignore`, { method: 'POST' }),
    () => t('ADMIN.INCI_QUEUE.IGNORED'),
  );

const reopenToken = (token: UnmatchedTokenDto) =>
  runMutation(
    () => api(`/admin/inci/queue/${token.id}/reopen`, { method: 'POST' }),
    () => t('ADMIN.INCI_QUEUE.REOPENED'),
  );

const searchIngredients = async (query: string) => {
  if (!query.trim()) {
    ingredientResults.value = [];
    return;
  }
  const params = new URLSearchParams({ q: query.trim(), pageSize: String(MAX_SEARCH_RESULTS) });
  const response = await api<PaginatedResult<IngredientOption>>(
    `/admin/ingredients?${params.toString()}`,
  );
  ingredientResults.value = response.items;
};

watch(status, () => {
  page.value = 1;
});

watch(debouncedIngredientSearch, (query) => {
  if (mapModalOpen.value) {
    searchIngredients(query);
  }
});

watch(mapModalOpen, (isOpen) => {
  if (isOpen) {
    searchIngredients(ingredientSearch.value);
  }
});

useSeo(() => ({
  title: t('SEO.ADMIN.INCI_QUEUE'),
  description: t('SEO.ADMIN.INCI_QUEUE_DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div>
    <AdminPageHeader
      :title="$t('ADMIN.INCI_QUEUE.TITLE')"
      :count="total"
      :description="$t('ADMIN.INCI_QUEUE.SUBTITLE')"
    />

    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="tab in statusTabs"
          :key="tab.value"
          type="button"
          class="rounded-pill border px-3 py-1 text-xs transition-colors"
          :class="
            status === tab.value
              ? 'border-ink bg-ink text-ink-inverse'
              : 'border-line text-ink-muted'
          "
          @click="status = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>
      <div v-if="pageCount > 1" class="flex items-center gap-2 text-xs text-ink-muted">
        <BaseButton variant="ghost" size="sm" :disabled="page <= 1" @click="page -= 1">
          <BaseIcon name="chevron-left" :size="14" />
        </BaseButton>
        <span>{{ $t('ADMIN.PAGE_OF', { page, total: pageCount }) }}</span>
        <BaseButton variant="ghost" size="sm" :disabled="page >= pageCount" @click="page += 1">
          <BaseIcon name="chevron-right" :size="14" />
        </BaseButton>
      </div>
    </div>

    <BaseErrorState v-if="error" @retry="refresh()" />

    <AdminTable
      v-else
      :columns="columns"
      :rows="rows"
      :loading="pending"
      :empty-title="$t('ADMIN.INCI_QUEUE.EMPTY')"
    >
      <template #cell-normalized="{ row }">
        <span class="font-mono text-sm text-ink">{{ row.normalized }}</span>
      </template>
      <template #cell-rawSamples="{ row }">
        <span class="block max-w-xs truncate text-xs text-ink-muted">
          {{ row.rawSamples.join(' · ') }}
        </span>
      </template>
      <template #cell-suggestion="{ row }">
        <span v-if="row.suggestedIngredient" class="block text-xs">
          <span class="text-ink">{{ row.suggestedIngredient.inciName }}</span>
          <span v-if="row.suggestedScore !== null" class="block text-ink-faint">
            {{ $t('ADMIN.INCI_QUEUE.SUGGESTION_SCORE', { score: toPercent(row.suggestedScore) }) }}
          </span>
        </span>
      </template>
      <template #cell-actions="{ row }">
        <span class="flex justify-end gap-1.5">
          <template v-if="isPending">
            <BaseButton
              v-if="row.suggestedIngredient"
              variant="secondary"
              size="sm"
              :disabled="saving"
              @click="acceptSuggestion(row)"
            >
              {{ $t('ADMIN.INCI_QUEUE.ACTION_ACCEPT') }}
            </BaseButton>
            <BaseButton variant="ghost" size="sm" :disabled="saving" @click="openMap(row)">
              {{ $t('ADMIN.INCI_QUEUE.ACTION_MAP') }}
            </BaseButton>
            <BaseButton variant="ghost" size="sm" :disabled="saving" @click="openNew(row)">
              {{ $t('ADMIN.INCI_QUEUE.ACTION_NEW') }}
            </BaseButton>
            <BaseButton variant="ghost" size="sm" :disabled="saving" @click="ignoreToken(row)">
              {{ $t('ADMIN.INCI_QUEUE.ACTION_IGNORE') }}
            </BaseButton>
          </template>
          <BaseButton
            v-else-if="row.status === 'IGNORED'"
            variant="ghost"
            size="sm"
            :disabled="saving"
            @click="reopenToken(row)"
          >
            {{ $t('ADMIN.INCI_QUEUE.ACTION_REOPEN') }}
          </BaseButton>
        </span>
      </template>
    </AdminTable>

    <BaseModal
      v-model:open="mapModalOpen"
      :title="$t('ADMIN.INCI_QUEUE.MAP_TITLE', { token: selectedToken?.normalized ?? '' })"
    >
      <div class="space-y-4">
        <BaseInput
          v-model="ingredientSearch"
          :label="$t('ADMIN.INCI_QUEUE.MAP_SEARCH')"
          :placeholder="$t('ADMIN.INCI_QUEUE.MAP_SEARCH_PLACEHOLDER')"
        />
        <div class="max-h-64 space-y-1 overflow-y-auto">
          <p v-if="!ingredientResults.length" class="px-1 text-xs text-ink-muted">
            {{ $t('ADMIN.INCI_QUEUE.MAP_NO_RESULTS') }}
          </p>
          <button
            v-for="ingredient in ingredientResults"
            :key="ingredient.id"
            type="button"
            class="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors"
            :class="
              selectedIngredientId === ingredient.id
                ? 'border-ink bg-ink text-ink-inverse'
                : 'border-line text-ink hover:bg-surface-muted'
            "
            @click="selectedIngredientId = ingredient.id"
          >
            <span>{{ ingredient.inciName }}</span>
            <span v-if="ingredient.commonName" class="text-xs opacity-70">
              {{ ingredient.commonName }}
            </span>
          </button>
        </div>
        <BaseNativeSelect
          v-model="aliasKind"
          :options="aliasKindOptions"
          :label="$t('ADMIN.INCI_QUEUE.MAP_KIND')"
        />
      </div>
      <template #footer>
        <BaseButton variant="ghost" @click="mapModalOpen = false">
          {{ $t('COMMON.CANCEL') }}
        </BaseButton>
        <BaseButton :loading="saving" :disabled="!selectedIngredientId" @click="confirmMap">
          {{ $t('ADMIN.INCI_QUEUE.MAP_CONFIRM') }}
        </BaseButton>
      </template>
    </BaseModal>

    <BaseModal
      v-model:open="newModalOpen"
      :title="$t('ADMIN.INCI_QUEUE.NEW_TITLE', { token: selectedToken?.normalized ?? '' })"
    >
      <div class="space-y-4">
        <BaseInput
          v-model="newIngredientName"
          :label="$t('ADMIN.INGREDIENTS.FIELD_INCI')"
          :hint="$t('ADMIN.INCI_QUEUE.NEW_HINT')"
          required
        />
        <BaseInput
          v-model="newIngredientCommonName"
          :label="$t('ADMIN.INGREDIENTS.FIELD_COMMON')"
        />
      </div>
      <template #footer>
        <BaseButton variant="ghost" @click="newModalOpen = false">
          {{ $t('COMMON.CANCEL') }}
        </BaseButton>
        <BaseButton :loading="saving" :disabled="!newIngredientName.trim()" @click="confirmNew">
          {{ $t('ADMIN.INCI_QUEUE.NEW_CONFIRM') }}
        </BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
