<script setup lang="ts">
const { isAuthenticated, isAdmin } = storeToRefs(useAuthStore());
const { logout } = useAuthStore();
const { count: compareCount } = storeToRefs(useCompareStore());
const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();

const menuOpen = ref(false);

const primaryLinks = [
  { to: '/discover', label: 'NAV.DISCOVER' },
  { to: '/products', label: 'NAV.PRODUCTS' },
  { to: '/compare', label: 'NAV.COMPARE' },
  { to: '/pricing', label: 'NAV.PRICING' },
  { to: '/ai', label: 'NAV.AI', requiresAuth: true },
];

const accountLinks = [
  { to: '/dashboard', label: 'NAV.DASHBOARD' },
  { to: '/shelf', label: 'NAV.SHELF' },
  { to: '/diary', label: 'NAV.DIARY' },
  { to: '/price-alerts', label: 'NAV.ALERTS' },
];

const desktopLinks = computed(() =>
  primaryLinks.filter((link) => !link.requiresAuth || isAuthenticated.value),
);

const mobileLinks = computed(() =>
  isAuthenticated.value ? [...desktopLinks.value, ...accountLinks] : desktopLinks.value,
);

const isActive = (to: string) => route.path === to || route.path.startsWith(`${to}/`);

const signOut = async () => {
  await logout();
  menuOpen.value = false;
  await router.push(localePath('/'));
};

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false;
  },
);
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-sm">
    <div class="container-page flex h-16 items-center gap-4">
      <NuxtLinkLocale to="/" class="shrink-0" :aria-label="$t('NAV.HOME')">
        <AppLogo />
      </NuxtLinkLocale>

      <nav class="hidden items-center gap-0.5 lg:flex" :aria-label="$t('NAV.MAIN')">
        <NuxtLinkLocale
          v-for="link in desktopLinks"
          :key="link.to"
          :to="link.to"
          class="rounded-md px-3 py-2 text-sm font-medium transition-colors"
          :class="isActive(link.to) ? 'bg-surface-muted text-ink' : 'text-ink-muted hover:text-ink'"
        >
          {{ $t(link.label) }}
        </NuxtLinkLocale>
      </nav>

      <div class="ml-auto flex shrink-0 items-center gap-1.5">
        <AppSearch />

        <LocaleSwitcher class="hidden sm:flex" />

        <NuxtLinkLocale
          v-if="compareCount > 0"
          to="/compare"
          class="relative hidden items-center gap-1.5 rounded-pill border border-line px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-line-strong sm:inline-flex"
        >
          <BaseIcon name="compare" :size="16" />
          <span class="tabular-nums">{{ compareCount }}</span>
        </NuxtLinkLocale>

        <UserMenu v-if="isAuthenticated" class="hidden sm:block" />
        <template v-else>
          <BaseButton to="/login" variant="ghost" size="sm" class="hidden sm:inline-flex">
            {{ $t('COMMON.SIGN_IN') }}
          </BaseButton>
          <BaseButton to="/register" size="sm" class="hidden sm:inline-flex">
            {{ $t('COMMON.GET_STARTED') }}
          </BaseButton>
        </template>

        <button
          type="button"
          class="rounded-md p-2 text-ink-soft transition-colors hover:bg-surface-muted lg:hidden"
          :aria-expanded="menuOpen"
          aria-controls="mobile-menu"
          :aria-label="$t('NAV.MENU')"
          @click="menuOpen = !menuOpen"
        >
          <BaseIcon :name="menuOpen ? 'close' : 'menu'" :size="20" />
        </button>
      </div>
    </div>

    <Transition
      enter-active-class="transition-all duration-base ease-out-soft"
      leave-active-class="transition-all duration-fast"
      enter-from-class="-translate-y-2 opacity-0"
      leave-to-class="-translate-y-2 opacity-0"
    >
      <div v-if="menuOpen" id="mobile-menu" class="border-t border-line bg-canvas lg:hidden">
        <div class="container-page space-y-1 py-4">
          <NuxtLinkLocale
            v-for="link in mobileLinks"
            :key="link.to"
            :to="link.to"
            class="block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
            :class="
              isActive(link.to)
                ? 'bg-surface-muted text-ink'
                : 'text-ink-soft hover:bg-surface-muted'
            "
          >
            {{ $t(link.label) }}
          </NuxtLinkLocale>

          <div class="mt-4! flex flex-col gap-2 border-t border-line pt-4">
            <LocaleSwitcher variant="stacked" class="mb-2 sm:hidden" />

            <template v-if="isAuthenticated">
              <BaseButton to="/profile" variant="secondary" block>
                {{ $t('NAV.PROFILE') }}
              </BaseButton>
              <BaseButton v-if="isAdmin" to="/admin" variant="secondary" block>
                {{ $t('NAV.ADMIN') }}
              </BaseButton>
              <BaseButton variant="ghost" block @click="signOut">
                {{ $t('COMMON.SIGN_OUT') }}
              </BaseButton>
            </template>
            <template v-else>
              <BaseButton to="/register" block>{{ $t('COMMON.GET_STARTED') }}</BaseButton>
              <BaseButton to="/login" variant="secondary" block>
                {{ $t('COMMON.SIGN_IN') }}
              </BaseButton>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </header>
</template>
