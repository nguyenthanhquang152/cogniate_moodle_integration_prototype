// ESLint flat config for every workspace. Run: npm run lint
// B-T1-01: every git-ignored path is ignored here too (.gitignore is read, not copied by hand), so local data
// such as extracted course packages in **/.data/ or .tmp/ never breaks npm run check.
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';

const gitignore = fileURLToPath(new URL('.gitignore', import.meta.url));

export default tseslint.config(
  includeIgnoreFile(gitignore, '.gitignore'),
  {
    ignores: [
      'docs/**',
      // QA owns tests/** as a separate npm project with its own tooling.
      'tests/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-console': 'off',
    },
  },
);
