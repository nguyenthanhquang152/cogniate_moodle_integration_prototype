// LA-E0-04 AC-05 (strictness) and AC-06 (openness): K0 probes of the LD-1 open-world rewrite, no Docker.
// Each row calls the shared check exactly as its frozen call site does, on a recorded G-BASE answer (g-base/*.json).
// Run: node --test tests/ltiaas/k0/ld1/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const testsDir = path.resolve(here, '../../..');
const acceptanceOpenWorldPath = path.join(testsDir, 'acceptance/lib/open-world.mjs');
const ltiaasOpenWorldPath = path.resolve(here, '../../lib/open-world.mjs');
const {
  BASELINE_PROFILES, BASELINE_REAL_PROFILES, BASELINE_SIMULATION_PROFILES, checkCards, checkLmsEntries,
  checkMigrationLedgers, checkProfiles, checkSimulationProfiles, extraChannelNames, registeredChannels,
} = await import(pathToFileURL(fs.existsSync(acceptanceOpenWorldPath) ? acceptanceOpenWorldPath : ltiaasOpenWorldPath).href);
const read = (name) => JSON.parse(fs.readFileSync(path.join(here, 'g-base', name), 'utf8'));
const copy = (value) => structuredClone(value);

// The three card texts of tests/e2e/M2/lib/m2.ts TEXT (checked below against that file).
const CARD_TEXTS = [
  'Export SCORM packages and sync course content with your Moodle LMS.',
  'Publish Cogniate courses to Canvas with LTI 1.3.',
  'Publish Cogniate courses to Blackboard Learn with LTI 1.3.',
];

// A new channel as LA adds it (app API delta §1-§2, LTI delta §4.7), and one that no registry knows.
const NEW = { id: 'lti-generic', name: 'LMS' };
const withChannel = (lmsProviders, id = NEW.id, name = NEW.name, label = name) => {
  const next = copy(lmsProviders);
  next.lms.push({ lms: id, channel: id, channelName: name, label, methods: ['dynamic', 'manual'], profiles: [] });
  return next;
};
const newProfile = (channel, { id = channel, simulation = false } = {}) => ({ id, lms: channel, channel, label: 'New',
  sharing: 'exclusive', issuer: null, authenticationEndpoint: null, accesstokenEndpoint: null, jwksUrl: null,
  siteUrlOn: null, serviceUrl: false, simulation, sharedPlatform: null });

/**
 * One entry per rewritten assertion (TEST-STRATEGY §4.3). `answer` is the recorded answer; `call(answer)` runs the
 * check like the call site; `change`, `remove`, `move` make one baseline element changed, removed or out of its
 * relative order; `extra(answer, registered)` adds one extra element of a registered (true) or unregistered channel.
 */
