<script setup lang="ts">
const year = new Date().getFullYear();

const groups = [
  {
    title: 'FOOTER.PRODUCT',
    links: [
      { to: '/discover', label: 'NAV.DISCOVER' },
      { to: '/products', label: 'FOOTER.ALL_PRODUCTS' },
      { to: '/ingredients', label: 'FOOTER.INGREDIENT_LIBRARY' },
      { to: '/dupes', label: 'FOOTER.DUPES' },
      { to: '/compare', label: 'NAV.COMPARE' },
      { to: '/reviews', label: 'FOOTER.REVIEWS' },
      { to: '/about-data', label: 'FOOTER.ABOUT_DATA' },
      { to: '/privacy', label: 'FOOTER.PRIVACY' },
    ],
  },
  {
    title: 'FOOTER.ACCOUNT',
    links: [
      { to: '/dashboard', label: 'NAV.DASHBOARD' },
      { to: '/shelf', label: 'NAV.SHELF' },
      { to: '/ai', label: 'SEO.AI.TITLE' },
      { to: '/price-alerts', label: 'NAV.ALERTS' },
      { to: '/diary', label: 'FOOTER.DIARY' },
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
            {{ $t('FOOTER.BLURB') }}
          </p>
          <LocaleSwitcher class="mt-5 w-fit" />
        </div>

        <nav v-for="group in groups" :key="group.title" :aria-label="$t(group.title)">
          <h2 class="text-sm font-semibold text-ink">{{ $t(group.title) }}</h2>
          <ul class="mt-3 space-y-2">
            <li v-for="link in group.links" :key="link.to">
              <NuxtLinkLocale
                :to="link.to"
                class="text-sm text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                {{ $t(link.label) }}
              </NuxtLinkLocale>
            </li>
          </ul>
        </nav>
      </div>

      <div
        class="mt-10 flex flex-col gap-3 border-t border-line pt-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between"
      >
        <p>{{ $t('FOOTER.RIGHTS', { year }) }}</p>
        <p class="max-w-xl">{{ $t('COMMON.MEDICAL_NOTE') }}</p>
      </div>
    </div>
  </footer>
</template>
