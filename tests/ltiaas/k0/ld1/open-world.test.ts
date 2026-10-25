// LA-E0-04 AC-05 (strictness) and AC-06 (openness): K0 probes of the LD-1 open-world rewrite, no Docker.
// Each row calls the shared check exactly as its frozen call site does, on a recorded G-BASE answer (g-base/*.json).
// Run via Vitest: npx vitest run --config tests/ltiaas/k0/vitest.config.mts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'vitest';
import * as ltiaasOpenWorld from '../../lib/open-world.mjs';
import type { CardDescriptor } from '../../lib/open-world.mjs';

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
  checkMigrationLedgers,
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
const withChannel = (lmsProviders: Json, id = NEW.id, name = NEW.name, label = name): Json => {
  const next = copy(lmsProviders);
  next.lms.push({ lms: id, channel: id, channelName: name, label, methods: ['dynamic', 'manual'], profiles: [] });
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

/**
 * Minimal DOM tree builder so K0 probes execute the exact `page.evaluate` extractor from `tests/e2e/M2/01-cards.m2.ts`
 * without a browser or external DOM package.
 */
class MiniElement {
  tagName: string;
  attrs: Map<string, string>;
  children: MiniElement[];
  parentElement: MiniElement | null;
  _ownText: string;
  _display: string;
  _height: number;

  constructor(
    tagName: string,
    attrs: Record<string, string | null | undefined> = {},
    children: MiniElement[] = [],
    text = '',
    { display = 'block', height = 120 }: { display?: string; height?: number } = {},
  ) {
    this.tagName = tagName.toUpperCase();
    this.attrs = new Map(
      Object.entries(attrs)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)]),
    );
    this.children = [];
    this.parentElement = null;
    this._ownText = text;
    this._display = display;
    this._height = height;
    for (const child of children) this.appendChild(child);
  }
  appendChild(child: MiniElement): MiniElement {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  get textContent(): string {
    return this._ownText + this.children.map((c) => c.textContent).join('');
  }
  getAttribute(name: string): string | null {
    return this.attrs.has(name) ? (this.attrs.get(name) ?? null) : null;
  }
  hasAttribute(name: string): boolean {
    return this.attrs.has(name);
  }
  getBoundingClientRect(): { height: number; width: number; top: number; left: number; right: number; bottom: number } {
    return { height: this._height, width: 240, top: 0, left: 0, right: 240, bottom: this._height };
  }
  matches(selector: string): boolean {
    return selector.split(',').some((part) => {
      const s = part.trim();
      if (!s) return false;
      if (s === '*') return true;
      const m = /^([a-zA-Z0-9_-]+)?(?:\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\])?$/.exec(s);
      if (!m) return false;
      const [, tag, attr, val] = m;
      if (tag && this.tagName !== tag.toUpperCase()) return false;
      if (attr) {
        if (!this.hasAttribute(attr)) return false;
        if (val !== undefined && this.getAttribute(attr) !== val) return false;
      }
      return true;
    });
  }
  querySelectorAll(selector: string): MiniElement[] {
    const out: MiniElement[] = [];
    const walk = (node: MiniElement): void => {
      for (const child of node.children) {
        if (child === this && selector === 'body *') continue;
        if (selector === 'body *' || child.matches(selector)) out.push(child);
        walk(child);
      }
    };
    if (selector === 'body *' && this.tagName === 'DOCUMENT') {
      const body = this.children.find((c) => c.tagName === 'BODY');
      if (body) walk(body);
      return out;
    }
    walk(this);
    return out;
  }
  querySelector(selector: string): MiniElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

interface CardDomSpec {
  tag?: string;
  channelId: string | null;
  initials?: string;
  control?: 'connect-link' | 'manage-link' | 'disabled-connect' | 'loading';
  heading: string;
  description: string;
  notice?: string | null;
  display?: string;
  height?: number;
}

