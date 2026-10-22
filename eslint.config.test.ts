// Author tests for the actual flat config: local path checks, D1 rows and their shared base fence.
import { ESLint } from 'eslint';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as shared from '@cogniate/shared';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('.', import.meta.url));
const channel = 'packages/channels/zz-probe/';
const core = 'services/cogniate-app/src/probe.ts';
const eslint = new ESLint({ cwd: root, overrideConfig: { rules: {
  // The snippets exercise imports, not the use of their local bindings.
  '@typescript-eslint/no-unused-vars': 'off',
  '@typescript-eslint/consistent-type-imports': 'off',
  'no-undef': 'off',
} } });

async function lint(file: string, code: string) {
  const results = await eslint.lintText(code, { filePath: resolve(root, file) });
  expect(results).toHaveLength(1);
  const messages = results[0]!.messages;
  expect(messages.filter((m) => m.fatal)).toEqual([]);
  return messages;
}

const allowed: [string, string][] = [
  ['manifest.ts', "import type { ChannelManifest } from '@cogniate/channel-kernel';"],
  ['manifest.ts', "import { type ChannelManifest } from '@cogniate/channel-kernel';"],
  ['manifest.ts', "export type { ChannelManifest } from '@cogniate/channel-kernel';"],
  ['lti-profiles.ts', "import manifest from './manifest.ts';"],
  ['lti-profiles.ts', "import type { ChannelManifest } from '@cogniate/channel-kernel';"],
  ['app.ts', "import manifest from './manifest.ts'; import adapter from './app/setup.ts';"],
  ['app.ts', "import type { PortContext } from '../../../services/cogniate-app/src/kernel/ports.ts';"],
  ['app.ts', "import type { Logger } from '@cogniate/shared';"],
  ['app.ts', "import { type Logger } from '@cogniate/shared';"],
  ['app.ts', "import * as pure from '@cogniate/shared/channel';"],
  ['app/nested/setup.ts', "import x from '../x.ts'; import manifest from '../../manifest.ts';"],
  ['app/nested/setup.ts', "import type { PortContext } from '../../../../../services/cogniate-app/src/kernel/ports.ts';"],
  ['app/setup.ts', "export * from '@cogniate/shared/channel';"],
  ['app/setup.test.ts', "import { expect } from 'vitest'; import x from './setup.ts';"],
  ['portal/index.tsx', "import React from 'react'; import { jsx } from 'react/jsx-runtime'; import manifest from '../manifest.ts';"],
  ['portal/index.tsx', "import x from '@cogniate/portal-sdk'; import y from './nested/view.tsx';"],
  ['portal/nested/view.tsx', "import x from '../../../../../apps/portal/src/sdk/index.ts';"],
  ['portal/view.test.tsx', "import { render } from '@testing-library/react'; import { expect } from 'vitest'; import x from './index.tsx';"],
  ['probe.test.ts', "import { expect } from 'vitest'; import type { ChannelManifest } from '@cogniate/channel-kernel'; import app from './app.ts';"],
  ['probe.test.ts', "import x from './lti-profiles.ts'; import y from './portal/index.tsx'; import z from './app/setup.test.ts';"],
  ['probe.test.ts', "import assert from 'node:assert/strict'; import { test } from 'node:test';"],
  ['README.md', '# Channel facts\nThis is Markdown, not JavaScript.'],
  ['portal/style.css', '.example { color: red; }'],
];

it.each(allowed)('allows D1 row %s: %s', async (file, code) => {
  expect(await lint(channel + file, code)).toEqual([]);
});

it.each(['helpers.ts', 'other/index.ts', 'package.json', 'helper', 'probe.test.tsx', 'app/probe.test.tsx', 'portal/probe.test.ts'])('refuses unknown file kind %s before parsing it', async (file) => {
  expect(await lint(channel + file, 'not JavaScript!')).toEqual([
    expect.objectContaining({ ruleId: 'channels/local-boundary', messageId: 'kind', message: expect.stringContaining('not a D1 channel file kind') }),
  ]);
});

