import type { BrandDto, TaxonomyItemDto } from '@kosvia/shared';

interface ProfileOptionsDto {
  concerns: TaxonomyItemDto[];
  goals: TaxonomyItemDto[];
}

export const useProfileOptions = () => {
  const { data, pending, error, refresh } = useApiFetch<ProfileOptionsDto>('/profile/options', {
    key: 'profile-options',
  });
  const { data: brands } = useApiFetch<BrandDto[]>('/brands', { key: 'brands' });

  return {
    concerns: computed(() => data.value?.concerns ?? []),
    goals: computed(() => data.value?.goals ?? []),
    brands: computed(() => brands.value ?? []),
    pending,
    error,
    refresh,
  };
};
