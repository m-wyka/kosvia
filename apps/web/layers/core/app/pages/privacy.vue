<script setup lang="ts">
const { t } = useI18n();

const SECTIONS = [
  'WHAT',
  'BASIS',
  'HEALTH',
  'AI',
  'MATCH',
  'RIGHTS',
  'RETENTION',
  'COOKIES',
  'MEDICAL',
] as const;

useSeo(() => ({
  title: t('PRIVACY.TITLE'),
  description: t('SEO.PRIVACY.DESCRIPTION'),
}));
</script>

<template>
  <div class="container-page py-12">
    <article>
      <h1 class="font-display text-3xl text-ink sm:text-4xl">
        {{ $t('PRIVACY.TITLE') }}
      </h1>
      <p class="mt-4 text-base leading-relaxed text-ink-soft">
        {{ $t('PRIVACY.INTRO') }}
      </p>
      <p class="mt-3 rounded-lg bg-info-soft px-3.5 py-2.5 text-xs leading-relaxed text-info">
        {{ $t('PRIVACY.DRAFT_NOTE') }}
      </p>

      <section v-for="section in SECTIONS" :key="section" class="mt-10">
        <h2 class="font-display text-2xl text-ink">
          {{ $t(`PRIVACY.${section}_TITLE`) }}
        </h2>
        <p class="mt-3 text-base leading-relaxed whitespace-pre-line text-ink-soft">
          {{ $t(`PRIVACY.${section}_BODY`) }}
        </p>
      </section>

      <p class="mt-10 text-sm text-ink-muted">
        {{ $t('PRIVACY.VERSION', { date: '2026-08-29' }) }}
      </p>
    </article>
  </div>
</template>
