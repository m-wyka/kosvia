import { defineStore } from 'pinia';
import type { AuthResponse, BeautyProfileDto, UserDto } from '@kosvia/shared';

/**
 * Session state.
 *
 * Tokens are never stored here — they live in HttpOnly cookies the browser
 * sends on our behalf. This store only holds who the user is, so the UI can
 * decide what to render.
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserDto | null>(null);
  const profile = ref<BeautyProfileDto | null>(null);
  const ready = ref(false);

  const isAuthenticated = computed(() => user.value !== null);
  const isAdmin = computed(() => user.value?.role === 'ADMIN');
  const needsOnboarding = computed(() => isAuthenticated.value && !user.value?.hasBeautyProfile);
  const displayName = computed(
    () => user.value?.name?.trim() || user.value?.email.split('@')[0] || 'there',
  );

  const api = () => useNuxtApp().$api;

  /** Resolves the session once per request/app start. Safe to call anywhere. */
  async function init(): Promise<void> {
    if (ready.value) return;
    try {
      user.value = await api()<UserDto>('/auth/me');
    } catch {
      user.value = null;
    } finally {
      ready.value = true;
    }
  }

  async function loadProfile(): Promise<BeautyProfileDto | null> {
    if (!isAuthenticated.value) return null;
    try {
      const response = await api()<BeautyProfileDto | null>('/profile');
      // An empty response body arrives as "" rather than null. Anything that is
      // not a profile-shaped object means "no profile yet".
      profile.value =
        response && typeof response === 'object' ? (response as BeautyProfileDto) : null;
    } catch {
      profile.value = null;
    }
    return profile.value;
  }

  async function login(email: string, password: string): Promise<UserDto> {
    const response = await api()<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    user.value = response.user;
    ready.value = true;
    return response.user;
  }

  async function register(email: string, password: string, name?: string): Promise<UserDto> {
    const response = await api()<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { email, password, name: name || undefined },
    });
    user.value = response.user;
    ready.value = true;
    return response.user;
  }

  async function logout(): Promise<void> {
    try {
      await api()('/auth/logout', { method: 'POST' });
    } finally {
      user.value = null;
      profile.value = null;
    }
  }

  /** Called after onboarding so the nav stops nagging about the profile. */
  function markProfileComplete(next: BeautyProfileDto): void {
    profile.value = next;
    if (user.value) user.value = { ...user.value, hasBeautyProfile: true };
  }

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
  };
});
