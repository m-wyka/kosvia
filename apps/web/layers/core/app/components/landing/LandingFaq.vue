<script setup lang="ts">
const { t } = useI18n();

/** Six entries, each a Q/A pair under LANDING.FAQ. */
const faqs = computed(() =>
  [1, 2, 3, 4, 5, 6].map((n) => ({
    q: t(`LANDING.FAQ.Q_${n}`),
    a: t(`LANDING.FAQ.A_${n}`),
  })),
);

const open = ref<number | null>(0);
</script>

<template>
  <section class="container-page py-16 sm:py-20">
    <SectionHeading
      :eyebrow="$t('LANDING.FAQ.EYEBROW')"
      :title="$t('LANDING.FAQ.TITLE')"
      align="center"
    />

    <dl class="mx-auto mt-10 max-w-2xl divide-y divide-line rounded-xl border border-line bg-surface">
      <div v-for="(faq, index) in faqs" :key="faq.q">
        <dt>
          <button
            type="button"
            class="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-muted"
            :aria-expanded="open === index"
            @click="open = open === index ? null : index"
          >
            <span class="text-sm font-medium text-ink">{{ faq.q }}</span>
            <BaseIcon
              name="chevron-down"
              :size="17"
              class="mt-0.5 shrink-0 text-ink-faint transition-transform duration-[--duration-fast]"
              :class="open === index && 'rotate-180'"
            />
          </button>
        </dt>
        <dd v-if="open === index" class="animate-fade-up px-5 pb-4 text-sm leading-relaxed text-ink-muted">
          {{ faq.a }}
        </dd>
      </div>
    </dl>
  </section>
</template>
