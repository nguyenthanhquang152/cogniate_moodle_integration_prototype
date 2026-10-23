import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]);
const source = (name: string, code: string) => ts.createSourceFile(name, code, ts.ScriptTarget.Latest, true);

/** A database call must stay inside the adapter. RegExp.exec is unrelated to database access. */
function databaseCalls(code: string): string[] {
  const tree = source('probe.ts', code);
  const aliases = new Map([['transaction', 'transaction'], ['afterCommit', 'afterCommit']]);
  const regexes = new Set<string>();
  const hits: string[] = [];
  const isRegex = (node: ts.Node): boolean => ts.isRegularExpressionLiteral(node)
    || (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'RegExp');
  const bindings = (node: ts.Node): void => {
    if (ts.isImportSpecifier(node) && !node.isTypeOnly && !node.parent.parent.isTypeOnly) {
      const name = (node.propertyName ?? node.name).text;
      if (name === 'transaction' || name === 'afterCommit') aliases.set(node.name.text, name);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && isRegex(node.initializer)) regexes.add(node.name.text);
    ts.forEachChild(node, bindings);
  };
  bindings(tree);
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee) && aliases.has(callee.text)) hits.push(aliases.get(callee.text)!);
      if (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) {
        const member = ts.isPropertyAccessExpression(callee) ? callee.name.text
          : ts.isStringLiteralLike(callee.argumentExpression) ? callee.argumentExpression.text : '';
        const receiver = callee.expression;
        if (['prepare', 'transaction', 'afterCommit'].includes(member)
          || (member === 'exec' && !isRegex(receiver) && !(ts.isIdentifier(receiver) && regexes.has(receiver.text)))) hits.push(member);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return hits;
}

/** Also refuse a direct import that bypasses the async port through a synchronous SQLite function. */
function sqliteImports(path: string, code: string, adapterModules: Map<string, Set<string>>): string[] {
  const hits: string[] = [];
  for (const node of source('probe.ts', code).statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || node.importClause?.isTypeOnly) continue;
    const adapterFunctions = adapterModules.get(resolve(dirname(path), node.moduleSpecifier.text));
    if (!adapterFunctions?.size) continue;
    const bindings = node.importClause?.namedBindings;
    // A value namespace exposes every private SQL function, also through later aliases or destructuring.
    // Pure helpers remain available as named imports; the public store index has no Db-first functions.
    if (bindings && ts.isNamespaceImport(bindings)) hits.push(`${bindings.name.text}.*`);
    if (bindings && ts.isNamedImports(bindings)) {
      for (const item of bindings.elements) {
        const name = (item.propertyName ?? item.name).text;
        if (!item.isTypeOnly && adapterFunctions.has(name)) hits.push(name);
      }
    }
  }
  return hits;
}

/** One file walk and assertion for production and the planted-file controls. */
function enforceBoundary(scanRoot: string): void {
  const all = files(scanRoot).filter((path) => path.endsWith('.ts') && !path.endsWith('.test.ts'));
  const adapterModules = new Map<string, Set<string>>();
  for (const path of all.filter((path) => relative(scanRoot, path).startsWith('store/'))) {
    const functions = new Set<string>();
    for (const node of source(path, readFileSync(path, 'utf8')).statements) {
      if (ts.isFunctionDeclaration(node) && node.name && node.parameters[0]?.type?.getText() === 'Db') functions.add(node.name.text);
    }
    adapterModules.set(path, functions);
  }
  const hits = all.filter((path) => !/^(store|db)\//.test(relative(scanRoot, path)) && !/\btestkit[^/]*\.ts$/.test(path)).flatMap((path) => {
    const text = readFileSync(path, 'utf8');
    return [...databaseCalls(text), ...sqliteImports(path, text, adapterModules)].map((hit) => `${relative(scanRoot, path)}: ${hit}`);
  });
  if (hits.length) throw new Error(`LTI store boundary violations:\n${hits.join('\n')}`);
}

