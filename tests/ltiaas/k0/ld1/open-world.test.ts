// LA-E0-04 AC-05 (strictness) and AC-06 (openness): K0 probes of the LD-1 open-world rewrite, no Docker.
// Each row calls the shared check exactly as its frozen call site does, on a recorded G-BASE answer (g-base/*.json).
// Run via Vitest: npx vitest run --config tests/ltiaas/k0/vitest.config.mts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'vitest';
import * as ltiaasOpenWorld from '../../lib/open-world.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const testsDir = path.resolve(here, '../../..');
const acceptanceOpenWorldPath = path.join(testsDir, 'acceptance/lib/open-world.mjs');
const ltiaasOpenWorldPath = path.resolve(here, '../../lib/open-world.mjs');

const openWorld: typeof ltiaasOpenWorld = fs.existsSync(acceptanceOpenWorldPath)
  ? ((await import(pathToFileURL(acceptanceOpenWorldPath).href)) as typeof ltiaasOpenWorld)
  : ltiaasOpenWorld;

const {
  BASELINE_PROFILES,
  BASELINE_REAL_PROFILES,
  BASELINE_SIMULATION_PROFILES,
  checkCards,
  checkLmsEntries,
  checkProfiles,
  checkSimulationProfiles,
  extraChannelNames,
  registeredChannels,
} = openWorld;

type Json = Record<string, any>;
const read = (name: string): Json => JSON.parse(fs.readFileSync(path.join(here, 'g-base', name), 'utf8')) as Json;
const copy = <T>(value: T): T => structuredClone(value);

// The three card texts of tests/e2e/M2/lib/m2.ts TEXT (checked below against that file).
const CARD_TEXTS = [
  'Export SCORM packages and sync course content with your Moodle LMS.',
  'Publish Cogniate courses to Canvas with LTI 1.3.',
  'Publish Cogniate courses to Blackboard Learn with LTI 1.3.',
];

// A new channel as LA adds it (app API delta §1-§2, LTI delta §4.7), and one that no registry knows.
const NEW = { id: 'lti-generic', name: 'LMS' };
const withChannel = (lmsProviders: Json, id = NEW.id, name = NEW.name): Json => {
  const next = copy(lmsProviders);
  next.lms.push({ lms: id, channel: id, channelName: name, label: name, methods: ['dynamic', 'manual'], profiles: [] });
  return next;
};
const newProfile = (channel: string, { id = channel, simulation = false }: { id?: string; simulation?: boolean } = {}): Json => ({
  id,
  lms: channel,
  channel,
  label: 'New',
  sharing: 'exclusive',
  issuer: null,
  authenticationEndpoint: null,
  accesstokenEndpoint: null,
  jwksUrl: null,
  siteUrlOn: null,
  serviceUrl: false,
  simulation,
  sharedPlatform: null,
});

interface ProbeRow {
  row: number;
  site: string;
  answer: Json;
  baseExtras?: number;
  call: (a: Json) => unknown[];
  change: (a: Json) => void;
  remove: (a: Json) => void;
  move: (a: Json) => void;
  extra: (a: Json, registered: boolean) => void;
}

const acceptance = read('acceptance.json');
const defaults = read('default.json');
const cards = read('cards.json');

const profileRow = (row: number, site: string, answer: Json, baseline: Json[], realOnly: boolean): ProbeRow => ({
  row,
  site,
  answer,
  call: (a) =>
    checkProfiles(a.providers.profiles, baseline, {
      registered: registeredChannels(a.lmsProviders),
      ...(realOnly ? { realOnly } : {}),
    }),
  change: (a) => {
    a.providers.profiles.find((p: Json) => p.id === 'canvas-cloud-beta').issuer = 'https://canvas.beta.example';
  },
  remove: (a) => {
    a.providers.profiles = a.providers.profiles.filter((p: Json) => p.id !== 'blackboard');
  },
  move: (a) => {
    const list: Json[] = a.providers.profiles;
    const i = list.findIndex((p) => p.id === 'standard');
    list.push(list.splice(i, 1)[0]);
  },
  extra: (a, registered) => {
    if (registered) a.lmsProviders = withChannel(a.lmsProviders);
    const at = a.providers.profiles.findIndex((p: Json) => p.simulation);
    a.providers.profiles.splice(
      at < 0 ? a.providers.profiles.length : at,
      0,
      newProfile(registered ? NEW.id : 'zz-unregistered'),
    );
  },
});