const buildCardElement = ({
  tag = 'article',
  channelId = null,
  initials = '',
  control = 'connect-link',
  heading,
  description,
  notice = null,
  display = 'block',
  height = 120,
}: CardDomSpec): MiniElement => {
  const children: MiniElement[] = [];
  if (initials) children.push(new MiniElement('span', {}, [], initials));
  if (control === 'connect-link') {
    const href = channelId ? `/integrations/${channelId}/connect` : '/integrations/connect';
    children.push(new MiniElement('a', { href, ...(channelId ? { id: `${channelId}-connect` } : {}) }, [], 'Connect'));
  } else if (control === 'manage-link') {
    const href = channelId ? `/integrations/${channelId}/con_1` : '/integrations/con_1';
    children.push(new MiniElement('a', { href, ...(channelId ? { id: `${channelId}-manage` } : {}) }, [], 'Manage'));
  } else if (control === 'disabled-connect') {
    children.push(new MiniElement('button', { disabled: 'true' }, [], 'Connect'));
  } else if (control === 'loading') {
    children.push(new MiniElement('span', {}, [], 'Loading…'));
  }
  children.push(new MiniElement('h2', {}, [], heading));
  children.push(new MiniElement('p', {}, [], description));
  if (notice) children.push(new MiniElement('p', {}, [], notice));
  const attrs: Record<string, string> = channelId !== null && channelId !== undefined ? { 'data-channel-id': channelId } : {};
  return new MiniElement(tag, attrs, children, '', { display, height });
};

const BASELINE_DOM_SPECS: CardDomSpec[] = [
  {
    channelId: null,
    initials: 'K',
    control: 'disabled-connect',
    heading: 'Kajabi',
    description: 'Publish and sell your courses directly on Kajabi with seamless content sync.',
  },
  {
    channelId: 'moodle',
    initials: '',
    control: 'connect-link',
    heading: 'Moodle',
    description: CARD_TEXTS[0],
  },
  {
    channelId: 'canvas',
    initials: 'Cv',
    control: 'connect-link',
    heading: 'Canvas',
    description: CARD_TEXTS[1],
  },
  {
    channelId: 'blackboard',
    initials: 'Bb',
    control: 'disabled-connect',
    heading: 'Blackboard',
    description: CARD_TEXTS[2],
    notice: 'Blackboard is not set up for this Cogniate service yet. Ask your Cogniate operator.',
  },
];

type EvaluateFn = (
  document: MiniElement,
  getComputedStyle: (el: MiniElement) => { display: string },
  moodleText: string,
) => CardDescriptor[];

const referenceEvaluateCards: EvaluateFn = (document, getComputedStyle, moodleText) => {
  const all = Array.from(document.querySelectorAll('body *'));
  let cell = all.find((el) => el.children.length === 0 && (el.textContent ?? '').includes(moodleText)) ?? null;
  while (cell && cell.parentElement && getComputedStyle(cell.parentElement).display !== 'grid') cell = cell.parentElement;
  if (!cell || !cell.parentElement) return [];
  return Array.from(cell.parentElement.children)
    .filter((c) => getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().height > 0)
    .map((c) => {
      const text = (c.textContent ?? '').replace(/\s+/g, ' ').trim();
      const article = c.matches('article[data-channel-id]') ? c : c.querySelector('article[data-channel-id]');
      const channel = article ? article.getAttribute('data-channel-id') : null;
      const controls = Array.from(c.querySelectorAll('a, button, [role="button"], [role="link"]')).filter((el) =>
        /^(?:Connect|Manage)$/i.test((el.textContent ?? '').replace(/\s+/g, ' ').trim()),
      );
      const hasLoadingLeaf = Array.from(c.querySelectorAll('*')).some(
        (el) => el.children.length === 0 && /^Loading(?:…|\.\.\.)$/i.test((el.textContent ?? '').replace(/\s+/g, ' ').trim()),
      );
      const loading = controls.length === 0 || hasLoadingLeaf || /^(?:[A-Za-z0-9]{1,4}\s*)?Loading(?:…|\.\.\.)/.test(text);
      return { text, channel, loading };
    });
};