const acceptance = read('acceptance.json'), defaults = read('default.json'), cards = read('cards.json');
const profileRow = (row, site, answer, baseline, realOnly) => ({
  row, site, answer,
  call: (a) => checkProfiles(a.providers.profiles, baseline, { registered: registeredChannels(a.lmsProviders), ...(realOnly ? { realOnly } : {}) }),
  change: (a) => { a.providers.profiles.find((p) => p.id === 'canvas-cloud-beta').issuer = 'https://canvas.beta.example'; },
  remove: (a) => { a.providers.profiles = a.providers.profiles.filter((p) => p.id !== 'blackboard'); },
  move: (a) => { const list = a.providers.profiles; const i = list.findIndex((p) => p.id === 'standard'); list.push(list.splice(i, 1)[0]); },
  extra: (a, registered) => {
    if (registered) a.lmsProviders = withChannel(a.lmsProviders);
    const at = a.providers.profiles.findIndex((p) => p.simulation);
    a.providers.profiles.splice(at < 0 ? a.providers.profiles.length : at, 0, newProfile(registered ? NEW.id : 'zz-unregistered'));
  },
});
const rows = [
  profileRow(1, 'tests/acceptance/M1/common/00-profiles.test.ts M1-01.common.constants', acceptance, BASELINE_PROFILES, false),
  {
    row: 2, site: 'tests/acceptance/M1/common/00-profiles.test.ts M1-01.common.constants; tests/e2e/host/run-m2.mjs stack gate', answer: acceptance,
    call: (a) => checkSimulationProfiles(a.ltiHealth.simulation_profiles, BASELINE_SIMULATION_PROFILES,
      { profiles: a.providers.profiles, registered: registeredChannels(a.lmsProviders) }),
    change: (a) => { a.ltiHealth.simulation_profiles[1] = 'canvas-sim-cloud-2'; },
    remove: (a) => { a.ltiHealth.simulation_profiles.shift(); },
    move: (a) => { a.ltiHealth.simulation_profiles.reverse(); },
    extra: (a, registered) => {
      const channel = registered ? NEW.id : 'zz-unregistered';
      if (registered) a.lmsProviders = withChannel(a.lmsProviders);
      a.providers.profiles.push(newProfile(channel, { id: channel + '-sim', simulation: true }));
      a.ltiHealth.simulation_profiles.push(channel + '-sim');
    },
  },
  profileRow(3, 'tests/host/run-m1.mjs defaultGate (M1-02.common.default-profile)', defaults, BASELINE_REAL_PROFILES, true),
  {
    row: 6, site: 'tests/e2e/M2/01-cards.m2.ts M2-01.cards', answer: { cards: cards.cards, lmsProviders: acceptance.lmsProviders },
    baseExtras: 1, // the G-BASE Kajabi card (BASELINE_OTHER_CARDS)
    call: (a) => checkCards(a.cards, CARD_TEXTS, { names: extraChannelNames(a.lmsProviders) }),
    change: (a) => { a.cards[2] = a.cards[2].replace('Canvas with LTI 1.3', 'Canvas with LTI'); },
    remove: (a) => { a.cards = a.cards.filter((text) => !text.includes(CARD_TEXTS[2])); },
    move: (a) => { a.cards.push(a.cards.splice(1, 1)[0]); },
    extra: (a, registered) => {
      if (registered) a.lmsProviders = withChannel(a.lmsProviders);
      a.cards.push(`Connect${registered ? NEW.name : 'Sakai'}Publish Cogniate courses to ${registered ? NEW.name : 'Sakai LMS'} with LTI 1.3.`);
    },
  },
  {
    row: 7, site: 'tests/acceptance/M1/canvas/11-canvas-platforms.test.ts:255 M1-15.canvas.lms-providers', answer: acceptance,
    call: (a) => checkLmsEntries(a.lmsProviders.lms),
    change: (a) => { a.lmsProviders.lms[1].lms = 'canvaz'; },
    remove: (a) => { a.lmsProviders.lms.splice(2, 1); },
    move: (a) => { a.lmsProviders.lms.reverse(); },
    extra: (a, registered) => {
      a.lmsProviders.lms.push(registered ? { lms: NEW.id, channel: NEW.id, channelName: NEW.name } : { lms: 'zz-unregistered', label: 'Sakai' });
    },
  },
  profileRow(8, 'tests/acceptance/M1/common/90-simulation-gates.test.ts M1-35.common.<profile>-<simulation>', defaults, BASELINE_REAL_PROFILES, true),
];

test('the probe card texts equal tests/e2e/M2/lib/m2.ts TEXT, and open-world copies match when present', () => {
  const m2Path = path.join(testsDir, 'e2e/M2/lib/m2.ts');
  if (fs.existsSync(m2Path)) {
    const source = fs.readFileSync(m2Path, 'utf8');
    for (const [key, text] of [['moodleCard', CARD_TEXTS[0]], ['canvasCard', CARD_TEXTS[1]], ['blackboardCard', CARD_TEXTS[2]]]) {
      assert.ok(source.includes(`${key}: ${JSON.stringify(text).replaceAll('"', "'")}`), key);
    }
  }
  if (fs.existsSync(acceptanceOpenWorldPath)) {
    assert.equal(
      fs.readFileSync(acceptanceOpenWorldPath, 'utf8'),
      fs.readFileSync(ltiaasOpenWorldPath, 'utf8'),
      'tests/acceptance/lib/open-world.mjs and tests/ltiaas/lib/open-world.mjs are identical',
    );
  }
});

