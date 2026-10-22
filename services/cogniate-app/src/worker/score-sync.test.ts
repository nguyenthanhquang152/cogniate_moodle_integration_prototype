import { TEST_CHANNELS } from '../testkit.ts';
// B-M1-01 (app contract §4.7.2): the worker reads the connection state at each send decision, not from the due-row
// batch. Two interleavings: a suspend commits while an EARLIER row of the batch waits for its POST, and a suspend
// commits while THIS row waits for its line item lookup. The "operator" writes through a second database connection,
// like the app:binding CLI process. Moodle rows and the grade and retry policy do not change.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LogLine } from '@cogniate/shared';
import { createLogger, encrypt } from '@cogniate/shared';
import { afterEach, describe, expect, it } from 'vitest';
import type { LtiClient } from '../clients/lti-client.ts';
import { LtiServiceError } from '../clients/lti-client.ts';
import type { LmsType } from '../providers/types.ts';
import { createConnection, disableConnection } from '../domain/connections.ts';
import type { Db } from '../domain/db.ts';
import { openDb } from '../domain/db.ts';
import { publicationResults } from '../domain/results.ts';
import { beginSend } from '../domain/score-syncs.ts';
import { NO_GRADEBOOK_COLUMN, createScoreSyncWorker } from './score-sync.ts';

const MASTER = Buffer.alloc(32, 5);
const NOW = 1_000_000;
const LIB = 'lib_worker';

let dir: string | null = null;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

/** The worker's database and a second connection to the same file (the operator CLI process). */
function setup() {
  dir = mkdtempSync(join(tmpdir(), 'cg-score-sync-'));
  const file = join(dir, 'cogniate.db');
  const db = openDb(file);
  const operator = openDb(file);
  db.prepare('INSERT INTO library (id, name, created_at) VALUES (?, ?, 0)').run(LIB, 'Library');
  db.prepare("INSERT INTO course (id, library_id, title, summary, variant, lang, created_at) VALUES ('crs_w', ?, 'C', '', 'default', 'en', 0)").run(LIB);
  db.prepare("INSERT INTO package (id, library_id, sha256, total_bytes, file_count, storage_path, created_at) VALUES ('pkg_w', ?, 'x', 1, 1, 'p', 0)").run(LIB);
  db.prepare("INSERT INTO course_version (id, course_id, version, format, package_id, validation_report, tracking_profile, created_at) VALUES ('ver_w', 'crs_w', 1, 'html', 'pkg_w', '{}', '{}', 0)").run();
  return { db, operator };
}

function connection(db: Db, lms: LmsType, name: string): string {
  const c = lms === 'moodle'
    ? createConnection(db, LIB, { channel: 'moodle', name, siteUrl: 'https://moodle.test', method: 'manual' }, null, 0, TEST_CHANNELS, 'exclusive')
    : lms === 'canvas'
      ? createConnection(db, LIB, { name, siteUrl: 'https://school-a.canvas.sim.test', method: 'manual', channel: lms, profile: 'canvas-sim-cloud' }, null, 0, TEST_CHANNELS, 'exclusive')
      : createConnection(db, LIB, { name, siteUrl: 'https://learn-a.blackboard.sim.test', method: 'manual', channel: lms, profile: 'blackboard-sim' }, null, 0, TEST_CHANNELS, 'exclusive');
  db.prepare("UPDATE connection SET status = 'registered' WHERE id = ?").run(c.id);
  db.prepare("INSERT INTO publication (id, connection_id, course_id, current_version_id, status, created_at, updated_at) VALUES (?, ?, 'crs_w', 'ver_w', 'available', 0, 0)").run(`pub_${name}`, c.id);
  return c.id;
}

