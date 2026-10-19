// Conformance P2 (Lead; ADR-010 rule 5 at aeb0854: "a superseded row never goes back to pending or sent"): a better
// result is never lowered. QA recipe in a Moodle outage (the window in which P2 is most likely): own blank SCO course;
// Moodle stopped; a failed 60 final → row A pending; a passed 90 final in a new session → row B, A superseded; Moodle
// started → B sent, Moodle 90; A stays superseded (observed for 60 s after B was sent). The send-in-flight race of P2
// itself needs a Moodle that hangs (not stopped); see qa.md.
import type { BrowserContext } from '@playwright/test';
import { hostAction } from '../lib/host-control';
import { newStackContext } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { qaBlankActivity } from '../lib/qa-course';
import { seed } from '../lib/seed';
import { appEvents, commitFromRuntime, course101, moodleGrade, openPlayer, reloadRuntime, results, rowsFor, savedSuspendData, scormCommit, settledState, waitForAppEvent, waitForMoodle, waitForRow } from '../lib/t5';

test('AC-T5-30 (P2) Moodle stopped: a failed 60 is pending, then a passed 90 supersedes it; Moodle started → 90 sent, Moodle 90; the 60 row stays superseded and is never sent', async ({ browser }) => {
  test.setTimeout(600_000);
  const user = seed().users.cg_student;
  const context: BrowserContext = await newStackContext(browser);
  let started = true;
  try {
    const c = await qaBlankActivity(context, 'P2');
    const player = await openPlayer(context, user, c.cmid);
    await hostAction('moodle-stop');
    started = false;
    const commitFinal = async (status: string, raw: number) => {
      const s = await settledState(player.token);
      const core = { lesson_status: status, score: { raw: String(raw), min: '0', max: '100' } };
      const c1 = await commitFromRuntime(player.runtime, player.token, scormCommit(s.sessionId, s.lastSeq + 1, 'commit', core, { suspend_data: savedSuspendData(s) }));
      const c2 = await commitFromRuntime(player.runtime, player.token, scormCommit(s.sessionId, s.lastSeq + 2, 'finish', core, { suspend_data: savedSuspendData(s) }));
      expect([c1.status, c2.status], `${c1.body.slice(0, 120)} | ${c2.body.slice(0, 120)}`).toEqual([200, 200]);
    };
    await commitFinal('failed', 60);
    const a = await waitForRow(c.publicationId, user, c.activity, (r) => r.scoreSyncs.some((s) => s.scoreGiven === 60 && s.status === 'pending' && s.tries >= 1), { timeoutMs: 60_000 });
    const rowA = a?.scoreSyncs.find((s) => s.scoreGiven === 60);
    expect(rowA?.status, JSON.stringify(a?.scoreSyncs)).toBe('pending');
    await reloadRuntime(player);
    await commitFinal('passed', 90);
    const b = await waitForRow(c.publicationId, user, c.activity, (r) => r.scoreSyncs.some((s) => s.scoreGiven === 90), { timeoutMs: 30_000 });
    expect(b?.scoreSyncs.find((s) => s.id === rowA!.id)?.status, 'the 60 row is superseded').toBe('superseded');

    await hostAction('moodle-start');
    started = true;
    await waitForRow(c.publicationId, user, c.activity, (r) => r.scoreSyncs.some((s) => s.scoreGiven === 90 && s.status === 'sent'), { timeoutMs: 240_000 });
    expect((await waitForMoodle(course101(), user, c.activity, 90, { timeoutMs: 120_000 })).grade, 'Moodle 90').toBe(90);
    // "Never": poll for 60 s after the better row was sent.
    const until = Date.now() + 60_000;
    const seen: string[] = [];
    while (Date.now() < until) {
      const row = rowsFor(await results(c.publicationId), user, c.activity)[0];
      const statusA = row?.scoreSyncs.find((s) => s.id === rowA!.id)?.status;
      const grade = await moodleGrade(course101(), user, c.activity);
      seen.push(`${statusA}/${grade}`);
      expect(statusA, 'the 60 row stays superseded').toBe('superseded');
      expect(grade, 'Moodle stays 90').toBe(90);
      await new Promise((r) => setTimeout(r, 5_000));
    }
    test.info().annotations.push({ type: 'observed', description: [...new Set(seen)].join(', ') });
    await player.popup.close({ runBeforeUnload: true }).catch(() => undefined);
  } finally {
    if (!started) await hostAction('moodle-start').catch(() => undefined);
    await context.close();
  }
});

