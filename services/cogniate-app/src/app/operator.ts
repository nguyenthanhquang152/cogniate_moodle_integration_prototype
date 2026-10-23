// Operator commands (app contract §4.8, §4.9): `app:grant issue|revoke|list` and `app:binding suspend|release`. They run
// in the app service shell (not reachable over HTTP). Each command returns its exit code and output lines, so the
// CLI wrappers in cli/ only parse arguments and print. The LTI side of revoke, suspend and release is the common
// cleanup engine (binding-cleanup.ts), with the same write-ahead refs as a redemption.
import { canonicalOrigin, randomToken, sha256Hex } from '@cogniate/shared';
import type { Logger } from '@cogniate/shared';
import type { LtiClient } from '../clients/lti-client.ts';
import type { GrantPurpose } from '../domain/bindings.ts';
import { getGrant, grantsOfConnection, insertGrant, leaseLive, reservationOfConnection, revokeGrant, revokeOpenGrants } from '../domain/bindings.ts';
import type { Connection } from '../domain/connections.ts';
import { completeSnapshot, disableConnection, getConnectionAnyLibrary } from '../domain/connections.ts';
import type { Db } from '../domain/db.ts';
import { transaction } from '../domain/db.ts';
import { getLibrary } from '../domain/libraries.ts';
import { PRINTABLE_ID } from '../providers/index.ts';
import type { BindingCleanup, CleanupLine } from './binding-cleanup.ts';
import { canvasIssuerMatches, providerProfiles, sharedReadiness } from './binding-targets.ts';

export interface OperatorDeps {
  db: Db;
  lti: LtiClient;
  logger: Logger;
  cleanup: BindingCleanup;
  now: () => number;
}

export interface CommandResult {
  exitCode: 0 | 1;
  lines: string[];
}

const fail = (line: string): CommandResult => ({ exitCode: 1, lines: [line] });
const iso = (ms: number) => new Date(ms).toISOString();
const lineOf = (l: CleanupLine) => `${l.result} platform=${l.platformId ?? '-'} deployment=${l.deploymentId ?? '-'}`;

export interface IssueInput {
  library: string;
  connection: string;
  site: string;
  serviceUrl?: string;
  clientId: string;
  deploymentId: string;
  purpose?: GrantPurpose;
  ttlSeconds?: number;
  note: string;
  traceId: string;
}

const GRANT_STATE = (g: { redeemedAt: number | null; revokedAt: number | null; expiresAt: number }, redeeming: boolean, now: number) =>
  g.redeemedAt !== null ? 'redeemed' : g.revokedAt !== null ? 'revoked' : redeeming ? 'redeeming' : now >= g.expiresAt ? 'expired' : 'issued';

