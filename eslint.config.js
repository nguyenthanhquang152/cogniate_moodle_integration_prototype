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
const sharedTypes = { name: '@cogniate/shared', allowTypeImports: true, message: 'Use import type from @cogniate/shared; values come from @cogniate/shared/channel (BD-A2-11).' };
const portPath = '(?:\\.\\./)+services/cogniate-app/src/kernel/ports\\.ts';
const portTypes = { regex: `^${portPath}$`, caseSensitive: true, allowTypeImports: true, message: 'Import app port types only (LA-ADR-01 D1).' };
const baseChannelImports = [qaImports, {
  regex: '^@cogniate/(?:cogniate-app|lti-service|portal|player)(?:/|$)', caseSensitive: true,
  message: 'Channels use kernel ports or the portal SDK, never service or app packages (LA-ADR-01 D1).',
}];
const kernelPath = '@cogniate/channel-kernel';
const appPaths = `${kernelPath}(?:/setup)?|@cogniate/shared(?:/channel)?|${portPath}|\\.{1,2}/.*`;
const portalPaths = `${kernelPath}|@cogniate/portal-sdk|react(?:/.*)?|\\.{1,2}/.*`;
const testTools = 'vitest(?:/.*)?|@testing-library/(?:react|dom|user-event)(?:/.*)?|node:(?:assert(?:/strict)?|test)';
const importRows = {
  manifest: { allowed: kernelPath, message: 'A manifest imports only @cogniate/channel-kernel types.' },
  profiles: { allowed: `${kernelPath}|\\./manifest\\.ts`, message: 'LTI profiles import kernel types and their own ./manifest.ts.' },
  app: { allowed: appPaths, message: 'App modules import kernel/port/shared types, kernel/setup and shared/channel values and their own manifest/app files.' },
  appTest: { allowed: `${appPaths}|${testTools}`, message: 'App tests use the app import API and test tools.' },
  portal: { allowed: portalPaths, message: 'Portal modules import kernel types, React, the portal SDK and their own manifest/portal files.' },
  portalTest: { allowed: `${portalPaths}|${testTools}`, message: 'Portal tests use the portal import API and test tools.' },
  rootTest: { allowed: `${kernelPath}|\\.{1,2}/.*|${testTools}`, message: 'Root tests import their own channel files, kernel types and test tools.' },
};
const onlyImports = (row) => ({ regex: `^(?!(?:${row.allowed})$)`, caseSensitive: true, message: `${row.message} (LA-ADR-01 D1).` });
// Every row keeps the base fence. The path rule below resolves traversal and the two path exceptions.
const channelImportsFor = (kind) => ['error', {
  paths: [kernelTypes, sharedTypes], patterns: [...baseChannelImports, portTypes, onlyImports(importRows[kind])],
}];
const isTest = (file) => /\.test\.[^/]+$/.test(file);
const channelKind = (entry) => {
  if (entry === 'manifest.ts') return 'manifest';
  if (entry === 'lti-profiles.ts') return 'profiles';
  if (entry === 'app.ts') return 'app';
  if (entry === 'README.md') return 'readme';
  if (isTest(entry)) {
    if (/^[^/]+\.test\.ts$/.test(entry)) return 'rootTest';
    if (/^app\/.*\.test\.ts$/.test(entry)) return 'appTest';
    if (/^portal\/.*\.test\.tsx$/.test(entry)) return 'portalTest';
    return null;
  }
  if (entry.startsWith('app/')) return 'app';
  if (entry.startsWith('portal/')) return 'portal';
  return null;
};

const inside = (folder, file) => {
  const path = relative(folder, file);
  return path !== '..' && !path.startsWith('../') && !isAbsolute(path);
};

