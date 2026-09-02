<script setup lang="ts">
const { isAdmin, isPremium, user, displayName } = storeToRefs(useAuthStore());
const { logout } = useAuthStore();
const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();

const MENU_ITEM_CLASS =
  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink';

const menuRoot = ref<HTMLElement | null>(null);
const triggerButton = ref<HTMLButtonElement | null>(null);
const isOpen = ref(false);

const menuId = useId();

const closeMenu = () => {
  isOpen.value = false;
};

const closeAndRefocus = () => {
  closeMenu();
  triggerButton.value?.focus();
};

const signOut = async () => {
  closeMenu();
  await logout();
  await router.push(localePath('/'));
};

onClickOutside(menuRoot, closeMenu);

watch(
  () => route.fullPath,
  () => {
    closeMenu();
  },
);
</script>

<template>
  <div ref="menuRoot" class="relative" @keydown.esc="closeAndRefocus">
    <button
      ref="triggerButton"
      type="button"
      class="flex items-center rounded-full transition-colors hover:bg-surface-muted"
      :class="isOpen && 'bg-surface-muted'"
      :aria-expanded="isOpen"
      :aria-controls="menuId"
      aria-haspopup="true"
      :aria-label="$t('NAV.ACCOUNT')"
      @click="isOpen = !isOpen"
    >
      <BaseAvatar :name="user?.name ?? user?.email" :size="34" />
    </button>

    <Transition
      enter-active-class="transition-all duration-base ease-out-soft"
      leave-active-class="transition-all duration-fast"
      enter-from-class="-translate-y-1 opacity-0"
      leave-to-class="-translate-y-1 opacity-0"
    >
      <div
        v-if="isOpen"
        :id="menuId"
        class="absolute top-full right-0 z-50 mt-2 w-60 origin-top-right rounded-xl border border-line bg-surface p-1.5 shadow-lg"
      >
        <div class="px-2.5 py-2">
          <p class="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
            {{ displayName }}
            <BaseBadge v-if="isPremium" tone="blush" size="xs">
              {{ $t('PREMIUM.BADGE') }}
            </BaseBadge>
          </p>
          <p class="truncate text-xs text-ink-muted">
            {{ user?.email }}
          </p>
        </div>

        <div class="my-1 border-t border-line" />

        <NuxtLinkLocale v-if="!isPremium" to="/pricing" :class="MENU_ITEM_CLASS" @click="closeMenu">
          <BaseIcon name="premium" :size="16" />
          {{ $t('PREMIUM.GO_PREMIUM') }}
        </NuxtLinkLocale>

        <NuxtLinkLocale to="/dashboard" :class="MENU_ITEM_CLASS" @click="closeMenu">
          <BaseIcon name="home" :size="16" />
          {{ $t('NAV.DASHBOARD') }}
        </NuxtLinkLocale>

        <NuxtLinkLocale to="/scan" :class="MENU_ITEM_CLASS" @click="closeMenu">
          <BaseIcon name="scan" :size="16" />
          {{ $t('NAV.SCAN') }}
        </NuxtLinkLocale>

        <NuxtLinkLocale to="/shelf" :class="MENU_ITEM_CLASS" @click="closeMenu">
          <BaseIcon name="shelf" :size="16" />
          {{ $t('NAV.SHELF') }}
        </NuxtLinkLocale>

        <NuxtLinkLocale to="/diary" :class="MENU_ITEM_CLASS" @click="closeMenu">
          <BaseIcon name="edit" :size="16" />
          {{ $t('NAV.DIARY') }}
        </NuxtLinkLocale>

        <NuxtLinkLocale to="/price-alerts" :class="MENU_ITEM_CLASS" @click="closeMenu">
          <BaseIcon name="bell" :size="16" />
          {{ $t('NAV.ALERTS') }}
        </NuxtLinkLocale>

        <div class="my-1 border-t border-line" />

        <NuxtLinkLocale to="/profile" :class="MENU_ITEM_CLASS" @click="closeMenu">
          <BaseIcon name="user" :size="16" />
          {{ $t('NAV.PROFILE') }}
        </NuxtLinkLocale>

        <NuxtLinkLocale v-if="isAdmin" to="/admin" :class="MENU_ITEM_CLASS" @click="closeMenu">
          <BaseIcon name="settings" :size="16" />
          {{ $t('NAV.ADMIN') }}
        </NuxtLinkLocale>

        <div class="my-1 border-t border-line" />

        <button type="button" :class="[MENU_ITEM_CLASS, 'w-full text-left']" @click="signOut">
          <BaseIcon name="logout" :size="16" />
          {{ $t('COMMON.SIGN_OUT') }}
        </button>
      </div>
    </Transition>
  </div>
</template>
