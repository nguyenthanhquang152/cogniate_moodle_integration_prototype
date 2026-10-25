// Only the bounded exception in tasks/T5b.md: delete one failed sync in the isolated QA clone.
// ADR-012 revision 3.3 §11: the app database is in the `appdb` volume. QA runs the approved P5 sequence
// inside one `storage-oplock.sh run -- <QA P5 step>` (p5-step.mjs): the existing app stop (the approved
// app-stop guard), the check that the app is positively stopped, the write in a `storage-p5` container,
// then the existing app start. The scope guards and the P5 assertions do not change.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StorageLane } from './storage-lane.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export async function removeP5FailedSync(r, syncId) {
  if (!r.state.h1Verified || !/^(?:qa|qalead)-/.test(r.PROJECT) || r.opt.checkout || r.CLONE === r.SOURCE) {
    throw new Error('P5 requires a verified fresh QA clone');
  }
  if (typeof syncId !== 'string' || !/^sync_[A-Za-z0-9_-]+$/.test(syncId)) throw new Error('Invalid sync id');
  const lane = new StorageLane(r);
  await lane.boot();
  // Exact-name gate before the mount (§11 item 1), then QA's read of the database entry itself.
  const presence = await lane.presence();
  if (presence.appdb.state !== 'labeled') throw new Error('QA database missing or symlinked');
  const files = await lane.script('fileset', { volumes: ['appdb'] });
  const db = files.app?.files?.['cogniate.db'];
  if (!db?.present || db.type === 'symlink') throw new Error('QA database missing or symlinked');
  // Validate every scope guard before stopping anything; the step always starts this service again.
  const spec = { clone: r.CLONE, project: r.PROJECT, imageId: lane.imageId, hostUid: lane.hostUid, hostGid: lane.hostGid,
    scriptDir: lane.bin, outDir: lane.out, syncId };
  const step = await r.exec('p5-step', 'bash', [lane.oplock, 'run', '--', process.execPath, path.join(HERE, 'p5-step.mjs'),
    Buffer.from(JSON.stringify(spec)).toString('base64')], { timeoutMs: 300_000 });
  let answer = null;
  for (const line of step.stdout.split('\n')) { try { const v = JSON.parse(line); if (v.p5Step) answer = v; } catch { /* other output */ } }
  const health = await r.waitHealth(r.state.urls.app, (body) => body.status === 'ok' && body.service === 'cogniate-app', 60_000);
  if (!answer || answer.started !== 0 || !health.ok) throw new Error('P5 QA app did not recover after the fixture');
  if (answer.error) throw new Error(answer.error);
  if (step.code !== 0) throw new Error('P5 step failed under the operation lock');
  return answer.result;
}
