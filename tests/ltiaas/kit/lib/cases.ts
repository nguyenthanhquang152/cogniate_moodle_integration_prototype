// Case bodies with injected I/O. The K1 suites call them with live I/O (runtime.ts `liveKitCaseIo`,
// bound to the frozen M1 helpers); kit.k0.test.ts calls the same functions with contract-shaped
// host fakes, so the selectors, request shapes and final comparisons run on the host too.
// No channel name appears here: every branch reads the fixture.
import crypto from 'node:crypto';
import { denied, DL, LTI, parseForm } from '../../../acceptance/M1/common/client.js';
import {
  buildPickerSelectionForm,
  ChannelFixture,
  contentItemPublicationIds,
  FamilyGuardExpectation,
  selectFamilyGuardProbes,
  validateFamilyGuardLaunchObservation,
} from './fixtures.js';

export interface HttpResultLike {
  status: number;
  headers: Record<string, unknown>;
  body: string;
}

export interface KitCaseIo {
  now(): number;
  sleep(ms: number): Promise<void>;
  // Log lines of one service (`lti-service` or `cogniate-app`) since a time, with exact field values.
  logEvents(
    service: string,
    event: string,
    sinceMs: number,
    fields?: Record<string, unknown>,
  ): Array<Record<string, unknown>>;
}

function fail(message: string): never {
  throw new Error(message);
}

// A launch check failure answers an HTML error page with status 400 or 401 and no redirect
// (security.md §2.2); the frozen M1 protocol tests check the code and accept either status.
export function launchRefused(
  response: { status: number; headers: unknown; body: string },
  code: string,
): void {
  if (response.status !== 400 && response.status !== 401) {
    fail(`launch refusal ${code}: status ${response.status}, expected 400 or 401`);
  }
  denied(response as { status: number; headers: any; body: string }, code, response.status);
}

function headerOf(response: HttpResultLike, name: string): string {
  const value = response.headers?.[name];
  return Array.isArray(value) ? String(value[0] ?? '') : value === undefined ? '' : String(value);
}

async function waitForEvents(
  io: KitCaseIo,
  read: () => Array<Record<string, unknown>>,
  timeoutMs: number,
  intervalMs: number,
): Promise<Array<Record<string, unknown>>> {
  const deadline = io.now() + timeoutMs;
  for (;;) {
    const found = read();
    if (found.length > 0 || io.now() >= deadline) return found;
    await io.sleep(intervalMs);
  }
}

// ---------------------------------------------------------------------------------------------
// K1-LAUNCH L4 (TEST-STRATEGY §2.4; LA-ADR-01 D6; cogniate-app-api-delta.md §5).
// ---------------------------------------------------------------------------------------------

export interface FamilyGuardCaseIo extends KitCaseIo {
  // One resource-link launch on the target binding (M1 `launch` through `launchOnChannel`).
  launch(patch: Record<string, unknown>): Promise<{ response: HttpResultLike }>;
}

export interface FamilyGuardCaseReport {
  probes: Array<{ expected: FamilyGuardExpectation; status: number; warnLogCount: number }>;
  notes: string[];
}

