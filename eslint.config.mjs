import eslint from '@eslint/js';
import globals from 'globals';
import { globalIgnores, defineConfig } from 'eslint/config';

export default defineConfig(
  globalIgnores([ '**/dist/', '**/coverage/' ]),
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      semi: ['error', 'always'],
      quotes: ['error', 'single'],
    },
  },
  eslint.configs.recommended,
);
