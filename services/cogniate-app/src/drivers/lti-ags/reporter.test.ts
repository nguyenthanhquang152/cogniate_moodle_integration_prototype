import { createLogger, encrypt, type OutboundRequest } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLtiClient, LtiServiceError } from '../../clients/lti-client.ts';
import { recordsFixture } from '../../kernel/records/records.testkit.ts';
import type { DeliveryContext, DispatchView } from '../../kernel/records/types.ts';
import { TEST_CHANNELS } from '../../testkit.ts';
import { ltiAgsReporter, NO_GRADEBOOK_COLUMN } from './index.ts';

const masterKey = Buffer.alloc(32, 5);
const now = 100_000;
const logger = createLogger({ service: 'reporter-test', write: () => {} });
const fixtures: ReturnType<typeof recordsFixture>[] = [];
afterEach(async () => { for (const f of fixtures.splice(0)) await f.close(); });
async function fixture() {
  const f = recordsFixture(); fixtures.push(f);
  const id = await f.addRow({ key: 'learner', score: 0.8, partition: 'platform', nextTryAt: 0 });
  f.db.prepare('UPDATE resource_link SET line_item_id = ?, service_key_encrypted = ?').run('line', encrypt(masterKey, 'service-key'));
  const calls: OutboundRequest[] = [];
  let status = 204;
  let json: unknown;
  let noAnswer = false;
  const lti = createLtiClient({ ltiUrl: 'https://lti.test', apiKeyFile: 'unused', readKey: () => 'api-key', outbound: {
    allowlist: ['lti.test'], async request(_url, options) {
      calls.push(options!);
      if (noAnswer) throw new Error('timeout');
      return { status, headers: {}, body: Buffer.alloc(0), text: () => '', json: () => json };
    },
  } });
  const reporter = ltiAgsReporter({ db: f.db, channels: TEST_CHANNELS, masterKey, lti });
  const beginSend = vi.fn(() => 'started' as const);
  const ctx: DeliveryContext = { instanceId: 'test', bootId: 'boot', leaseOwner: 'test/boot', now: () => now,
    logger, traceId: 'trace', signal: new AbortController().signal, beginSend };
  const row: DispatchView = { id, reporter: reporter.id, partitionKey: 'platform', placementId: 'rl_learner', learnerSubject: 'learner',
    tries: 0, createdAt: now, retryFrom: now, confirmationAfter: null,
    payload: reporter.prepare({ attemptId: 'att_learner', placementId: 'rl_learner', learnerSubject: 'learner', outcome: 'passed', scoreGiven: 80, scoreMaximum: 100 }) as Record<string, unknown> };
  return { ...f, lti, reporter, row, ctx, beginSend, calls, answer(s: number, code = 'FAIL', retryAfter?: unknown) {
    status = s; noAnswer = s === 0; json = s >= 200 && s < 300 ? undefined : { details: { message: code, description: 'Description', retryAfter } };
  } };
}

