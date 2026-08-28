<script setup lang="ts">
definePageMeta({ layout: 'focused', middleware: 'guest' });

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
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
    await router.push(redirect ?? (auth.needsOnboarding ? '/onboarding' : '/dashboard'));
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

useSeo({
  title: 'Sign in',
  description: 'Sign in to Kosvia to see your personal match scores, shelf and price alerts.',
  noindex: true,
});
</script>

<template>
  <div class="w-full max-w-sm">
    <h1 class="font-display text-3xl text-ink">Welcome back</h1>
    <p class="mt-2 text-sm text-ink-muted">
      Sign in to pick up your shelf, your matches and your alerts.
    </p>

    <form class="mt-8 space-y-4" novalidate @submit.prevent="submit">
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

      <BaseButton type="submit" block size="lg" :loading="pending">Sign in</BaseButton>
    </form>

    <button
      type="button"
      class="mt-4 w-full rounded-lg border border-dashed border-line-strong px-4 py-3 text-left transition-colors hover:bg-surface-muted"
      @click="useDemoAccount"
    >
      <span class="block text-sm font-medium text-ink">Use the demo account</span>
      <span class="block text-xs text-ink-muted">
        demo@kosvia.app — a filled-in profile, shelf and price alerts
      </span>
    </button>

    <p class="mt-8 text-center text-sm text-ink-muted">
      New here?
      <NuxtLink to="/register" class="font-medium text-ink underline-offset-4 hover:underline">
        Create an account
      </NuxtLink>
    </p>
  </div>
</template>
