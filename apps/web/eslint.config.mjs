import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt({
  rules: {
    // Page and layout components are legitimately single-word here.
    'vue/multi-word-component-names': 'off',
    // Props are declared with TypeScript types, where `prop?: T` already means
    // "optional, undefined when omitted". Requiring an explicit default would
    // only add noise.
    'vue/require-default-prop': 'off',
  },
});
