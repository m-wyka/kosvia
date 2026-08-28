import type { AsyncData, UseFetchOptions } from '#app';
import type { FetchError } from 'ofetch';

type ApiFetchOptions<T> = Omit<UseFetchOptions<T>, 'default'> & { default?: () => T };

export const useApi = () => {
  return useNuxtApp().$api;
};

export const useApiMessage = () => {
  return useNuxtApp().$apiMessage;
};

export const useApiFetch = <T>(
  url: string | Ref<string> | (() => string),
  options: ApiFetchOptions<T> = {},
): AsyncData<T | null, FetchError | null> => {
  return useFetch(url, {
    ...options,
    $fetch: useNuxtApp().$api as typeof $fetch,
  } as UseFetchOptions<T>) as AsyncData<T | null, FetchError | null>;
};