export async function runFamilyGuardCase(
  ctx: {
    target: ChannelFixture;
    allFixtures: ChannelFixture[];
    platformId: string;
    resourceId: string;
  },
  io: FamilyGuardCaseIo,
  options: { logWaitMs?: number; settleMs?: number; pollMs?: number } = {},
): Promise<FamilyGuardCaseReport> {
  const logWaitMs = options.logWaitMs ?? 5_000;
  const settleMs = options.settleMs ?? 500;
  const pollMs = options.pollMs ?? 200;
  // The expectations are fixed before any launch is sent.
  const selection = selectFamilyGuardProbes(ctx.target, ctx.allFixtures);
  const report: FamilyGuardCaseReport = { probes: [], notes: selection.notes };
  const errors: string[] = [];

  for (const expected of selection.probes) {
    const since = io.now();
    const launched = await io.launch({
      resource: ctx.resourceId,
      claims: { [`${LTI}tool_platform`]: { product_family_code: expected.foreignFamily } },
    });
    const response = launched.response;
    // check 14 logs `family_guard_mismatch {platform_id, family}` in the LTI service log (LA-ADR-01 D6).
    const read = () =>
      io
        .logEvents('lti-service', 'family_guard_mismatch', since, { platform_id: ctx.platformId })
        .filter(
          (e) => String(e.family ?? '').toLowerCase() === expected.foreignFamily.toLowerCase(),
        );
    let events: Array<Record<string, unknown>> = [];
    if (expected.expectedOutcome === 'warn_passthrough') {
      events = await waitForEvents(io, read, logWaitMs, pollMs);
    } else if (expected.expectedOutcome === 'pass') {
      await io.sleep(settleMs);
      events = read();
    }
    const verdict = validateFamilyGuardLaunchObservation(expected, {
      status: response.status,
      body: response.body,
      location: headerOf(response, 'location'),
      warnLogCount: events.length,
    });
    if (!verdict.ok) errors.push(String(verdict.error));
    report.probes.push({ expected, status: response.status, warnLogCount: events.length });
  }

  if (errors.length > 0) {
    fail(`L4 family guard on "${ctx.target.id}":\n${errors.join('\n')}`);
  }
  return report;
}

// ---------------------------------------------------------------------------------------------
// Deep Linking picker handoff (cogniate-app-api.md §6: `/tool/deep-link` answers 303 to
// `/tool/picker/{pickerId}`; the frozen M1 `picker` helper follows both steps). The HTTP client
// follows no redirects; the observed status is returned as it is.
// ---------------------------------------------------------------------------------------------

export async function followPickerHandoff(
  launchResponse: HttpResultLike,
  request: (url: string, opts?: { headers?: Record<string, string> }) => Promise<HttpResultLike>,
  appOrigin: string,
): Promise<{
  handoffUrl: string;
  pickerUrl: string;
  status: number;
  html: string;
  page: HttpResultLike;
}> {
  const handoffUrl = new URL(headerOf(launchResponse, 'location'), appOrigin).href;
  const handoff = await request(handoffUrl, { headers: { accept: 'text/html' } });
  const next = headerOf(handoff, 'location');
  if (handoff.status !== 303 || !next) {
    return {
      handoffUrl,
      pickerUrl: handoffUrl,
      status: handoff.status,
      html: String(handoff.body ?? ''),
      page: handoff,
    };
  }
  const pickerUrl = new URL(next, appOrigin).href;
  const page = await request(pickerUrl, { headers: { accept: 'text/html' } });
  return { handoffUrl, pickerUrl, status: page.status, html: String(page.body ?? ''), page };
}

// ---------------------------------------------------------------------------------------------
// K1-LAUNCH L10: platform storage at the HTTP level (TEST-STRATEGY §2.4 L10: AP-05-01, AP-05-02,
// AP-05-04, AP-05-05, AP-05-07; LA-ADR-05 D1 rules 1, 3, 6-8; lti-service-api-delta.md §2.1, §2.2).
// ---------------------------------------------------------------------------------------------

export const STORAGE_HELP_TEXT =
  'Your browser blocked the Cogniate sign-in in this frame. Open the activity in a new window, or allow cookies for this site.';

export interface PlatformStorageCaseIo extends KitCaseIo {
  // M1 `beginLaunch`: one simulator scenario and one login POST.
  beginLaunch(
    patch: Record<string, unknown>,
    loginPatch?: Record<string, unknown>,
  ): Promise<{ login: HttpResultLike; location: string; cookie: string }>;
  // Frozen `httpsRequest` (no redirects followed).
  request(
    url: string,
    opts?: { method?: string; headers?: Record<string, string>; body?: string },
  ): Promise<HttpResultLike>;
  // M1 `formPost`.
  formPost(url: string, fields: Record<string, string>, cookie?: string): Promise<HttpResultLike>;
  rememberSecret(value: string): void;
}