for (const r of rows) {
  const baseExtras = r.baseExtras ?? 0;
  test(`row ${r.row} control: the recorded G-BASE answer passes (${r.site})`, () => {
    assert.equal(r.call(copy(r.answer)).length, baseExtras);
  });
  for (const kind of ['change', 'remove', 'move']) {
    test(`row ${r.row} strictness (AC-05): one baseline element ${kind}d fails`, () => {
      const answer = copy(r.answer); r[kind](answer);
      assert.throws(() => r.call(answer), assert.AssertionError);
    });
  }
  test(`row ${r.row} openness (AC-06): one extra element of a registered channel passes`, () => {
    const answer = copy(r.answer); r.extra(answer, true);
    assert.equal(r.call(answer).length, baseExtras + 1);
  });
  test(`row ${r.row} openness (AC-06): one extra element of an unregistered channel fails`, () => {
    const answer = copy(r.answer); r.extra(answer, false);
    assert.throws(() => r.call(answer), assert.AssertionError);
  });
}

test('rows 1, 3, 7, 8: additive fields (LA-IC-01) on the baseline elements pass', () => {
  for (const r of rows.filter((x) => [1, 3, 8].includes(x.row))) {
    const answer = copy(r.answer);
    for (const p of answer.providers.profiles) Object.assign(p, { channel: p.lms ?? 'moodle', endpoints: 'fixed' });
    assert.deepEqual(r.call(answer), [], `row ${r.row}`);
  }
  const answer = copy(acceptance);
  for (const e of answer.lmsProviders.lms) Object.assign(e, { channel: e.lms, channelName: e.label, family: 'lti13' });
  assert.deepEqual(checkLmsEntries(answer.lmsProviders.lms), []);
});

test('rows 3 and 8: a simulation profile in the default profile fails', () => {
  const answer = copy(defaults);
  answer.providers.profiles.push({ ...BASELINE_PROFILES.find((p) => p.id === 'canvas-sim-cloud'), label: 'x', sharedPlatform: null });
  assert.throws(() => checkProfiles(answer.providers.profiles, BASELINE_REAL_PROFILES,
    { registered: registeredChannels(answer.lmsProviders), realOnly: true }), assert.AssertionError);
});

test('row 6: the G-BASE Kajabi card is allowed, but not twice', () => {
  const answer = copy(cards.cards);
  assert.deepEqual(checkCards(answer.filter((t) => !t.includes('Kajabi')), CARD_TEXTS, { names: [] }), []);
  answer.push(answer[0]);
  assert.throws(() => checkCards(answer, CARD_TEXTS, { names: [] }), assert.AssertionError);
});

test('row 6 exact membership (A-LA-E0-04-01 / B-LA-E0-04-01): mixed registered and unregistered cards with lti-generic (channelName: LMS)', () => {
  const names = extraChannelNames(withChannel(acceptance.lmsProviders));
  assert.deepEqual(names, ['lti-generic', 'LMS']);
  const registeredStringCard = 'ConnectLMSPublish Cogniate courses to LMS with LTI 1.3.';
  const registeredDomCard = {
    text: 'LTI Connect LTI 1.3 Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
    channel: 'lti-generic',
    name: 'LTI 1.3',
  };
  assert.equal(checkCards([...cards.cards, registeredStringCard], CARD_TEXTS, { names }).length, 2);
  assert.equal(checkCards([...cards.cards, registeredDomCard], CARD_TEXTS, { names }).length, 2);

  const unregisteredCards = [
    'Connect Sakai Publish Cogniate courses to Sakai LMS with LTI 1.3.',
    'ConnectSakai LMSPublish Cogniate courses to Sakai with LTI 1.3.',
    'ConnectYour LMSPublish Cogniate courses to Sakai with LTI 1.3.',
    { text: registeredStringCard, channel: 'sakai', name: 'LMS' },
    { text: 'Connect Sakai Publish Cogniate courses to Sakai LMS with LTI 1.3.', channel: null, name: 'Sakai LMS' },
  ];
  for (const bad of unregisteredCards) {
    assert.throws(() => checkCards([...cards.cards, bad], CARD_TEXTS, { names }), assert.AssertionError);
    assert.throws(() => checkCards([...cards.cards, registeredDomCard, bad], CARD_TEXTS, { names }), assert.AssertionError);
  }
});