// no-restricted-imports enforces the API table below. Resolve relative imports too: a glob alone cannot
// tell if ../../ leaves the current channel at every nesting depth. No channel ids are listed here.
const localBoundary = {
  meta: { type: 'problem', schema: [], messages: {
    boundary: 'Use files allowed for this channel entry: its own manifest/app/portal files, app port types or the portal SDK (LA-ADR-01 D1).',
    core: 'Core must use channel registry discovery, never a channel path (LA-ADR-01 D1).',
    kind: 'This is not a D1 channel file kind. Use manifest.ts, lti-profiles.ts, app.ts, app/**, portal/**, a colocated test or README.md.',
    dynamic: 'No runtime dynamic loading in channel files, including tests (LA-ADR-01 D1).',
    test: 'A non-test channel file must not import a test file (LA-ADR-01 D1).',
    type: '{{allowed}} Type-position imports follow the same row (LA-ADR-01 D1).',
  } },
  create(context) {
    const file = context.filename;
    const inChannel = inside(channelsRoot, file);
    const channel = inChannel ? resolve(channelsRoot, relative(channelsRoot, file).split('/')[0]) : null;
    const entry = channel ? relative(channel, file) : '';
    const kind = channelKind(entry);
    const specifier = (source) => {
      if (typeof source?.value === 'string') return source.value;
      if (source?.type === 'TemplateLiteral' && source.expressions.length === 0) return source.quasis[0].value.cooked;
      return null;
    };
    const check = (source) => {
      const value = specifier(source);
      if (value === null) return;
      if (!channel && value.startsWith('packages/channels/')) context.report({ node: source, messageId: 'core' });
      if (!value.startsWith('.') && !isAbsolute(value)) return;
      const target = resolve(dirname(file), value);
      if (!channel) {
        if (inside(channelsRoot, target)) context.report({ node: source, messageId: 'core' });
        return;
      }
      if (!isTest(entry) && isTest(target)) context.report({ node: source, messageId: 'test' });
      if (inside(channel, target)) {
        const ownEntry = relative(channel, target);
        const ownKind = channelKind(ownEntry);
        const allowed = kind === 'rootTest'
          || (kind === 'profiles' && ownEntry === 'manifest.ts')
          || ((kind === 'app' || kind === 'appTest') && (ownEntry === 'manifest.ts' || ownEntry.startsWith('app/')))
          || ((kind === 'portal' || kind === 'portalTest') && (ownEntry === 'manifest.ts' || ownEntry.startsWith('portal/')));
        if (!allowed || !ownKind || ownKind === 'readme') {
          context.report({ node: source, messageId: 'boundary' });
        }
        return;
      }
      if ((entry === 'app.ts' || entry.startsWith('app/')) && target === resolve(root, 'services/cogniate-app/src/kernel/ports.ts')) return;
      if (entry.startsWith('portal/') && inside(resolve(root, 'apps/portal/src/sdk'), target)) return;
      context.report({ node: source, messageId: 'boundary' });
    };
    const dynamic = (node, source) => {
      if (channel) context.report({ node, messageId: 'dynamic' });
      else check(source);
    };
    return {
      Program: (node) => { if (channel && !kind) context.report({ node, messageId: 'kind' }); },
      ImportDeclaration: (node) => {
        check(node.source);
        if (channel && node.specifiers.some((s) => s.type === 'ImportSpecifier' && (s.imported.name ?? s.imported.value) === 'createRequire')) {
          context.report({ node, messageId: 'dynamic' });
        }
      },
      ExportNamedDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ImportExpression: (node) => dynamic(node, node.source),
      TSImportType: (node) => {
        check(node.source);
        const row = importRows[kind];
        if (channel && row && !new RegExp(`^(?:${row.allowed})$`).test(specifier(node.source))) {
          context.report({ node, messageId: 'type', data: { allowed: row.message } });
        }
      },
      TSImportEqualsDeclaration: (node) => {
        if (node.moduleReference.type === 'TSExternalModuleReference') dynamic(node, node.moduleReference.expression);
      },
      CallExpression: (node) => {
        const callee = node.callee;
        if (callee.type === 'Identifier' && callee.name === 'require') dynamic(node, node.arguments[0]);
        if (channel && ((callee.type === 'Identifier' && callee.name === 'createRequire')
          || (callee.type === 'MemberExpression' && (callee.computed ? specifier(callee.property) : callee.property.name) === 'createRequire'))) {
          context.report({ node, messageId: 'dynamic' });
        }
      },
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
    // Include non-code and extensionless files too, so an unknown file kind cannot escape lint discovery.
    files: ['packages/channels/*/**/*.*', 'packages/channels/*/**/!(*.*)'],
    languageOptions: {
      parser: {
        meta: { name: 'channel-file-kinds', version: '1' },
        parseForESLint(code, options) {
          const entry = relative(channelsRoot, options.filePath).split('/').slice(1).join('/');
          // Validate the layout before parsing unknown files; README and assets have no JS import syntax.
          const source = channelKind(entry) && /\.[cm]?[jt]sx?$/.test(entry) ? code : '';
          return tseslint.parser.parseForESLint(source, options);
        },
      },
    },
    rules: { 'no-restricted-imports': ['error', { paths: [kernelTypes, sharedTypes], patterns: baseChannelImports }],
      'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error',
    },
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
    rules: { 'no-restricted-imports': channelImportsFor('manifest') },
  },
  {
    files: ['packages/channels/*/lti-profiles.ts'],
    rules: { 'no-restricted-imports': channelImportsFor('profiles') },
  },
  {
    files: ['packages/channels/*/app.ts', 'packages/channels/*/app/**'],
    rules: {
      'no-restricted-imports': channelImportsFor('app'),
      'no-restricted-globals': ['error', {
        globals: ['fetch', 'WebSocket', 'process'].map((name) => ({ name, message: 'Channel server code uses PortContext capabilities (BD-A2-11).' })),
        checkGlobalObject: true,
      }],
    },
  },
  {
    files: ['packages/channels/*/portal/**'],
    rules: { 'no-restricted-imports': channelImportsFor('portal') },
  },
  {
    files: ['packages/channels/*/*.test.ts'],
    rules: { 'no-restricted-imports': channelImportsFor('rootTest') },
  },
  {
    files: ['packages/channels/*/app/**/*.test.ts'],
    rules: { 'no-restricted-imports': channelImportsFor('appTest') },
  },
  {
    files: ['packages/channels/*/portal/**/*.test.tsx'],
    rules: { 'no-restricted-imports': channelImportsFor('portalTest') },
  },
);
