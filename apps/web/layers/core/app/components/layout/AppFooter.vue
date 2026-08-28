<script setup lang="ts">
const year = new Date().getFullYear();

const groups = [
  {
    title: 'Product',
    links: [
      { to: '/discover', label: 'Discover' },
      { to: '/products', label: 'All products' },
      { to: '/ingredients', label: 'Ingredient library' },
      { to: '/compare', label: 'Compare' },
    ],
  },
  {
    title: 'Your account',
    links: [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/shelf', label: 'My Shelf' },
      { to: '/ai', label: 'AI Beauty Shopper' },
      { to: '/price-alerts', label: 'Price alerts' },
    ],
  },
];
</script>

<template>
  <footer class="mt-20 border-t border-line bg-surface">
    <div class="container-page py-12">
      <div class="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div class="lg:col-span-2">
          <AppLogo />
          <p class="mt-3 max-w-sm text-sm leading-relaxed text-ink-muted">
            Kosvia is your personal AI for choosing cosmetics — it reads the ingredient list,
            weighs it against your skin and your budget, and tells you what actually fits.
          </p>
        </div>

        <nav v-for="group in groups" :key="group.title" :aria-label="group.title">
          <h2 class="text-sm font-semibold text-ink">{{ group.title }}</h2>
          <ul class="mt-3 space-y-2">
            <li v-for="link in group.links" :key="link.to">
              <NuxtLink
                :to="link.to"
                class="text-sm text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
              >{{ link.label }}</NuxtLink>
            </li>
          </ul>
        </nav>
      </div>

      <div class="mt-10 flex flex-col gap-3 border-t border-line pt-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <p>© {{ year }} Kosvia. Demo build.</p>
        <p class="max-w-xl">
          Kosvia gives information about cosmetic products and their ingredients. It is not a
          medical service and does not diagnose or treat skin conditions.
        </p>
      </div>
    </div>
  </footer>
</template>
