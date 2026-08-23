import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'packages/api/src/generated/**',
      'packages/web/src/components/ui/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettier,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // An unawaited promise in an auth or audit path silently drops the work.
      // This is the single most valuable rule in this codebase.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          // The audit log is append-only. There is no legitimate reason for
          // any code path to update or delete an audit row; the database
          // trigger would reject it at runtime anyway, so fail at lint time.
          selector:
            "MemberExpression[object.property.name='auditLog'][property.name=/^(update|updateMany|delete|deleteMany|upsert)$/]",
          message:
            'The audit log is append-only. Updating or deleting audit rows is forbidden (the database trigger will reject it).',
        },
      ],
    },
  },

  // API: Node environment
  {
    files: ['packages/api/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Web: browser environment + React rules
  {
    files: ['packages/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Config files sit outside the type-aware project graph. Spreading
  // disableTypeChecked and then declaring our own languageOptions would
  // replace its parserOptions wholesale and re-enable type checking, so the
  // globals are merged into the spread rather than set beside it.
  {
    files: ['**/*.config.{js,ts}', 'eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: globals.node,
    },
  },

  /*
   * Tests talk to the API over HTTP, and supertest types every response body
   * as `any` because it cannot know the shape of a route it has never seen.
   * Asserting on those bodies is the entire point of an integration test, so
   * the unsafe-any family is relaxed here — and only here.
   */
  {
    files: ['**/tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