const loadM2EvaluateFn = (): EvaluateFn => {
  const m2CardsPath = path.join(testsDir, 'e2e/M2/01-cards.m2.ts');
  if (!fs.existsSync(m2CardsPath)) return referenceEvaluateCards;
  const src = fs.readFileSync(m2CardsPath, 'utf8');
  const m = /page\.evaluate\(\(moodleText\)\s*=>\s*\{([\s\S]*?)\},\s*TEXT\.moodleCard\)/.exec(src);
  assert.ok(m, '01-cards.m2.ts defines page.evaluate((moodleText) => { ... }, TEXT.moodleCard)');
  return new Function('document', 'getComputedStyle', 'moodleText', m[1]) as EvaluateFn;
};

const evaluateM2Cards = loadM2EvaluateFn();

const extractDomCards = (cardSpecs: CardDomSpec[]): CardDescriptor[] => {
  const grid = new MiniElement('div', {}, cardSpecs.map(buildCardElement), '', { display: 'grid', height: 600 });
  const body = new MiniElement('body', {}, [grid], '', { display: 'block', height: 800 });
  const doc = new MiniElement('document', {}, [body], '', { display: 'block', height: 800 });
  const getComputedStyle = (el: MiniElement) => ({ display: el._display ?? 'block' });
  const res = evaluateM2Cards(doc, getComputedStyle, CARD_TEXTS[0]);
  assert.deepEqual(res, referenceEvaluateCards(doc, getComputedStyle, CARD_TEXTS[0]));
  return res;
};

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
      a.cards = [
        { channel: null, text: a.cards[0], loading: false },
        { channel: 'moodle', text: a.cards[1], loading: false },
        { channel: 'canvas', text: a.cards[2], loading: false },
        { channel: 'blackboard', text: a.cards[3], loading: false },
        {
          channel: registered ? NEW.id : 'zz-unregistered',
          text: `Connect${registered ? NEW.name : 'Sakai'}Publish Cogniate courses to ${registered ? NEW.name : 'Sakai LMS'} with LTI 1.3.`,
          loading: false,
        },
      ];
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
  const m2Path = path.join(testsDir, 'e2e/M2/lib/m2.ts');
  if (fs.existsSync(m2Path)) {
    const source = fs.readFileSync(m2Path, 'utf8');
    for (const [key, text] of [
      ['moodleCard', CARD_TEXTS[0]],
      ['canvasCard', CARD_TEXTS[1]],
      ['blackboardCard', CARD_TEXTS[2]],
    ] as const) {
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

test('row 6 G-BASE unattributed parity vs BD-A1-119 attributed branch: baseline page without data-channel-id passes with the 3 baseline cards and fails with an extra card; attributed page follows BD-A1-119', () => {
  // Branch 1: unattributed baseline page (1b17261 / G-BASE parity — no card has data-channel-id).
  const unattributedSpecsWithKajabi: CardDomSpec[] = BASELINE_DOM_SPECS.map((s) => ({ ...s, channelId: null }));
  const unattributedThreeBaselineSpecs: CardDomSpec[] = unattributedSpecsWithKajabi.slice(1);
  const unattributedThreeDom = extractDomCards(unattributedThreeBaselineSpecs);
  const unattributedFourDom = extractDomCards(unattributedSpecsWithKajabi);

  assert.ok(unattributedThreeDom.every((c) => c.channel === null));
  assert.ok(unattributedFourDom.every((c) => c.channel === null));

  // Unattributed baseline page passes with the 3 baseline cards (and with the G-BASE static Kajabi card).
  assert.deepEqual(checkCards(unattributedThreeDom, CARD_TEXTS, { names: [] }), []);
  assert.equal(checkCards(unattributedFourDom, CARD_TEXTS, { names: [] }).length, 1);

  // Unattributed baseline page fails with any extra card (whether registered in lms-providers or not).
  const extraUnattributedSpec: CardDomSpec = {
    channelId: null,
    initials: 'LTI',
    control: 'connect-link',
    heading: 'LTI 1.3',
    description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
  };
  assert.throws(
    () => checkCards(extractDomCards([...unattributedThreeBaselineSpecs, extraUnattributedSpec]), CARD_TEXTS, { names: [] }),
    assert.AssertionError,
  );
  assert.throws(
    () => checkCards(extractDomCards([...unattributedThreeBaselineSpecs, extraUnattributedSpec]), CARD_TEXTS, { names: ['lti-generic'] }),
    assert.AssertionError,
  );
  assert.throws(
    () => checkCards(extractDomCards([...unattributedSpecsWithKajabi, extraUnattributedSpec]), CARD_TEXTS, { names: [] }),
    assert.AssertionError,
  );
  assert.throws(
    () => checkCards(unattributedThreeDom, CARD_TEXTS, { names: ['lti-generic'] }),
    assert.AssertionError,
  );

  // Branch 2: attributed page (a8bbac53 / BD-A1-119 — cards carry article[data-channel-id]).
  const attributedThreeDom = extractDomCards(BASELINE_DOM_SPECS.slice(1));
  const attributedFourDom = extractDomCards(BASELINE_DOM_SPECS);
  assert.deepEqual(checkCards(attributedThreeDom, CARD_TEXTS, { names: [] }), []);
  assert.equal(checkCards(attributedFourDom, CARD_TEXTS, { names: [] }).length, 1);

  const genericDomSpec: CardDomSpec = {
    channelId: 'lti-generic',
    initials: 'LTI',
    control: 'connect-link',
    heading: 'LTI 1.3',
    description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
  };
  assert.equal(
    checkCards(extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec]), CARD_TEXTS, { names: ['lti-generic'] }).length,
    2,
  );
  assert.throws(
    () => checkCards(extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec]), CARD_TEXTS, { names: [] }),
    assert.AssertionError,
  );
});

