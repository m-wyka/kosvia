<script setup lang="ts">
/**
 * Language switcher.
 *
 * `switchLocalePath` returns the current route in the other locale, so
 * switching from /pl/products/xyz lands on /products/xyz rather than the home
 * page. Rendered as real links: each locale has its own URL, and a link is
 * what lets a reader open the other language in a new tab.
 */
withDefaults(defineProps<{ variant?: 'inline' | 'stacked' }>(), { variant: 'inline' });

type LocaleCode = 'en' | 'pl';

const { locale, locales } = useI18n();
const switchLocalePath = useSwitchLocalePath();

const { t } = useI18n();

/** Names come from the locale files so each language names itself. */
const available = computed(() =>
  locales.value.map((entry) => ({
    code: entry.code as LocaleCode,
    label: t(`LOCALE.${entry.code.toUpperCase()}`),
  })),
);
</script>

<template>
  <nav
    :aria-label="$t('LOCALE.LABEL')"
    class="flex items-center gap-0.5 rounded-pill border border-line p-0.5"
    :class="variant === 'stacked' && 'w-full justify-center'"
  >
    <NuxtLink
      v-for="entry in available"
      :key="entry.code"
      :to="switchLocalePath(entry.code)"
      class="rounded-pill px-2.5 py-1 text-xs font-medium transition-colors"
      :class="
        locale === entry.code
          ? 'bg-ink text-ink-inverse'
          : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
      "
      :aria-current="locale === entry.code ? 'true' : undefined"
      :hreflang="entry.code"
    >{{ entry.code.toUpperCase() }}<span class="sr-only"> — {{ entry.label }}</span></NuxtLink>
  </nav>
</template>
