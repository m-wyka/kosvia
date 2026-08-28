<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();

const { t } = useI18n();
const localePath = useLocalePath();

const isMissing = computed(() => props.error.statusCode === 404);

const copy = computed(() =>
  isMissing.value
    ? { title: t('ERRORS.NOT_FOUND_TITLE'), body: t('ERRORS.NOT_FOUND_BODY') }
    : { title: t('ERRORS.SERVER_TITLE'), body: t('ERRORS.SERVER_BODY') },
);

useHead(() => ({ title: copy.value.title }));
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-canvas">
    <header class="container-page flex h-16 shrink-0 items-center">
      <NuxtLinkLocale to="/" :aria-label="$t('NAV.HOME')"><AppLogo /></NuxtLinkLocale>
    </header>

    <main class="container-page flex flex-1 items-center justify-center py-12">
      <div class="max-w-md text-center">
        <span
          class="mx-auto flex size-14 items-center justify-center rounded-2xl"
          :class="isMissing ? 'bg-surface-muted text-ink-muted' : 'bg-critical-soft text-critical'"
        >
          <BaseIcon :name="isMissing ? 'search' : 'alert'" :size="26" />
        </span>

        <h1 class="mt-6 font-display text-3xl text-ink">{{ copy.title }}</h1>
        <p class="mt-3 text-base text-ink-muted">{{ copy.body }}</p>

        <div class="mt-8 flex flex-col justify-center gap-2.5 sm:flex-row">
          <BaseButton size="lg" @click="clearError({ redirect: localePath('/products') })">
            {{ $t('ERRORS.BROWSE_PRODUCTS') }}
          </BaseButton>
          <BaseButton
            size="lg"
            variant="secondary"
            @click="clearError({ redirect: localePath('/') })"
          >
            {{ $t('ERRORS.GO_HOME') }}
          </BaseButton>
        </div>

        <p v-if="error.statusCode" class="mt-8 text-xs text-ink-faint">
          {{ $t('ERRORS.CODE', { code: error.statusCode }) }}
        </p>
      </div>
    </main>
  </div>
</template>