test('row 6 BD-A1-119 DOM oracle (A-LA-E0-04-01 / B-LA-E0-04-01 / A-LA-E0-04-05 / B-LA-E0-04-03): unregistered Sakai and Campus Cloud cards fail in every state', () => {
  const providers = withChannel(
    withChannel(acceptance.lmsProviders, 'lti-generic', 'LMS', 'Other LTI 1.3 platform'),
    'campus',
    'Campus',
    'Campus LMS',
  );
  const names = extraChannelNames(providers);
  assert.deepEqual(names, ['lti-generic', 'campus']);

  const genericDomSpec: CardDomSpec = {
    channelId: 'lti-generic',
    initials: 'LTI',
    control: 'connect-link',
    heading: 'LTI 1.3',
    description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
  };
  const campusDomSpec: CardDomSpec = {
    channelId: 'campus',
    initials: 'Cp',
    control: 'disabled-connect',
    heading: 'Campus Learning',
    description: 'Publish Cogniate courses to Campus LMS with LTI 1.3.',
    notice: 'Campus is not set up for this Cogniate service yet. Ask your Cogniate operator.',
  };

  const validGrid = extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec, campusDomSpec]);
  assert.equal(checkCards(validGrid, CARD_TEXTS, { names }).length, 3);

  const unregisteredDomSpecs: CardDomSpec[] = [
    // Reviewer-A Round 1 (A-LA-E0-04-01): Sakai card mentioning "LMS" without data-channel-id or with sakai id.
    {
      channelId: null,
      initials: 'Sk',
      control: 'connect-link',
      heading: 'Sakai',
      description: 'Publish Cogniate courses to Sakai LMS with LTI 1.3.',
    },
    {
      channelId: 'sakai',
      initials: 'Sk',
      control: 'connect-link',
      heading: 'Sakai',
      description: 'Publish Cogniate courses to Sakai LMS with LTI 1.3.',
    },
    // Reviewer-B Round 1 (B-LA-E0-04-01): Sakai LMS heading without data-channel-id or with sakai id.
    {
      channelId: null,
      initials: 'Sk',
      control: 'connect-link',
      heading: 'Sakai LMS',
      description: 'Publish Cogniate courses to Sakai with LTI 1.3.',
    },
    // Reviewer-A Round 3 (A-LA-E0-04-05 item 1): disabled Sakai card with generic "LMS is not set up..." notice.
    {
      channelId: null,
      initials: 'Sk',
      control: 'disabled-connect',
      heading: 'Sakai Learning',
      description: 'Publish Cogniate courses to Sakai LMS with LTI 1.3.',
      notice: 'LMS is not set up for this Cogniate service yet. Ask your Cogniate operator.',
    },
    // Disabled Sakai card copying registered Campus notice or using display name as data-channel-id.
    {
      channelId: null,
      initials: 'Sk',
      control: 'disabled-connect',
      heading: 'Sakai Learning',
      description: 'Publish Cogniate courses to Sakai LMS with LTI 1.3.',
      notice: 'Campus is not set up for this Cogniate service yet. Ask your Cogniate operator.',
    },
    {
      channelId: 'LMS',
      initials: 'Sk',
      control: 'disabled-connect',
      heading: 'Sakai Learning',
      description: 'Publish Cogniate courses to Sakai LMS with LTI 1.3.',
      notice: 'LMS is not set up for this Cogniate service yet. Ask your Cogniate operator.',
    },
    // Reviewer-B Round 3 (B-LA-E0-04-03): unregistered disabled "Campus Cloud" lookalike card (no attribute, unknown id, or display name).
    {
      channelId: null,
      initials: 'Cc',
      control: 'disabled-connect',
      heading: 'Campus Cloud',
      description: 'Publish courses to your platform.',
      notice: 'Ask your operator to enable Campus Cloud.',
    },
    {
      channelId: 'campus-cloud',
      initials: 'Cc',
      control: 'disabled-connect',
      heading: 'Campus Cloud',
      description: 'Publish courses to your platform.',
      notice: 'Ask your operator to enable Campus Cloud.',
    },
    {
      channelId: 'Campus',
      initials: 'Cc',
      control: 'disabled-connect',
      heading: 'Campus Cloud',
      description: 'Publish courses to your platform.',
      notice: 'Ask your operator to enable Campus Cloud.',
    },
    {
      channelId: 'Campus LMS',
      initials: 'Cc',
      control: 'disabled-connect',
      heading: 'Campus Cloud',
      description: 'Publish courses to your platform.',
      notice: 'Ask your operator to enable Campus Cloud.',
    },
    // Duplicate registered data-channel-id on a second card.
    {
      channelId: 'campus',
      initials: 'Cc',
      control: 'disabled-connect',
      heading: 'Campus Cloud',
      description: 'Publish courses to your platform.',
      notice: 'Ask your operator to enable Campus Cloud.',
    },
  ];

  for (const badSpec of unregisteredDomSpecs) {
    const withBad = extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec, campusDomSpec, badSpec]);
    assert.throws(() => checkCards(withBad, CARD_TEXTS, { names }), assert.AssertionError);
  }
});