// P2 in-flight variant (Lead decision: docker compose pause/unpause moodle through the host channel, QA project only).
// With Moodle paused, each send of row A hangs until the LTI service's 5 s time-out. Row A's first try ends with a
// score_sync event; data-model §3 puts the next try 5 s later, so the better result is committed 7 s after that event,
// inside A's second send. App contract §10/§12 now requires a durable confirmation of the best row.
// Restart only the own QA app after the first accepted higher send; verify persisted pending, confirmation,
// no further obsolete sends, and a finite 90-second Moodle observation (not universal remote ordering).
test('AC-T5-30 (P2, in flight and restart) lower 60 stays superseded; first accepted 90 stays pending across app restart until confirmation; Moodle stays 90 for 90 seconds with no obsolete retry', async ({ browser }) => {
  test.setTimeout(600_000);
  const user = seed().users.cg_student;
  const context: BrowserContext = await newStackContext(browser);
  let paused = false;
  try {
    const c = await qaBlankActivity(context, 'P2f');
    const player = await openPlayer(context, user, c.cmid);
    const s1 = await settledState(player.token);
    await hostAction('moodle-pause');
    paused = true;
    const since = Date.now() - 1_000;
    const core = (status: string, raw: number) => ({ lesson_status: status, score: { raw: String(raw), min: '0', max: '100' } });
    for (const [i, ev] of (['commit', 'finish'] as const).entries()) {
      const res = await commitFromRuntime(player.runtime, player.token, scormCommit(s1.sessionId, s1.lastSeq + 1 + i, ev, core('failed', 60), { suspend_data: savedSuspendData(s1) }));
      expect(res.status, res.body.slice(0, 120)).toBe(200);
    }
    const a = await waitForRow(c.publicationId, user, c.activity, (r) => r.scoreSyncs.some((s) => s.scoreGiven === 60), { timeoutMs: 30_000 });
    const rowA = a!.scoreSyncs.find((s) => s.scoreGiven === 60)!;
    // A new session for the better result, made now (the runtime page does not need Moodle), so the commit is fast.
    await reloadRuntime(player);
    const s2 = await settledState(player.token);
    const firstTry = await waitForAppEvent((e) => e.event === 'score_sync' && e.sync_id === rowA.id, since, 60_000);
    expect(firstTry, 'the first send of row A ended (paused Moodle → time-out)').toBeDefined();
    const target = Date.parse(String(firstTry!.ts)) + 7_000; // inside the second send: next try at +5 s, it hangs 5 s
    await new Promise((r) => setTimeout(r, Math.max(0, target - Date.now())));
    const committedAt = Date.now();
    for (const [i, ev] of (['commit', 'finish'] as const).entries()) {
      const res = await commitFromRuntime(player.runtime, player.token, scormCommit(s2.sessionId, s2.lastSeq + 1 + i, ev, core('passed', 90), { suspend_data: savedSuspendData(s2) }));
      expect(res.status, res.body.slice(0, 120)).toBe(200);
    }
    const b = await waitForRow(c.publicationId, user, c.activity, (r) => r.scoreSyncs.some((s) => s.scoreGiven === 90), { timeoutMs: 30_000 });
    const rowB = b!.scoreSyncs.find((s) => s.scoreGiven === 90)!;
    expect(b?.scoreSyncs.find((s) => s.id === rowA.id)?.status, 'the 60 row is superseded').toBe('superseded');
    // The send that was running when B arrived ends (time-out); its event shows the window was hit.
    const after = await waitForAppEvent((e) => e.event === 'score_sync' && e.sync_id === rowA.id && Date.parse(String(e.ts)) > committedAt, since, 30_000);
    // Contract §12 (B-FIX-01): a send that ends after its row was superseded logs status "superseded" and send_result.
    expect(after, 'a send of row A ended after the better result (the window was hit)').toBeDefined();
    expect(after?.status, `score_sync of the late send: ${JSON.stringify(after)}`).toBe('superseded');
    expect(String(after?.send_result ?? ''), 'send_result').toMatch(/^(sent|pending|conflict|failed)$/);
    expect(after?.phase).toBe('send');
    const settledA = rowsFor(await results(c.publicationId), user, c.activity)[0]?.scoreSyncs.find((s) => s.id === rowA.id);
    expect(settledA?.status).toBe('superseded');
    const events = appEvents(since, (e) => e.event === 'score_sync' && e.sync_id === rowA.id).map((e) => `${String(e.ts).slice(11, 23)} ${e.status} tries ${e.tries}`);
    test.info().annotations.push({ type: 'row A sends', description: `${events.join('; ')}; better result committed at ${new Date(committedAt).toISOString().slice(11, 23)}; a send of A ended after it: ${Boolean(after)}` });

    await hostAction('moodle-unpause');
    paused = false;
    const accepted = await waitForAppEvent((e) => e.event === 'score_sync' && e.sync_id === rowB.id
      && e.phase === 'send' && e.send_result === 'sent', since, 120_000);
    expect(accepted, 'the first accepted higher POST is logged').toBeDefined();
    expect(accepted?.status, 'a required confirmation keeps accepted delivery pending').toBe('pending');
    const pendingB = rowsFor(await results(c.publicationId), user, c.activity)[0]?.scoreSyncs.find((s) => s.id === rowB.id);
    expect(pendingB?.status).toBe('pending');
    expect(pendingB?.sentAt).toBeNull();
    expect(pendingB?.tries).toBe(Number(accepted!.tries));

    // Spec-authorized restart proves the required confirmation survives process recovery.
    const restart = await hostAction('p2-app-restart');
    expect(restart.restart, 'host records actual app stop/start times').toBeDefined();
    expect(restart.restart!.stoppedAt).toBeGreaterThan(Date.parse(String(accepted!.ts)));
    expect(restart.restart!.stoppedAt, 'QA stopped the app before confirmation became due').toBeLessThan(Date.parse(String(accepted!.ts)) + 5_000);
    const confirmed = await waitForAppEvent((e) => e.event === 'score_sync' && e.sync_id === rowB.id
      && e.phase === 'confirmation' && e.status === 'sent', since, 120_000);
    expect(confirmed, 'only a successful confirmation permits sent').toBeDefined();
    expect(Date.parse(String(confirmed!.ts)), 'confirmation happened after the app stopped and recovered').toBeGreaterThanOrEqual(restart.restart!.stoppedAt);
    expect(Date.parse(String(confirmed!.ts)) - Date.parse(String(accepted!.ts)), 'at least five seconds between accepted responses').toBeGreaterThanOrEqual(5_000);
    expect(Number(confirmed!.tries), 'exactly one successful confirmation after the accepted send').toBe(Number(accepted!.tries) + 1);
    const sent = await waitForRow(c.publicationId, user, c.activity, (r) => r.scoreSyncs.some((s) => s.id === rowB.id && s.status === 'sent'), { timeoutMs: 30_000 });
    expect(sent?.scoreSyncs.find((s) => s.id === rowB.id)?.sentAt).toBeTruthy();
    expect((await waitForMoodle(course101(), user, c.activity, 90, { timeoutMs: 120_000 })).grade, 'Moodle 90').toBe(90);
    const until = Date.now() + 90_000; // longer than the 30 s retry step after the 5 s one
    const seen: string[] = [];
    while (Date.now() < until) {
      const row = rowsFor(await results(c.publicationId), user, c.activity)[0];
      const statusA = row?.scoreSyncs.find((s) => s.id === rowA.id)?.status;
      const grade = await moodleGrade(course101(), user, c.activity);
      seen.push(`${statusA}/${grade}`);
      expect(statusA, 'the 60 row stays superseded').toBe('superseded');
      expect(row?.scoreSyncs.find((s) => s.id === rowA.id)?.tries, 'no retry of the obsolete row').toBe(settledA!.tries);
      expect(row?.scoreSyncs.find((s) => s.id === rowB.id)?.status).toBe('sent');
      expect(row?.scoreSyncs.find((s) => s.id === rowB.id)?.tries, 'no endless successful confirmation loop').toBe(Number(confirmed!.tries));
      expect(grade, 'Moodle stays 90').toBe(90);
      await new Promise((r) => setTimeout(r, 5_000));
    }
    test.info().annotations.push({ type: 'observed', description: [...new Set(seen)].join(', ') });
    expect(appEvents(Date.parse(String(after!.ts)) + 1, (e) => e.event === 'score_sync' && e.sync_id === rowA.id),
      'no later send event for the obsolete row during the 90-second observation').toEqual([]);
    for (const [id, tries] of [[rowA.id, settledA!.tries], [rowB.id, Number(confirmed!.tries)]] as const) {
      const sends = appEvents(since, (e) => e.event === 'score_sync' && e.sync_id === id);
      expect(sends.map((e) => Number(e.tries)), 'one log event per actual POST, no waiting counted').toEqual(Array.from({ length: tries }, (_, i) => i + 1));
      expect(sends.every((e) => e.phase === 'send' || e.phase === 'confirmation')).toBe(true);
    }
    await test.info().attach('p2-confirmation-evidence', {
      body: JSON.stringify({ lower: settledA, higherPending: pendingB, accepted, restart, confirmed,
        events: appEvents(since, (e) => e.event === 'score_sync' && (e.sync_id === rowA.id || e.sync_id === rowB.id)), observationSeconds: 90 }, null, 2),
      contentType: 'application/json',
    });
    await player.popup.close({ runBeforeUnload: true }).catch(() => undefined);
  } finally {
    if (paused) await hostAction('moodle-unpause').catch(() => undefined);
    await context.close();
  }
});
