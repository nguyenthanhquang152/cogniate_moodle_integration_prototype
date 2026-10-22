// K0 smoke suite (TEST-STRATEGY §2.7, TD-03). Runs with no Docker inside `npm run check`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

test('K0 smoke: root package.json workspaces exclude packages/channels/* (TD-03)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
    workspaces?: string[];
  };
  assert.ok(Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0, 'root package.json declares workspaces');
  for (const entry of pkg.workspaces) {
    assert.ok(!entry.startsWith('packages/channels'), `channel folder must not be a workspace: ${entry}`);
  }
});

test('K0 smoke: recorded G-BASE fixtures for LD-1 are present and have 0 secret hits', () => {
  const gbaseDir = path.join(here, 'ld1', 'g-base');
  for (const name of ['acceptance.json', 'default.json', 'cards.json']) {
    const raw = fs.readFileSync(path.join(gbaseDir, name), 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    assert.ok(parsed && typeof parsed === 'object', `${name} is a JSON object`);
    assert.ok(!/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(raw), `${name} has no JWT`);
  }
});
