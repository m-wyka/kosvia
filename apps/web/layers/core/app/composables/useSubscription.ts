import type { SubscriptionOverviewDto } from '@kosvia/shared';

export const useSubscription = () => {
  const overview = useState<SubscriptionOverviewDto | null>('subscription-overview', () => null);
  const pending = useState<boolean>('subscription-overview-pending', () => false);

  const { isAuthenticated, isPremium } = storeToRefs(useAuthStore());

  const plan = computed(() => overview.value?.plan ?? (isPremium.value ? 'PREMIUM' : 'FREE'));
  const entitlements = computed(() => overview.value?.entitlements ?? null);

  const fetchOverview = async (): Promise<void> => {
    if (!isAuthenticated.value || pending.value) {
      return;
    }
    pending.value = true;
    try {
      overview.value = await useApi()<SubscriptionOverviewDto>('/subscription');
    } catch {
      overview.value = null;
    } finally {
      pending.value = false;
    }
  };

  const clearOverview = (): void => {
    overview.value = null;
  };

  return { overview, plan, entitlements, isPremium, fetchOverview, clearOverview };
};
