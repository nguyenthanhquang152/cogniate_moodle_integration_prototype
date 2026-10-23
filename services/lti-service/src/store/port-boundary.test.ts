import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
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
  const aliases = new Set(['transaction']);
  const regexes = new Set<string>();
  const hits: string[] = [];
  const isRegex = (node: ts.Node): boolean => ts.isRegularExpressionLiteral(node)
    || (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'RegExp');
  const bindings = (node: ts.Node): void => {
    if (ts.isImportSpecifier(node) && (node.propertyName ?? node.name).text === 'transaction') aliases.add(node.name.text);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && isRegex(node.initializer)) regexes.add(node.name.text);
    ts.forEachChild(node, bindings);
  };
  bindings(tree);
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee) && aliases.has(callee.text)) hits.push('transaction');
      if (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) {
        const member = ts.isPropertyAccessExpression(callee) ? callee.name.text
          : ts.isStringLiteralLike(callee.argumentExpression) ? callee.argumentExpression.text : '';
        const receiver = callee.expression;
        if (['prepare', 'transaction'].includes(member)
          || (member === 'exec' && !isRegex(receiver) && !(ts.isIdentifier(receiver) && regexes.has(receiver.text)))) hits.push(member);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return hits;
}

/** Also refuse a direct import that bypasses the async port through a synchronous SQLite function. */
function sqliteImports(code: string, adapterFunctions: Set<string>): string[] {
  const hits: string[] = [];
  for (const node of source('probe.ts', code).statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)
      || !node.moduleSpecifier.text.includes('/store/') || node.importClause?.isTypeOnly) continue;
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const item of bindings.elements) {
        const name = (item.propertyName ?? item.name).text;
        if (!item.isTypeOnly && adapterFunctions.has(name)) hits.push(name);
      }
    }
  }
  return hits;
}

describe('LA-E5-23 store boundary', () => {
  it('AC-01: runtime code makes no direct database calls or synchronous SQLite imports', () => {
    const all = files(root).filter((path) => path.endsWith('.ts') && !path.endsWith('.test.ts'));
    const adapterFunctions = new Set<string>();
    for (const path of all.filter((path) => relative(root, path).startsWith('store/'))) {
      for (const node of source(path, readFileSync(path, 'utf8')).statements) {
        if (ts.isFunctionDeclaration(node) && node.name && node.parameters[0]?.type?.getText() === 'Db') adapterFunctions.add(node.name.text);
      }
    }
    const hits = all.filter((path) => !/^(store|db)\//.test(relative(root, path)) && !/\btestkit[^/]*\.ts$/.test(path)).flatMap((path) => {
      const text = readFileSync(path, 'utf8');
      return [...databaseCalls(text), ...sqliteImports(text, adapterFunctions)].map((hit) => `${relative(root, path)}: ${hit}`);
    });
    expect(hits).toEqual([]);
  });

  it('AC-01 negative control: finds member calls, computed access, and an imported transaction alias', () => {
    expect(databaseCalls(`
      import { transaction as atomic } from '../db/index.ts';
      connection.prepare('SELECT 1').get();
      connection['exec']('BEGIN');
      connection.transaction(() => 1);
      atomic(connection, () => 1);
    `)).toEqual(['prepare', 'exec', 'transaction', 'transaction']);
    expect(sqliteImports("import { getAccount as read } from '../store/accounts.ts';", new Set(['getAccount']))).toEqual(['getAccount']);
  });

  it('allows regex matching, type imports, and SQL text that is not executed', () => {
    expect(databaseCalls("const regex = new RegExp('a'); regex.exec('a'); /b/.exec('b'); const text = 'db.prepare(1)';")).toEqual([]);
    expect(sqliteImports("import type { getAccount } from '../store/accounts.ts';", new Set(['getAccount']))).toEqual([]);
  });

  it('AC-03: names the four process states that LG must move', () => {
    const index = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    for (const state of ['score clock', 'platform token cache', 'platform JWKS cache', 'rate-limit buckets']) expect(index).toContain(state);
  });
});
