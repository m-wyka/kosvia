<template>
  <section class="container-page pb-20">
    <div class="relative overflow-hidden rounded-2xl border border-line bg-surface px-6 py-14 text-center sm:px-12">
      <div class="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div class="absolute -top-24 left-1/4 size-80 rounded-full bg-blush-soft blur-3xl opacity-70" />
        <div class="absolute -bottom-24 right-1/4 size-80 rounded-full bg-sage-soft blur-3xl opacity-60" />
      </div>

      <h2 class="mx-auto max-w-2xl font-display text-3xl leading-tight text-ink sm:text-4xl">
        {{ $t('LANDING.CTA.TITLE') }}
      </h2>
      <p class="mx-auto mt-4 max-w-xl text-base text-ink-muted">{{ $t('LANDING.CTA.BODY') }}</p>
      <div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <BaseButton to="/onboarding" size="lg">
          {{ $t('LANDING.CTA.PRIMARY') }}
          <template #icon><BaseIcon name="arrow-right" :size="18" /></template>
        </BaseButton>
        <BaseButton to="/products" size="lg" variant="secondary">
          {{ $t('LANDING.CTA.SECONDARY') }}
        </BaseButton>
      </div>
    </div>
  </section>
</template>