/** Scratch roots keep planted violations out of the real source tree and other parallel test workers. */
function withScratchFiles(entries: Record<string, string>, test: (scanRoot: string) => void): void {
  const scanRoot = mkdtempSync(join(tmpdir(), 'lti-store-boundary-'));
  try {
    const fixture = {
      'store/accounts.ts': 'export function getAccount(db: Db) { return null; } export function helper(value: string) { return value; }',
      'store/index.ts': 'export function storeFor(source: unknown) { return source; }',
      ...entries,
    };
    for (const [name, text] of Object.entries(fixture)) {
      const path = join(scanRoot, name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    }
    test(scanRoot);
  } finally { rmSync(scanRoot, { recursive: true, force: true }); }
}

describe('LA-E5-23 store boundary', () => {
  it('AC-01: runtime code makes no direct database calls or synchronous SQLite imports', () => {
    enforceBoundary(root);
  });

  it.each([
    ['prepare', "connection.prepare('SELECT 1').get();", 'prepare'],
    ['computed exec', "connection['exec']('BEGIN');", 'exec'],
    ['transaction member', 'connection.transaction(() => 1);', 'transaction'],
    ['transaction import alias', "import { transaction as atomic } from '../db/index.ts'; atomic(db, () => 1);", 'transaction'],
    ['afterCommit', "import { afterCommit } from '@cogniate/shared'; afterCommit(db, () => undefined);", 'afterCommit'],
    ['afterCommit import alias', "import { afterCommit as committed } from '@cogniate/shared'; committed(db, () => undefined);", 'afterCommit'],
    ['afterCommit member', "import * as shared from '@cogniate/shared'; shared.afterCommit(db, () => undefined);", 'afterCommit'],
    ['computed afterCommit', "import * as shared from '@cogniate/shared'; shared['afterCommit'](db, () => undefined);", 'afterCommit'],
    ['named SQLite import', "import { getAccount } from '../store/accounts.ts'; getAccount(db, 'unit');", 'getAccount'],
    ['aliased SQLite import', "import { getAccount as read } from '../store/accounts.ts'; read(db, 'unit');", 'getAccount'],
    ['namespace SQLite import', "import * as accounts from '../store/accounts.ts'; accounts.getAccount(db, 'unit');", 'accounts.*'],
  ])('AC-01 negative control: a planted %s outside the adapter fails the file scan', (_name, code, hit) => {
    withScratchFiles({ 'http/planted.ts': code }, (scanRoot) => {
      expect(() => enforceBoundary(scanRoot)).toThrow(`http/planted.ts: ${hit}`);
    });
  });

  it('allows regex matching, type imports, pure helpers, the public port, and SQL text that is not executed', () => {
    withScratchFiles({ 'http/allowed.ts': `
      import type * as accounts from '../store/accounts.ts';
      import type { getAccount } from '../store/accounts.ts';
      import { type getAccount as Read, helper } from '../store/accounts.ts';
      import * as store from '../store/index.ts';
      const regex = new RegExp('a'); regex.exec('a'); /b/.exec('b');
      const text = 'db.prepare(1); afterCommit(db, callback)';
      helper('unit'); store.storeFor(source);
    ` }, (scanRoot) => expect(() => enforceBoundary(scanRoot)).not.toThrow());
  });

  it.each(['store/allowed.ts', 'db/allowed.ts', 'http/probe.test.ts', 'testkit.ts', 'http/testkit-fixture.ts'])(
    'keeps %s outside the runtime boundary check', (path) => {
      withScratchFiles({ [path]: `
        import * as accounts from '../store/accounts.ts';
        import { afterCommit as committed } from '@cogniate/shared';
        accounts.getAccount(db, 'unit'); db.prepare('SELECT 1'); committed(db, () => undefined);
      ` }, (scanRoot) => expect(() => enforceBoundary(scanRoot)).not.toThrow());
    },
  );

  it('does not hide a production violation beside excluded test and testkit files', () => {
    withScratchFiles({
      'http/probe.test.ts': "db.prepare('SELECT 1');",
      'http/testkit-fixture.ts': 'afterCommit(db, () => undefined);',
      'http/planted.ts': 'afterCommit(db, () => undefined);',
    }, (scanRoot) => expect(() => enforceBoundary(scanRoot)).toThrow('http/planted.ts: afterCommit'));
  });

  it('AC-03: names the four process states that LG must move', () => {
    const index = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    for (const state of ['score clock', 'platform token cache', 'platform JWKS cache', 'rate-limit buckets']) expect(index).toContain(state);
  });
});
