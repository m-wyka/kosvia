import type { PaginatedResult } from '@kosvia/shared';

/**
 * The shared behaviour behind every admin list: debounced search, pagination,
 * and create/update/delete that always refetch rather than patching local state.
 *
 * Each resource page then only describes its columns and its form.
 */
export function useAdminResource<T extends { id: string }>(
  path: string,
  options: { pageSize?: number; paginated?: boolean } = {},
) {
  const { pageSize = 25, paginated = true } = options;

  const api = useApi();
  const toast = useToast();
  const message = useApiMessage();

  const search = ref('');
  const page = ref(1);
  const debouncedSearch = refDebounced(search, 300);
  const saving = ref(false);

  watch(debouncedSearch, () => {
    page.value = 1;
  });

  const url = computed(() => {
    if (!paginated) return path;
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize) });
    if (debouncedSearch.value) params.set('q', debouncedSearch.value);
    return `${path}?${params.toString()}`;
  });

  const { data, pending, error, refresh } = useApiFetch<PaginatedResult<T> | T[]>(() => url.value, {
    key: `admin-${path}`,
    watch: [url],
  });

  const rows = computed<T[]>(() =>
    Array.isArray(data.value) ? data.value : (data.value?.items ?? []),
  );
  const total = computed(() => (Array.isArray(data.value) ? data.value.length : (data.value?.total ?? 0)));
  const pageCount = computed(() => (Array.isArray(data.value) ? 1 : (data.value?.pageCount ?? 1)));

  /** Wraps a mutation with the error handling and refetch every page needs. */
  async function mutate<R>(action: () => Promise<R>, successMessage: string): Promise<R | null> {
    saving.value = true;
    try {
      const result = await action();
      await refresh();
      toast.success(successMessage);
      return result;
    } catch (caught) {
      toast.error(message(caught));
      return null;
    } finally {
      saving.value = false;
    }
  }

  type Body = Record<string, unknown>;

  const create = (body: Body, label = 'Created') =>
    mutate(() => api(path, { method: 'POST', body }), label);

  const update = (id: string, body: Body, label = 'Saved') =>
    mutate(() => api(`${path}/${id}`, { method: 'PUT', body }), label);

  const patch = (id: string, body: Body, label = 'Saved') =>
    mutate(() => api(`${path}/${id}`, { method: 'PATCH', body }), label);

  const remove = (id: string, label = 'Deleted') =>
    mutate(() => api(`${path}/${id}`, { method: 'DELETE' }), label);

  return {
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
    patch,
    remove,
  };
}
