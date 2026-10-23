// LA-E3-05 (data model §5b, LA-ADR-05 D3b): picker_pick, its migration and the stats.
// The migration fixture is seeded with old SQL, never with the current writers: a writer change must not change it.
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from './db.ts';
import { openDb } from './db.ts';
import { launchStats } from './launch.ts';
import { claimPicker, linkPickToResourceLink, releasePicker } from './pickers.ts';

const MIGRATION = '018_picker_pick.sql';
const migrations = fileURLToPath(new URL('./migrations/', import.meta.url));
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

/** One library, one connection and three available publications (pub_1, pub_2, pub_3), with old SQL. */
function seed(db: Db): void {
  db.exec(`INSERT INTO library (id, name, created_at) VALUES ('lib', 'Library', 0);
    INSERT INTO package (id, library_id, sha256, total_bytes, file_count, storage_path, created_at) VALUES ('pkg', 'lib', 'x', 1, 1, 'p', 0);
    INSERT INTO connection (id, library_id, name, site_url, method, status, lti_platform_id, created_at, updated_at)
      VALUES ('con', 'lib', 'Connection', 'https://school.test', 'manual', 'connected', 'platform', 0, 0);`);
  for (const n of [1, 2, 3]) {
    db.exec(`INSERT INTO course (id, library_id, title, summary, variant, lang, created_at) VALUES ('crs_${n}', 'lib', 'Course ${n}', '', 'default', 'en', ${n});
      INSERT INTO course_version (id, course_id, version, format, package_id, validation_report, tracking_profile, created_at)
        VALUES ('ver_${n}', 'crs_${n}', 1, 'html', 'pkg', '{}', '{}', ${n});
      INSERT INTO publication (id, connection_id, course_id, current_version_id, status, created_at, updated_at)
        VALUES ('pub_${n}', 'con', 'crs_${n}', 'ver_${n}', 'available', ${n}, ${n});`);
  }
}

const link = (db: Db, id: string, publication: string) => db.prepare(`INSERT INTO resource_link (id, connection_id, publication_id, deployment_id,
  context_id, resource_link_id, context_title, title, created_at, updated_at) VALUES (?, 'con', ?, '1', '2', ?, 'Course', 'Activity', 0, 0)`).run(id, publication, id);

/** A picker session row as the old writers left it (single pick in picker_session). */
function session(db: Db, id: string, row: { usedAt?: number | null; publication?: string | null; resourceLink?: string | null; expiresAt?: number; context?: string }): void {
  db.prepare(`INSERT INTO picker_session (id, connection_id, ltik_encrypted, issuer_origin, deployment_id, context_id, context_title, created_at, expires_at,
    used_at, publication_id, resource_link_id) VALUES (?, 'con', X'00', 'https://school.test', '1', ?, 'Course', 0, ?, ?, ?, ?)`)
    .run(id, row.context ?? '2', row.expiresAt ?? 10_000, row.usedAt ?? null, row.publication ?? null, row.resourceLink ?? null);
}

const publications = ['pub_1', 'pub_2', 'pub_3'].map((id, i) => ({ id, connectionId: 'con', courseId: `crs_${i + 1}` }));
const activities = (db: Db) => publications.map((p) => launchStats(db, p).activities);

describe(`app migration ${MIGRATION} (AC-LA-E3-05-10)`, () => {
  /** A database at the last migration before picker_pick, with links and old single picks of every kind. */
  function fixture() {
    const dir = mkdtempSync(join(tmpdir(), 'picker-pick-migration-'));
    dirs.push(dir);
    const old = join(dir, 'old');
    mkdirSync(old);
    for (const name of readdirSync(migrations).filter((name) => name < MIGRATION)) copyFileSync(join(migrations, name), join(old, name));
    const source = join(dir, 'source.db');
    const db = openDb(source, old);
    seed(db);
    link(db, 'rl_1', 'pub_1');
    link(db, 'rl_2', 'pub_2');
    session(db, 'p-unused', {});
    session(db, 'p-unused-expired', { expiresAt: 1 });
    session(db, 'p-1-open', { usedAt: 5, publication: 'pub_1' });
    session(db, 'p-1-open-other-context', { usedAt: 6, publication: 'pub_1', context: '9' });
    session(db, 'p-1-matched', { usedAt: 4, publication: 'pub_1', resourceLink: 'rl_1' });
    session(db, 'p-3-open', { usedAt: 7, publication: 'pub_3' });
    // The activities stat of today's launchStats (data model §2.1), as SQL text of the old release.
    const before = publications.map((p) => Number(db.prepare(`SELECT
      (SELECT COUNT(*) FROM resource_link WHERE publication_id = ?) + (SELECT COUNT(*) FROM picker_session
        WHERE publication_id = ? AND used_at IS NOT NULL AND resource_link_id IS NULL) AS n`).get(p.id, p.id)!.n));
    db.close();
    const copy = join(dir, 'upgraded.db');
    copyFileSync(source, copy);
    return { copy, before };
  }

  it('keeps every activities stat equal and copies each used single pick into picker_pick', () => {
    const { copy, before } = fixture();
    expect(before).toEqual([3, 1, 1]);
    const db = openDb(copy);
    expect(activities(db)).toEqual(before);
    expect(db.prepare('SELECT picker_id_hash, publication_id, resource_link_id FROM picker_pick ORDER BY picker_id_hash').all()).toEqual([
      { picker_id_hash: 'p-1-matched', publication_id: 'pub_1', resource_link_id: 'rl_1' },
      { picker_id_hash: 'p-1-open', publication_id: 'pub_1', resource_link_id: null },
      { picker_id_hash: 'p-1-open-other-context', publication_id: 'pub_1', resource_link_id: null },
      { picker_id_hash: 'p-3-open', publication_id: 'pub_3', resource_link_id: null },
    ]);
    db.close();
    // A second open applies nothing again (the ledger has the file once).
    const again = openDb(copy);
    expect(again.prepare('SELECT COUNT(*) AS n FROM picker_pick').get()).toEqual({ n: 4 });
    again.close();
  });

  it('an old open pick is still matched by the first launch of that course after the upgrade', () => {
    const { copy } = fixture();
    const db = openDb(copy);
    link(db, 'rl_9', 'pub_3');
    linkPickToResourceLink(db, { connectionId: 'con', deploymentId: '1', contextId: '2', publicationId: 'pub_3', resourceLinkId: 'rl_9' });
    expect(db.prepare("SELECT resource_link_id FROM picker_pick WHERE picker_id_hash = 'p-3-open'").get()).toEqual({ resource_link_id: 'rl_9' });
    expect(db.prepare("SELECT resource_link_id FROM picker_session WHERE id = 'p-3-open'").get()).toEqual({ resource_link_id: 'rl_9' });
    expect(launchStats(db, publications[2]!).activities).toBe(1); // the link, no open pick
    db.close();
  });
});

