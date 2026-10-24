// LD-1 open-world checks (milestone LA, task LA-E0-04; tests/ltiaas/TEST-STRATEGY.md §4.3 rows 1-8).
// Pure functions: no I/O and no product import. M1, M2 and their host runners call them on live answers;
// tests/ltiaas/k0/ld1-open-world.test.mjs calls them on recorded G-BASE answers (strictness and openness probes).
//
// Rule of every check: each baseline element is present exactly once, with its baseline values, in its baseline
// relative order. Extra fields on an element are allowed. Each extra element must belong to a registered channel,
// that is a channel id of GET /app-api/lms-providers (LA-E0-04 design notes; app API delta §2).
import assert from 'node:assert/strict';

/** The 8 baseline profiles of GET /api/providers in their order (M1-01; `label` and `sharedPlatform` are checked apart). */
export const BASELINE_PROFILES = [
  { id: 'standard', lms: null, sharing: 'exclusive', issuer: null, authenticationEndpoint: null,
    accesstokenEndpoint: null, jwksUrl: null, siteUrlOn: null, serviceUrl: false, simulation: false },
  ...['production', 'beta', 'test'].map((tier) => {
    const part = tier === 'production' ? '' : tier + '.';
    return { id: 'canvas-cloud-' + tier, lms: 'canvas', sharing: 'exclusive',
      issuer: `https://canvas.${part}instructure.com`,
      authenticationEndpoint: `https://sso.${part}canvaslms.com/api/lti/authorize_redirect`,
      jwksUrl: `https://sso.${part}canvaslms.com/api/lti/security/jwks`,
      accesstokenEndpoint: '{serviceUrl}/login/oauth2/token',
      siteUrlOn: 'platform', serviceUrl: true, simulation: false };
  }),
  { id: 'canvas-self-hosted', lms: 'canvas', sharing: 'exclusive', issuer: '{siteUrl}',
    authenticationEndpoint: '{siteUrl}/api/lti/authorize_redirect', jwksUrl: '{siteUrl}/api/lti/security/jwks',
    accesstokenEndpoint: '{serviceUrl}/login/oauth2/token', siteUrlOn: 'platform', serviceUrl: true, simulation: false },
  ...[false, true].map((simulation) => {
    const domain = simulation ? 'blackboard.sim.test' : 'blackboard.com';
    return { id: simulation ? 'blackboard-sim' : 'blackboard', lms: 'blackboard', sharing: 'shared',
      issuer: `https://${domain}`, authenticationEndpoint: `https://developer.${domain}/api/v1/gateway/oidcauth`,
      accesstokenEndpoint: `https://developer.${domain}/api/v1/gateway/oauth2/jwttoken`,
      jwksUrl: `https://developer.${domain}/api/v1/management/applications/{clientId}/jwks.json`,
      siteUrlOn: 'deployment', serviceUrl: false, simulation };
  }),
  { id: 'canvas-sim-cloud', lms: 'canvas', sharing: 'exclusive', issuer: 'https://canvas.sim.test',
    authenticationEndpoint: 'https://sso.canvas.sim.test/api/lti/authorize_redirect',
    jwksUrl: 'https://sso.canvas.sim.test/api/lti/security/jwks',
    accesstokenEndpoint: '{serviceUrl}/login/oauth2/token', siteUrlOn: 'platform', serviceUrl: true, simulation: true },
];
/** The 6 baseline real profiles (the `default` profile shows only these). */
export const BASELINE_REAL_PROFILES = BASELINE_PROFILES.filter((p) => !p.simulation);
/** The 2 baseline simulation profile ids of `/healthz` `simulation_profiles` (`acceptance` profile). */
export const BASELINE_SIMULATION_PROFILES = ['blackboard-sim', 'canvas-sim-cloud'];
/** The 3 baseline `lms` entries of GET /app-api/lms-providers, in order. */
export const BASELINE_LMS = ['moodle', 'canvas', 'blackboard'];
/**
 * The non-channel card that the "LMS Publishing" filter also shows at G-BASE (a static integration card, not an LTI
 * channel). Row 6 allows it by its exact text; it had no check before, so the rewrite does not require it.
 */
export const BASELINE_OTHER_CARDS = ['Publish and sell your courses directly on Kajabi with seamless content sync.'];

