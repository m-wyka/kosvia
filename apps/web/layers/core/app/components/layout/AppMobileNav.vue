<script setup lang="ts">
const AUTH_ONLY_PATHS = ['/shelf', '/profile'];

const route = useRoute();
const { isAuthenticated } = storeToRefs(useAuthStore());

const items = [
  { to: '/', label: 'NAV.HOME', icon: 'home' as const, exact: true },
  { to: '/discover', label: 'NAV.DISCOVER', icon: 'compass' as const },
  { to: '/scan', label: 'NAV.SCAN', icon: 'scan' as const, primary: true },
  { to: '/shelf', label: 'NAV.SHELF_SHORT', icon: 'shelf' as const },
  { to: '/profile', label: 'NAV.PROFILE', icon: 'user' as const },
];

const linkTarget = (to: string) =>
  !isAuthenticated.value && AUTH_ONLY_PATHS.includes(to) ? '/login' : to;

const isActive = (item: (typeof items)[number]) =>
  item.exact ? route.path === item.to : route.path.startsWith(item.to);
</script>

<template>
  <nav
    class="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 backdrop-blur-md lg:hidden"
    :aria-label="$t('NAV.PRIMARY')"
  >
    <ul class="mx-auto flex max-w-lg items-end justify-around px-2 pt-1.5">
      <li v-for="item in items" :key="item.to" class="flex-1">
        <NuxtLinkLocale
          :to="linkTarget(item.to)"
          class="flex flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition-colors"
          :class="[
            item.primary ? '-mt-5' : '',
            isActive(item) && !item.primary ? 'text-ink' : 'text-ink-muted',
          ]"
          :aria-current="isActive(item) ? 'page' : undefined"
        >
          <span
            v-if="item.primary"
            class="flex size-12 items-center justify-center rounded-full bg-ink text-ink-inverse shadow-md transition-transform active:scale-95"
          >
            <BaseIcon :name="item.icon" :size="22" />
          </span>
          <BaseIcon v-else :name="item.icon" :size="21" />
          <span class="text-2xs font-medium" :class="item.primary && 'text-ink'">
            {{ $t(item.label) }}
          </span>
        </NuxtLinkLocale>
      </li>
    </ul>
  </nav>
</template>