test('row 6 loading state (A-LA-E0-04-03): delayed connections settle and pass; permanently unresolved loading fails', async () => {
  const names = extraChannelNames(withChannel(acceptance.lmsProviders, 'lti-generic', 'LMS', 'Other LTI 1.3 platform'));
  const loadingGenericCard = {
    text: 'Loading…LTI 1.3Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
    channel: null,
    name: 'LTI 1.3',
    loading: true,
  };
  const loadingGenericCardWithoutFlag = {
    text: 'Loading…LTI 1.3Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
    channel: null,
    name: 'LTI 1.3',
  };
  const settledGenericCard = {
    text: 'LTIConnectLTI 1.3Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
    channel: 'lti-generic',
    name: 'LTI 1.3',
    disabled: false,
    loading: false,
  };

  // Unsettled loading cards (with or without explicit loading: true) are rejected by checkCards.
  assert.throws(() => checkCards([...cards.cards, loadingGenericCard], CARD_TEXTS, { names }), assert.AssertionError);
  assert.throws(() => checkCards([...cards.cards, loadingGenericCardWithoutFlag], CARD_TEXTS, { names }), assert.AssertionError);
  assert.throws(() => checkCards([...cards.cards, loadingGenericCard.text], CARD_TEXTS, { names }), assert.AssertionError);

  // Delayed connections load: polling waits while loading is true, then passes once settled.
  let polls = 0;
  const readDelayed = () => {
    polls += 1;
    return [...cards.cards, polls < 3 ? loadingGenericCard : settledGenericCard];
  };
  const waitUntilSettled = async (readFn, maxAttempts = 5) => {
    for (let i = 0; i < maxAttempts; i++) {
      const current = readFn();
      if (current.length > 0 && current.every((c) => !(typeof c === 'object' && c?.loading))) return current;
    }
    throw new assert.AssertionError({ message: 'LMS Publishing cards finished loading' });
  };
  const settled = await waitUntilSettled(readDelayed, 5);
  assert.equal(polls, 3);
  assert.equal(checkCards(settled, CARD_TEXTS, { names }).length, 2);

  // Permanently unresolved connections load: never settles within the poll bound and fails.
  await assert.rejects(() => waitUntilSettled(() => [...cards.cards, loadingGenericCard], 5), assert.AssertionError);
});

test('row 6 not-ready disabled card with distinct display title (B-LA-E0-04-02): registered passes, unregistered fails', () => {
  const providersWithCampus = withChannel(
    withChannel(acceptance.lmsProviders, 'lti-generic', 'LMS', 'Other LTI 1.3 platform'),
    'campus',
    'Campus',
    'Campus LMS',
  );
  const names = extraChannelNames(providersWithCampus);
  assert.deepEqual(names, ['lti-generic', 'LMS', 'Other LTI 1.3 platform', 'campus', 'Campus', 'Campus LMS']);

  // Ready branch (enabled Connect link) for campus with distinct title 'Campus Learning'.
  const campusReadyCard = {
    text: 'CpConnectCampus LearningPublish Cogniate courses to Campus LMS with LTI 1.3.',
    channel: 'campus',
    name: 'Campus Learning',
    disabled: false,
    loading: false,
  };
  // Disabled-control not-ready branch (no Connect href/id; renders disabled button and not-ready notice).
  const campusNotReadyExtracted = {
    text: 'CpConnectCampus LearningPublish Cogniate courses to Campus LMS with LTI 1.3.Campus is not set up for this Cogniate service yet. Ask your Cogniate operator.',
    channel: 'Campus',
    name: 'Campus Learning',
    disabled: true,
    loading: false,
    notReadyLms: 'Campus',
  };
  const campusNotReadyNullChannel = {
    text: 'CpConnectCampus LearningPublish Cogniate courses to Campus LMS with LTI 1.3.Campus is not set up for this Cogniate service yet. Ask your Cogniate operator.',
    channel: null,
    name: 'Campus Learning',
    disabled: true,
    loading: false,
  };
  const campusNotReadyMinimalDomStub = {
    text: 'CpConnectCampus LearningPublish courses to your campus platform.',
    channel: null,
    name: 'Campus Learning',
    disabled: true,
    loading: false,
  };
  const genericNotReadyNullChannel = {
    text: 'LTIConnectLTI 1.3Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.LMS is not set up for this Cogniate service yet. Ask your Cogniate operator.',
    channel: null,
    name: 'LTI 1.3',
    disabled: true,
    loading: false,
  };

  for (const good of [
    campusReadyCard,
    campusNotReadyExtracted,
    campusNotReadyNullChannel,
    campusNotReadyMinimalDomStub,
    genericNotReadyNullChannel,
  ]) {
    assert.equal(checkCards([...cards.cards, good], CARD_TEXTS, { names }).length, 2);
  }

  // Unregistered cards in the same disabled-control not-ready state must fail.
  const unregisteredNotReadyCards = [
    {
      text: 'SkConnectSakai LearningPublish Cogniate courses to Sakai LMS with LTI 1.3.Sakai is not set up for this Cogniate service yet. Ask your Cogniate operator.',
      channel: 'Sakai',
      name: 'Sakai Learning',
      disabled: true,
      loading: false,
      notReadyLms: 'Sakai',
    },
    {
      text: 'SkConnectSakai LearningPublish Cogniate courses to Sakai LMS with LTI 1.3.Sakai is not set up for this Cogniate service yet. Ask your Cogniate operator.',
      channel: null,
      name: 'Sakai Learning',
      disabled: true,
      loading: false,
    },
    {
      text: 'SkConnectSakai LearningPublish courses to your sakai platform.',
      channel: null,
      name: 'Sakai Learning',
      disabled: true,
      loading: false,
    },
    {
      text: 'SkConnectSakai LMSPublish Cogniate courses to Sakai LMS with LTI 1.3.',
      channel: null,
      name: 'Sakai LMS',
      disabled: true,
      loading: false,
    },
  ];
  for (const bad of unregisteredNotReadyCards) {
    assert.throws(() => checkCards([...cards.cards, bad], CARD_TEXTS, { names }), assert.AssertionError);
    assert.throws(() => checkCards([...cards.cards, campusNotReadyNullChannel, bad], CARD_TEXTS, { names }), assert.AssertionError);
  }
});