describe('picks (data model §5b)', () => {
  function db() {
    const d = openDb(':memory:');
    seed(d);
    return d;
  }

  it('claim writes one pick per publication (publication_id only for a single pick); a cancel writes none; release removes them', () => {
    const d = db();
    for (const id of ['multi', 'single', 'cancel']) session(d, id, {});
    expect(claimPicker(d, 'multi', ['pub_1', 'pub_2', 'pub_3'], 100)).toBe(true);
    expect(claimPicker(d, 'single', ['pub_2'], 100)).toBe(true);
    expect(claimPicker(d, 'cancel', [], 100)).toBe(true);
    expect(d.prepare('SELECT id, used_at, publication_id FROM picker_session ORDER BY id').all()).toEqual([
      { id: 'cancel', used_at: 100, publication_id: null }, { id: 'multi', used_at: 100, publication_id: null }, { id: 'single', used_at: 100, publication_id: 'pub_2' },
    ]);
    expect(d.prepare('SELECT picker_id_hash AS s, COUNT(*) AS n FROM picker_pick GROUP BY s ORDER BY s').all()).toEqual([{ s: 'multi', n: 3 }, { s: 'single', n: 1 }]);
    expect(activities(d)).toEqual([1, 2, 1]);
    // A used picker cannot be claimed again; the claim writes nothing then.
    expect(claimPicker(d, 'multi', ['pub_1'], 101)).toBe(false);
    expect(d.prepare("SELECT COUNT(*) AS n FROM picker_pick WHERE picker_id_hash = 'multi'").get()).toEqual({ n: 3 });
    releasePicker(d, 'multi');
    expect(d.prepare("SELECT used_at, publication_id FROM picker_session WHERE id = 'multi'").get()).toEqual({ used_at: null, publication_id: null });
    expect(activities(d)).toEqual([0, 1, 0]);
  });

  it('an expired picker cannot be claimed and gets no pick', () => {
    const d = db();
    session(d, 'old', { expiresAt: 50 });
    expect(claimPicker(d, 'old', ['pub_1', 'pub_2'], 100)).toBe(false);
    expect(d.prepare('SELECT COUNT(*) AS n FROM picker_pick').get()).toEqual({ n: 0 });
  });

  it('the first launch takes the oldest open pick of that course in that LMS course; other contexts and courses stay open', () => {
    const d = db();
    session(d, 'a', { context: '2' });
    session(d, 'b', { context: '2' });
    session(d, 'c', { context: '9' });
    claimPicker(d, 'b', ['pub_1', 'pub_2'], 10);
    claimPicker(d, 'a', ['pub_1'], 20);
    claimPicker(d, 'c', ['pub_1'], 5);
    link(d, 'rl_x', 'pub_1');
    linkPickToResourceLink(d, { connectionId: 'con', deploymentId: '1', contextId: '2', publicationId: 'pub_1', resourceLinkId: 'rl_x' });
    expect(d.prepare('SELECT picker_id_hash AS s, publication_id AS p, resource_link_id AS r FROM picker_pick ORDER BY s, p').all()).toEqual([
      { s: 'a', p: 'pub_1', r: null }, { s: 'b', p: 'pub_1', r: 'rl_x' }, { s: 'b', p: 'pub_2', r: null }, { s: 'c', p: 'pub_1', r: null },
    ]);
    // Session b is a multi-pick: its old columns stay empty.
    expect(d.prepare("SELECT publication_id, resource_link_id FROM picker_session WHERE id = 'b'").get()).toEqual({ publication_id: null, resource_link_id: null });
    expect(activities(d)).toEqual([3, 1, 0]); // pub_1: rl_x + open picks of a and c
  });
});
