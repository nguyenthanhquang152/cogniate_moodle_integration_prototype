// LA-E5-23 K0 and UNIT verification suite (host-only, no Docker).
// Written by QA-2 from:
// - docs/architecture/ltiaas/tasks/LA-E5-23.md (AC-LA-E5-23-01..03)
// - docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md (D4 T0-T2, D13 items 1-4)
// - docs/architecture/ltiaas/build-decisions-A2.md (§48 BD-A2-96)
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { f5Text, hasScript } from '../../tasks-core/LA-E1-04/fitness';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, '../../../..');
const ROOT = process.env.LA_SCRATCH_CLONE ? path.resolve(process.env.LA_SCRATCH_CLONE) : DEFAULT_ROOT;
const LTI_SRC = path.join(ROOT, 'services', 'lti-service', 'src');

function writeArtifact(name: string, content: string): void {
  const dir = process.env.LA_RUN_DIR?.trim();
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, name), content, { mode: 0o600 });
}

function clearVitestCache(cwd: string): void {
  fs.rmSync(path.join(cwd, 'node_modules', '.vitest-cache'), { recursive: true, force: true });
  fs.rmSync(path.join(cwd, 'node_modules', '.vite'), { recursive: true, force: true });
}

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out.sort();
}

const SQL_LITERAL_RE =
  /\b(?:SELECT\s+[\s\S]+?\s+FROM|INSERT\s+(?:OR\s+\w+\s+)?INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|BEGIN\s+IMMEDIATE|SAVEPOINT\s+\w+|ROLLBACK\s+TO)\b/i;

/**
 * QA-2 independent AST boundary scan of a non-store, non-db production TypeScript file in services/lti-service/src/**.
 * Checks AC-LA-E5-23-01 and BD-A2-96:
 * 1. No import or reference to node:sqlite or DatabaseSync.
 * 2. No call to database handle methods/helpers: prepare, exec (excluding RegExp.exec), transaction, afterCommit.
 * 3. No value import of synchronous Db-first-parameter store functions from store/**.
 * 4. No raw SQL statement literals outside store/** and db/**.
 */
