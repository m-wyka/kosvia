import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt({
  rules: {
    'vue/multi-word-component-names': 'off',
    'vue/require-default-prop': 'off',
    curly: ['error', 'all'],
    'func-style': ['error', 'expression'],
    'prefer-arrow-callback': 'error',
  },
});
