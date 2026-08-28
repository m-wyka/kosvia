import type { BrandDto, TaxonomyItemDto } from '@kosvia/shared';

/**
 * The vocabulary the beauty profile is built from — concerns, goals and the
 * brand list. Fetched once and shared by onboarding and the profile page.
 */
export function useProfileOptions() {
  const { data, pending, error, refresh } = useApiFetch<{
    concerns: TaxonomyItemDto[];
    goals: TaxonomyItemDto[];
  }>('/profile/options', { key: 'profile-options' });

  const { data: brands } = useApiFetch<BrandDto[]>('/brands', { key: 'brands' });

  return {
    concerns: computed(() => data.value?.concerns ?? []),
    goals: computed(() => data.value?.goals ?? []),
    brands: computed(() => brands.value ?? []),
    pending,
    error,
    refresh,
  };
}
