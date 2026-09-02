<template>
  <section class="container-page py-16 sm:py-20">
    <SectionHeading
      :eyebrow="$t('LANDING.PRICING.EYEBROW')"
      :title="$t('LANDING.PRICING.TITLE')"
      :description="$t('LANDING.PRICING.BODY')"
      align="center"
    />

    <PricingPlanCards class="mt-10" />

    <div class="mt-8 flex justify-center">
      <NuxtLinkLocale to="/pricing" class="text-sm font-medium text-ink-soft underline">
        {{ $t('LANDING.PRICING.SEE_FULL') }}
      </NuxtLinkLocale>
    </div>
  </section>
</template>