/** One due pending row (with tries) on its own resource link; `lineItem` null makes the worker look it up. */
function dueRow(db: Db, con: string, n: number, opts: { lineItem: string | null; tries?: number; nextTryAt?: number }): string {
  const pub = String(db.prepare('SELECT id FROM publication WHERE connection_id = ?').get(con)!.id);
  db.prepare(`INSERT INTO resource_link (id, connection_id, publication_id, deployment_id, context_id, resource_link_id, context_title, title, created_at, updated_at,
      line_item_id, service_key_encrypted) VALUES (?, ?, ?, 'dA', 'c', ?, 'C', 'T', 0, 0, ?, ?)`)
    .run(`rl_${n}`, con, pub, `r${n}`, opts.lineItem, encrypt(MASTER, 'service-key'));
  db.prepare("INSERT INTO attempt (id, resource_link_id, user_sub, course_version_id, preview, outcome, score_given, score_maximum, created_at, updated_at) VALUES (?, ?, 'u', 'ver_w', 0, 'completed', 7, 10, 0, 0)")
    .run(`att_${n}`, `rl_${n}`);
  db.prepare("INSERT INTO score_sync (id, attempt_id, resource_link_id, user_sub, payload, score_given, score_maximum, status, tries, created_at, next_try_at, updated_at) VALUES (?, ?, ?, 'u', '{}', 7, 10, 'pending', ?, ?, ?, 0)")
    .run(`sync_${n}`, `att_${n}`, `rl_${n}`, opts.tries ?? 0, NOW - 1000, opts.nextTryAt ?? NOW - 1000);
  return `sync_${n}`;
}

const row = (db: Db, id: string) => db.prepare('SELECT status, tries, last_error, send_started_at FROM score_sync WHERE id = ?').get(id);

/** A fake LTI client: the given hooks run inside the awaited calls (the suspend interleaves there). */
function fakeLti(hooks: { onPost?: (line: string) => void; onLookup?: () => Array<{ id: string }> }) {
  const posts: string[] = [];
  const lookups: string[] = [];
  const client = {
    postScore: async (_key: string, line: string) => {
      await Promise.resolve();
      posts.push(line);
      hooks.onPost?.(line);
    },
    findLineItems: async (_key: string, resourceLinkId: string) => {
      await Promise.resolve();
      lookups.push(resourceLinkId);
      return hooks.onLookup?.() ?? [];
    },
  } as unknown as LtiClient;
  return { client, posts, lookups };
}

function worker(db: Db, lti: LtiClient) {
  const lines: LogLine[] = [];
  const w = createScoreSyncWorker({ channels: TEST_CHANNELS, db, lti, logger: createLogger({ service: 'cogniate-app', write: (l) => lines.push(JSON.parse(l) as LogLine) }), masterKey: MASTER, now: () => NOW });
  return { w, lines };
}

