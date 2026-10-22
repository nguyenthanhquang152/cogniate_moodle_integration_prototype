// ESLint flat config for every workspace. Run: npm run lint
// B-T1-01: every git-ignored path is ignored here too (.gitignore is read, not copied by hand), so local data
// such as extracted course packages in **/.data/ or .tmp/ never breaks npm run check.
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import globals from 'globals';
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';

const gitignore = fileURLToPath(new URL('.gitignore', import.meta.url));
const root = fileURLToPath(new URL('.', import.meta.url));
const channelsRoot = resolve(root, 'packages/channels');
// F1 and F3 use the same product scope (README §4). F1 itself is installed by LA-E1-04.
const scope = JSON.parse(readFileSync(new URL('packages/channel-kernel/fitness-scope.json', import.meta.url), 'utf8'));
const qaImports = { group: ['**/tests/**'], message: 'Do not import from tests/** (QA only).' };
const channelImports = { group: ['**/packages/channels/**', 'packages/channels/**'], message: 'Core must use channel registry discovery (LA-ADR-01 D1).' };
const kernelTypes = { name: '@cogniate/channel-kernel', allowTypeImports: true, message: 'Channel files may import kernel types only (LA-ADR-01 D1).' };
const portPath = '(?:\\.\\./)+services/cogniate-app/src/kernel/ports\\.ts';
const portTypes = { regex: `^${portPath}$`, caseSensitive: true, allowTypeImports: true, message: 'Import app port types only (LA-ADR-01 D1).' };
const onlyImports = (allowed) => ({ regex: `^(?!(?:${allowed})$)`, caseSensitive: true, message: 'This import is outside the channel entry point API (LA-ADR-01 D1).' });

const inside = (folder, file) => {
  const path = relative(folder, file);
  return path !== '..' && !path.startsWith('../') && !isAbsolute(path);
};

// no-restricted-imports enforces the API table below. Resolve relative imports too: a glob alone cannot
// tell if ../../ leaves the current channel at every nesting depth. No channel ids are listed here.
const localBoundary = {
  meta: { type: 'problem', schema: [], messages: { boundary: 'This path crosses the channel boundary (LA-ADR-01 D1).' } },
  create(context) {
    const file = context.filename;
    const inChannel = inside(channelsRoot, file);
    const channel = inChannel ? resolve(channelsRoot, relative(channelsRoot, file).split('/')[0]) : null;
    const entry = channel ? relative(channel, file) : '';
    const check = (source) => {
      if (!source || typeof source.value !== 'string') return;
      const value = source.value;
      if (!value.startsWith('.') && !isAbsolute(value)) return;
      const target = resolve(dirname(file), value);
      if (!channel) {
        if (inside(channelsRoot, target)) context.report({ node: source, messageId: 'boundary' });
        return;
      }
      if (inside(channel, target)) {
        // Portal code can use its own modules and manifest, but cannot load the channel's server code.
        if (entry.startsWith('portal/') && !/\.test\.[tj]sx?$/.test(entry)
          && !inside(resolve(channel, 'portal'), target) && target !== resolve(channel, 'manifest.ts')) {
          context.report({ node: source, messageId: 'boundary' });
        }
        return;
      }
      if ((entry === 'app.ts' || entry.startsWith('app/')) && target === resolve(root, 'services/cogniate-app/src/kernel/ports.ts')) return;
      if (entry.startsWith('portal/') && inside(resolve(root, 'apps/portal/src/sdk'), target)) return;
      context.report({ node: source, messageId: 'boundary' });
    };
    return {
      ImportDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
      TSImportType: (node) => check(node.source),
      CallExpression: (node) => { if (node.callee.type === 'Identifier' && node.callee.name === 'require') check(node.arguments[0]); },
    };
  },
};

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
      // ADR-008: no code imports from tests/**.
      'no-restricted-imports': ['error', { patterns: [qaImports] }],
    },
  },
  {
    files: [...scope.classes.core.globs, ...scope.classes.channel.globs],
    plugins: { channels: { rules: { 'local-boundary': localBoundary } } },
    rules: { 'channels/local-boundary': 'error' },
  },
  {
    files: scope.classes.core.globs,
    rules: { 'no-restricted-imports': ['error', { patterns: [qaImports, channelImports] }] },
  },
  {
    // ADR-008 import fence: the untrusted content host imports only domain/attempts*, packages/tracking and packages/shared.
    files: ['services/cogniate-app/src/content-host/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['../*', '!../domain', '../domain/*', '!../domain/attempts*'], message: 'content-host may import only ../domain/attempts*, @cogniate/tracking and @cogniate/shared (ADR-008).' },
          { group: ['@cogniate/*', '!@cogniate/shared', '!@cogniate/tracking'], message: 'content-host may import only @cogniate/shared and @cogniate/tracking (ADR-008).' },
          qaImports, channelImports,
        ],
      }],
    },
  },
  {
    files: ['packages/channels/*/manifest.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: [kernelTypes], patterns: [onlyImports('@cogniate/channel-kernel')] }] },
  },
  {
    files: ['packages/channels/*/lti-profiles.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: [kernelTypes], patterns: [onlyImports('@cogniate/channel-kernel|\\./manifest\\.ts')] }] },
  },
  {
    files: ['packages/channels/*/app.ts'],
    rules: { 'no-restricted-imports': ['error', { paths: [kernelTypes], patterns: [portTypes, onlyImports(`@cogniate/channel-kernel|${portPath}`)] }] },
  },
  {
    files: ['packages/channels/*/app/**'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', {
      paths: [kernelTypes], patterns: [qaImports, portTypes, onlyImports(`@cogniate/(?:channel-kernel|shared)|${portPath}|\\.{1,2}/.*`)],
    }] },
  },
  {
    files: ['packages/channels/*/portal/**'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', {
      paths: [kernelTypes], patterns: [qaImports, onlyImports('@cogniate/(?:channel-kernel|portal-sdk)|react(?:/.*)?|\\.{1,2}/.*')],
    }] },
  },
);