const show = (value) => JSON.stringify(value);

/** The registered channel ids: `channel` of each GET /app-api/lms-providers entry, or its `lms` before LA-IC-01. */
export function registeredChannels(lmsProviders) {
  assert.ok(Array.isArray(lmsProviders?.lms), 'GET /app-api/lms-providers has an lms list');
  const ids = lmsProviders.lms.map((entry) => entry.channel ?? entry.lms);
  for (const id of ids) assert.equal(typeof id, 'string', 'Each lms-providers entry has a channel id');
  return new Set(ids);
}

/**
 * The exact channel ids and names of the registered channels that are not baseline channels
 * (`channel`/`lms`, `channelName`, `label`).
 */
export function extraChannelNames(lmsProviders) {
  assert.ok(Array.isArray(lmsProviders?.lms), 'GET /app-api/lms-providers has an lms list');
  const names = [];
  for (const entry of lmsProviders.lms) {
    const id = entry.channel ?? entry.lms;
    if (BASELINE_LMS.includes(id)) continue;
    for (const candidate of [id, entry.channelName, entry.label]) {
      if (typeof candidate === 'string' && candidate.trim().length > 0 && !names.includes(candidate.trim())) {
        names.push(candidate.trim());
      }
    }
  }
  return names;
}

/**
 * Open list: each baseline element matches exactly one actual element, `check` passes for that pair, and the
 * matched elements keep the baseline order. Returns the actual elements that match no baseline element.
 */
export function openList(actual, baseline, { matches, check = () => {}, label }) {
  assert.ok(Array.isArray(actual), `${label}: the answer is a list`);
  const at = baseline.map((expected) => {
    const hits = actual.flatMap((item, index) => (matches(item, expected) ? [index] : []));
    assert.equal(hits.length, 1, `${label}: baseline element ${show(expected)} appears ${hits.length} times, expected once`);
    check(actual[hits[0]], expected);
    return hits[0];
  });
  for (let i = 1; i < at.length; i++) {
    assert.ok(at[i - 1] < at[i], `${label}: baseline order changed at ${show(baseline[i])}`);
  }
  const used = new Set(at);
  return actual.filter((_, index) => !used.has(index));
}

/** Every field of the baseline object is present with the same value; extra fields are allowed. */
export function sameBaselineFields(actual, expected, label) {
  assert.ok(actual && typeof actual === 'object', `${label}: an object`);
  for (const [key, value] of Object.entries(expected)) {
    assert.ok(Object.hasOwn(actual, key), `${label}: baseline field ${key} is missing`);
    assert.deepEqual(actual[key], value, `${label}: baseline field ${key} changed`);
  }
}

/**
 * Rows 1, 3, 8: GET /api/providers profiles. Ids are unique. The baseline profiles keep their fields and order.
 * Each extra profile has a `channel` that is a registered channel. `realOnly` (the `default` profile): no profile
 * is a simulation profile. Returns the extra profiles.
 */
export function checkProfiles(profiles, baseline, { registered, realOnly = false, label = 'GET /api/providers' }) {
  assert.ok(Array.isArray(profiles), `${label}: a profile list`);
  const ids = profiles.map((p) => p?.id);
  assert.equal(new Set(ids).size, ids.length, `${label}: profile ids are unique`);
  const extras = openList(profiles, baseline, { label,
    matches: (p, b) => p?.id === b.id,
    check: (p, b) => sameBaselineFields(p, b, `${label} ${b.id}`) });
  for (const p of extras) {
    assert.equal(typeof p?.channel, 'string', `${label}: extra profile ${show(p?.id)} has no channel`);
    assert.ok(registered.has(p.channel), `${label}: extra profile ${show(p.id)} has the unregistered channel ${show(p.channel)}`);
  }
  if (realOnly) for (const p of profiles) assert.equal(p.simulation, false, `${label}: ${show(p.id)} is a simulation profile`);
  return extras;
}

/**
 * Row 2: `/healthz` `simulation_profiles`. The baseline ids keep their order. Each extra id is the simulation
 * profile (in `profiles` of GET /api/providers) of a registered channel. Returns the extra ids.
 */
