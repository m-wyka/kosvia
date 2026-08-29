import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt({
  rules: {
    'vue/multi-word-component-names': 'off',
    'vue/require-default-prop': 'off',
    'vue/html-self-closing': [
      'error',
      { html: { void: 'always', normal: 'always', component: 'always' } },
    ],
    curly: ['error', 'all'],
    'func-style': ['error', 'expression'],
    'prefer-arrow-callback': 'error',
  },
});
