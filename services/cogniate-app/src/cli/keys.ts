// npm run app:keys -w services/cogniate-app -- status [--operator <name>]
// npm run app:keys -w services/cogniate-app -- rewrap [--operator <name>]
// LA-E5-22 (LA-ADR-06 D6, operability §6.3 last line; A2 BD-A2-91): the app key ring. `status` prints the active
// version and the sealed values of each version; `rewrap` re-seals the long-lived values (web-services token, ref
// copy, service keys) with the active version and writes one audit event `key_provider.rewrap`. Operator only: it runs
// in the app service shell. The operator policy runs without evidence (BD-A2-63): production needs a listed --operator.
import { parseArgs } from 'node:util';
import type { LocalKeyProvider, Logger } from '@cogniate/shared';
import { insertAuditEvent } from '../app/audit.ts';
import type { CommandResult } from '../app/operator.ts';
import { evaluateOperatorPolicy } from '../app/operator-policy.ts';
import { appSealedVersionCounts, rewrapAppBlobs } from '../app/sealing.ts';
import type { Db } from '../domain/db.ts';

const USAGE = 'Usage: app:keys status [--operator O] | rewrap [--operator O]';

export interface KeysDeps {
  db: Db;
  keys: LocalKeyProvider;
  logger: Pick<Logger, 'warn'>;
  now(): number;
  env?: NodeJS.ProcessEnv;
}

/** The active version, then each ring version and each version in use that the ring does not have. */
function statusLines(deps: KeysDeps): string[] {
  const counts = appSealedVersionCounts(deps.db);
  const ring = deps.keys.versions();
  const lines = [`Key provider: ${deps.keys.kind}`, `Active version: ${deps.keys.activeVersion()}`];
  for (const v of ring) lines.push(`Version ${v.id} (${v.state}): ${counts.get(v.id) ?? 0} sealed values`);
  for (const [id, n] of [...counts].filter(([id]) => !ring.some((v) => v.id === id)).sort()) {
    lines.push(`Version ${id} (not in the key ring): ${n} sealed values`);
  }
  return lines;
}

export function runKeysCommand(deps: KeysDeps, argv: string[], traceId: string): CommandResult {
  let command: string | undefined;
  let operator: string | undefined;
  try {
    const parsed = parseArgs({ args: argv, allowPositionals: true, options: { operator: { type: 'string' } } });
    [command] = parsed.positionals;
    operator = parsed.values.operator;
    if (parsed.positionals.length !== 1) command = undefined;
  } catch {
    command = undefined;
  }
  if (command !== 'status' && command !== 'rewrap') return { exitCode: 1, lines: [USAGE] };
  const policy = evaluateOperatorPolicy({ operator, evidenceRequired: false }, deps.env ?? process.env);
  if (!policy.allowed) {
    let line: { event?: unknown; reason?: unknown } = {};
    try { line = JSON.parse(policy.message) as typeof line; } catch { /* the line is printed as it is */ }
    deps.logger.warn(typeof line.event === 'string' ? line.event : 'operator_refused', { trace_id: traceId, reason: typeof line.reason === 'string' ? line.reason : null });
    return { exitCode: 1, lines: [policy.message] };
  }
  if (command === 'status') return { exitCode: 0, lines: statusLines(deps) };

  const r = rewrapAppBlobs(deps.db, deps.keys);
  // LA-ADR-06 D6: `failed` when a row did not open (its version is missing from the ring); a compare-and-set skip alone
  // does not change the outcome (run again).
  const outcome = r.unreadable > 0 ? 'failed' : 'complete';
  insertAuditEvent(deps.db, {
    actor: policy.actor, libraryId: null, connectionId: null, traceId, clientIp: null,
    action: 'key_provider.rewrap', target: { type: 'key_provider', id: null }, result: 'ok',
    details: { ...policy.details, outcome, activeVersion: deps.keys.activeVersion(), examined: r.examined, rewrapped: r.rewrapped, skippedChanged: r.skippedChanged,
      unreadable: r.unreadable, ...(r.unreadableVersions.length > 0 ? { unreadableVersions: r.unreadableVersions } : {}) },
  }, deps.now());
  const lines = [`Re-wrap: ${outcome}. Examined ${r.examined}, re-wrapped ${r.rewrapped}, skipped because changed ${r.skippedChanged}, unreadable ${r.unreadable}.`];
  if (r.unreadable > 0) lines.push(`Unreadable versions: ${r.unreadableVersions.join(', ')}. Put each version back into the app key ring, restart the app, and run app:keys rewrap again.`);
  if (r.skippedChanged > 0) lines.push('Some values changed during the run. Run app:keys rewrap again.');
  lines.push('Picker sessions keep their old form until they expire.', `Trace id: ${traceId}`, ...statusLines(deps));
  return { exitCode: outcome === 'complete' ? 0 : 1, lines };
}

if (import.meta.main) {
  const { operatorRuntime, finish } = await import('./operator-runtime.ts');
  const { db, keys, logger, traceId } = await operatorRuntime();
  finish(runKeysCommand({ db, keys, logger, now: Date.now }, process.argv.slice(2), traceId), () => db.close());
}
