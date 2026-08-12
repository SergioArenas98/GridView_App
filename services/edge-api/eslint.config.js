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
    // Node ESM tooling scripts (schema/fixture validation, media publication).
    // These run in Node, not in the Worker runtime, so they get Node globals.
    files: ['scripts/**/*.mjs', 'scripts/**/*.ts', 'test/**/*.test.mjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
