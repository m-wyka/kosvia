<template>
  <div class="flex min-h-dvh flex-col">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-ink-inverse"
    >
      {{ $t('COMMON.SKIP_TO_CONTENT') }}
    </a>

    <AppHeader />

    <main id="main" class="flex-1 pb-24 lg:pb-0">
      <slot />
    </main>

    <AppFooter />
    <CompareTray />
    <AppMobileNav />
  </div>
</template>
