// Only the bounded exception in tasks/T5b.md: delete one failed sync in the isolated QA clone.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export async function removeP5FailedSync(r, syncId) {
  if (!r.state.h1Verified || !/^qa-/.test(r.PROJECT) || r.opt.checkout || r.CLONE === r.SOURCE) {
    throw new Error('P5 requires a verified fresh QA clone');
  }
  if (typeof syncId !== 'string' || !/^sync_[A-Za-z0-9_-]+$/.test(syncId)) throw new Error('Invalid sync id');
  const file = path.join(r.CLONE, 'infra/.data/cogniate-app/cogniate.db');
  if (!fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink()) throw new Error('QA database missing or symlinked');
  const compose = ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env'];
  // The bounded fixture exception requires the app to reload the edited state.
  // Validate every scope guard before stopping anything; always start this service again.
  try {
    const stopped = await r.exec('p5-stop-cogniate-app', 'docker', [...compose, 'stop', 'cogniate-app'], { timeoutMs: 60_000 });
    if (stopped.code !== 0) throw new Error('P5 could not stop its QA app');
    return deleteFailedSync(file, syncId);
  } finally {
    const started = await r.exec('p5-start-cogniate-app', 'docker', [...compose, 'start', 'cogniate-app'], { timeoutMs: 60_000 });
    const health = await r.waitHealth(r.state.urls.app, (body) => body.status === 'ok' && body.service === 'cogniate-app', 60_000);
    if (started.code !== 0 || !health.ok) throw new Error('P5 QA app did not recover after the fixture');
  }
}

function deleteFailedSync(file, syncId) {
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');
    // Resolve the physical table name from the QA database; no service-source imports or SQL copied from product.
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('score_sync','score_syncs')").all();
    if (tables.length !== 1) throw new Error('Expected one score-sync table');
    const table = tables[0].name;
    const row = db.prepare(`SELECT id, status FROM ${table} WHERE id=?`).get(syncId);
    if (row?.status !== 'failed') throw new Error('P5 higher row must already be failed');
    const deleted = db.prepare(`DELETE FROM ${table} WHERE id=? AND status='failed'`).run(syncId);
    if (Number(deleted.changes) !== 1) throw new Error('P5 must delete exactly one row');
    db.exec('COMMIT');
    return { deletedSyncId: syncId, deletedCount: Number(deleted.changes) };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    db.close();
  }
}
