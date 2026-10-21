// AC-M1-41 a-lock-scope (ADR-012 revision 3.3 §7 scope, §13): the QA storage case that the candidate
// `npm run test:acceptance` runs. The suite holds no operation lock of its own, so a host-control
// `stack:restart` takes the lock between the suite's internal stack-up.sh runs. The host runner checks
// the lock log pairs; this case checks the restart result and the service health.
import { httpsRequest } from '../../lib/https';
import { assert, host, m1Test, poll, urls } from './client';

m1Test('M1-41.common.a-lock-scope', 'host-control stack:restart of lti-service takes the lock between the suite starts', async () => {
  const restart = await host('m1-restart', { service: 'lti-service' });
  assert.equal(restart.code, 0, 'Host-control stack:restart exits 0');
  assert.ok(!/operation_in_progress/.test(restart.stdout + restart.stderr), 'No operation_in_progress');
  await poll(async () => {
    try { return (await httpsRequest(urls.lti + '/healthz')).status; } catch { return 0; }
  }, (status) => status === 200, 120_000, 1000);
}, 240_000, 'SIM');