const denied: [string, string][] = [
  ['manifest.ts', "import { buildChannelRegistry } from '@cogniate/channel-kernel';"],
  ['manifest.ts', "import type { X } from '@cogniate/channel-kernel/src/index.ts';"],
  ['manifest.ts', "import x from './app/x.ts';"],
  ['lti-profiles.ts', "import x from './app.ts';"],
  ['lti-profiles.ts', "import x from './app/x.ts';"],
  ['app.ts', "import x from './lti-profiles.ts';"],
  ['app.ts', "import x from './portal/index.tsx';"],
  ['app.ts', "import x from './helpers.ts';"],
  ['app.ts', "import x from './README.md';"],
  ['app.ts', "import type { X } from '@cogniate/shared/jobs.testkit';"],
  ['app.ts', "import { PortContext } from '../../../services/cogniate-app/src/kernel/ports.ts';"],
  ['app.ts', "import type { X } from '../../../services/cogniate-app/src/domain/db.ts';"],
  ['app.ts', "import type { X } from '../../../apps/portal/src/sdk/index.ts';"],
  ['app/setup.ts', "import x from '../portal/index.tsx';"],
  ['app/setup.ts', "import x from '../../zz-other/app/setup.ts';"],
  ['app/setup.ts', "import x from '../../../../services/cogniate-app/src/domain/db.ts';"],
  ['app/setup.ts', "import x from '../../../../packages/shared/src/index.ts';"],
  ['app/setup.ts', "import x from './setup.test.ts';"],
  ['app/setup.ts', "export * from './setup.test.ts';"],
  ['app/setup.ts', "export { x } from './setup.test.ts';"],
  ['app/setup.ts', "import x from 'node:fs';"],
  ['portal/index.tsx', "import x from '../app.ts';"],
  ['portal/index.tsx', "import x from '../../../../apps/portal/src/api.ts';"],
  ['portal/index.tsx', "import x from '../../../../apps/portal/src/sdk/../api.ts';"],
  ['portal/index.tsx', "import x from '../../../../apps/portal/src/sdk-other/index.ts';"],
  ['portal/index.tsx', "import x from './view.test.tsx';"],
  ['portal/view.test.tsx', "import x from '../app.ts';"],
  ['probe.test.ts', "import x from '../zz-other/manifest.ts';"],
  ['probe.test.ts', "import x from '../../../services/cogniate-app/src/kernel/ports.ts';"],
  ['probe.test.ts', "import x from '../../../apps/portal/src/sdk/index.ts';"],
  ['probe.test.ts', "import x from '@cogniate/shared/channel';"],
];
it.each(denied)('refuses disallowed import for %s: %s', async (file, code) => {
  expect((await lint(channel + file, code)).some((m) => ['channels/local-boundary', 'no-restricted-imports'].includes(m.ruleId ?? ''))).toBe(true);
});

describe.each(['app.ts', 'app/setup.ts', 'app/setup.test.ts'])('shared capability fence in %s', (file) => {
  // Every value in the root barrel is refused, including future exports and all key-provider values.
  it.each(Object.keys(shared))('refuses root value %s', async (name) => {
    expect(await lint(channel + file, `import { ${name} } from '@cogniate/shared';`)).toContainEqual(
      expect.objectContaining({ ruleId: 'no-restricted-imports' }),
    );
  });
  it.each(["import * as shared from '@cogniate/shared';", "export * from '@cogniate/shared';"])('refuses a root namespace: %s', async (code) => {
    expect(await lint(channel + file, code)).toContainEqual(expect.objectContaining({ ruleId: 'no-restricted-imports' }));
  });
  it.each(['fetch', 'WebSocket', 'process', 'globalThis.fetch', 'globalThis.WebSocket', 'globalThis.process'])('refuses global capability %s', async (name) => {
    expect(await lint(channel + file, `${name};`)).toContainEqual(expect.objectContaining({ ruleId: 'no-restricted-globals' }));
  });
});

