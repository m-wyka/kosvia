<script setup lang="ts">
const auth = useAuthStore();
const compare = useCompareStore();
const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();

const search = ref('');
const menuOpen = ref(false);

const links = [
  { to: '/discover', label: 'NAV.DISCOVER' },
  { to: '/products', label: 'NAV.PRODUCTS' },
  { to: '/compare', label: 'NAV.COMPARE' },
  { to: '/shelf', label: 'NAV.SHELF', auth: true },
  { to: '/ai', label: 'NAV.AI', auth: true },
  { to: '/price-alerts', label: 'NAV.ALERTS', auth: true },
];

const visibleLinks = computed(() => links.filter((link) => !link.auth || auth.isAuthenticated));
const isActive = (to: string) => route.path === to || route.path.startsWith(`${to}/`);

function submitSearch() {
  const q = search.value.trim();
  if (!q) return;
  menuOpen.value = false;
  router.push({ path: localePath('/products'), query: { q } });
}

watch(() => route.fullPath, () => { menuOpen.value = false; });

async function signOut() {
  await auth.logout();
  menuOpen.value = false;
  await router.push(localePath('/'));
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
    <div class="container-page flex h-16 items-center gap-4">
      <NuxtLinkLocale to="/" class="shrink-0" :aria-label="$t('NAV.HOME')">
        <AppLogo />
      </NuxtLinkLocale>

      <nav class="hidden items-center gap-0.5 lg:flex" :aria-label="$t('NAV.MAIN')">
        <NuxtLinkLocale
          v-for="link in visibleLinks"
          :key="link.to"
          :to="link.to"
          class="rounded-md px-3 py-2 text-sm font-medium transition-colors"
          :class="isActive(link.to) ? 'bg-surface-muted text-ink' : 'text-ink-muted hover:text-ink'"
        >{{ $t(link.label) }}</NuxtLinkLocale>
      </nav>

      <form class="ml-auto hidden min-w-0 flex-1 justify-end md:flex" role="search" @submit.prevent="submitSearch">
        <label for="header-search" class="sr-only">{{ $t('NAV.SEARCH_LABEL') }}</label>
        <div class="relative w-full max-w-xs">
          <BaseIcon
            name="search"
            :size="16"
            class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
          />
          <input
            id="header-search"
            v-model="search"
            type="search"
            :placeholder="$t('NAV.SEARCH_PLACEHOLDER')"
            class="h-10 w-full rounded-pill border border-line bg-surface pr-3.5 pl-9 text-sm
                   placeholder:text-ink-faint transition-colors hover:border-line-strong"
          >
        </div>
      </form>

      <div class="ml-auto flex shrink-0 items-center gap-1.5 md:ml-0">
        <LocaleSwitcher class="hidden sm:flex" />

        <NuxtLinkLocale
          v-if="compare.count > 0"
          to="/compare"
          class="relative hidden items-center gap-1.5 rounded-pill border border-line px-3 py-2
                 text-sm font-medium text-ink-soft transition-colors hover:border-line-strong sm:inline-flex"
        >
          <BaseIcon name="compare" :size="16" />
          <span class="tabular-nums">{{ compare.count }}</span>
        </NuxtLinkLocale>

        <template v-if="auth.isAuthenticated">
          <NuxtLinkLocale
            to="/profile"
            class="hidden items-center gap-2 rounded-pill py-1 pr-3 pl-1 transition-colors hover:bg-surface-muted sm:flex"
          >
            <BaseAvatar :name="auth.user?.name ?? auth.user?.email" :size="30" />
            <span class="max-w-24 truncate text-sm font-medium text-ink">{{ auth.displayName }}</span>
          </NuxtLinkLocale>
          <BaseButton
            v-if="auth.isAdmin"
            to="/admin"
            variant="ghost"
            size="sm"
            class="hidden lg:inline-flex"
          >{{ $t('NAV.ADMIN') }}</BaseButton>
          <BaseButton variant="ghost" size="sm" class="hidden lg:inline-flex" @click="signOut">
            {{ $t('COMMON.SIGN_OUT') }}
          </BaseButton>
        </template>
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
      enter-active-class="transition-all duration-[--duration-base] ease-[--ease-out-soft]"
      leave-active-class="transition-all duration-[--duration-fast]"
      enter-from-class="-translate-y-2 opacity-0"
      leave-to-class="-translate-y-2 opacity-0"
    >
      <div v-if="menuOpen" id="mobile-menu" class="border-t border-line bg-canvas lg:hidden">
        <div class="container-page space-y-1 py-4">
          <form class="mb-3 md:hidden" role="search" @submit.prevent="submitSearch">
            <label for="mobile-search" class="sr-only">{{ $t('NAV.SEARCH_LABEL') }}</label>
            <div class="relative">
              <BaseIcon
                name="search"
                :size="16"
                class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
              />
              <input
                id="mobile-search"
                v-model="search"
                type="search"
                :placeholder="$t('NAV.SEARCH_PLACEHOLDER')"
                class="h-11 w-full rounded-pill border border-line bg-surface pr-3.5 pl-9 text-sm"
              >
            </div>
          </form>

          <NuxtLinkLocale
            v-for="link in visibleLinks"
            :key="link.to"
            :to="link.to"
            class="block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
            :class="isActive(link.to) ? 'bg-surface-muted text-ink' : 'text-ink-soft hover:bg-surface-muted'"
          >{{ $t(link.label) }}</NuxtLinkLocale>

          <div class="!mt-4 flex flex-col gap-2 border-t border-line pt-4">
            <LocaleSwitcher variant="stacked" class="mb-2 sm:hidden" />

            <template v-if="auth.isAuthenticated">
              <BaseButton to="/profile" variant="secondary" block>{{ $t('NAV.PROFILE') }}</BaseButton>
              <BaseButton v-if="auth.isAdmin" to="/admin" variant="secondary" block>
                {{ $t('NAV.ADMIN') }}
              </BaseButton>
              <BaseButton variant="ghost" block @click="signOut">{{ $t('COMMON.SIGN_OUT') }}</BaseButton>
            </template>
            <template v-else>
              <BaseButton to="/register" block>{{ $t('COMMON.GET_STARTED') }}</BaseButton>
              <BaseButton to="/login" variant="secondary" block>{{ $t('COMMON.SIGN_IN') }}</BaseButton>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </header>
</template>
