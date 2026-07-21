import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', '.wrangler/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      // TypeScript already reports undefined identifiers with type info.
      'no-undef': 'off',
    },
  },
  {
    // Node ESM tooling scripts (schema/fixture validation).
    files: ['scripts/**/*.mjs', 'test/**/*.test.mjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
