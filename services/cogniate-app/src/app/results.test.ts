import fastify from 'fastify';
import { createLogger, encrypt } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ltiAgsReporter } from '../drivers/lti-ags/index.ts';
import { configureRecordReporters } from '../kernel/records/records.ts';
import { recordsFixture } from '../kernel/records/records.testkit.ts';
import { TEST_CHANNELS, fakeLti } from '../testkit.ts';
import { ApiError } from './api-errors.ts';
import { registerResultRoutes } from './results.ts';

const close: Array<() => Promise<void>> = [];
afterEach(async () => { for (const fn of close.splice(0)) await fn(); });
async function fixture(readBack = true, reporterReadBack = true) {
  const f = recordsFixture();
  const id = await f.addRow({ key: 'user', partition: 'p', score: 0.8, nextTryAt: 0 });
  const lti = fakeLti();
  const masterKey = Buffer.alloc(32, 5);
  const channels = { ...TEST_CHANNELS, capabilities(channel: string) {
    return { ...TEST_CHANNELS.capabilities(channel), 'records.readBack': readBack };
  } };
  f.db.prepare('UPDATE resource_link SET line_item_id = ?, service_key_encrypted = ?').run('line', encrypt(masterKey, 'service-key'));
  const reporter = ltiAgsReporter({ db: f.db, lti: lti.client, channels, masterKey });
  if (!reporterReadBack) delete reporter.readBack;
  configureRecordReporters(f.db, [reporter]);
  const app = fastify();
  app.addHook('onRequest', async (req) => {
    req.auth = { signedIn: { library: { id: 'lib' } } } as NonNullable<typeof req.auth>;
    req.traceId = 'trace';
  });
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ApiError) return reply.code(err.status).send(err.body());
    return reply.code(500).send(err);
  });
  registerResultRoutes(app, { db: f.db, channels, lti: lti.client, masterKey, logger: createLogger({ service: 'test', write: () => {} }), now: () => 100_000 });
  close.push(async () => { await app.close(); await f.close(); });
  return { ...f, app, lti, id, reporter };
}

describe('results guards and read-back', () => {
  it.each([[false, true], [true, false]])('AC-LA-E4-03-06: no read-back capability or implementation gives 409 (%s, %s)', async (capability, method) => {
    const f = await fixture(capability, method);
    const response = await f.app.inject({ method: 'POST', url: '/publications/pub/results/refresh' });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ details: { message: 'CAPABILITY_NOT_SUPPORTED', capability: 'records.readBack' } });
    expect(f.lti.calls).toEqual([]);
  });
  it('AC-LA-E4-03-06: the baseline reporter reads only the learner result and stores it', async () => {
    const f = await fixture();
    f.lti.client.getResults = vi.fn(async () => [{ userId: 'other', resultScore: 1, resultMaximum: 1 }, { userId: 'user', resultScore: 8, resultMaximum: 10 }]);
    const response = await f.app.inject({ method: 'POST', url: '/publications/pub/results/refresh' });
    expect(response.statusCode).toBe(200);
    expect(f.lti.client.getResults).toHaveBeenCalledWith('service-key', 'line', 'user', 'trace');
    expect(f.db.prepare('SELECT result_score, result_maximum, read_at FROM gradebook_read').all()).toEqual([{ result_score: 8, result_maximum: 10, read_at: 100_000 }]);
  });
  it('AC-LA-E4-03-07: a disabled operator-grant connection refuses refresh and Resend before remote calls', async () => {
    const f = await fixture();
    f.db.exec("UPDATE connection SET binding_authority = 'operatorGrant', status = 'disabled'; UPDATE record_dispatch SET status = 'failed'");
    for (const url of ['/publications/pub/results/refresh', `/score-syncs/${f.id}/resend`]) {
      const response = await f.app.inject({ method: 'POST', url });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ details: { message: 'CONNECTION_NOT_READY' } });
    }
    expect(f.lti.calls).toEqual([]);
    expect(await f.readRow(f.id)).toMatchObject({ status: 'failed', tries: 0 });
  });
});
