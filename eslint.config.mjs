import { defineConfig } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';

export default defineConfig([
  {
    ignores: ['dist/**', 'coverage/**', 'ios/**', 'android/**', 'modules/legacy-ai/**', 'work-web-export/**'],
  },
  ...expoConfig,
  {
    rules: {
      'import/order': ['warn', { alphabetize: { order: 'asc' }, 'newlines-between': 'always' }],
    },
  },
]);