describe('score sync worker: connection state per send (B-M1-01, app contract §4.7.2)', () => {
  it('a suspend during an EARLIER row\'s POST: that POST counts (sent, tries 1); the next batch row gets no POST and fails CONNECTION_DISABLED, tries unchanged', async () => {
    const { db, operator } = setup();
    const bb = connection(db, 'blackboard', 'bb');
    const first = dueRow(db, bb, 1, { lineItem: 'line1' });
    const second = dueRow(db, bb, 2, { lineItem: 'line2', tries: 3 });
    const lti = fakeLti({ onPost: (line) => { if (line === 'line1') disableConnection(operator, LIB, bb, NOW); } });
    const { w, lines } = worker(db, lti.client);
    await w.kick();
    expect(lti.posts).toEqual(['line1']);
    // The POST that began before the suspend is not undone: its real answer is recorded.
    expect(row(db, first)).toEqual({ status: 'sent', tries: 1, last_error: null, send_started_at: null });
    expect(row(db, second)).toEqual({ status: 'failed', tries: 3, last_error: 'CONNECTION_DISABLED', send_started_at: null });
    expect(lines.filter((l) => l.event === 'score_sync').map((l) => [l.sync_id, l.status, l.tries, l.phase])).toEqual([
      [first, 'sent', 1, 'send'], [second, 'failed', 3, 'send'],
    ]);
  });

  it('a suspend during THIS row\'s line item lookup: no POST; failed CONNECTION_DISABLED, tries unchanged', async () => {
    const { db, operator } = setup();
    const bb = connection(db, 'blackboard', 'bb');
    const sync = dueRow(db, bb, 1, { lineItem: null, tries: 2 });
    const lti = fakeLti({ onLookup: () => { disableConnection(operator, LIB, bb, NOW); return [{ id: 'looked-up-line' }]; } });
    await worker(db, lti.client).w.kick();
    expect(lti.lookups).toEqual(['r1']);
    expect(lti.posts).toEqual([]);
    expect(row(db, sync)).toEqual({ status: 'failed', tries: 2, last_error: 'CONNECTION_DISABLED', send_started_at: null });
  });

  it.each([
    ['the lookup fails (the fence-out switched the deployment off)', () => { throw new LtiServiceError(403, 'DEPLOYMENT_NOT_ACTIVE', 'The deployment is not active.'); }],
    ['the lookup finds no line item', () => []],
  ])('a suspend during the lookup and %s: CONNECTION_DISABLED wins, tries unchanged', async (_label, answer) => {
    const { db, operator } = setup();
    const canvas = connection(db, 'canvas', 'cv');
    const sync = dueRow(db, canvas, 1, { lineItem: null, tries: 1 });
    const lti = fakeLti({ onLookup: () => { disableConnection(operator, LIB, canvas, NOW); return answer(); } });
    await worker(db, lti.client).w.kick();
    expect(lti.posts).toEqual([]);
    expect(row(db, sync)).toEqual({ status: 'failed', tries: 1, last_error: 'CONNECTION_DISABLED', send_started_at: null });
  });

  it.each([
    ['no line item', () => [], NO_GRADEBOOK_COLUMN],
    ['a 403 lookup', () => { throw new LtiServiceError(403, 'DEPLOYMENT_NOT_ACTIVE', 'The deployment is not active.'); }, '403 DEPLOYMENT_NOT_ACTIVE: The deployment is not active.'],
  ])('the same lookup outcome (%s) on an ACTIVE connection keeps the grade policy', async (_label, answer, lastError) => {
    const { db } = setup();
    const bb = connection(db, 'blackboard', 'bb');
    const sync = dueRow(db, bb, 1, { lineItem: null });
    const lti = fakeLti({ onLookup: answer });
    await worker(db, lti.client).w.kick();
    expect(lti.posts).toEqual([]);
    expect(row(db, sync)).toEqual({ status: 'failed', tries: 0, last_error: lastError, send_started_at: null });
  });

  it('Moodle is unchanged: a disabled Moodle connection is not this rule, so its rows still get their POST', async () => {
    const { db, operator } = setup();
    const moodle = connection(db, 'moodle', 'md');
    const first = dueRow(db, moodle, 1, { lineItem: 'line1' });
    const second = dueRow(db, moodle, 2, { lineItem: 'line2' });
    const lti = fakeLti({ onPost: (line) => { if (line === 'line1') disableConnection(operator, LIB, moodle, NOW); } });
    await worker(db, lti.client).w.kick();
    expect(lti.posts).toEqual(['line1', 'line2']);
    expect([row(db, first)?.status, row(db, second)?.status]).toEqual(['sent', 'sent']);
  });

  it('pending until due: a row of a disabled connection that is not due yet does not change', async () => {
    const { db } = setup();
    const bb = connection(db, 'blackboard', 'bb');
    const later = dueRow(db, bb, 1, { lineItem: 'line1', tries: 1, nextTryAt: NOW + 30_000 });
    disableConnection(db, LIB, bb, NOW);
    const lti = fakeLti({});
    await worker(db, lti.client).w.kick();
    expect(lti.posts).toEqual([]);
    expect(row(db, later)).toEqual({ status: 'pending', tries: 1, last_error: null, send_started_at: null });
  });

  it('beginSend decides with the connection state at that moment (one transaction)', () => {
    const { db, operator } = setup();
    const bb = connection(db, 'blackboard', 'bb');
    const a = dueRow(db, bb, 1, { lineItem: 'line1', tries: 4 });
    const b = dueRow(db, bb, 2, { lineItem: 'line2', tries: 4 });
    expect(beginSend(db, a, NOW)).toBe('started');
    expect(row(db, a)).toEqual({ status: 'pending', tries: 5, last_error: null, send_started_at: NOW });
    expect(beginSend(db, a, NOW)).toBe('skipped'); // a send is already in progress
    disableConnection(operator, LIB, bb, NOW);
    expect(beginSend(db, b, NOW)).toBe('connection_disabled');
    expect(row(db, b)).toEqual({ status: 'failed', tries: 4, last_error: 'CONNECTION_DISABLED', send_started_at: null });
    expect(beginSend(db, b, NOW)).toBe('skipped');
  });
});