export interface PlatformStorageCaseReport {
  storagePath: boolean;
  steps: string[];
}

// Reads the one `<script type="application/json">` block of a storage page (LA-ADR-05 D1 rule 3:
// the page values live only in one escaped JSON block; `&`, `<`, `>` are `\u` escapes).
export function readStoragePageJson(html: string): Record<string, unknown> {
  const blocks = [
    ...String(html ?? '').matchAll(
      /<script\b[^>]*\btype=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];
  if (blocks.length !== 1) {
    fail(`storage page must have exactly one <script type="application/json"> block, found ${blocks.length}`);
  }
  const parsed = JSON.parse(blocks[0][1].trim()) as unknown;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('storage page JSON block is not an object');
  }
  return parsed as Record<string, unknown>;
}

function stringValues(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => stringValues(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => stringValues(v, out));
  return out;
}

// The login page's auth URL equals the `Location` that the `302` login gives (lti-service-api-delta
// §2.1): the value of the JSON block on the same origin and path as that `Location`.
export function findStorageAuthUrl(data: Record<string, unknown>, plainLocation: string): string {
  const plain = new URL(plainLocation);
  const matches = new Set(
    stringValues(data).filter((value) => {
      try {
        const u = new URL(value);
        return u.origin === plain.origin && u.pathname === plain.pathname;
      } catch {
        return false;
      }
    }),
  );
  if (matches.size !== 1) {
    fail(
      `storage login page JSON must hold one auth URL on ${plain.origin}${plain.pathname}, found ${matches.size}`,
    );
  }
  const authUrl = [...matches][0];
  if (!new URL(authUrl).searchParams.get('state')) {
    fail('storage login auth URL has no state parameter');
  }
  return authUrl;
}

