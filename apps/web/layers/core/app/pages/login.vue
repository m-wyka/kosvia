<script setup lang="ts">
definePageMeta({ layout: 'focused', middleware: 'guest' });

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const message = useApiMessage();

const email = ref('');
const password = ref('');
const error = ref('');
const pending = ref(false);

async function submit() {
  error.value = '';
  pending.value = true;
  try {
    await auth.login(email.value, password.value);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null;
    await router.push(redirect ?? localePath(auth.needsOnboarding ? '/onboarding' : '/dashboard'));
  } catch (caught) {
    error.value = message(caught);
  } finally {
    pending.value = false;
  }
}

/** The seeded demo account, so a fresh clone is one click from a full app. */
function useDemoAccount() {
  email.value = 'demo@kosvia.app';
  password.value = 'Password123!';
}

const { t } = useI18n();

useSeo(() => ({
  title: t('SEO.LOGIN.TITLE'),
  description: t('SEO.LOGIN.DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div class="w-full max-w-sm">
    <h1 class="font-display text-3xl text-ink">{{ $t('AUTH.LOGIN_TITLE') }}</h1>
    <p class="mt-2 text-sm text-ink-muted">{{ $t('AUTH.LOGIN_BODY') }}</p>

    <form class="mt-8 space-y-4" novalidate @submit.prevent="submit">
      <BaseInput
        v-model="email"
        :label="$t('AUTH.EMAIL')"
        type="email"
        autocomplete="email"
        :placeholder="$t('AUTH.EMAIL_PLACEHOLDER')"
        required
      />
      <BaseInput
        v-model="password"
        :label="$t('AUTH.PASSWORD')"
        type="password"
        autocomplete="current-password"
        required
      />

      <p
        v-if="error"
        class="flex items-start gap-2 rounded-lg bg-critical-soft px-3.5 py-2.5 text-sm text-critical"
        role="alert"
      >
        <BaseIcon name="alert" :size="15" class="mt-0.5 shrink-0" />
        {{ error }}
      </p>

      <BaseButton type="submit" block size="lg" :loading="pending">
        {{ $t('AUTH.SIGN_IN') }}
      </BaseButton>
    </form>

    <button
      type="button"
      class="mt-4 w-full rounded-lg border border-dashed border-line-strong px-4 py-3 text-left transition-colors hover:bg-surface-muted"
      @click="useDemoAccount"
    >
      <span class="block text-sm font-medium text-ink">{{ $t('AUTH.DEMO_TITLE') }}</span>
      <span class="block text-xs text-ink-muted">{{ $t('AUTH.DEMO_BODY') }}</span>
    </button>

    <p class="mt-8 text-center text-sm text-ink-muted">
      {{ $t('AUTH.NO_ACCOUNT') }}
      <NuxtLinkLocale to="/register" class="font-medium text-ink underline-offset-4 hover:underline">
        {{ $t('AUTH.CREATE_ACCOUNT') }}
      </NuxtLinkLocale>
    </p>
  </div>
</template>
