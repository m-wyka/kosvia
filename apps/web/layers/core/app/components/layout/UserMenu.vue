<script setup lang="ts">
const { isAdmin, user, displayName } = storeToRefs(useAuthStore());
const { logout } = useAuthStore();
const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();

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
      class="flex cursor-pointer items-center rounded-full transition-colors hover:bg-surface-muted"
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
          <p class="truncate text-sm font-medium text-ink">
            {{ displayName }}
          </p>
          <p class="truncate text-xs text-ink-muted">
            {{ user?.email }}
          </p>
        </div>

        <div class="my-1 border-t border-line" />

        <NuxtLinkLocale
          to="/profile"
          class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
          @click="closeMenu"
        >
          <BaseIcon name="user" :size="16" />
          {{ $t('NAV.PROFILE') }}
        </NuxtLinkLocale>

        <NuxtLinkLocale
          v-if="isAdmin"
          to="/admin"
          class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
          @click="closeMenu"
        >
          <BaseIcon name="settings" :size="16" />
          {{ $t('NAV.ADMIN') }}
        </NuxtLinkLocale>

        <div class="my-1 border-t border-line" />

        <button
          type="button"
          class="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
          @click="signOut"
        >
          <BaseIcon name="logout" :size="16" />
          {{ $t('COMMON.SIGN_OUT') }}
        </button>
      </div>
    </Transition>
  </div>
</template>
