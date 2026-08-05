import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const baseConfig = tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-expect-error': 'allow-with-description',
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
);

import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
  { ignores: ['test-results/**', 'playwright-report/**', 'artifacts/**'] },
  ...nextVitals,
  ...baseConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@personal-link-hub/database',
                '@personal-link-hub/database/*',
                'drizzle-orm',
                'drizzle-orm/*',
                'pg',
                'openai',
                'openai/*',
              ],
              message:
                'Application persistence and AI integrations belong in the separate backend repository.',
            },
          ],
        },
      ],
    },
  },
];

export default config;
