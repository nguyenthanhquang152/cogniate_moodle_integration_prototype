import { ApiError } from './api-errors.ts';
import type { ChannelRegistry } from '@cogniate/channel-kernel';
// Operator commands (app contract §4.8, §4.9): `app:grant issue|revoke|list` and `app:binding suspend|release`. They run
// in the app service shell (not reachable over HTTP). Each command returns its exit code and output lines, so the
// CLI wrappers in cli/ only parse arguments and print. The LTI side of revoke, suspend and release is the common
// cleanup engine (binding-cleanup.ts), with the same write-ahead refs as a redemption.
// LA-E5-12 (LA-ADR-07 D4, D5; LA-ADR-06 D4 rule 4): every write command first asks the operator policy (LA-E5-11); a
// refusal prints the policy line and stores nothing. Then the command writes exactly one app audit event: `ok` in the
// transaction of its local change, or `refused` (with a stable code) when it refuses a known grant or connection. A
// usage error, an unknown target and an LTI service failure write no event.
import { canonicalOrigin, randomToken, sha256Hex } from '@cogniate/shared';
import type { Logger } from '@cogniate/shared';
import type { LtiClient } from '../clients/lti-client.ts';
import type { GrantPurpose } from '../domain/bindings.ts';
import { attemptsOfConnection, getGrant, grantsOfConnection, insertGrant, leaseLive, reservationOfConnection, revokeGrant, revokeOpenGrants } from '../domain/bindings.ts';
import type { Connection } from '../domain/connections.ts';
import { completeSnapshot, getConnectionAnyLibrary } from '../domain/connections.ts';
import type { Db } from '../domain/db.ts';
import { transaction } from '../domain/db.ts';
import { getLibrary } from '../domain/libraries.ts';
import { authorityFor } from '../kernel/authority/index.ts';
import { servedByKernel, setupOf } from '../kernel/setup.ts';
import type { AdminValues } from '../kernel/ports.ts';
import { PRINTABLE_ID } from '@cogniate/channel-kernel/setup';
import type { BindingCleanup, CleanupLine } from './binding-cleanup.ts';
import { BOUND_FIELDS, exclusiveIssuerMatches, foreignHostFields, providerProfiles, sharedReadiness } from './binding-targets.ts';
import { insertAuditEvent } from './audit.ts';
import type { AuditTarget } from './audit.ts';
import { evaluateOperatorPolicy } from './operator-policy.ts';
import type { OperatorPolicyDecision } from './operator-policy.ts';

export interface OperatorDeps {
  channels: ChannelRegistry;
  db: Db;
  lti: LtiClient;
  logger: Logger;
  cleanup: BindingCleanup;
  now: () => number;
  /** The CLI process environment of the operator policy (STACK_PROFILE, OPERATORS, OPERATORS_FILE, OPERATOR_NAME). */
  env?: NodeJS.ProcessEnv;
}

/** The operator flags of a write command (LA-ADR-07 D4, D5). Without them the M1 command is unchanged (not production). */
export interface OperatorFlags {
  operator?: string;
  evidenceChannel?: string;
  evidenceRef?: string;
}

export interface CommandResult {
  exitCode: 0 | 1;
  lines: string[];
}

