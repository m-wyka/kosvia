<script setup lang="ts">
/**
 * Bottom navigation for phones.
 *
 * Scan sits in the middle and is deliberately the most prominent target — it
 * is the fastest route into the product once barcode scanning ships. Today it
 * opens the search page and says so honestly.
 */
const route = useRoute();
const auth = useAuthStore();

const items = [
  { to: '/', label: 'Home', icon: 'home' as const, exact: true },
  { to: '/discover', label: 'Discover', icon: 'compass' as const },
  { to: '/scan', label: 'Scan', icon: 'scan' as const, primary: true },
  { to: '/shelf', label: 'Shelf', icon: 'shelf' as const },
  { to: '/profile', label: 'Profile', icon: 'user' as const },
];

const resolve = (to: string) =>
  !auth.isAuthenticated && ['/shelf', '/profile'].includes(to) ? '/login' : to;

const isActive = (item: (typeof items)[number]) =>
  item.exact ? route.path === item.to : route.path.startsWith(item.to);
</script>

<template>
  <nav
    class="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 backdrop-blur-md lg:hidden"
    aria-label="Primary"
  >
    <ul class="mx-auto flex max-w-lg items-end justify-around px-2 pt-1.5">
      <li v-for="item in items" :key="item.to" class="flex-1">
        <NuxtLink
          :to="resolve(item.to)"
          class="flex flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition-colors"
          :class="[
            item.primary ? '-mt-5' : '',
            isActive(item) && !item.primary ? 'text-ink' : 'text-ink-muted',
          ]"
          :aria-current="isActive(item) ? 'page' : undefined"
        >
          <span
            v-if="item.primary"
            class="flex size-12 items-center justify-center rounded-full bg-ink text-ink-inverse shadow-md
                   transition-transform active:scale-95"
          >
            <BaseIcon :name="item.icon" :size="22" />
          </span>
          <BaseIcon v-else :name="item.icon" :size="21" />
          <span class="text-2xs font-medium" :class="item.primary && 'text-ink'">{{ item.label }}</span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
