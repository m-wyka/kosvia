<script setup lang="ts">
/**
 * Admin shell — a compact sidebar, denser type, same design tokens.
 * Functional rather than expressive, but recognisably the same product.
 */
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const open = ref(false);

const sections = [
  {
    title: 'Overview',
    links: [{ to: '/admin', label: 'Dashboard', icon: 'home' as const, exact: true }],
  },
  {
    title: 'Catalogue',
    links: [
      { to: '/admin/products', label: 'Products', icon: 'droplet' as const },
      { to: '/admin/brands', label: 'Brands', icon: 'tag' as const },
      { to: '/admin/categories', label: 'Categories', icon: 'shelf' as const },
      { to: '/admin/ingredients', label: 'Ingredients', icon: 'leaf' as const },
    ],
  },
  {
    title: 'Commerce',
    links: [
      { to: '/admin/stores', label: 'Stores', icon: 'store' as const },
      { to: '/admin/offers', label: 'Offers', icon: 'compare' as const },
    ],
  },
  {
    title: 'People',
    links: [{ to: '/admin/users', label: 'Users', icon: 'user' as const }],
  },
];

const isActive = (link: { to: string; exact?: boolean }) =>
  link.exact ? route.path === link.to : route.path.startsWith(link.to);

watch(() => route.fullPath, () => { open.value = false; });

async function signOut() {
  await auth.logout();
  await router.push('/');
}
</script>

<template>
  <div class="min-h-dvh bg-canvas lg:grid lg:grid-cols-[15rem_1fr]">
    <!-- Sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-50 w-60 -translate-x-full border-r border-line bg-surface
             transition-transform duration-[--duration-base] ease-[--ease-out-soft]
             lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0"
      :class="open && 'translate-x-0 shadow-lg'"
    >
      <div class="flex h-14 items-center justify-between border-b border-line px-4">
        <NuxtLink to="/admin" class="flex items-center gap-2">
          <AppLogo :size="22" />
        </NuxtLink>
        <BaseBadge tone="neutral" size="xs">Admin</BaseBadge>
      </div>

      <nav class="space-y-5 overflow-y-auto p-3" aria-label="Admin">
        <div v-for="section in sections" :key="section.title">
          <p class="px-2 pb-1.5 text-2xs font-semibold tracking-widest text-ink-faint uppercase">
            {{ section.title }}
          </p>
          <ul class="space-y-0.5">
            <li v-for="link in section.links" :key="link.to">
              <NuxtLink
                :to="link.to"
                class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors"
                :class="isActive(link) ? 'bg-surface-muted font-medium text-ink' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'"
              >
                <BaseIcon :name="link.icon" :size="16" />
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>
      </nav>

      <div class="absolute inset-x-0 bottom-0 border-t border-line p-3">
        <NuxtLink
          to="/"
          class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
        >
          <BaseIcon name="arrow-right" :size="16" class="rotate-180" />
          Back to Kosvia
        </NuxtLink>
        <button
          type="button"
          class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          @click="signOut"
        >
          <BaseIcon name="logout" :size="16" />
          Sign out
        </button>
      </div>
    </aside>

    <div v-if="open" class="fixed inset-0 z-40 bg-overlay lg:hidden" @click="open = false" />

    <div class="min-w-0">
      <header class="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur-md lg:hidden">
        <button
          type="button"
          class="rounded-md p-2 text-ink-soft hover:bg-surface-muted"
          aria-label="Open admin menu"
          @click="open = true"
        >
          <BaseIcon name="menu" :size="20" />
        </button>
        <AppLogo :size="20" />
      </header>

      <main class="p-4 sm:p-6 lg:p-8">
        <slot />
      </main>
    </div>
  </div>
</template>
