<script setup lang="ts">
const { t } = useI18n();

const comparisonOpen = ref(false);

useSeo(() => ({
  title: t('SEO.PRICING.TITLE'),
  description: t('SEO.PRICING.DESCRIPTION'),
  path: '/pricing',
}));
</script>

<template>
  <div class="container-page py-12 sm:py-16">
    <SectionHeading
      :eyebrow="$t('PRICING.EYEBROW')"
      :title="$t('PRICING.TITLE')"
      :description="$t('PRICING.BODY')"
      align="center"
    />

    <PricingPlanCards class="mt-10" />

    <div class="mt-8 flex justify-center">
      <BaseButton variant="ghost" @click="comparisonOpen = true">
        {{ $t('PRICING.COMPARE.OPEN') }}
      </BaseButton>
    </div>

    <PlanUsageCard class="mx-auto mt-10 max-w-3xl" />

    <PricingComparisonModal v-model:open="comparisonOpen" />
  </div>
</template>
