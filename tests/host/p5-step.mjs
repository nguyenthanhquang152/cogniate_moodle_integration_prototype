#!/usr/bin/env node
// The QA P5 step that runs inside one `storage-oplock.sh run --` (ADR-012 revision 3.3 §11 `storage-p5`).
// Order: the existing `docker compose stop cogniate-app`, the check that the app is positively stopped,
// the write in a `storage-p5` container, then the existing `docker compose start cogniate-app` (always).
import { run } from './lib.mjs';
import { assertMountable, fixtureArgs, serviceContainers, volumePresence } from './storage-docker.mjs';

const spec = JSON.parse(Buffer.from(process.argv[2] ?? '', 'base64').toString('utf8'));
const docker = (args, o = {}) => run('docker', args, { cwd: spec.clone, timeoutMs: 120_000, ...o });
const compose = ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env'];
const say = (value) => process.stdout.write(JSON.stringify({ p5Step: true, ...value }) + '\n');

let result = null, error = null, started = null;
try {
  const stopped = await docker([...compose, 'stop', 'cogniate-app'], { timeoutMs: 60_000 });
  if (stopped.code !== 0) throw new Error('P5 could not stop its QA app');
  const app = (await serviceContainers(docker, spec.project)).find((s) => s.service === 'cogniate-app');
  if (!app || !['exited', 'created', 'dead'].includes(app.state)) throw new Error('P5 app is not positively stopped');
  assertMountable(await volumePresence(docker, spec.project), ['appdb']);
  const b64 = Buffer.from(JSON.stringify({ syncId: spec.syncId })).toString('base64');
  const built = fixtureArgs({ kind: 'storage-p5', project: spec.project, imageId: spec.imageId, hostUid: spec.hostUid, hostGid: spec.hostGid,
    scriptDir: spec.scriptDir, outDir: spec.outDir,
    command: ['node', '--no-warnings', '/qa/bin/storage-fixture-script.mjs', 'p5', '--app', '/v/appdb', '--spec', b64] });
  const write = await docker(built.args, { timeoutMs: 120_000 });
  if (write.timedOut) { await docker(['rm', '-f', built.name]); throw new Error('P5 container exceeded its time bound'); }
  const answer = write.stdout.split('\n').flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } }).at(-1);
  if (write.code !== 0 || !answer || answer.error) throw new Error(answer?.error ?? 'P5 write failed');
  result = { deletedSyncId: answer.deletedSyncId, deletedCount: answer.deletedCount };
} catch (e) {
  error = String(e?.message ?? e);
} finally {
  started = (await docker([...compose, 'start', 'cogniate-app'], { timeoutMs: 60_000 })).code;
}
say({ result, error, started });
process.exit(error || started !== 0 ? 1 : 0);