export function checkSimulationProfiles(ids, baseline, { profiles, registered, label = '/healthz simulation_profiles' }) {
  assert.ok(Array.isArray(ids), `${label}: a list`);
  assert.equal(new Set(ids).size, ids.length, `${label}: ids are unique`);
  const extras = openList(ids, baseline, { label, matches: (id, expected) => id === expected });
  for (const id of extras) {
    const profile = profiles.find((p) => p?.id === id);
    assert.ok(profile, `${label}: extra id ${show(id)} is not a profile of GET /api/providers`);
    assert.equal(profile.simulation, true, `${label}: extra id ${show(id)} is not a simulation profile`);
    assert.ok(typeof profile.channel === 'string' && registered.has(profile.channel),
      `${label}: extra id ${show(id)} has the unregistered channel ${show(profile.channel)}`);
  }
  return extras;
}

/**
 * Row 7: the `lms` list of GET /app-api/lms-providers. The baseline entries keep their order. Each extra entry
 * carries its registry channel id: `channel` is a string equal to its `lms` (app API delta §2). Returns the extras.
 */
export function checkLmsEntries(entries, baseline = BASELINE_LMS, { label = 'GET /app-api/lms-providers lms' } = {}) {
  assert.ok(Array.isArray(entries), `${label}: a list`);
  const ids = entries.map((e) => e?.lms);
  assert.equal(new Set(ids).size, ids.length, `${label}: lms values are unique`);
  const extras = openList(entries, baseline, { label, matches: (e, expected) => e?.lms === expected });
  for (const e of extras) {
    assert.ok(typeof e.channel === 'string' && e.channel === e.lms,
      `${label}: extra entry ${show(e.lms)} has no registered channel id (channel ${show(e.channel)})`);
  }
  return extras;
}

/** Host runners only: the portal user of seed.json (found by shape, as tests/acceptance/lib/app.ts portalUser). */
export function seedPortalUser(rawSeed, email = 'thanh@cogniate.test') {
  const found = [];
  const walk = (node) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') {
      if (typeof node.email === 'string' && typeof node.password === 'string') found.push({ email: node.email, password: node.password });
      Object.values(node).forEach(walk);
    }
  };
  walk(rawSeed?.portal ?? rawSeed);
  const user = found.find((u) => u.email === email);
  assert.ok(user, `seed.json has no portal user ${email}`);
  return user;
}

/**
 * Host runners only: GET /app-api/lms-providers as a portal user. `request(url, { method, headers, body, ca })`
 * is the caller's HTTPS function and resolves { status, headers, body } (tests/host/lib.mjs httpsLoopback).
 */
export async function appLmsProviders(request, { appUrl, ca, user }) {
  const body = JSON.stringify({ email: user.email, password: user.password });
  const signIn = await request(appUrl + '/app-api/session', { method: 'POST', ca, body, headers: { accept: 'application/json',
    origin: appUrl, 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(body)) } });
  assert.equal(signIn.status, 204, `POST /app-api/session: HTTP ${signIn.status}`);
  const cookie = [signIn.headers['set-cookie'] ?? []].flat().find((c) => c.startsWith('__Host-cog_session='));
  assert.ok(cookie, 'POST /app-api/session sets the session cookie');
  const answer = await request(appUrl + '/app-api/lms-providers', { ca, headers: { accept: 'application/json', cookie: cookie.split(';')[0] } });
  assert.equal(answer.status, 200, `GET /app-api/lms-providers: HTTP ${answer.status}`);
  return JSON.parse(answer.body);
}

const cardText = (card) => (typeof card === 'string' ? card : String(card?.text ?? ''));

const isOtherCard = (card, other) => {
  if (card && typeof card === 'object') {
    const channel = card.channel ?? card.id ?? null;
    if (typeof channel === 'string' && channel.trim().length > 0) return false;
  }
  return cardText(card).includes(other);
};