function scanProductionFileForBoundaryViolations(
  relPath: string,
  code: string,
  syncStoreExports: ReadonlySet<string>,
): string[] {
  const sf = ts.createSourceFile(relPath, code, ts.ScriptTarget.Latest, true);
  const violations: string[] = [];
  const fnAliases = new Set(['transaction', 'afterCommit']);
  const regexVars = new Set<string>();

  const isRegexExpr = (node: ts.Node): boolean =>
    ts.isRegularExpressionLiteral(node) ||
    (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'RegExp');

  const collectBindings = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (spec === 'node:sqlite' || spec === 'sqlite') {
        violations.push(`${relPath}: import from ${spec}`);
      }
      const clause = node.importClause;
      if (clause && !clause.isTypeOnly && clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const el of clause.namedBindings.elements) {
          const importedName = (el.propertyName ?? el.name).text;
          const localName = el.name.text;
          if (importedName === 'DatabaseSync') {
            violations.push(`${relPath}: import DatabaseSync`);
          }
          if (!el.isTypeOnly && (importedName === 'transaction' || importedName === 'afterCommit')) {
            fnAliases.add(localName);
            violations.push(`${relPath}: import ${importedName}`);
          }
          if (!el.isTypeOnly && spec.includes('/store/') && syncStoreExports.has(importedName)) {
            violations.push(`${relPath}: sync store import ${importedName}`);
          }
        }
      }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && isRegexExpr(node.initializer)) {
      regexVars.add(node.name.text);
    }
    ts.forEachChild(node, collectBindings);
  };
  collectBindings(sf);

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee) && fnAliases.has(callee.text)) {
        violations.push(`${relPath}: call ${callee.text}()`);
      } else if (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) {
        const member = ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : ts.isStringLiteralLike(callee.argumentExpression)
            ? callee.argumentExpression.text
            : '';
        const recv = callee.expression;
        if (member === 'prepare' || member === 'transaction' || member === 'afterCommit') {
          violations.push(`${relPath}: member call .${member}()`);
        } else if (
          member === 'exec' &&
          !isRegexExpr(recv) &&
          !(ts.isIdentifier(recv) && regexVars.has(recv.text))
        ) {
          violations.push(`${relPath}: member call .exec()`);
        }
      }
    }
    if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (SQL_LITERAL_RE.test(node.text)) {
        violations.push(`${relPath}: SQL literal "${node.text.slice(0, 40)}..."`);
      }
    }
    if (ts.isTemplateExpression(node)) {
      const joined = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' ? ');
      if (SQL_LITERAL_RE.test(joined)) {
        violations.push(`${relPath}: SQL template "${joined.slice(0, 40)}..."`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  return violations;
}

describe('LA-E5-23 Async store port in the LTI service (K0 + UNIT host verification, no Docker)', () => {
  it('AC-LA-E5-23-01 (BD-A2-96, LA-ADR-06 D13 item 3): no production file outside store/** and db/** calls the database handle (prepare, exec, transaction, afterCommit) or holds raw SQL, and a planted call is detected', () => {
    const allFiles = walkTsFiles(LTI_SRC);
    const nonTestFiles = allFiles.filter((f) => !f.endsWith('.test.ts'));

    // Collect synchronous Db-first-parameter functions declared in store/**
    const syncStoreExports = new Set<string>();
    for (const full of nonTestFiles) {
      const rel = path.relative(LTI_SRC, full).replace(/\\/g, '/');
      if (!rel.startsWith('store/')) continue;
      const sf = ts.createSourceFile(rel, fs.readFileSync(full, 'utf8'), ts.ScriptTarget.Latest, true);
      for (const stmt of sf.statements) {
        if (ts.isFunctionDeclaration(stmt) && stmt.name && stmt.parameters[0]?.type?.getText(sf) === 'Db') {
          syncStoreExports.add(stmt.name.text);
        }
      }
    }
    expect(syncStoreExports.size).toBeGreaterThan(0);

    // Scan all production files outside store/** and db/** (excluding *.test.ts and testkit*.ts)
    const runtimeOutsideStore = nonTestFiles.filter((full) => {
      const rel = path.relative(LTI_SRC, full).replace(/\\/g, '/');
      return !rel.startsWith('store/') && !rel.startsWith('db/') && !/(^|\/)testkit[^/]*\.ts$/.test(rel);
    });
    expect(runtimeOutsideStore.length).toBeGreaterThan(15);

    const violations: string[] = [];
    for (const full of runtimeOutsideStore) {
      const rel = path.relative(LTI_SRC, full).replace(/\\/g, '/');
      const code = fs.readFileSync(full, 'utf8');
      violations.push(...scanProductionFileForBoundaryViolations(rel, code, syncStoreExports));
    }
    expect(violations, `Production files outside store/** and db/** must have 0 boundary hits`).toEqual([]);

    // Negative controls on QA-2's scanner: verify planted calls (prepare, exec, transaction, afterCommit, DatabaseSync, sync store import, raw SQL) are all caught
    const plantedSamples: Array<[string, string, RegExp]> = [
      ['http/planted-prepare.ts', 'export const f = (db: any) => db.prepare("SELECT 1").get();', /member call \.prepare\(\)/],
      ['http/planted-exec.ts', 'export const f = (db: any) => db["exec"]("BEGIN");', /member call \.exec\(\)/],
      ['http/planted-tx.ts', 'import { transaction as tx } from "@cogniate/shared";\nexport const f = (db: any) => tx(db, () => 1);', /call tx\(\)/],
      ['http/planted-after-commit.ts', 'import { afterCommit } from "@cogniate/shared";\nexport const f = (db: any) => afterCommit(db, () => {});', /call afterCommit\(\)/],
      ['http/planted-sqlite.ts', 'import { DatabaseSync } from "node:sqlite";\nexport type X = DatabaseSync;', /import from node:sqlite/],
      ['http/planted-sql.ts', 'export const q = "DELETE FROM audit_event WHERE ts < ?";', /SQL literal/],
    ];
    for (const [samplePath, sampleCode, expectedMatch] of plantedSamples) {
      const sampleHits = scanProductionFileForBoundaryViolations(samplePath, sampleCode, syncStoreExports);
      expect(sampleHits.some((h) => expectedMatch.test(h)), `${samplePath} must match ${expectedMatch}; got ${JSON.stringify(sampleHits)}`).toBe(true);
    }

    // Positive control on QA-2's scanner: RegExp.exec and type-only store imports pass with 0 hits
    const allowedSample = `
      import type { getAccount } from '../store/accounts.ts';
      const re = new RegExp('^ltis_');
      export const ok = (s: string) => re.exec(s) || /^ltio_/.exec(s);
    `;
    expect(scanProductionFileForBoundaryViolations('http/allowed.ts', allowedSample, syncStoreExports)).toEqual([]);

    // Also run Author's store/port-boundary.test.ts on the clean tree, and with a real planted scratch file outside store/**
    clearVitestCache(ROOT);
    const cleanRun = spawnSync(
      'npx',
      ['--no-install', 'vitest', 'run', 'services/lti-service/src/store/port-boundary.test.ts'],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    );
    const cleanOut = `${cleanRun.stdout ?? ''}\n${cleanRun.stderr ?? ''}`;
    assert.equal(cleanRun.status, 0, `store/port-boundary.test.ts on clean tree must exit 0:\n${cleanOut}`);

    // Planted scratch file outside store/** (tasks README §2 form (k): removed in finally)
    const plantedPath = path.join(LTI_SRC, 'http', 'zz-qa2-e523-planted-probe.ts');
    let plantedOut = '';
    try {
      fs.writeFileSync(
        plantedPath,
        "export function plantedDbCall(db: { prepare: (sql: string) => unknown }): unknown {\n  return db.prepare('SELECT 1');\n}\n",
        'utf8',
      );
      clearVitestCache(ROOT);
      const plantedRun = spawnSync(
        'npx',
        ['--no-install', 'vitest', 'run', 'services/lti-service/src/store/port-boundary.test.ts'],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
      );
      plantedOut = `${plantedRun.stdout ?? ''}\n${plantedRun.stderr ?? ''}`;
      assert.notEqual(
        plantedRun.status,
        0,
        `store/port-boundary.test.ts must fail when a planted database call exists outside store/**:\n${plantedOut}`,
      );
      assert.match(
        plantedOut,
        /zz-qa2-e523-planted-probe\.ts:\s*prepare/,
        `store/port-boundary.test.ts failure must name the planted file and call:\n${plantedOut}`,
      );
    } finally {
      fs.rmSync(plantedPath, { force: true });
      clearVitestCache(ROOT);
    }

    writeArtifact(
      'la-e5-23-ac01-boundary.log',
      `# Scanned ${runtimeOutsideStore.length} production files outside store/** and db/** (0 violations)\n\n## Clean run of store/port-boundary.test.ts\n${cleanOut}\n\n## Planted-file run of store/port-boundary.test.ts\n${plantedOut}\n`,
    );
  });

  it('LA-ADR-06 D13 item 3 & D4 T0-T2 (BD-A2-96): atomic audited operations roll back both the data change, the audit_event row, and afterCommit callbacks when a failure occurs after the change', async () => {
    const dbMod = (await import(pathToFileURL(path.join(LTI_SRC, 'db', 'index.ts')).href)) as {
      openDb: (filename: string) => {
        prepare: (sql: string) => {
          run: (...args: unknown[]) => { changes: number | bigint };
          get: (...args: unknown[]) => Record<string, unknown> | undefined;
          all: (...args: unknown[]) => Array<Record<string, unknown>>;
        };
        exec: (sql: string) => void;
        close: () => void;
        readonly isTransaction: boolean;
      };
    };
    const storeMod = (await import(pathToFileURL(path.join(LTI_SRC, 'store', 'index.ts')).href)) as {
      createSqliteLtiStore: (db: unknown) => {
        accounts: {
          getAccount: (id: string) => Promise<Record<string, unknown> | null>;
          createAccount: (input: Record<string, unknown>, now: number) => Promise<Record<string, unknown>>;
        };
        audit: {
          request: <T>(
            now: () => number,
            base: Record<string, unknown>,
            fn: (ops: {
              createAccount: (
                input: Record<string, unknown>,
                preparedKey: unknown,
                now: number,
              ) => Record<string, unknown>;
              updateAccount: (
                id: string,
                patch: Record<string, unknown>,
                now: number,
              ) => { account: Record<string, unknown>; statusChanged: boolean };
            }) => Promise<T> | T,
          ) => Promise<T>;
          listAuditEvents: (filter: { toolAccountId?: string; limit?: number }) => Promise<{
            events: Array<Record<string, unknown>>;
          }>;
          observeAuditEvents: (fn: (action: string, result: 'ok' | 'refused') => void) => Promise<void>;
        };
      };
      storeFor: (source: unknown) => unknown;
    };
    const toolKeysMod = (await import(pathToFileURL(path.join(LTI_SRC, 'store', 'tool-keys.ts')).href)) as {
      prepareToolKey: (handle: Buffer, accountId: string) => Promise<{ kid: string }>;
    };
    const auditMod = (await import(pathToFileURL(path.join(LTI_SRC, 'store', 'audit.ts')).href)) as {
      withAudit: <T>(
        db: unknown,
        now: () => number,
        base: Record<string, unknown>,
        fn: (audit: {
          change: <R>(
            mutate: () => R,
            describe: (r: R) => { action?: string; target?: { type: string; id: string | null }; details?: Record<string, unknown> },
          ) => R;
        }) => Promise<T>,
      ) => Promise<T>;
    };
    const settingsMod = (await import(pathToFileURL(path.join(LTI_SRC, 'store', 'settings.ts')).href)) as {
      patchRateLimitSettings: (db: unknown, patch: Record<string, unknown>) => Record<string, unknown>;
      readRateLimitSettings: (db: unknown) => Record<string, unknown>;
    };
    const sharedMod = (await import(pathToFileURL(path.join(ROOT, 'packages', 'shared', 'src', 'index.ts')).href)) as {
      afterCommit: (db: unknown, fn: () => void) => void;
    };
    const apiErrorsMod = (await import(pathToFileURL(path.join(LTI_SRC, 'api-errors.ts')).href)) as {
      ApiError: new (code: string, reason?: string, details?: Record<string, unknown>) => Error;
    };

    const db = dbMod.openDb(':memory:');
    try {
      const store = storeMod.createSqliteLtiStore(db);
      expect(storeMod.storeFor(db)).toBe(storeMod.storeFor(db));
      expect(storeMod.storeFor(store)).toBe(store);

      const observed: Array<{ action: string; result: string; inTx: boolean }> = [];
      await store.audit.observeAuditEvents((action, result) => {
        observed.push({ action, result, inTx: db.isTransaction });
      });

      const accountInput = {
        id: 'qa2-atomic-acct',
        name: 'QA2 Atomic Account',
        launchUrl: 'https://qa2.test/launch',
        deepLinkingUrl: 'https://qa2.test/deep',
        registrationUrl: 'https://qa2.test/register',
      };
      const preparedKey = await toolKeysMod.prepareToolKey(Buffer.alloc(32, 0x42), accountInput.id);
      const base = {
        actor: { type: 'operator', id: 'qa2-op' },
        toolAccountId: accountInput.id,
        action: 'account.create',
        target: { type: 'account', id: accountInput.id },
        traceId: 'trace-qa2-e523-atomic',
        clientIp: '127.0.0.1',
      };

      // Case 1: Failure during audit_event insert after account + signing key writes rolls back everything
      db.exec(
        "CREATE TRIGGER qa2_fail_audit_insert BEFORE INSERT ON audit_event BEGIN SELECT RAISE(ABORT, 'qa2_simulated_audit_failure'); END",
      );
      await expect(
        store.audit.request(() => 1_700_000_000_000, base, async (ops) => {
          await Promise.resolve();
          return ops.createAccount(accountInput, preparedKey, 1_700_000_000_000);
        }),
      ).rejects.toThrow(/qa2_simulated_audit_failure/);

      // Neither the account row, nor the tool_key row, nor any audit_event row, nor any afterCommit observer survived
      await expect(store.accounts.getAccount(accountInput.id)).resolves.toBeNull();
      expect(db.prepare('SELECT kid FROM tool_key WHERE kid = ?').get(preparedKey.kid)).toBeUndefined();
      expect((await store.audit.listAuditEvents({ limit: 10 })).events).toEqual([]);
      expect(observed).toEqual([]);
      db.exec('DROP TRIGGER qa2_fail_audit_insert');

      // Case 2: Failure thrown inside withAudit / audit.change describe callback after a write rolls back the write and afterCommit
      const afterCommitSpy = vi.fn();
      await expect(
        auditMod.withAudit(db, () => 1_700_000_001_000, base, async (audit) => {
          return audit.change(
            () => {
              settingsMod.patchRateLimitSettings(db, {
                classes: { api: { ratePerMinute: 7, burst: 3 } },
                registrationSessionsPerAddress: 9,
              });
              sharedMod.afterCommit(db, afterCommitSpy);
              return 'written';
            },
            () => {
              throw new Error('qa2_describe_failed_after_write');
            },
          );
        }),
      ).rejects.toThrow(/qa2_describe_failed_after_write/);

      expect(settingsMod.readRateLimitSettings(db)).toEqual({});
      expect((await store.audit.listAuditEvents({ limit: 10 })).events).toEqual([]);
      expect(afterCommitSpy).not.toHaveBeenCalled();
      expect(observed).toEqual([]);

      // Case 3: Successful atomic audited operation commits the account, first signing key, and ok audit_event together, and fires afterCommit outside the transaction
      const created = await store.audit.request(() => 1_700_000_002_000, base, async (ops) => {
        await Promise.resolve();
        return ops.createAccount(accountInput, preparedKey, 1_700_000_002_000);
      });
      expect(created).toMatchObject({ id: accountInput.id, status: 'active' });
      await expect(store.accounts.getAccount(accountInput.id)).resolves.toMatchObject({ id: accountInput.id });
      expect(db.prepare('SELECT kid FROM tool_key WHERE kid = ?').get(preparedKey.kid)).toEqual({ kid: preparedKey.kid });
      expect(observed).toEqual([{ action: 'account.create', result: 'ok', inTx: false }]);

      // Case 4: BD-A2-29 dynamic action rule inside atomic store operation (status transition -> account.status vs same status -> account.update)
      const updateBase = {
        ...base,
        action: 'account.update',
        traceId: 'trace-qa2-e523-update',
      };
      await store.audit.request(() => 1_700_000_003_000, updateBase, (ops) =>
        ops.updateAccount(accountInput.id, { status: 'suspended' }, 1_700_000_003_000),
      );
      await store.audit.request(() => 1_700_000_004_000, updateBase, (ops) =>
        ops.updateAccount(accountInput.id, { status: 'suspended', name: 'Renamed While Suspended' }, 1_700_000_004_000),
      );
      expect(observed.slice(1)).toEqual([
        { action: 'account.status', result: 'ok', inTx: false },
        { action: 'account.update', result: 'ok', inTx: false },
      ]);

      // Case 5: 4xx refusal rolls back any partial work and records one refused audit_event with the error code
      await expect(
        store.audit.request(() => 1_700_000_005_000, updateBase, () => {
          throw new apiErrorsMod.ApiError('ACCOUNT_CLOSED');
        }),
      ).rejects.toThrow('ACCOUNT_CLOSED');
      expect(observed.at(-1)).toEqual({ action: 'account.update', result: 'refused', inTx: false });

      const allEvents = (await store.audit.listAuditEvents({ toolAccountId: accountInput.id, limit: 10 })).events;
      expect(allEvents.map((e) => `${e.action}:${e.result}:${e.code ?? ''}`)).toEqual([
        'account.update:refused:ACCOUNT_CLOSED',
        'account.update:ok:',
        'account.status:ok:',
        'account.create:ok:',
      ]);
    } finally {
      db.close();
    }
  });

  it('AC-LA-E5-23-02 & F5 rules (LA-ADR-06 D13 item 2 & 3, BD-A2-96): all 6 F5 rules pass with 0 hits, sql-portability rejects rowid/X""/date functions, and audit-event-delete allows only store/audit-retention.ts', async () => {
    assert.equal(hasScript('fitness:rules'), true, 'root package.json defines fitness:rules');

    const treeRun = spawnSync('npm', ['run', 'fitness:rules'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    const treeOut = `${treeRun.stdout ?? ''}\n${treeRun.stderr ?? ''}`;
    assert.equal(treeRun.status, 0, `npm run fitness:rules must exit 0:\n${treeOut}`);
    assert.match(
      treeOut,
      /F5 PASS: 6 rules \(audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability\), 0 hits/,
      `F5 summary must report 6 rules and 0 hits:\n${treeOut}`,
    );

    const log: string[] = [`## tree fitness:rules\n${treeOut.trim()}`];

    // AC-LA-E5-23-02: sql-portability fails for a probe statement with rowid (in store/** and in a new LA migration)
    for (const [probePath, probeCode] of [
      ['services/lti-service/src/store/accounts.ts', 'export const q = "SELECT rowid, id FROM tool_account ORDER BY rowid ASC";\n'],
      ['services/lti-service/src/db/migrations/099_qa2_probe.sql', 'SELECT rowid, id FROM tool_account;\n'],
      ['services/lti-service/src/store/tool-keys.ts', "export const q = \"UPDATE tool_key SET private_key_encrypted = X'' WHERE kid = ?\";\n"],
      ['services/lti-service/src/store/accounts.ts', "export const q = \"SELECT unixepoch('subsec') FROM tool_account\";\n"],
    ] as const) {
      const res = await f5Text(probePath, probeCode);
      log.push(`## sql-portability FAIL probe (${probePath})\n${probeCode}-> exit ${res.code}\n${res.output.trim()}`);
      assert.notEqual(res.code, 0, `sql-portability probe at ${probePath} must fail F5:\n${res.output}`);
      assert.match(res.output, /sql-portability/, `F5 failure at ${probePath} must name sql-portability:\n${res.output}`);
    }

    // Positive control for sql-portability: portable SQL in store/** passes
    const portablePass = await f5Text(
      'services/lti-service/src/store/accounts.ts',
      'export const q = "SELECT id, status FROM tool_account WHERE id = ? ORDER BY created_at DESC";\n',
    );
    log.push(`## sql-portability PASS control\n-> exit ${portablePass.code}\n${portablePass.output.trim()}`);
    assert.equal(portablePass.code, 0, `Portable SQL in store/accounts.ts must pass F5:\n${portablePass.output}`);

    // BD-A2-96: audit-event-delete allows services/lti-service/src/store/audit-retention.ts,
    // and rejects DELETE FROM audit_event in jobs/audit-retention.ts (old path) and store/audit.ts (insert & list only)
    const retentionAllowed = await f5Text(
      'services/lti-service/src/store/audit-retention.ts',
      'export const del = "DELETE FROM audit_event WHERE ts < ?";\n',
    );
    log.push(`## audit-event-delete PASS at store/audit-retention.ts\n-> exit ${retentionAllowed.code}\n${retentionAllowed.output.trim()}`);
    assert.equal(
      retentionAllowed.code,
      0,
      `DELETE FROM audit_event at services/lti-service/src/store/audit-retention.ts must pass F5:\n${retentionAllowed.output}`,
    );

    for (const forbiddenAuditPath of [
      'services/lti-service/src/jobs/audit-retention.ts',
      'services/lti-service/src/store/audit.ts',
      'services/lti-service/src/store/audited-operations.ts',
    ]) {
      const forbiddenRes = await f5Text(
        forbiddenAuditPath,
        'export const del = "DELETE FROM audit_event WHERE ts < ?";\n',
      );
      log.push(`## audit-event-delete FAIL at ${forbiddenAuditPath}\n-> exit ${forbiddenRes.code}\n${forbiddenRes.output.trim()}`);
      assert.notEqual(
        forbiddenRes.code,
        0,
        `DELETE FROM audit_event at ${forbiddenAuditPath} must fail F5:\n${forbiddenRes.output}`,
      );
      assert.match(forbiddenRes.output, /audit-event-delete/, `F5 output must name audit-event-delete:\n${forbiddenRes.output}`);
    }

    // Run the infra unit tests for sql-portability and audit-event-delete
    const infraRes = spawnSync(
      process.execPath,
      [
        '--test',
        path.join(ROOT, 'infra/scripts/fitness-sql-portability.test.mjs'),
        path.join(ROOT, 'infra/scripts/fitness-audit-event-delete.test.mjs'),
      ],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    );
    const infraOut = `${infraRes.stdout ?? ''}\n${infraRes.stderr ?? ''}`;
    log.push(`## infra F5 rule tests\n${infraOut.trim()}`);
    assert.equal(infraRes.status, 0, `infra F5 rule tests must exit 0:\n${infraOut}`);

    writeArtifact('la-e5-23-ac02-f5.log', `${log.join('\n\n')}\n`);
  });

  it('AC-LA-E5-23-03 (LA-ADR-06 D13 item 4): the store index lists the four in-memory states that LG must move', () => {
    const storeIndexPath = path.join(LTI_SRC, 'store', 'index.ts');
    assert.equal(fs.existsSync(storeIndexPath), true, 'services/lti-service/src/store/index.ts must exist');
    const text = fs.readFileSync(storeIndexPath, 'utf8');

    const requiredStates = [
      'score clock',
      'platform token cache',
      'platform JWKS cache',
      'rate-limit buckets',
    ];
    for (const state of requiredStates) {
      expect(text, `store/index.ts must list in-memory state "${state}" (LA-ADR-06 D13 item 4)`).toContain(state);
    }
    writeArtifact('la-e5-23-ac03-store-index.log', text);
  });

  it('Author unit suites for the LTI store port pass with a fresh Vitest cache', () => {
    clearVitestCache(ROOT);
    const storeTestFiles = walkTsFiles(path.join(LTI_SRC, 'store'))
      .filter((f) => f.endsWith('.test.ts'))
      .map((f) => path.relative(ROOT, f).replace(/\\/g, '/'));
    expect(storeTestFiles).toContain('services/lti-service/src/store/port-boundary.test.ts');
    expect(storeTestFiles).toContain('services/lti-service/src/store/port.test.ts');

    const res = spawnSync('npx', ['--no-install', 'vitest', 'run', '--reporter=verbose', ...storeTestFiles], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    const out = `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
    writeArtifact('la-e5-23-store-unit-tests.log', out);
    assert.equal(res.status, 0, `LTI store unit tests exited ${res.status}:\n${out}`);
  });
});
