import { defineStore } from 'pinia';
import type {
  AuthResponse,
  BeautyProfileDto,
  ConsentType,
  ConsentsDto,
  RegisterPayload,
  UserDto,
} from '@kosvia/shared';

const FALLBACK_DISPLAY_NAME = 'there';

const isProfileShaped = (response: unknown): response is BeautyProfileDto => {
  return Boolean(response) && typeof response === 'object';
};

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserDto | null>(null);
  const profile = ref<BeautyProfileDto | null>(null);
  const ready = ref(false);

  const isAuthenticated = computed(() => user.value !== null);
  const isAdmin = computed(() => user.value?.role === 'ADMIN');
  const needsOnboarding = computed(() => isAuthenticated.value && !user.value?.hasBeautyProfile);
  const displayName = computed(
    () => user.value?.name?.trim() || user.value?.email.split('@')[0] || FALLBACK_DISPLAY_NAME,
  );

  const api = () => useNuxtApp().$api;

  const init = async (): Promise<void> => {
    if (ready.value) {
      return;
    }
    try {
      user.value = await api()<UserDto>('/auth/me');
    } catch {
      user.value = null;
    } finally {
      ready.value = true;
    }
  };

  const loadProfile = async (): Promise<BeautyProfileDto | null> => {
    if (!isAuthenticated.value) {
      return null;
    }
    try {
      const response = await api()<BeautyProfileDto | null>('/profile');
      profile.value = isProfileShaped(response) ? response : null;
    } catch {
      profile.value = null;
    }
    return profile.value;
  };

  const login = async (email: string, password: string): Promise<UserDto> => {
    const response = await api()<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    user.value = response.user;
    ready.value = true;
    return response.user;
  };

  const register = async (payload: RegisterPayload): Promise<UserDto> => {
    const response = await api()<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { ...payload, name: payload.name || undefined },
    });
    user.value = response.user;
    ready.value = true;
    return response.user;
  };

  const hasConsent = (type: ConsentType): boolean => user.value?.consents[type] ?? false;

  const setConsent = async (type: ConsentType, granted: boolean): Promise<void> => {
    const consents = await api()<ConsentsDto>('/account/consents', {
      method: 'PUT',
      body: { type, granted },
    });
    if (user.value) {
      user.value = { ...user.value, consents: consents.current };
    }
    if (type === 'BEAUTY_PROFILE_HEALTH' && !granted) {
      profile.value = null;
      if (user.value) {
        user.value = { ...user.value, hasBeautyProfile: false };
      }
    }
  };

  const setDeletionScheduledFor = (value: string | null): void => {
    if (user.value) {
      user.value = { ...user.value, deletionScheduledFor: value };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await api()('/auth/logout', { method: 'POST' });
    } finally {
      user.value = null;
      profile.value = null;
    }
  };

  const markProfileComplete = (completedProfile: BeautyProfileDto): void => {
    profile.value = completedProfile;
    if (user.value) {
      user.value = { ...user.value, hasBeautyProfile: true };
    }
  };

  return {
    user,
    profile,
    ready,
    isAuthenticated,
    isAdmin,
    needsOnboarding,
    displayName,
    init,
    loadProfile,
    login,
    register,
    logout,
    markProfileComplete,
    hasConsent,
    setConsent,
    setDeletionScheduledFor,
  };
});