// The storage-check page posts the form fields `check` and `value` (lti-service-api-delta §2.2).
// Ruling A2 BD-A2-112: the check value is the member `check` of the page's one data block
// `<script id="lti-storage-data" type="application/json">` (members postUrl, check, target, origin,
// key, messageId; never the state, the state hash or the tool URL). No other source is read.
export function readStorageCheckData(html: string): { data: Record<string, unknown>; check: string } {
  const blocks = [...String(html ?? '').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(
    (m) =>
      /\bid=["']lti-storage-data["']/i.test(m[1]) && /\btype=["']application\/json["']/i.test(m[1]),
  );
  if (blocks.length !== 1) {
    fail(`storage-check page must have exactly one <script id="lti-storage-data" type="application/json"> block, found ${blocks.length}`);
  }
  const data = JSON.parse(blocks[0][2].trim()) as unknown;
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    fail('storage-check page data block is not an object');
  }
  const check = (data as Record<string, unknown>).check;
  if (typeof check !== 'string' || !check) {
    fail('storage-check page data block has no string member "check"');
  }
  return { data: data as Record<string, unknown>, check };
}

export function readStorageCheckToken(html: string): string {
  return readStorageCheckData(html).check;
}

export async function runPlatformStorageCase(
  ctx: {
    fixture: ChannelFixture;
    // The binding's scenario fields: provider, clientId, deploymentId, siteHost, pageHost, resource.
    launchPatch: Record<string, unknown>;
    ltiUrl: string;
    account: string;
  },
  io: PlatformStorageCaseIo,
  options: { logWaitMs?: number; pollMs?: number } = {},
): Promise<PlatformStorageCaseReport> {
  const logWaitMs = options.logWaitMs ?? 8_000;
  const pollMs = options.pollMs ?? 200;
  const ltiOrigin = new URL(ctx.ltiUrl).origin;
  const storageCheckUrl = new URL(`/lti/launch/${ctx.account}/storage-check`, ctx.ltiUrl).href;
  const storage = ctx.fixture.sim.platformStorage ?? null;
  const target = storage?.frameName ?? '_parent';
  const steps: string[] = [];

  const authorize = async (authUrl: string) => {
    const res = await io.request(authUrl);
    if (res.status !== 200) fail(`platform authorize answered ${res.status}, expected 200`);
    const form = parseForm(res.body);
    io.rememberSecret(form.fields.id_token ?? '');
    io.rememberSecret(form.fields.state ?? '');
    return form;
  };
  const postCheck = (fields: { check: string; value: string }, origin: string | null) =>
    io.request(storageCheckUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'text/html',
        ...(origin === null ? {} : { origin }),
      },
      body: new URLSearchParams(fields).toString(),
    });
  const checkLog = async (since: number, detail: string) => {
    const found = await waitForEvents(
      io,
      () =>
        io.logEvents('lti-service', 'launch_check_failed', since, {
          check: 'storage',
          code: 'INVALID_STATE',
          detail,
        }),
      logWaitMs,
      pollMs,
    );
    if (found.length === 0) fail(`no LTI log launch_check_failed {check: storage, detail: ${detail}}`);
  };

  // AP-05-01: a login without lti_storage_target answers 302 with the state cookie.
  const plain = await io.beginLaunch(ctx.launchPatch);
  if (plain.login.status !== 302) fail(`login without lti_storage_target answered ${plain.login.status}, expected 302`);
  if (!plain.cookie) fail('login without lti_storage_target set no __Host-lti_state_ cookie');
  steps.push('AP-05-01 plain login 302');

  if (!storage) {
    // Rule 1: platformStorage null gives the 302 also with a target; rule 6: no cookie -> STATE_COOKIE_MISSING.
    const withTarget = await io.beginLaunch({ ...ctx.launchPatch, storageTarget: target });
    if (withTarget.login.status !== 302) {
      fail(`login with lti_storage_target on a platformStorage-null profile answered ${withTarget.login.status}, expected 302`);
    }
    const form = await authorize(withTarget.location);
    launchRefused(await io.formPost(form.action, form.fields), 'STATE_COOKIE_MISSING');
    steps.push('rule 1/6: target login 302, launch without cookie STATE_COOKIE_MISSING');
  } else {
    const storageLogin = async (extra: Record<string, unknown> = {}) => {
      const started = await io.beginLaunch({ ...ctx.launchPatch, ...extra, storageTarget: target });
      if (started.login.status !== 200) {
        fail(`login with lti_storage_target="${target}" answered ${started.login.status}, expected the 200 login page (AP-05-02)`);
      }
      if (!started.cookie) fail('storage login page set no __Host-lti_state_ cookie (rule 3)');
      const authUrl = findStorageAuthUrl(readStoragePageJson(started.login.body), plain.location);
      const state = new URL(authUrl).searchParams.get('state') ?? '';
      io.rememberSecret(state);
      return { authUrl, state };
    };
    const checkPage = async (login: { authUrl: string; state: string }) => {
      const form = await authorize(login.authUrl);
      const res = await io.formPost(form.action, form.fields);
      if (res.status !== 200) fail(`launch without the state cookie answered ${res.status}, expected the 200 storage-check page (rule 7)`);
      if (headerOf(res, 'location')) fail('storage-check page must not redirect (no ltik before the check)');
      const { data, check } = readStorageCheckData(res.body);
      if (stringValues(data).some((value) => value.includes(login.state))) {
        fail('storage-check page data block carries the state (BD-A2-112: never the state)');
      }
      io.rememberSecret(check);
      return check;
    };

    // AP-05-02 + rule 8: Origin first (the check stays unused), then the match gives 303 with an ltik.
    const first = await storageLogin();
    steps.push('AP-05-02 storage login 200, auth URL from the JSON block');
    const check1 = await checkPage(first);
    denied(await postCheck({ check: check1, value: first.state }, 'https://evil.example.test'), 'INVALID_STATE', 400);
    const accepted = await postCheck({ check: check1, value: first.state }, ltiOrigin);
    if (accepted.status !== 303) fail(`storage check with the right value answered ${accepted.status}, expected 303`);
    const ltik = new URL(headerOf(accepted, 'location'), ltiOrigin).searchParams.get('ltik') ?? '';
    if (!ltik) fail('storage check 303 has no ltik');
    io.rememberSecret(ltik);
    steps.push('rule 8: foreign Origin INVALID_STATE, then {check, value} with the LTI Origin 303');

    // AP-05-04: a second use of the same check.
    let since = io.now();
    denied(await postCheck({ check: check1, value: first.state }, ltiOrigin), 'INVALID_STATE', 400);
    await checkLog(since, 'storage_check_unknown_used_or_expired');
    steps.push('AP-05-04 replay INVALID_STATE (used)');

    // AP-05-04: a wrong value on a fresh check.
    const second = await storageLogin();
    const check2 = await checkPage(second);
    since = io.now();
    denied(await postCheck({ check: check2, value: `${second.state}-wrong` }, ltiOrigin), 'INVALID_STATE', 400);
    await checkLog(since, 'storage_mismatch');
    steps.push('AP-05-04 wrong value INVALID_STATE (storage_mismatch)');

    // AP-05-05: an empty value on a fresh check.
    const third = await storageLogin();
    const check3 = await checkPage(third);
    const empty = await postCheck({ check: check3, value: '' }, ltiOrigin);
    denied(empty, 'STATE_COOKIE_MISSING', 400);
    if (!empty.body.includes(STORAGE_HELP_TEXT)) fail('empty storage value page has no storage help text');
    steps.push('AP-05-05 empty value STATE_COOKIE_MISSING with the help text');

    // Rule 8: an unknown check with an otherwise valid request.
    since = io.now();
    const unknownCheck = crypto.randomBytes(32).toString('base64url');
    denied(await postCheck({ check: unknownCheck, value: third.state }, ltiOrigin), 'INVALID_STATE', 400);
    await checkLog(since, 'storage_check_unknown_used_or_expired');
    steps.push('rule 8 unknown check INVALID_STATE');

    // AP-05-07: a bad signature on the storage path gives INVALID_SIGNATURE, not the check page.
    const faulty = await storageLogin({ fault: 'altered-signature' });
    const faultyForm = await authorize(faulty.authUrl);
    launchRefused(await io.formPost(faultyForm.action, faultyForm.fields), 'INVALID_SIGNATURE');
    steps.push('AP-05-07 bad signature INVALID_SIGNATURE before the storage-check page');
  }

  // A state cookie of another login is refused.
  const prepared = await io.beginLaunch(ctx.launchPatch);
  const preparedForm = await authorize(prepared.location);
  const other = await io.beginLaunch(ctx.launchPatch);
  const wrongCookie = await io.formPost(preparedForm.action, preparedForm.fields, other.cookie);
  if (wrongCookie.status !== 400 && wrongCookie.status !== 401) {
    fail(`launch with the state cookie of another login answered ${wrongCookie.status}, expected 400 or 401`);
  }
  steps.push('cookie of another login 400');

  return { storagePath: Boolean(storage), steps };
}

