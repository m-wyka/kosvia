<script setup lang="ts">
definePageMeta({ layout: 'focused', middleware: 'guest' });

const auth = useAuthStore();
const router = useRouter();
const localePath = useLocalePath();
const message = useApiMessage();

const name = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const pending = ref(false);

const { t } = useI18n();

/** Mirrors the API's password policy so the rules are visible before submitting. */
const rules = computed(() => [
  { label: t('AUTH.RULE.LENGTH'), met: password.value.length >= 10 },
  { label: t('AUTH.RULE.LOWER'), met: /[a-z]/.test(password.value) },
  { label: t('AUTH.RULE.UPPER'), met: /[A-Z]/.test(password.value) },
  { label: t('AUTH.RULE.DIGIT'), met: /[0-9]/.test(password.value) },
]);
const passwordValid = computed(() => rules.value.every((rule) => rule.met));

async function submit() {
  error.value = '';
  pending.value = true;
  try {
    await auth.register(email.value, password.value, name.value);
    await router.push(localePath('/onboarding'));
  } catch (caught) {
    error.value = message(caught);
  } finally {
    pending.value = false;
  }
}

useSeo(() => ({
  title: t('SEO.REGISTER.TITLE'),
  description: t('SEO.REGISTER.DESCRIPTION'),
  noindex: true,
}));
</script>

<template>
  <div class="w-full max-w-sm">
    <h1 class="font-display text-3xl text-ink">{{ $t('AUTH.REGISTER_TITLE') }}</h1>
    <p class="mt-2 text-sm text-ink-muted">{{ $t('AUTH.REGISTER_BODY') }}</p>

    <form class="mt-8 space-y-4" novalidate @submit.prevent="submit">
      <BaseInput
        v-model="name"
        :label="$t('AUTH.NAME')"
        autocomplete="name"
        :placeholder="$t('AUTH.NAME_OPTIONAL')"
      />
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
        autocomplete="new-password"
        required
      />

      <ul class="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <li
          v-for="rule in rules"
          :key="rule.label"
          class="flex items-center gap-1.5 text-xs transition-colors"
          :class="rule.met ? 'text-sage' : 'text-ink-faint'"
        >
          <BaseIcon :name="rule.met ? 'check' : 'minus'" :size="12" :stroke-width="2.2" />
          {{ rule.label }}
        </li>
      </ul>

      <p
        v-if="error"
        class="flex items-start gap-2 rounded-lg bg-critical-soft px-3.5 py-2.5 text-sm text-critical"
        role="alert"
      >
        <BaseIcon name="alert" :size="15" class="mt-0.5 shrink-0" />
        {{ error }}
      </p>

      <BaseButton
        type="submit"
        block
        size="lg"
        :loading="pending"
        :disabled="!passwordValid || !email"
      >{{ $t('AUTH.REGISTER') }}</BaseButton>
    </form>

    <p class="mt-6 text-center text-xs leading-relaxed text-ink-muted">
      {{ $t('COMMON.MEDICAL_NOTE') }}
    </p>

    <p class="mt-6 text-center text-sm text-ink-muted">
      {{ $t('AUTH.HAVE_ACCOUNT') }}
      <NuxtLinkLocale to="/login" class="font-medium text-ink underline-offset-4 hover:underline">
        {{ $t('COMMON.SIGN_IN') }}
      </NuxtLinkLocale>
    </p>
  </div>
</template>
