import type { AsyncData, UseFetchOptions } from '#app';
import type { FetchError } from 'ofetch';

/**
 * `UseFetchOptions` types `default` as returning `undefined`, which makes the
 * common `default: () => []` pattern fail to type-check. Narrowing it to the
 * response type is both correct and what every call site expects.
 */
type ApiFetchOptions<T> = Omit<UseFetchOptions<T>, 'default'> & { default?: () => T };

/** Typed access to the configured API client. */
export function useApi() {
  return useNuxtApp().$api;
}

/** Turns a thrown fetch error into copy we are willing to show a user. */
export function useApiMessage() {
  return useNuxtApp().$apiMessage;
}

/**
 * `useFetch` bound to the Kosvia API.
 *
 * Wrapping it here means every call gets the shared client (cookie forwarding,
 * silent refresh) and every page gets the same `{ data, pending, error }`
 * shape to drive its loading / error / empty states.
 */
export function useApiFetch<T>(
  url: string | Ref<string> | (() => string),
  options: ApiFetchOptions<T> = {},
): AsyncData<T | null, FetchError | null> {
  return useFetch(url, {
    ...options,
    $fetch: useNuxtApp().$api as typeof $fetch,
  } as UseFetchOptions<T>) as AsyncData<T | null, FetchError | null>;
}