// ---------------------------------------------------------------------------------------------
// K1-DL D3 single select (cogniate-app-api.md §6 `POST /tool/picker/{pickerId}`; ruling A1 BD-A1-120):
// on a radio picker two `publicationId` values give the 400 page PUBLICATION_NOT_AVAILABLE with no JWT
// and no Deep Linking return; the picker stays unused, so one id on the same picker then gives one item.
// ---------------------------------------------------------------------------------------------

function jwtPayload(jwt: string): Record<string, unknown> {
  const part = String(jwt ?? '').split('.')[1];
  if (!part) fail('picker answer has no JWT');
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
}

export async function runSingleSelectRefusal(
  ctx: { pickerUrl: string; publicationIds: [string, string] },
  io: { postSelection(pickerUrl: string, form: Array<[string, string]>): Promise<HttpResultLike> },
): Promise<{ refusedStatus: number; controlIds: string[] }> {
  const refused = await io.postSelection(ctx.pickerUrl, buildPickerSelectionForm([...ctx.publicationIds]));
  if (refused.status !== 400) {
    fail(`two publicationId values on a single-select picker answered ${refused.status}, expected 400`);
  }
  denied(refused as { status: number; headers: any; body: string }, 'PUBLICATION_NOT_AVAILABLE', 400);
  if (/\bname=["']JWT["']/i.test(refused.body)) {
    fail('single-select refusal page carries a Deep Linking response JWT');
  }

  // The picker stays unused: one id on the same picker gives exactly that one item.
  const control = await io.postSelection(ctx.pickerUrl, buildPickerSelectionForm([ctx.publicationIds[0]]));
  if (control.status !== 200) {
    fail(`one publicationId on the same picker after the refusal answered ${control.status}, expected 200`);
  }
  const controlIds = contentItemPublicationIds(
    jwtPayload(parseForm(control.body).fields.JWT ?? '')[`${DL}content_items`],
  );
  if (controlIds.length !== 1 || controlIds[0] !== ctx.publicationIds[0]) {
    fail(`one-id control gave items ${JSON.stringify(controlIds)}, expected ["${ctx.publicationIds[0]}"]`);
  }
  return { refusedStatus: refused.status, controlIds };
}

// ---------------------------------------------------------------------------------------------
// K1-AGS A3 waits (cogniate-app-api.md §10; cogniate-app-api-delta.md §8 `dispatch_throttled`).
// The frozen `waitSync(..., 'pending')` also matches a new row before its first send (tries 0);
// these waits return only after the send was tried.
// ---------------------------------------------------------------------------------------------

type Row = Record<string, unknown>;
type Sync = Record<string, unknown>;

function learnerSyncOf(rows: unknown[], learnerSub: string, accept: (sync: Sync) => boolean) {
  const row = (rows as Row[]).find(
    (r) => (r?.learner as Record<string, unknown> | undefined)?.sub === learnerSub,
  );
  const syncs = Array.isArray(row?.scoreSyncs) ? (row!.scoreSyncs as Sync[]) : [];
  return { row, sync: syncs.find(accept) };
}

export async function waitForLearnerSync(
  io: { readRows(): Promise<unknown[]>; now(): number; sleep(ms: number): Promise<void> },
  learnerSub: string,
  accept: (sync: Sync) => boolean,
  description: string,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<{ row: Row; sync: Sync; reads: number }> {
  const deadline = io.now() + (options.timeoutMs ?? 20_000);
  let reads = 0;
  for (;;) {
    reads += 1;
    const { row, sync } = learnerSyncOf(await io.readRows(), learnerSub, accept);
    if (row && sync) return { row, sync, reads };
    if (io.now() >= deadline) fail(`no score sync of learner "${learnerSub}" shows ${description}`);
    await io.sleep(options.intervalMs ?? 250);
  }
}

export async function waitForThrottledDispatch(
  io: {
    readRows(): Promise<unknown[]>;
    readScoreCalls(): Promise<Array<Record<string, unknown>>>;
    throttleEvents(): Array<Record<string, unknown>>;
    now(): number;
    sleep(ms: number): Promise<void>;
  },
  learnerSub: string,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<{
  sync: Sync;
  scoreCalls: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  reads: number;
}> {
  const deadline = io.now() + (options.timeoutMs ?? 20_000);
  let reads = 0;
  for (;;) {
    reads += 1;
    const scoreCalls = (await io.readScoreCalls()).filter(
      (r) => (r.body as Record<string, unknown> | undefined)?.userId === learnerSub,
    );
    const events = io.throttleEvents();
    if (scoreCalls.length > 0 && events.length > 0) {
      const { sync } = learnerSyncOf(await io.readRows(), learnerSub, () => true);
      if (sync) return { sync, scoreCalls, events, reads };
    }
    if (io.now() >= deadline) {
      fail(
        `learner "${learnerSub}": no throttled send seen (score calls ${scoreCalls.length}, dispatch_throttled events ${events.length})`,
      );
    }
    await io.sleep(options.intervalMs ?? 250);
  }
}