test('row 6 BD-A1-119 DOM oracle (A-LA-E0-04-05 / B-LA-E0-04-02): registered card with custom title and custom not-ready text passes', () => {
  const providers = withChannel(
    withChannel(acceptance.lmsProviders, 'lti-generic', 'LMS', 'Other LTI 1.3 platform'),
    'campus',
    'Campus',
    'Campus LMS',
  );
  const names = extraChannelNames(providers);
  assert.deepEqual(names, ['lti-generic', 'campus']);

  const genericDomSpec: CardDomSpec = {
    channelId: 'lti-generic',
    initials: 'LTI',
    control: 'connect-link',
    heading: 'LTI 1.3',
    description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
  };

  // Reviewer-A Round 3 (A-LA-E0-04-05 item 2): card.title 'Teaching Hub', custom description, custom texts.notReady.
  const customNotReadyA: CardDomSpec = {
    channelId: 'campus',
    initials: 'Th',
    control: 'disabled-connect',
    heading: 'Teaching Hub',
    description: 'Publish your courses to Campus.',
    notice: 'Campus is unavailable until your operator completes setup.',
  };
  // Reviewer-B Round 3 (B-LA-E0-04-02): card.title 'Teaching Hub', custom description, custom texts.notReady.
  const customNotReadyB: CardDomSpec = {
    channelId: 'campus',
    initials: 'Th',
    control: 'disabled-connect',
    heading: 'Teaching Hub',
    description: 'Publish courses to your platform.',
    notice: 'Ask your operator to enable Campus.',
  };
  // Ready and connected states with custom title 'Teaching Hub'.
  const customReady: CardDomSpec = {
    channelId: 'campus',
    initials: 'Th',
    control: 'connect-link',
    heading: 'Teaching Hub',
    description: 'Publish your courses to Campus.',
  };
  const customConnected: CardDomSpec = {
    channelId: 'campus',
    initials: 'Th',
    control: 'manage-link',
    heading: 'Teaching Hub',
    description: 'Publish your courses to Campus.',
  };

  for (const campusSpec of [customNotReadyA, customNotReadyB, customReady, customConnected]) {
    const domCards = extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec, campusSpec]);
    assert.equal(checkCards(domCards, CARD_TEXTS, { names }).length, 3);
  }
});