const fail = (line: string): CommandResult => ({ exitCode: 1, lines: [line] });
/** Channel text names in registry order, joined as "X", "X and Y" or "X, Y and Z" (the BD-A1-31 list form). */
const joinNames = (names: readonly string[], word: 'and' | 'or'): string =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} ${word} ${names.at(-1)!}`;
const iso = (ms: number) => new Date(ms).toISOString();
const lineOf = (l: CleanupLine) => `${l.result} platform=${l.platformId ?? '-'} deployment=${l.deploymentId ?? '-'}`;

/** The admin values that an admin-value grant binds, as typed (LA-ADR-02 D6: --issuer, --auth-url, --token-url, …). */
export type TypedBoundValues = Partial<AdminValues>;

export interface IssueInput extends OperatorFlags {
  /** Admin-value profile, no staged platform: every value that the grant binds. */
  boundValues?: TypedBoundValues;
  /** Admin-value profile with a staged registration: take the bound values from the staged platform. */
  acceptStaged?: boolean;
  /** A bound value whose host is not the issuer host needs this confirmation (Reviewer-A A-LAD-23). */
  confirmForeignHosts?: boolean;
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

/** The CLI flag of each bound value (LA-ADR-02 D6). */
const BOUND_FLAGS: Record<keyof AdminValues, string> = {
  issuer: '--issuer', authenticationEndpoint: '--auth-url', accessTokenEndpoint: '--token-url', jwksUrl: '--jwks-url', tokenAudience: '--token-audience',
};
const BOUND_LABELS: Record<keyof AdminValues, string> = {
  issuer: 'Issuer', authenticationEndpoint: 'Authentication URL', accessTokenEndpoint: 'Token URL', jwksUrl: 'JWKS URL', tokenAudience: 'Token audience',
};
/** An https URL with no user name, password or fragment, at most 2048 characters (the admin-value body rule). */
function isHttpsUrl(value: string): boolean {
  if (value.length > 2048) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.username === '' && u.password === '' && u.hash === '';
  } catch {
    return false;
  }
}

type Allowed = Extract<OperatorPolicyDecision, { allowed: true }>;
/** The tenant, the connection and the changed object of one audit event (data-model §5: connection_id on every event). */
interface Subject { libraryId: string; connectionId: string; target: AuditTarget }
/** A connection has one binding; the binding target is named by the connection id. */
const bindingSubject = (c: Connection): Subject => ({ libraryId: c.libraryId, connectionId: c.id, target: { type: 'binding', id: c.id } });

export function createOperator(deps: OperatorDeps) {
  const { db, lti, logger: log, cleanup, now, channels } = deps;

  /**
   * The operator policy before any change. A refusal is logged with its reason and stores nothing (no row, no event).
   * `evidenceRequired` is false only for app:grant revoke (BD-A2-63): production needs the operator, not the evidence.
   */
  const policyOf = (flags: OperatorFlags, note: string | undefined, traceId: string, evidenceRequired = true): OperatorPolicyDecision => {
    const decision = evaluateOperatorPolicy({ operator: flags.operator, evidenceChannel: flags.evidenceChannel, evidenceRef: flags.evidenceRef, note, evidenceRequired },
      deps.env ?? process.env);
    if (!decision.allowed) {
      let line: { event?: unknown; reason?: unknown } = {};
      try { line = JSON.parse(decision.message) as typeof line; } catch { /* the line is printed as it is */ }
      log.warn(typeof line.event === 'string' ? line.event : 'operator_refused', { trace_id: traceId, reason: typeof line.reason === 'string' ? line.reason : null });
    }
    return decision;
  };

  /** One app audit event of a command; `details` hold only the evidence fields and note_present (LA-ADR-07 D5). */
  const record = (allowed: Allowed, traceId: string, action: string, subject: Subject, result: 'ok' | 'refused', code: string | null = null): void => {
    insertAuditEvent(db, { actor: allowed.actor, libraryId: subject.libraryId, connectionId: subject.connectionId, traceId, clientIp: null,
      action, target: subject.target, result, code, details: allowed.details }, now());
  };

  // Texts name the LMS with the manifest text names (LA-ADR-01 D12): the connection's channel, or the channels that
  // offer the refused feature, from the registry (Canvas and Blackboard bytes as in M1).
  const textNames = (offers: (id: string) => boolean): string[] => channels.channels().filter((m) => offers(m.id)).map((m) => channels.textName(m.id));
  const grantChannels = () => textNames((id) => channels.channel(id)!.registration.some((r) => r.authority === 'operatorGrant'));
  const multiDeploymentChannels = () => textNames((id) => channels.capabilities(id)['deployments.multiple']);
  const serviceUrlChannels = () => textNames((id) => Object.values(setupOf(channels, id)?.profiles ?? {}).some((p) => p.serviceUrl));

  /** `app:grant issue` (§4.8): every check before anything is stored; one approval code, shown once. */
  async function issue(input: IssueInput): Promise<CommandResult> {
    const policy = policyOf(input, input.note, input.traceId);
    if (!policy.allowed) return fail(policy.message);
    const purpose = input.purpose ?? 'initial';
    const ttl = input.ttlSeconds ?? 86400;
    // Read first, so that a refusal on a known connection writes its event; the order of the checks stays M1's.
    const c = getConnectionAnyLibrary(db, input.connection);
    const refuse = (code: string, line: string): CommandResult => {
      if (c) record(policy, input.traceId, 'grant.issue', { libraryId: c.libraryId, connectionId: c.id, target: { type: 'grant', id: null } }, 'refused', code);
      return fail(line);
    };
    if (!Number.isInteger(ttl) || ttl < 60 || ttl > 604800) return refuse('ttl_invalid', '--ttl-seconds must be 60 to 604800.');
    if (input.note.length < 1 || input.note.length > 500) return refuse('note_invalid', '--note must be 1 to 500 characters (the evidence reference).');
    if (!PRINTABLE_ID.test(input.clientId) || !PRINTABLE_ID.test(input.deploymentId)) return refuse('id_invalid', '--client-id and --deployment-id must be 1 to 255 printable ASCII characters without spaces.');
    if (!c) return fail(`Unknown connection: ${input.connection}.`);
    if (c.libraryId !== input.library) return refuse('library_mismatch', '--library is not the library of this connection.');
    const library = getLibrary(db, c.libraryId)!;
    if (c.bindingAuthority !== 'operatorGrant') return refuse('authority_not_operator_grant', `Approval grants are only for ${joinNames(grantChannels(), 'and')} connections.`);
    if (purpose === 'initial' && c.status !== 'pending') return refuse('connection_not_pending', 'An initial grant needs a pending connection.');
    if (purpose === 'add_deployment' && !(channels.capabilities(c.channel)['deployments.multiple'] && (c.status === 'registered' || c.status === 'connected'))) {
      return refuse('add_deployment_not_allowed', `An add_deployment grant needs a registered or connected ${joinNames(multiDeploymentChannels(), 'or')} connection.`);
    }
    const site = canonicalOrigin(input.site);
    if (!site.ok || site.origin !== c.siteUrl) return refuse('site_mismatch', '--site is not the site URL of this connection.');
    const service = input.serviceUrl === undefined ? site : canonicalOrigin(input.serviceUrl);
    if (!setupOf(channels, c.channel)?.profiles[c.profile]?.serviceUrl && input.serviceUrl !== undefined && (!service.ok || service.origin !== c.siteUrl)) return refuse('service_url_not_allowed', `--service-url is only for ${joinNames(serviceUrlChannels(), 'or')} connections.`);
    if (!service.ok || service.origin !== c.serviceUrl) return refuse('service_url_mismatch', '--service-url is not the service URL of this connection.');
    if (purpose === 'add_deployment' && input.clientId !== c.platform?.clientId) return refuse('client_id_mismatch', '--client-id is not the client id of this connection platform.');
    // LA-ADR-02 D6: an initial grant of an admin-value channel (served by the kernel adapter, BD-A1-79) binds the admin
    // values; every other grant refuses the bound-value flags.
    const adminValueGrant = purpose === 'initial' && servedByKernel(channels, c.channel);
    const typed = Object.fromEntries(Object.entries(input.boundValues ?? {}).filter(([, v]) => v !== undefined)) as TypedBoundValues;
    const staged = c.method === 'dynamic' && c.platform !== null;
    if (!adminValueGrant && Object.keys(typed).length > 0) return refuse('bound_values_not_allowed', '--issuer, --auth-url, --token-url, --jwks-url and --token-audience are only for an initial grant of a connection with admin values.');
    if (input.acceptStaged && !(adminValueGrant && staged)) return refuse('not_staged', '--accept-staged needs a connection with a staged registration.');
    let boundValues: AdminValues | null = null;
    if (adminValueGrant) {
      let row;
      try {
        row = (await providerProfiles(lti, input.traceId)).find((p) => p.id === c.profile);
      } catch {
        return fail('The LTI service did not answer. Nothing was stored.');
      }
      if (!row || row.endpoints === 'fixed') return refuse('profile_changed', `The ${channels.textName(c.channel)} profile changed after this connection was made. Make a new connection.`);
      if (staged) {
        if (Object.keys(typed).length > 0) return refuse('bound_values_not_allowed', 'A staged registration takes its values from the staged platform. Use --accept-staged.');
        if (!input.acceptStaged) return refuse('bound_values_missing', 'This connection has a staged registration. Add --accept-staged to bind its values.');
        let p;
        try {
          p = await lti.getPlatform(c.platform!.id, input.traceId);
        } catch {
          return fail('The LTI service did not answer. Nothing was stored.');
        }
        if (p.active || p.url !== c.platform!.issuer || p.clientId !== c.platform!.clientId || !p.authenticationEndpoint || !p.accesstokenEndpoint || !p.authConfig) {
          return refuse('staged_values_changed', 'The staged platform changed after the registration. Make a new connection.');
        }
        if (input.clientId !== p.clientId) return refuse('client_id_mismatch', '--client-id is not the client id of the staged platform.');
        if (!p.deploymentIds.includes(input.deploymentId)) return refuse('deployment_mismatch', '--deployment-id is not a deployment of the staged platform.');
        boundValues = { issuer: p.url, authenticationEndpoint: p.authenticationEndpoint, accessTokenEndpoint: p.accesstokenEndpoint, jwksUrl: p.authConfig.key,
          ...(p.clientAssertionAud !== null ? { tokenAudience: p.clientAssertionAud } : {}) };
      } else {
        const missing = BOUND_FIELDS.filter((key) => key !== 'tokenAudience' && typed[key] === undefined);
        if (missing.length > 0) return refuse('bound_values_missing', `This connection binds its admin values. Add ${missing.map((key) => BOUND_FLAGS[key]).join(', ')}.`);
        const bad = BOUND_FIELDS.find((key) => typed[key] !== undefined && !isHttpsUrl(typed[key]!.trim()));
        if (bad) return refuse('bound_value_invalid', `${BOUND_FLAGS[bad]} must be an https URL.`);
        if (new URL(typed.issuer!.trim()).origin !== c.siteUrl) return refuse('bound_value_invalid', '--issuer must be on the site URL of this connection.');
        const value = (v: string): string => { const o = canonicalOrigin(v.trim()); return o.ok ? o.origin : v.trim(); };
        boundValues = { issuer: value(typed.issuer!), authenticationEndpoint: value(typed.authenticationEndpoint!), accessTokenEndpoint: value(typed.accessTokenEndpoint!),
          jwksUrl: value(typed.jwksUrl!), ...(typed.tokenAudience !== undefined ? { tokenAudience: value(typed.tokenAudience) } : {}) };
      }
    }
    if (purpose === 'initial' && !adminValueGrant) {
      const sharing = setupOf(channels, c.channel)?.sharingOf(c.profile);
      const snapshot = sharing ? completeSnapshot(c, sharing) : null;
      if (!snapshot) return refuse('snapshot_missing', 'This connection has no provider snapshot. Make a new connection.');
      let row;
      try {
        row = (await providerProfiles(lti, input.traceId)).find((p) => p.id === c.profile);
      } catch {
        // Not a refusal: no event (LA-ADR-06 D4 rule 1).
        return fail('The LTI service did not answer. Nothing was stored.');
      }
      if (sharing === 'exclusive' && !exclusiveIssuerMatches(row, c, snapshot)) {
        return refuse('profile_changed', `The ${channels.textName(c.channel)} profile changed after this connection was made. Make a new connection.`);
      }
      if (sharing === 'shared') {
        const cause = sharedReadiness(row, snapshot);
        const lms = channels.textName(c.channel);
        if (cause === 'platform_inactive') return refuse('platform_inactive', `The ${lms} shared platform is not active.`);
        if (cause) return refuse('platform_changed', `The ${lms} shared platform changed after this connection was made. Make a new connection.`);
        if (input.clientId !== snapshot.clientId) return refuse('client_id_mismatch', `--client-id is not the ${lms} Application ID of the shared platform.`);
        const reserved = reservationOfConnection(db, c.id);
        if (reserved && reserved.deploymentId !== input.deploymentId) return refuse('deployment_fixed', `This connection holds a reservation for deployment ${reserved.deploymentId}; --deployment-id must be that id.`);
      }
    }
    // The bound values come before the code (app contract §4.8 "Issue output"); a value off the issuer host is marked.
    const head = [
      `Library: ${library.name} (${library.id})`, `Connection: ${c.name} (${c.id})`, `LMS profile: ${c.channel} ${c.profile}`, `Purpose: ${purpose}`,
      `Site URL: ${c.siteUrl}`, `Service URL: ${c.serviceUrl}`, `Client ID: ${input.clientId}`, `Deployment ID: ${input.deploymentId}`,
    ];
    if (boundValues) {
      const foreign = foreignHostFields(boundValues);
      for (const key of BOUND_FIELDS) {
        if (boundValues[key] !== undefined) head.push(`${BOUND_LABELS[key]}: ${boundValues[key]}${foreign.includes(key) ? ' [not on the issuer host]' : ''}`);
      }
      if (foreign.length > 0 && !input.confirmForeignHosts) {
        record(policy, input.traceId, 'grant.issue', { libraryId: c.libraryId, connectionId: c.id, target: { type: 'grant', id: null } }, 'refused', 'foreign_hosts_unconfirmed');
        return { exitCode: 1, lines: [...head, 'A value is not on the issuer host. Check with the LMS administrator that the vendor issued this client id for this issuer at that host, then add --confirm-foreign-hosts.'] };
      }
    }
    const code = randomToken();
    const t = now();
    const grantId = transaction(db, () => {
      // A new grant for the same connection and purpose replaces the older unredeemed ones (also one an attempt holds).
      revokeOpenGrants(db, c.id, 'replaced', t, purpose);
      const id = insertGrant(db, {
        libraryId: c.libraryId, connectionId: c.id, channel: c.channel, profile: c.profile, purpose, siteUrl: c.siteUrl, serviceUrl: c.serviceUrl,
        clientId: input.clientId, deploymentId: input.deploymentId, note: input.note, expiresAt: t + ttl * 1000,
        ...(boundValues ? { boundValues: { ...boundValues } as Record<string, string> } : {}),
      }, sha256Hex(code), t);
      record(policy, input.traceId, 'grant.issue', { libraryId: c.libraryId, connectionId: c.id, target: { type: 'grant', id } }, 'ok');
      return id;
    });
    log.info('grant_issued', { trace_id: input.traceId, grant_id: grantId, connection_id: c.id, purpose, expires_at: iso(t + ttl * 1000) });
    return { exitCode: 0, lines: [...head, `Grant id: ${grantId}`, `Approval code (shown once): ${code}`, `Expires: ${iso(t + ttl * 1000)}`] };
  }

  /** `app:grant revoke` (§4.8): revoke an unredeemed grant, then the grant cleanup. Revoke again repeats the cleanup. */
  async function revoke(grantId: string, traceId: string, flags: OperatorFlags = {}): Promise<CommandResult> {
    const policy = policyOf(flags, undefined, traceId, false);
    if (!policy.allowed) return fail(policy.message);
    const g = getGrant(db, grantId);
    if (!g) return fail(`Unknown grant: ${grantId}.`);
    const subject: Subject = { libraryId: g.libraryId, connectionId: g.connectionId, target: { type: 'grant', id: g.id } };
    // The grant state that decides the result is read inside the change transaction (LA-ADR-06 D4 T1).
    const state = transaction(db, () => {
      const current = getGrant(db, g.id)!;
      if (current.redeemedAt !== null) return 'redeemed' as const;
      const revoked = current.revokedAt === null && revokeGrant(db, g.id, 'operator', now());
      record(policy, traceId, 'grant.revoke', subject, 'ok');
      return revoked ? 'revoked' as const : 'unchanged' as const;
    });
    if (state === 'redeemed') {
      record(policy, traceId, 'grant.revoke', subject, 'refused', 'grant_redeemed');
      return fail('This grant is redeemed. Use app:binding suspend instead.');
    }
    if (state === 'revoked') log.info('grant_revoked', { trace_id: traceId, grant_id: g.id });
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
        // LA-ADR-02 D6 (app API delta §7): the bound values of an admin-value grant.
        ...(g.boundValues ? BOUND_FIELDS.filter((key) => g.boundValues![key] !== undefined).map((key) => `${key}=${g.boundValues![key]}`) : []),
        `created=${iso(g.createdAt)}`, `expires=${iso(g.expiresAt)}`, GRANT_STATE(g, holderGrant === g.id, t),
      ].join(' ')),
    };
  }

  const bindingOf = (c: Connection): string => {
    const attempts = attemptsOfConnection(db, c.id);
    if (attempts.some((a) => a.targetKind === 'shared_deployment') || (attempts.length === 0 && setupOf(channels, c.channel)?.sharingOf(c.profile) === 'shared')) {
      const r = reservationOfConnection(db, c.id);
      const lms = channels.textName(c.channel);
      return r ? `${lms} deployment ${r.deploymentId} of ${r.platformId}` : `${lms}: no reservation`;
    }
    return c.ltiPlatformId ? `${c.channel} platform ${c.ltiPlatformId}` : `${c.channel}: no platform id`;
  };

  /** `app:binding suspend` (§4.9): disabled + grants revoked in one transaction, then the fence-out. Repeatable. */
  async function suspend(connectionId: string, note: string, traceId: string, flags: OperatorFlags = {}): Promise<CommandResult> {
    const policy = policyOf(flags, note, traceId);
    if (!policy.allowed) return fail(policy.message);
    const c = getConnectionAnyLibrary(db, connectionId);
    if (note.length < 1 || note.length > 500) {
      if (c) record(policy, traceId, 'binding.suspend', bindingSubject(c), 'refused', 'note_invalid');
      return fail('--note must be 1 to 500 characters (the evidence reference).');
    }
    if (!c) return fail(`Unknown connection: ${connectionId}.`);
    const library = getLibrary(db, c.libraryId)!;
    const head = [`Library: ${library.name} (${library.id})`, `Connection: ${c.name} (${c.id})`, `Binding: ${bindingOf(c)}`];
    const lines = await authorityFor(c, deps).suspend(c, traceId, () => record(policy, traceId, 'binding.suspend', bindingSubject(c), 'ok'));
    if (c.bindingAuthority === 'self') {
      for (const l of lines) log.warn('binding_fenced', { trace_id: traceId, connection_id: c.id, platform_id: l.platformId, deployment_id: l.deploymentId, result: l.result });
    }
    return { exitCode: lines.some((l) => l.result === 'failed') ? 1 : 0, lines: [...head, ...lines.map(lineOf)] };
  }

  /** `app:binding release` (§4.9): preconditions first; deletes only this connection's reservation and approvals. */
  async function release(connectionId: string, note: string, traceId: string, flags: OperatorFlags = {}): Promise<CommandResult> {
    const policy = policyOf(flags, note, traceId);
    if (!policy.allowed) return fail(policy.message);
    const c = getConnectionAnyLibrary(db, connectionId);
    if (note.length < 1 || note.length > 500) {
      if (c) record(policy, traceId, 'binding.release', bindingSubject(c), 'refused', 'note_invalid');
      return fail('--note must be 1 to 500 characters (the evidence reference).');
    }
    if (!c) return fail(`Unknown connection: ${connectionId}.`);
    // A release that fails at the LTI service changes no local row: no event (only a refusal has a code).
    const r = await authorityFor(c, deps).release(c, traceId, () => record(policy, traceId, 'binding.release', bindingSubject(c), 'ok'));
    if (!r.ok) {
      if (r.code !== null) record(policy, traceId, 'binding.release', bindingSubject(c), 'refused', r.code);
      return fail(r.message);
    }
    return { exitCode: r.failed ? 1 : 0, lines: r.lines.map(lineOf) };
  }

  const bindingCommand = (command: typeof suspend): typeof suspend => async (...args) => {
    try { return await command(...args); }
    catch (error) {
      if (error instanceof ApiError) return fail(`${error.code}: ${error.message}`);
      throw error;
    }
  };
  return { issue, revoke, list, suspend: bindingCommand(suspend), release: bindingCommand(release) };
}
