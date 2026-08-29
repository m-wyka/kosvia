<script setup lang="ts">
definePageMeta({ layout: 'focused', middleware: 'guest' });

const DEMO_EMAIL = 'demo@kosvia.app';
const DEMO_PASSWORD = 'Password123!';

const { needsOnboarding } = storeToRefs(useAuthStore());
const { login } = useAuthStore();
const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const message = useApiMessage();
const { t } = useI18n();

const email = ref('');
const password = ref('');
const error = ref('');
const pending = ref(false);

const destinationAfterLogin = (): string => {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null;
  return redirect ?? localePath(needsOnboarding.value ? '/onboarding' : '/dashboard');
};

const submit = async () => {
  error.value = '';
  pending.value = true;
  try {
    await login(email.value, password.value);
    await router.push(destinationAfterLogin());
  } catch (caught) {
    error.value = message(caught);
  } finally {
    pending.value = false;
  }
};

const fillDemoAccount = () => {
  email.value = DEMO_EMAIL;
  password.value = DEMO_PASSWORD;
};

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
      @click="fillDemoAccount"
    >
      <span class="block text-sm font-medium text-ink">{{ $t('AUTH.DEMO_TITLE') }}</span>
      <span class="block text-xs text-ink-muted">{{ $t('AUTH.DEMO_BODY') }}</span>
    </button>

    <p class="mt-8 text-center text-sm text-ink-muted">
      {{ $t('AUTH.NO_ACCOUNT') }}
      <NuxtLinkLocale
        to="/register"
        class="font-medium text-ink underline-offset-4 hover:underline"
      >
        {{ $t('AUTH.CREATE_ACCOUNT') }}
      </NuxtLinkLocale>
    </p>
  </div>
</template>
