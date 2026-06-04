// Shared flat ESLint config for all TypeScript workspaces.
// Per-package eslint.config.mjs files re-export this and may extend it.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.turbo/**',
      '**/.expo/**',
      '**/node_modules/**',
      'packages/db/src/generated/**',
      'packages/api-client/src/schema.d.ts',
      'apps/scraper/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // CommonJS config files (Metro/Babel/Prettier etc.) use Node globals and require().
    files: ['**/*.config.js', '**/*.cjs', '**/babel.config.js', '**/metro.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        module: 'writable',
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },
  {
    rules: {
      // Strict TS hygiene: no implicit any, justify every suppression.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
