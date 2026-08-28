<script setup lang="ts">
/**
 * The one button in the product. Renders as <button>, <a> or <NuxtLinkLocale>
 * depending on what it is given, so navigation stays semantic.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const props = withDefaults(
  defineProps<{
    variant?: Variant;
    size?: Size;
    to?: string;
    href?: string;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    loading?: boolean;
    block?: boolean;
    /** Required when the button has no visible text (icon-only). */
    label?: string;
  }>(),
  { variant: 'primary', size: 'md', type: 'button' },
);

// `NuxtLinkLocale`, not `NuxtLink`: with a prefixed strategy every internal
// path needs the active locale applied, and callers pass unprefixed paths.
const component = computed(() =>
  props.to ? resolveComponent('NuxtLinkLocale') : props.href ? 'a' : 'button',
);

const variants: Record<Variant, string> = {
  primary:
    'bg-ink text-ink-inverse hover:bg-ink-soft active:bg-ink disabled:bg-ink-faint shadow-xs',
  secondary:
    'bg-surface text-ink border border-line-strong hover:border-ink-faint hover:bg-surface-muted shadow-xs',
  ghost: 'bg-transparent text-ink-soft hover:bg-surface-muted hover:text-ink',
  accent: 'bg-blush text-white hover:bg-blush-deep shadow-xs',
  danger: 'bg-critical-soft text-critical border border-critical/25 hover:bg-critical hover:text-white',
};

const sizes: Record<Size, string> = {
  // Minimum 44px tall on md/lg so touch targets are comfortable on mobile.
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-md',
  md: 'h-11 px-5 text-sm gap-2 rounded-lg',
  lg: 'h-13 px-7 text-base gap-2.5 rounded-xl',
};
</script>

<template>
  <component
    :is="component"
    :to="to"
    :href="href"
    :type="to || href ? undefined : type"
    :disabled="to || href ? undefined : disabled || loading"
    :aria-disabled="disabled || loading ? 'true' : undefined"
    :aria-busy="loading ? 'true' : undefined"
    :aria-label="label"
    class="inline-flex items-center justify-center font-medium tracking-tight whitespace-nowrap
           transition-all duration-[--duration-fast] ease-[--ease-out-soft]
           active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
    :class="[variants[variant], sizes[size], block && 'w-full']"
  >
    <BaseSpinner v-if="loading" :size="size === 'lg' ? 18 : 15" />
    <slot v-else name="icon" />
    <slot />
  </component>
</template>
