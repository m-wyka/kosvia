<script setup lang="ts">
const OPEN_BEAUTY_FACTS_URL = 'https://world.openbeautyfacts.org';

const { t } = useI18n();

useSeo(() => ({
  title: t('SEO.ABOUT_DATA.TITLE'),
  description: t('SEO.ABOUT_DATA.DESCRIPTION'),
}));
</script>

<template>
  <div class="container-page py-12">
    <article class="mx-auto max-w-2xl">
      <h1 class="font-display text-3xl text-ink sm:text-4xl">
        {{ $t('ABOUT_DATA.TITLE') }}
      </h1>
      <p class="mt-4 text-base leading-relaxed text-ink-soft">
        {{ $t('ABOUT_DATA.INTRO') }}
      </p>

      <section class="mt-10">
        <h2 class="font-display text-2xl text-ink">
          {{ $t('ABOUT_DATA.OBF_TITLE') }}
        </h2>
        <p class="mt-3 text-base leading-relaxed text-ink-soft">
          {{ $t('ABOUT_DATA.OBF_BODY') }}
        </p>
        <a
          :href="OPEN_BEAUTY_FACTS_URL"
          class="mt-3 inline-block text-sm font-medium text-ink underline-offset-4 hover:underline"
          rel="noopener"
          target="_blank"
        >
          {{ $t('ABOUT_DATA.OBF_LINK') }}
        </a>
      </section>

      <section class="mt-10">
        <h2 class="font-display text-2xl text-ink">
          {{ $t('ABOUT_DATA.OWN_TITLE') }}
        </h2>
        <p class="mt-3 text-base leading-relaxed text-ink-soft">
          {{ $t('ABOUT_DATA.OWN_BODY') }}
        </p>
      </section>

      <section class="mt-10">
        <h2 class="font-display text-2xl text-ink">
          {{ $t('ABOUT_DATA.DEMO_TITLE') }}
        </h2>
        <p class="mt-3 text-base leading-relaxed text-ink-soft">
          {{ $t('ABOUT_DATA.DEMO_BODY') }}
        </p>
      </section>

      <p
        class="mt-10 rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed text-ink-muted"
      >
        {{ $t('ABOUT_DATA.CONTACT') }}
      </p>
    </article>
  </div>
</template>