test('row 6 loading state (A-LA-E0-04-03 / BD-A1-119): delayed connections settle and pass; permanently unresolved loading fails', async () => {
  const names = extraChannelNames(withChannel(acceptance.lmsProviders, 'lti-generic', 'LMS', 'Other LTI 1.3 platform'));
  assert.deepEqual(names, ['lti-generic']);

  const loadingDomCards = extractDomCards([
    ...BASELINE_DOM_SPECS,
    {
      channelId: 'lti-generic',
      initials: 'LTI',
      control: 'loading',
      heading: 'LTI 1.3',
      description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
    },
  ]);
  const settledDomCards = extractDomCards([
    ...BASELINE_DOM_SPECS,
    {
      channelId: 'lti-generic',
      initials: 'LTI',
      control: 'connect-link',
      heading: 'LTI 1.3',
      description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
    },
  ]);

  assert.equal(loadingDomCards.at(-1)?.channel, 'lti-generic');
  assert.equal(loadingDomCards.at(-1)?.loading, true);
  assert.equal(settledDomCards.at(-1)?.channel, 'lti-generic');
  assert.equal(settledDomCards.at(-1)?.loading, false);

  // Unsettled loading cards (with or without explicit loading: true) are rejected by checkCards.
  assert.throws(() => checkCards(loadingDomCards, CARD_TEXTS, { names }), assert.AssertionError);
  assert.throws(
    () => checkCards(loadingDomCards.map(({ loading, ...rest }) => rest), CARD_TEXTS, { names }),
    assert.AssertionError,
  );

  // Delayed connections load: polling waits while loading is true, then passes once settled.
  let polls = 0;
  const readDelayed = () => {
    polls += 1;
    return polls < 3 ? loadingDomCards : settledDomCards;
  };
  const waitUntilSettled = async (readFn: () => CardDescriptor[], maxAttempts = 5): Promise<CardDescriptor[]> => {
    for (let i = 0; i < maxAttempts; i++) {
      const current = readFn();
      if (current.length > 0 && current.every((c) => !c.loading)) return current;
    }
    throw new assert.AssertionError({ message: 'LMS Publishing cards finished loading' });
  };
  const settled = await waitUntilSettled(readDelayed, 5);
  assert.equal(polls, 3);
  assert.equal(checkCards(settled, CARD_TEXTS, { names }).length, 2);

  // Permanently unresolved connections load: never settles within the poll bound and fails.
  await assert.rejects(() => waitUntilSettled(() => loadingDomCards, 5), assert.AssertionError);
});