const rows = ['manifest.ts', 'lti-profiles.ts', 'app.ts', 'app/setup.ts', 'portal/index.tsx', 'probe.test.ts', 'app/setup.test.ts', 'portal/view.test.tsx'];
describe.each(rows)('base fence in %s', (file) => {
  it.each(['cogniate-app', 'lti-service', 'portal', 'player'].flatMap((name) => [`@cogniate/${name}`, `@cogniate/${name}/src/index.ts`]))('refuses product package %s even for types', async (name) => {
    expect(await lint(channel + file, `import type { X } from '${name}';`)).toContainEqual(expect.objectContaining({ ruleId: 'no-restricted-imports' }));
  });
  it.each([
    "import('@cogniate/shared');", "import('./manifest.ts');", 'import(`./manifest.ts`);', 'import(name);', 'import(`./${name}.ts`);',
    "require('@cogniate/shared');", 'require(name);', "import x = require('@cogniate/shared');",
    "import { createRequire as loader } from 'node:module';", 'createRequire(import.meta.url);',
    'module.createRequire(import.meta.url);', "module['createRequire'](import.meta.url);",
  ])('refuses runtime loading: %s', async (code) => {
    expect(await lint(channel + file, code)).toContainEqual(expect.objectContaining({ ruleId: 'channels/local-boundary', messageId: 'dynamic' }));
  });
  it('keeps the QA import fence', async () => {
    expect(await lint(channel + file, "import x from '../../../../tests/fixtures.ts';")).toContainEqual(expect.objectContaining({ ruleId: 'no-restricted-imports' }));
  });
});

it.each([
  ['manifest.ts', '@cogniate/channel-kernel'], ['lti-profiles.ts', './manifest.ts'],
  ['app.ts', '@cogniate/shared'], ['app.ts', '@cogniate/shared/channel'],
  ['app.ts', '../../../services/cogniate-app/src/kernel/ports.ts'], ['app/setup.ts', '../manifest.ts'],
  ['app/setup.test.ts', 'vitest'], ['probe.test.ts', './app.ts'],
  ['portal/index.tsx', '@cogniate/portal-sdk'], ['portal/view.test.tsx', '@testing-library/react'],
])('allows a type-position import for %s from %s', async (file, source) => {
  expect(await lint(channel + file, `type X = import('${source}').T;`)).toEqual([]);
});
it.each([
  ['manifest.ts', '@cogniate/shared'], ['lti-profiles.ts', '@cogniate/shared/channel'],
  ['app.ts', '@cogniate/shared/jobs.testkit'], ['app.ts', '@cogniate/cogniate-app'],
  ['app/setup.ts', '../portal/index.tsx'], ['app/setup.test.ts', 'node:fs'],
  ['probe.test.ts', '@cogniate/shared'], ['portal/index.tsx', '@cogniate/shared/channel'],
  ['portal/view.test.tsx', '../../../../services/cogniate-app/src/domain/db.ts'],
])('refuses a type-position import for %s from %s', async (file, source) => {
  expect(await lint(channel + file, `type X = import('${source}').T;`)).toContainEqual(expect.objectContaining({ ruleId: 'channels/local-boundary' }));
});

describe('core paths, including template strings without expressions', () => {
  const path = '../../../packages/channels/zz-probe/manifest.ts';
  it.each([
    `import x from '${path}';`, `export { x } from '${path}';`, `export * from '${path}';`,
    `type X = import('${path}').T;`, `import('${path}');`, 'import(`' + path + '`);',
    `require('${path}');`, 'require(`' + path + '`);', `import x = require('${path}');`,
    "import('packages/channels/zz-probe/manifest.ts');",
    `import(${JSON.stringify(resolve(root, 'packages/channels/zz-probe/manifest.ts'))});`,
  ])('refuses %s', async (code) => {
    expect(await lint(core, code)).toContainEqual(expect.objectContaining({ ruleId: 'channels/local-boundary', messageId: 'core' }));
  });
  it.each(["import('node:fs');", 'import(`node:fs`);', 'import(name);', 'import(`./${name}.ts`);', "import x from './config.ts';", 'export const x = 1;'])('allows core imports that do not name channels: %s', async (code) => {
    expect(await lint(core, code)).toEqual([]);
  });
  it('does not confuse a sibling path with the channel folder', async () => {
    expect(await lint(core, "import('../../../packages/channels-other/index.ts');")).toEqual([]);
  });
});
