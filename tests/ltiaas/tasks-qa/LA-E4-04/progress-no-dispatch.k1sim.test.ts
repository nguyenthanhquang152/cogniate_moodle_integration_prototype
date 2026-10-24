// LA-E4-04 K1-SIM acceptance suite: Progress record emission (no outbound dispatch).
// Runs inside the e2e container on a SIM slot using only public app, service, and simulator APIs.
// Sources:
// - docs/architecture/ltiaas/tasks/LA-E4-04.md (AC-LA-E4-04-02)
// - docs/architecture/ltiaas/adr/LA-ADR-03-record-and-outcome-pipeline.md D1, D9
// - docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md §6
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { scormCommit } from '../../../acceptance/lib/t5';
import { canvasBound, canvasPlay } from '../../../acceptance/M1/canvas/canvas';
import {
  bound,
  expectStatus,
  httpsRequest,
  pause,
  records,
  urls,
  type Json,
} from '../../../acceptance/M1/common/client';
import { openPlay, publication, results, waitSync } from '../../../acceptance/M1/common/course';

function writeArtifact(name: string, data: unknown): void {
  const runDir = process.env.LA_RUN_DIR;
  if (!runDir) return;
  fs.mkdirSync(runDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(runDir, name), `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
}

async function postCommit(runtimeToken: string, body: Record<string, unknown>): Promise<void> {
  const res = await httpsRequest(`${urls.content}/rt/${encodeURIComponent(runtimeToken)}/commit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  expectStatus(res, 200);
}

describe('LA-E4-04 K1-SIM: Progress record emission (no outbound dispatch)', () => {
  it('AC-LA-E4-04-02: one attempt with several progress commits, then a final result: simulator AGS score records and results API show only the final score and no progress dispatch row', async () => {
    // 1. SCORM 1.2 attempt on Blackboard SIM: 3 progress commits (incomplete, raw 20, 50, 70), then 1 final commit (passed, 85/100)
    const bb = await bound();
    const scormPub = await publication(bb, 'scorm12');
    const scormCursor = (await records()).cursor;
    const scormPlay = await openPlay(bb, scormPub, { subject: 'learner-e404-scorm' });
    const scormSessionId = String(scormPlay.state.sessionId);
    let scormSeq = Number(scormPlay.state.lastSeq);

    for (const step of [
      { raw: '20', location: 'page-1', suspend: 'progress-step-1' },
      { raw: '50', location: 'page-2', suspend: 'progress-step-2' },
      { raw: '70', location: 'page-3', suspend: 'progress-step-3' },
    ]) {
      scormSeq += 1;
      await postCommit(
        scormPlay.runtimeToken,
        scormCommit(
          scormSessionId,
          scormSeq,
          'commit',
          {
            lesson_status: 'incomplete',
            lesson_location: step.location,
            score: { raw: step.raw, min: '0', max: '100' },
            session_time: '0000:00:05.00',
            exit: 'suspend',
          },
          { suspend_data: step.suspend },
        ),
      );
    }

    // Give the outbox runner time to process any mistakenly queued progress dispatch rows
    await pause(3_000);

    const scormMidHits = (await records(scormCursor)).records.filter(
      (r: Json) => r.kind === 'score' && r.resource === scormPub.id,
    );
    expect(scormMidHits, 'zero simulator AGS score POSTs during progress commits').toEqual([]);

    const scormMidRows = await results(bb, scormPub);
    expect(scormMidRows.length).toBe(1);
    expect(scormMidRows[0].attempts.length).toBe(1);
    expect(scormMidRows[0].attempts[0].outcome).toBe('in_progress');
    expect(scormMidRows[0].scoreSyncs, 'zero scoreSyncs rows while attempt is in_progress').toEqual([]);

    // Final SCORM commit (finish, passed, 85/100)
    scormSeq += 1;
    await postCommit(
      scormPlay.runtimeToken,
      scormCommit(
        scormSessionId,
        scormSeq,
        'finish',
        {
          lesson_status: 'passed',
          lesson_location: 'page-final',
          score: { raw: '85', min: '0', max: '100' },
          session_time: '0000:00:15.00',
          exit: '',
        },
        { suspend_data: 'progress-final' },
      ),
    );

    await waitSync(bb, scormPub, 'sent');
    await pause(1_500);

    const scormFinalHits = (await records(scormCursor)).records.filter(
      (r: Json) => r.kind === 'score' && r.resource === scormPub.id,
    );
    expect(scormFinalHits.length, 'exactly one AGS score POST for the SCORM attempt').toBe(1);
    expect(scormFinalHits[0].body.scoreGiven).toBe(85);
    expect(scormFinalHits[0].body.scoreMaximum).toBe(100);
    expect(scormFinalHits[0].body.activityProgress).toBe('Completed');
    expect(scormFinalHits[0].body.gradingProgress).toBe('FullyGraded');

    const scormFinalRows = await results(bb, scormPub);
    expect(scormFinalRows.length).toBe(1);
    expect(scormFinalRows[0].attempts.length).toBe(1);
    expect(scormFinalRows[0].attempts[0]).toMatchObject({
      outcome: 'passed',
      scoreGiven: 85,
      scoreMaximum: 100,
    });
    expect(scormFinalRows[0].best).toMatchObject({
      outcome: 'passed',
      scoreGiven: 85,
      scoreMaximum: 100,
    });
    expect(scormFinalRows[0].scoreSyncs.length, 'only the single final scoreSyncs row exists').toBe(1);
    expect(scormFinalRows[0].scoreSyncs[0]).toMatchObject({
      status: 'sent',
      scoreGiven: 85,
      scoreMaximum: 100,
      tries: 1,
    });

    // 2. HTML attempt on Canvas SIM: 2 incomplete progress commits, then 1 final completion commit (90/100) + repeated unload
    const cv = await canvasBound();
    const htmlPub = await publication(cv, 'html');
    const htmlCursor = (await records()).cursor;
    const htmlPlay = await canvasPlay(cv, htmlPub, { subject: 'learner-e404-html' });
    const htmlSessionId = String(htmlPlay.state.sessionId);
    let htmlSeq = Number(htmlPlay.state.lastSeq);

    // Progress commit 1: 3 answers, page not yet seen -> in_progress
    htmlSeq += 1;
    await postCommit(htmlPlay.runtimeToken, {
      kind: 'html',
      event: 'progress',
      sessionId: htmlSessionId,
      seq: htmlSeq,
      progress: {
        seenPages: [],
        answers: { q0: '1', q1: '1', q2: '1' },
      },
    });

    // Progress commit 2: 6 answers, page still not seen -> in_progress
    htmlSeq += 1;
    await postCommit(htmlPlay.runtimeToken, {
      kind: 'html',
      event: 'progress',
      sessionId: htmlSessionId,
      seq: htmlSeq,
      progress: {
        seenPages: [],
        answers: { q0: '1', q1: '1', q2: '1', q3: '1', q4: '1', q5: '1' },
      },
    });

    await pause(3_000);

    const htmlMidHits = (await records(htmlCursor)).records.filter(
      (r: Json) => r.kind === 'score' && r.resource === htmlPub.id,
    );
    expect(htmlMidHits, 'zero simulator AGS score POSTs during HTML progress commits').toEqual([]);

    const htmlMidRows = await results(cv, htmlPub);
    expect(htmlMidRows.length).toBe(1);
    expect(htmlMidRows[0].attempts.length).toBe(1);
    expect(htmlMidRows[0].attempts[0].outcome).toBe('in_progress');
    expect(htmlMidRows[0].scoreSyncs, 'zero scoreSyncs rows while HTML attempt is in_progress').toEqual([]);

    // Final HTML commit: all pages seen + 9/10 correct answers -> passed 90/100, followed by repeated unload
    const fullAnswers = Object.fromEntries(Array.from({ length: 10 }, (_, n) => [`q${n}`, n < 9 ? '1' : '0']));
    htmlSeq += 1;
    await postCommit(htmlPlay.runtimeToken, {
      kind: 'html',
      event: 'progress',
      sessionId: htmlSessionId,
      seq: htmlSeq,
      progress: {
        seenPages: ['index'],
        answers: fullAnswers,
      },
    });

    htmlSeq += 1;
    await postCommit(htmlPlay.runtimeToken, {
      kind: 'html',
      event: 'unload',
      sessionId: htmlSessionId,
      seq: htmlSeq,
      progress: {
        seenPages: ['index'],
        answers: fullAnswers,
      },
    });

    await waitSync(cv, htmlPub, 'sent');
    await pause(1_500);

    const htmlFinalHits = (await records(htmlCursor)).records.filter(
      (r: Json) => r.kind === 'score' && r.resource === htmlPub.id,
    );
    expect(htmlFinalHits.length, 'exactly one AGS score POST for the HTML attempt').toBe(1);
    expect(htmlFinalHits[0].body.scoreGiven).toBe(90);
    expect(htmlFinalHits[0].body.scoreMaximum).toBe(100);
    expect(htmlFinalHits[0].body.activityProgress).toBe('Completed');
    expect(htmlFinalHits[0].body.gradingProgress).toBe('FullyGraded');

    const htmlFinalRows = await results(cv, htmlPub);
    expect(htmlFinalRows.length).toBe(1);
    expect(htmlFinalRows[0].attempts.length).toBe(1);
    expect(htmlFinalRows[0].attempts[0]).toMatchObject({
      outcome: 'passed',
      scoreGiven: 90,
      scoreMaximum: 100,
    });
    expect(htmlFinalRows[0].best).toMatchObject({
      outcome: 'passed',
      scoreGiven: 90,
      scoreMaximum: 100,
    });
    expect(htmlFinalRows[0].scoreSyncs.length, 'only the single final HTML scoreSyncs row exists').toBe(1);
    expect(htmlFinalRows[0].scoreSyncs[0]).toMatchObject({
      status: 'sent',
      scoreGiven: 90,
      scoreMaximum: 100,
      tries: 1,
    });

    writeArtifact('e4-04-ac02.json', {
      scorm: {
        progressCommitsSent: 3,
        midScoreHits: scormMidHits.length,
        midScoreSyncs: scormMidRows[0].scoreSyncs.length,
        finalScoreHits: scormFinalHits.length,
        finalScoreBody: scormFinalHits[0].body,
        finalScoreSyncs: scormFinalRows[0].scoreSyncs,
      },
      html: {
        progressCommitsSent: 2,
        midScoreHits: htmlMidHits.length,
        midScoreSyncs: htmlMidRows[0].scoreSyncs.length,
        finalScoreHits: htmlFinalHits.length,
        finalScoreBody: htmlFinalHits[0].body,
        finalScoreSyncs: htmlFinalRows[0].scoreSyncs,
      },
    });
  });
});