const rows: ProbeRow[] = [
  profileRow(1, 'tests/acceptance/M1/common/00-profiles.test.ts M1-01.common.constants', acceptance, BASELINE_PROFILES, false),
  {
    row: 2,
    site: 'tests/acceptance/M1/common/00-profiles.test.ts M1-01.common.constants; tests/e2e/host/run-m2.mjs stack gate',
    answer: acceptance,
    call: (a) =>
      checkSimulationProfiles(a.ltiHealth.simulation_profiles, BASELINE_SIMULATION_PROFILES, {
        profiles: a.providers.profiles,
        registered: registeredChannels(a.lmsProviders),
      }),
    change: (a) => {
      a.ltiHealth.simulation_profiles[1] = 'canvas-sim-cloud-2';
    },
    remove: (a) => {
      a.ltiHealth.simulation_profiles.shift();
    },
    move: (a) => {
      a.ltiHealth.simulation_profiles.reverse();
    },
    extra: (a, registered) => {
      const channel = registered ? NEW.id : 'zz-unregistered';
      if (registered) a.lmsProviders = withChannel(a.lmsProviders);
      a.providers.profiles.push(newProfile(channel, { id: channel + '-sim', simulation: true }));
      a.ltiHealth.simulation_profiles.push(channel + '-sim');
    },
  },
  profileRow(3, 'tests/host/run-m1.mjs defaultGate (M1-02.common.default-profile)', defaults, BASELINE_REAL_PROFILES, true),
  {
    row: 6,
    site: 'tests/e2e/M2/01-cards.m2.ts M2-01.cards',
    answer: { cards: cards.cards, lmsProviders: acceptance.lmsProviders },
    baseExtras: 1, // the G-BASE Kajabi card (BASELINE_OTHER_CARDS)
    call: (a) => checkCards(a.cards, CARD_TEXTS, { names: extraChannelNames(a.lmsProviders) }),
    change: (a) => {
      a.cards[2] = a.cards[2].replace('Canvas with LTI 1.3', 'Canvas with LTI');
    },
    remove: (a) => {
      a.cards = a.cards.filter((text: string) => !text.includes(CARD_TEXTS[2]));
    },
    move: (a) => {
      a.cards.push(a.cards.splice(1, 1)[0]);
    },
    extra: (a, registered) => {
      if (registered) a.lmsProviders = withChannel(a.lmsProviders);
      a.cards.push(`ConnectYour LMSPublish Cogniate courses to ${registered ? NEW.name : 'Sakai'} with LTI 1.3.`);
    },
  },
  {
    row: 7,
    site: 'tests/acceptance/M1/canvas/11-canvas-platforms.test.ts:255 M1-15.canvas.lms-providers',
    answer: acceptance,
    call: (a) => checkLmsEntries(a.lmsProviders.lms),
    change: (a) => {
      a.lmsProviders.lms[1].lms = 'canvaz';
    },
    remove: (a) => {
      a.lmsProviders.lms.splice(2, 1);
    },
    move: (a) => {
      a.lmsProviders.lms.reverse();
    },
    extra: (a, registered) => {
      a.lmsProviders.lms.push(
        registered
          ? { lms: NEW.id, channel: NEW.id, channelName: NEW.name }
          : { lms: 'zz-unregistered', label: 'Sakai' },
      );
    },
  },
  profileRow(8, 'tests/acceptance/M1/common/90-simulation-gates.test.ts M1-35.common.<profile>-<simulation>', defaults, BASELINE_REAL_PROFILES, true),
];

test('the probe card texts equal tests/e2e/M2/lib/m2.ts TEXT, and open-world copies match when present', () => {
  const source = fs.readFileSync(path.join(testsDir, 'e2e/M2/lib/m2.ts'), 'utf8');
  for (const [key, text] of [
    ['moodleCard', CARD_TEXTS[0]],
    ['canvasCard', CARD_TEXTS[1]],
    ['blackboardCard', CARD_TEXTS[2]],
  ] as const) {
    assert.ok(source.includes(`${key}: ${JSON.stringify(text).replaceAll('"', "'")}`), key);
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
  for (const kind of ['change', 'remove', 'move'] as const) {
    test(`row ${r.row} strictness (AC-05): one baseline element ${kind}d fails`, () => {
      const answer = copy(r.answer);
      r[kind](answer);
      assert.throws(() => r.call(answer), assert.AssertionError);
    });
  }
  test(`row ${r.row} openness (AC-06): one extra element of a registered channel passes`, () => {
    const answer = copy(r.answer);
    r.extra(answer, true);
    assert.equal(r.call(answer).length, baseExtras + 1);
  });
  test(`row ${r.row} openness (AC-06): one extra element of an unregistered channel fails`, () => {
    const answer = copy(r.answer);
    r.extra(answer, false);
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
  answer.providers.profiles.push({
    ...BASELINE_PROFILES.find((p) => p.id === 'canvas-sim-cloud'),
    label: 'x',
    sharedPlatform: null,
  });
  assert.throws(
    () =>
      checkProfiles(answer.providers.profiles, BASELINE_REAL_PROFILES, {
        registered: registeredChannels(answer.lmsProviders),
        realOnly: true,
      }),
    assert.AssertionError,
  );
});

test('row 6: the G-BASE Kajabi card is allowed, but not twice', () => {
  const answer = copy(cards.cards);
  assert.deepEqual(checkCards(answer.filter((t: string) => !t.includes('Kajabi')), CARD_TEXTS, { names: [] }), []);
  answer.push(answer[0]);
  assert.throws(() => checkCards(answer, CARD_TEXTS, { names: [] }), assert.AssertionError);
});