it('AC-LA-E1-06-06: disabled zz-test grant rows fail without POST; self rows still send', async () => {
  const { buildChannelRegistry } = await import('@cogniate/channel-kernel');
  const manifest = {
    ...TEST_CHANNELS.channel('moodle')!, id: 'zz-test', names: { text: 'Test LMS', label: 'Test LMS' },
    registration: [
      { method: 'dynamic', authority: 'self', profiles: ['zz-self'], defaultProfile: 'zz-self' },
      { method: 'manual', authority: 'operatorGrant', profiles: ['zz-grant'], defaultProfile: 'zz-grant' },
    ],
    lti: { guardedFamilies: [], toolConfiguration: 'none' },
  };
  const channels = buildChannelRegistry([{ folder: '/test/zz-test', manifest }], { simulations: true });
  const { db } = setup();
  const syncs: string[] = [];
  for (const [index, method] of (['manual', 'dynamic'] as const).entries()) {
    const c = createConnection(db, LIB, { name: method, siteUrl: 'https://school.test', channel: 'zz-test', method }, null, 0, channels, 'exclusive');
    db.prepare("INSERT INTO publication (id, connection_id, course_id, current_version_id, status, created_at, updated_at) VALUES (?, ?, 'crs_w', 'ver_w', 'available', 0, 0)").run(`pub_${method}`, c.id);
    syncs.push(dueRow(db, c.id, index + 1, { lineItem: `line${index + 1}` }));
    disableConnection(db, LIB, c.id, NOW);
    // A mismatched legacy class must not affect a decision made from the stored authority.
    db.prepare('UPDATE connection SET lms = ? WHERE id = ?').run(method === 'manual' ? 'moodle' : 'canvas', c.id);
  }
  const lti = fakeLti({});
  const w = createScoreSyncWorker({ channels, db, lti: lti.client, logger: createLogger({ service: 'test', write: () => {} }), masterKey: MASTER, now: () => NOW });
  await w.kick();
  expect(lti.posts).toEqual(['line2']);
  expect(row(db, syncs[0]!)).toMatchObject({ status: 'failed', tries: 0, last_error: 'CONNECTION_DISABLED' });
  expect(row(db, syncs[1]!)).toMatchObject({ status: 'sent', tries: 1, last_error: null });
});

// BD-A1-27: these user-visible values stay frozen until LA-IC-15.
it.each(['moodle', 'canvas', 'blackboard'] as const)('%s keeps the frozen 409 lastError and learner fallback', async (channel) => {
  const { db } = setup();
  const con = connection(db, channel, 'frozen');
  const sync = dueRow(db, con, 1, { lineItem: 'line1' });
  const lti = fakeLti({ onPost: () => { throw new LtiServiceError(409, 'CONFLICT', 'Newer score.'); } });
  await worker(db, lti.client).w.kick();
  expect(row(db, sync)?.last_error).toBe('409 CONFLICT: Newer score. (Moodle has a grade with a newer time)');
  db.prepare('UPDATE connection SET site_url = ? WHERE id = ?').run('invalid site', con);
  expect(publicationResults(db, { connectionId: con, courseId: 'crs_w' }, TEST_CHANNELS)[0]?.learner.label).toBe('Learner u @ Moodle');
});