describe('AC-LA-E4-03-01: AGS transport mapping', () => {
  it.each([200, 201, 204, 299])('%s is accepted with the prepared AGS body and send marker first', async (status) => {
    const f = await fixture(); f.answer(status);
    expect(await f.reporter.deliver(f.row, f.ctx)).toEqual({ kind: 'accepted' });
    expect(f.beginSend).toHaveBeenCalledOnce();
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]).toMatchObject({ method: 'POST', headers: { authorization: 'SERVICE-AUTH-V1 api-key:service-key' }, body: JSON.stringify({
      userId: 'learner', activityProgress: 'Completed', gradingProgress: 'FullyGraded', scoreGiven: 80, scoreMaximum: 100,
    }) });
  });
  it.each([400, 403, 404, 422])('%s is rejected', async (status) => {
    const f = await fixture(); f.answer(status);
    expect(await f.reporter.deliver(f.row, f.ctx)).toEqual({ kind: 'rejected', text: `${status} FAIL: Description` });
  });
  it.each([['moodle', 'Moodle'], ['canvas', 'Canvas'], ['blackboard', 'Blackboard'], ['unknown', 'your LMS']])('409 uses the %s channel name (LA-IC-15)', async (channel, name) => {
    const f = await fixture(); f.answer(409); f.db.prepare('UPDATE connection SET channel = ?').run(channel!);
    expect(await f.reporter.deliver(f.row, f.ctx)).toEqual({ kind: 'conflict', text: `409 FAIL: Description (${name} has a grade with a newer time)` });
  });
  it.each([0, 401, 500, 502, 503, 504])('%s retries, with uncertainty only for no answer or 5xx after POST', async (status) => {
    const f = await fixture(); f.answer(status);
    expect(await f.reporter.deliver(f.row, f.ctx)).toMatchObject({ kind: 'retryable', uncertain: status !== 401 });
    expect(f.beginSend).toHaveBeenCalledOnce();
    f.db.exec('UPDATE resource_link SET line_item_id = NULL'); f.beginSend.mockClear(); f.calls.length = 0;
    expect(await f.reporter.deliver(f.row, f.ctx)).toMatchObject({ kind: 'retryable', uncertain: false });
    expect(f.beginSend).not.toHaveBeenCalled(); expect(f.calls[0]?.method).toBe('GET');
  });
  it.each(['PLATFORM_RATE_LIMITED', 'RATE_LIMITED'])('429 %s carries details.retryAfter through the client to retryAt', async (code) => {
    const f = await fixture(); f.answer(429, code, 30);
    await expect(f.lti.postScore('key', 'line', {}, 'trace')).rejects.toMatchObject({ status: 429, code, retryAfter: 30 });
    expect(await f.reporter.deliver(f.row, f.ctx)).toEqual({ kind: 'throttled', text: `429 ${code}: Description`, retryAt: now + 30_000 });
  });
  it.each([[undefined, 60], ['30', 60], [null, 60], [-1, 1], [0, 1], [1.5, 2], [4000, 3600]])('normalizes Retry-After %s to %s seconds', async (value, seconds) => {
    const f = await fixture(); f.answer(429, 'PLATFORM_RATE_LIMITED', value);
    expect(await f.reporter.deliver(f.row, f.ctx)).toMatchObject({ kind: 'throttled', retryAt: now + Number(seconds) * 1000 });
  });
  it('B-LA-E4-03-03: a dispatch whose placement has no resource link fails locally at once', async () => {
    const f = await fixture();
    expect(await f.reporter.deliver({ ...f.row, placementId: 'rl_missing' }, f.ctx)).toEqual({ kind: 'local_failure', text: NO_GRADEBOOK_COLUMN });
    expect(f.beginSend).not.toHaveBeenCalled(); expect(f.calls).toEqual([]);
  });
  it('B-LA-E4-03-03: stored texts keep the 300-character limit', async () => {
    const f = await fixture(); f.answer(409, 'C'.repeat(400));
    const outcome = await f.reporter.deliver(f.row, f.ctx);
    expect(outcome).toMatchObject({ kind: 'conflict' });
    expect(outcome && 'text' in outcome ? outcome.text : '').toBe(`409 ${'C'.repeat(296)}`);
  });
  it('B-LA-E4-03-02: the reporter computes the partition of a placement from its LTI platform', async () => {
    const f = await fixture();
    expect(f.reporter.partitionKey({ id: 'rl_learner', graded: true })).toBe('platform');
  });
  it('does not POST after beginSend skips, and does not hide unexpected errors as a transport result', async () => {
    const f = await fixture();
    expect(await f.reporter.deliver(f.row, { ...f.ctx, beginSend: () => 'skipped' })).toBeNull(); expect(f.calls).toEqual([]);
    f.lti.postScore = async () => { throw new TypeError('bug'); };
    await expect(f.reporter.deliver(f.row, f.ctx)).rejects.toBeInstanceOf(TypeError);
    f.lti.postScore = async () => { throw new LtiServiceError(429, 'UNKNOWN_LIMIT', ''); };
    expect(await f.reporter.deliver(f.row, f.ctx)).toMatchObject({ kind: 'retryable', uncertain: false });
  });
});
