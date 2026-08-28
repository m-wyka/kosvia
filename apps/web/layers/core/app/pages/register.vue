<script setup lang="ts">
definePageMeta({ layout: 'focused', middleware: 'guest' });

const auth = useAuthStore();
const router = useRouter();
const message = useApiMessage();

const name = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const pending = ref(false);

/** Mirrors the API's password policy so the rules are visible before submitting. */
const rules = computed(() => [
  { label: 'At least 10 characters', met: password.value.length >= 10 },
  { label: 'One lowercase letter', met: /[a-z]/.test(password.value) },
  { label: 'One uppercase letter', met: /[A-Z]/.test(password.value) },
  { label: 'One number', met: /[0-9]/.test(password.value) },
]);
const passwordValid = computed(() => rules.value.every((rule) => rule.met));

async function submit() {
  error.value = '';
  pending.value = true;
  try {
    await auth.register(email.value, password.value, name.value);
    await router.push('/onboarding');
  } catch (caught) {
    error.value = message(caught);
  } finally {
    pending.value = false;
  }
}

useSeo({
  title: 'Create your account',
  description: 'Create a Kosvia account to get personal match scores on every cosmetic.',
  noindex: true,
});
</script>

<template>
  <div class="w-full max-w-sm">
    <h1 class="font-display text-3xl text-ink">Create your account</h1>
    <p class="mt-2 text-sm text-ink-muted">
      Two minutes of questions, and every product gets a score that means something to you.
    </p>

    <form class="mt-8 space-y-4" novalidate @submit.prevent="submit">
      <BaseInput v-model="name" label="Name" autocomplete="name" placeholder="Optional" />
      <BaseInput
        v-model="email"
        label="Email"
        type="email"
        autocomplete="email"
        placeholder="you@example.com"
        required
      />
      <BaseInput
        v-model="password"
        label="Password"
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
      >Create account</BaseButton>
    </form>

    <p class="mt-6 text-center text-xs leading-relaxed text-ink-muted">
      Kosvia gives information about cosmetics and their ingredients. It is not a medical
      service and does not diagnose or treat skin conditions.
    </p>

    <p class="mt-6 text-center text-sm text-ink-muted">
      Already have an account?
      <NuxtLink to="/login" class="font-medium text-ink underline-offset-4 hover:underline">
        Sign in
      </NuxtLink>
    </p>
  </div>
</template>