test('M1-41.common.j-snapshot migration ledger (A-LA-E0-04-02 / LD-24): old ledger is a prefix of upgraded ledger and matches candidate migrations', () => {
  const oldLedger = {
    'lti-service/lti.db': ['001_init.sql', '005_lti_grants.sql'],
    'cogniate-app/cogniate.db': ['001_init.sql', '011_lms_types.sql'],
  };
  const expectedLtiLedger = ['001_init.sql', '005_lti_grants.sql', '006_lti_provider_selection.sql', '007_lti_channel_columns.sql'];
  const expectedAppLedger = [
    '001_init.sql',
    '011_lms_types.sql',
    '012_connection_provider_snapshot.sql',
    '013_connection_channel_columns.sql',
  ];
  const newLedger = {
    'lti-service/lti.db': [...expectedLtiLedger],
    'cogniate-app/cogniate.db': [...expectedAppLedger],
  };
  checkMigrationLedgers(oldLedger, newLedger, { expectedLtiLedger, expectedAppLedger });

  // Missing historical entry in lti.db or cogniate.db fails even if also removed from expected*Ledger.
  const droppedLti = expectedLtiLedger.slice(1);
  assert.throws(
    () =>
      checkMigrationLedgers(
        oldLedger,
        { 'lti-service/lti.db': droppedLti, 'cogniate-app/cogniate.db': expectedAppLedger },
        { expectedLtiLedger: droppedLti, expectedAppLedger },
      ),
    assert.AssertionError,
  );
  const droppedApp = expectedAppLedger.filter((m) => m !== '011_lms_types.sql');
  assert.throws(
    () =>
      checkMigrationLedgers(
        oldLedger,
        { 'lti-service/lti.db': expectedLtiLedger, 'cogniate-app/cogniate.db': droppedApp },
        { expectedLtiLedger, expectedAppLedger: droppedApp },
      ),
    assert.AssertionError,
  );

  // Reordered historical prefix fails even if expected*Ledger matches newLedger.
  const reorderedLti = ['005_lti_grants.sql', '001_init.sql', '006_lti_provider_selection.sql', '007_lti_channel_columns.sql'];
  assert.throws(
    () =>
      checkMigrationLedgers(
        oldLedger,
        { 'lti-service/lti.db': reorderedLti, 'cogniate-app/cogniate.db': expectedAppLedger },
        { expectedLtiLedger: reorderedLti, expectedAppLedger },
      ),
    assert.AssertionError,
  );

  // Unapplied candidate migration file fails exact comparison.
  assert.throws(
    () =>
      checkMigrationLedgers(
        oldLedger,
        { 'lti-service/lti.db': expectedLtiLedger.slice(0, -1), 'cogniate-app/cogniate.db': expectedAppLedger },
        { expectedLtiLedger, expectedAppLedger },
      ),
    assert.AssertionError,
  );
});