test('row 6 BD-A1-119 DOM oracle: unknown data-channel-id and missing registered card fail', () => {
  const providers = withChannel(
    withChannel(acceptance.lmsProviders, 'lti-generic', 'LMS', 'Other LTI 1.3 platform'),
    'campus',
    'Campus',
    'Campus LMS',
  );
  const names = extraChannelNames(providers);
  assert.deepEqual(names, ['lti-generic', 'campus']);

  const genericDomSpec: CardDomSpec = {
    channelId: 'lti-generic',
    initials: 'LTI',
    control: 'connect-link',
    heading: 'LTI 1.3',
    description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
  };
  const campusDomSpec: CardDomSpec = {
    channelId: 'campus',
    initials: 'Cp',
    control: 'connect-link',
    heading: 'Campus',
    description: 'Publish Cogniate courses to Campus LMS with LTI 1.3.',
  };

  // 1. Missing registered card: campus is in GET /app-api/lms-providers, but its card is absent from the DOM.
  const missingCampusDom = extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec]);
  assert.throws(() => checkCards(missingCampusDom, CARD_TEXTS, { names }), assert.AssertionError);

  // Missing both extra registered cards when lti-generic is registered.
  const onlyBaselineDom = extractDomCards(BASELINE_DOM_SPECS);
  assert.throws(() => checkCards(onlyBaselineDom, CARD_TEXTS, { names: ['lti-generic'] }), assert.AssertionError);

  // 2. Unknown data-channel-id on a channel card fails (replacing campus or added alongside).
  for (const unknownId of ['unknown-lms', 'sakai', 'campus-cloud', 'LMS', 'Campus', '']) {
    const unknownSpec: CardDomSpec = { ...campusDomSpec, channelId: unknownId };
    const replacedDom = extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec, unknownSpec]);
    assert.throws(() => checkCards(replacedDom, CARD_TEXTS, { names }), assert.AssertionError);
    const addedDom = extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec, campusDomSpec, unknownSpec]);
    assert.throws(() => checkCards(addedDom, CARD_TEXTS, { names }), assert.AssertionError);
  }

  // 3. Static Kajabi card carrying a data-channel-id attribute fails (BD-A1-119: static cards have no attribute).
  const kajabiWithAttrSpecs = BASELINE_DOM_SPECS.map((s, i) => (i === 0 ? { ...s, channelId: 'kajabi' } : s));
  assert.throws(
    () => checkCards(extractDomCards([...kajabiWithAttrSpecs, genericDomSpec, campusDomSpec]), CARD_TEXTS, { names }),
    assert.AssertionError,
  );

  // 4. Baseline card missing data-channel-id or carrying a mismatched data-channel-id fails.
  const moodleWithoutAttrSpecs = BASELINE_DOM_SPECS.map((s, i) => (i === 1 ? { ...s, channelId: null } : s));
  assert.throws(
    () => checkCards(extractDomCards([...moodleWithoutAttrSpecs, genericDomSpec, campusDomSpec]), CARD_TEXTS, { names }),
    assert.AssertionError,
  );
  const moodleWrongAttrSpecs = BASELINE_DOM_SPECS.map((s, i) => (i === 1 ? { ...s, channelId: 'moodle-other' } : s));
  assert.throws(
    () => checkCards(extractDomCards([...moodleWrongAttrSpecs, genericDomSpec, campusDomSpec]), CARD_TEXTS, { names }),
    assert.AssertionError,
  );
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