function checkExtraCard(card, allowed, label) {
  if (card && typeof card === 'object') {
    const channel = typeof card.channel === 'string' && card.channel.trim().length > 0
      ? card.channel.trim()
      : typeof card.id === 'string' && card.id.trim().length > 0
        ? card.id.trim()
        : null;
    const name = typeof card.name === 'string' && card.name.trim().length > 0
      ? card.name.trim()
      : typeof card.title === 'string' && card.title.trim().length > 0
        ? card.title.trim()
        : null;
    if (channel !== null) {
      assert.ok(allowed.has(channel), `${label}: extra card ${show(card)} has unregistered channel ${show(channel)}`);
      return;
    }
    if (name !== null) {
      assert.ok(allowed.has(name), `${label}: extra card ${show(card)} names no registered channel (${show(name)})`);
      return;
    }
  }
  const raw = cardText(card).trim();
  const headingMatch = /^(?:[A-Za-z0-9]{1,4}\s*)?(?:Connect|Manage)\s*(.+?)\s*(?:Publish|Export)\b/.exec(raw);
  const targetMatch = /Publish Cogniate courses to\s+(.+?)\s+with LTI 1\.3\./.exec(raw);
  const candidates = headingMatch
    ? [headingMatch[1].trim(), ...(targetMatch ? [targetMatch[1].trim()] : [])]
    : [raw];
  assert.ok(
    candidates.length > 0 && candidates.every((c) => c.length > 0 && allowed.has(c)),
    `${label}: extra card ${show(card)} names no registered channel`,
  );
}

/**
 * Row 6: the visible cards of the "LMS Publishing" filter, in page order. Each baseline card text is in
 * exactly one card, in the baseline order. An extra card is a G-BASE non-channel card (`others`, each at most
 * once) or matches a registered non-baseline channel by exact `id` or `name` (`names`, from extraChannelNames),
 * never by substring. Returns the extra cards.
 */
export function checkCards(cards, baselineTexts, { names, others = BASELINE_OTHER_CARDS, label = 'LMS Publishing cards' }) {
  const allowed = new Set(names.filter((n) => typeof n === 'string' && n.trim().length > 0).map((n) => n.trim()));
  const extras = openList(cards, baselineTexts, { label, matches: (card, expected) => cardText(card).includes(expected) });
  for (const other of others) {
    assert.ok(extras.filter((card) => isOtherCard(card, other)).length <= 1, `${label}: the card ${show(other)} appears more than once`);
  }
  for (const card of extras) {
    if (others.some((other) => isOtherCard(card, other))) continue;
    checkExtraCard(card, allowed, label);
  }
  return extras;
}

/**
 * Snapshot-upgrade migration ledger check (M1-41.common.j-snapshot; BD-A2-108 / LA-H21):
 * 1. Every historical ledger entry from `oldLedger` is still present in `newLedger` in its original order
 *    (each `oldLedger[db]` is a non-empty prefix of `newLedger[db]`), independent of the candidate's files.
 * 2. `newLedger['cogniate-app/cogniate.db']` includes `012_connection_provider_snapshot.sql`.
 * 3. Each upgraded ledger equals the candidate's full sorted migration file list (`expectedLtiLedger`, `expectedAppLedger`).
 */
export function checkMigrationLedgers(
  oldLedger,
  newLedger,
  { expectedLtiLedger, expectedAppLedger, label = 'M1-41.common.j-snapshot migration ledger' } = {},
) {
  for (const db of ['lti-service/lti.db', 'cogniate-app/cogniate.db']) {
    const oldEntries = oldLedger?.[db];
    const newEntries = newLedger?.[db];
    assert.ok(Array.isArray(oldEntries) && oldEntries.length > 0, `${label}: ${db} old ledger is a non-empty list`);
    assert.ok(Array.isArray(newEntries) && newEntries.length >= oldEntries.length, `${label}: ${db} upgraded ledger is shorter than old ledger`);
    assert.deepEqual(
      newEntries.slice(0, oldEntries.length),
      oldEntries,
      `${label}: ${db} old ledger is not a prefix of the upgraded ledger`,
    );
  }
  assert.ok(
    newLedger['cogniate-app/cogniate.db'].includes('012_connection_provider_snapshot.sql'),
    `${label}: cogniate-app/cogniate.db upgraded ledger is missing 012_connection_provider_snapshot.sql`,
  );
  if (expectedLtiLedger !== undefined) {
    assert.deepEqual(newLedger['lti-service/lti.db'], expectedLtiLedger, `${label}: lti-service/lti.db ledger does not match candidate migrations`);
  }
  if (expectedAppLedger !== undefined) {
    assert.deepEqual(newLedger['cogniate-app/cogniate.db'], expectedAppLedger, `${label}: cogniate-app/cogniate.db ledger does not match candidate migrations`);
  }
}
