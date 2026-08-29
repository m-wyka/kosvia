<template>
  <div class="flex min-h-dvh flex-col bg-canvas">
    <header class="container-page flex h-16 shrink-0 items-center justify-between">
      <NuxtLinkLocale to="/" :aria-label="$t('NAV.HOME')"><AppLogo /></NuxtLinkLocale>
      <slot name="header-action" />
    </header>
    <main class="container-page flex flex-1 items-center justify-center py-8">
      <slot />
    </main>
  </div>
</template>