export function createOperator(deps: OperatorDeps) {
  const { db, lti, logger: log, cleanup, now } = deps;

  /** `app:grant issue` (§4.8): every check before anything is stored; one approval code, shown once. */
  async function issue(input: IssueInput): Promise<CommandResult> {
    const purpose = input.purpose ?? 'initial';
    const ttl = input.ttlSeconds ?? 86400;
    if (!Number.isInteger(ttl) || ttl < 60 || ttl > 604800) return fail('--ttl-seconds must be 60 to 604800.');
    if (input.note.length < 1 || input.note.length > 500) return fail('--note must be 1 to 500 characters (the evidence reference).');
    if (!PRINTABLE_ID.test(input.clientId) || !PRINTABLE_ID.test(input.deploymentId)) return fail('--client-id and --deployment-id must be 1 to 255 printable ASCII characters without spaces.');
    const c = getConnectionAnyLibrary(db, input.connection);
    if (!c) return fail(`Unknown connection: ${input.connection}.`);
    if (c.libraryId !== input.library) return fail('--library is not the library of this connection.');
    const library = getLibrary(db, c.libraryId)!;
    if (c.lms !== 'canvas' && c.lms !== 'blackboard') return fail('Approval grants are only for Canvas and Blackboard connections.');
    if (purpose === 'initial' && c.status !== 'pending') return fail('An initial grant needs a pending connection.');
    if (purpose === 'add_deployment' && !(c.lms === 'canvas' && (c.status === 'registered' || c.status === 'connected'))) {
      return fail('An add_deployment grant needs a registered or connected Canvas connection.');
    }
    const site = canonicalOrigin(input.site);
    if (!site.ok || site.origin !== c.siteUrl) return fail('--site is not the site URL of this connection.');
    const service = input.serviceUrl === undefined ? site : canonicalOrigin(input.serviceUrl);
    if (c.lms !== 'canvas' && input.serviceUrl !== undefined && (!service.ok || service.origin !== c.siteUrl)) return fail('--service-url is only for Canvas connections.');
    if (!service.ok || service.origin !== c.serviceUrl) return fail('--service-url is not the service URL of this connection.');
    if (purpose === 'add_deployment' && input.clientId !== c.platform?.clientId) return fail('--client-id is not the client id of this connection platform.');
    if (purpose === 'initial') {
      const snapshot = completeSnapshot(c);
      if (!snapshot) return fail('This connection has no provider snapshot. Make a new connection.');
      let row;
      try {
        row = (await providerProfiles(lti, input.traceId)).find((p) => p.id === c.profile);
      } catch {
        return fail('The LTI service did not answer. Nothing was stored.');
      }
      if (c.lms === 'canvas' && !canvasIssuerMatches(row, c, snapshot)) {
        return fail('The Canvas profile changed after this connection was made. Make a new connection.');
      }
      if (c.lms === 'blackboard') {
        const cause = sharedReadiness(row, snapshot);
        if (cause === 'platform_inactive') return fail('The Blackboard shared platform is not active.');
        if (cause) return fail('The Blackboard shared platform changed after this connection was made. Make a new connection.');
        if (input.clientId !== snapshot.clientId) return fail('--client-id is not the Blackboard Application ID of the shared platform.');
        const reserved = reservationOfConnection(db, c.id);
        if (reserved && reserved.deploymentId !== input.deploymentId) return fail(`This connection holds a reservation for deployment ${reserved.deploymentId}; --deployment-id must be that id.`);
      }
    }
    const code = randomToken();
    const t = now();
    const grantId = transaction(db, () => {
      // A new grant for the same connection and purpose replaces the older unredeemed ones (also one an attempt holds).
      revokeOpenGrants(db, c.id, 'replaced', t, purpose);
      return insertGrant(db, {
        libraryId: c.libraryId, connectionId: c.id, lms: c.lms, profile: c.profile, purpose, siteUrl: c.siteUrl, serviceUrl: c.serviceUrl,
        clientId: input.clientId, deploymentId: input.deploymentId, note: input.note, expiresAt: t + ttl * 1000,
      }, sha256Hex(code), t);
    });
    log.info('grant_issued', { trace_id: input.traceId, grant_id: grantId, connection_id: c.id, purpose, expires_at: iso(t + ttl * 1000) });
    return {
      exitCode: 0,
      lines: [
        `Library: ${library.name} (${library.id})`, `Connection: ${c.name} (${c.id})`, `LMS profile: ${c.lms} ${c.profile}`, `Purpose: ${purpose}`,
        `Site URL: ${c.siteUrl}`, `Service URL: ${c.serviceUrl}`, `Client ID: ${input.clientId}`, `Deployment ID: ${input.deploymentId}`,
        `Grant id: ${grantId}`, `Approval code (shown once): ${code}`, `Expires: ${iso(t + ttl * 1000)}`,
      ],
    };
  }

  /** `app:grant revoke` (§4.8): revoke an unredeemed grant, then the grant cleanup. Revoke again repeats the cleanup. */
  async function revoke(grantId: string, traceId: string): Promise<CommandResult> {
    const g = getGrant(db, grantId);
    if (!g) return fail(`Unknown grant: ${grantId}.`);
    if (g.redeemedAt !== null) return fail('This grant is redeemed. Use app:binding suspend instead.');
    if (g.revokedAt === null && revokeGrant(db, g.id, 'operator', now())) log.info('grant_revoked', { trace_id: traceId, grant_id: g.id });
    const c = getConnectionAnyLibrary(db, g.connectionId)!;
    const lines = await cleanup.revokeCleanup(getGrant(db, g.id)!, c, traceId);
    if (lines === null) return { exitCode: 0, lines: ['revoked', 'a running redemption will cancel and switch off its own record; run revoke again after 60 s to check'] };
    return { exitCode: lines.some((l) => l.result === 'failed') ? 1 : 0, lines: ['revoked', ...lines.map(lineOf)] };
  }

  /** `app:grant list` (§4.8): never the code or its hash. */
  function list(connectionId: string): CommandResult {
    const c = getConnectionAnyLibrary(db, connectionId);
    if (!c) return fail(`Unknown connection: ${connectionId}.`);
    const t = now();
    const holder = leaseLive(c, t) ? c.redeemingAttempt : null;
    const holderGrant = holder ? db.prepare('SELECT grant_id FROM binding_attempt WHERE attempt_id = ?').get(holder)?.grant_id : undefined;
    return {
      exitCode: 0,
      lines: grantsOfConnection(db, c.id).map((g) => [
        g.id, g.purpose, `site=${g.siteUrl}`, `service=${g.serviceUrl}`, `client=${g.clientId}`, `deployment=${g.deploymentId}`,
        `created=${iso(g.createdAt)}`, `expires=${iso(g.expiresAt)}`, GRANT_STATE(g, holderGrant === g.id, t),
      ].join(' ')),
    };
  }

  const bindingOf = (c: Connection): string => {
    if (c.lms === 'blackboard') {
      const r = reservationOfConnection(db, c.id);
      return r ? `Blackboard deployment ${r.deploymentId} of ${r.platformId}` : 'Blackboard: no reservation';
    }
    return c.ltiPlatformId ? `${c.lms} platform ${c.ltiPlatformId}` : `${c.lms}: no platform id`;
  };

  /** `app:binding suspend` (§4.9): disabled + grants revoked in one transaction, then the fence-out. Repeatable. */
  async function suspend(connectionId: string, note: string, traceId: string): Promise<CommandResult> {
    if (note.length < 1 || note.length > 500) return fail('--note must be 1 to 500 characters (the evidence reference).');
    const c = getConnectionAnyLibrary(db, connectionId);
    if (!c) return fail(`Unknown connection: ${connectionId}.`);
    const library = getLibrary(db, c.libraryId)!;
    const head = [`Library: ${library.name} (${library.id})`, `Connection: ${c.name} (${c.id})`, `Binding: ${bindingOf(c)}`];
    transaction(db, () => { disableConnection(db, c.libraryId, c.id, now()); revokeOpenGrants(db, c.id, 'suspend', now()); });
    log.warn('binding_suspended', { trace_id: traceId, connection_id: c.id, note_present: true });
    const lines = await cleanup.fenceOut(getConnectionAnyLibrary(db, c.id)!, traceId);
    if (c.lms === 'moodle') {
      for (const l of lines) log.warn('binding_fenced', { trace_id: traceId, connection_id: c.id, platform_id: l.platformId, deployment_id: l.deploymentId, result: l.result });
    }
    return { exitCode: lines.some((l) => l.result === 'failed') ? 1 : 0, lines: [...head, ...lines.map(lineOf)] };
  }

  /** `app:binding release` (§4.9): preconditions first; deletes only this connection's reservation and approvals. */
  async function release(connectionId: string, note: string, traceId: string): Promise<CommandResult> {
    if (note.length < 1 || note.length > 500) return fail('--note must be 1 to 500 characters (the evidence reference).');
    const c = getConnectionAnyLibrary(db, connectionId);
    if (!c) return fail(`Unknown connection: ${connectionId}.`);
    const r = await cleanup.release(c, traceId);
    if (!r.ok) return fail(r.message);
    return { exitCode: r.failed ? 1 : 0, lines: r.lines.map(lineOf) };
  }

  return { issue, revoke, list, suspend, release };
}
