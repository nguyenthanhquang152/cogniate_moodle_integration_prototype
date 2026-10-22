// The record reporter port (LA-ADR-03 D5). The kernel owns the learning records, the dispatch rows, their delivery
// state and the grade policy. A reporter owns only its wire: the body, the remote call and the remote answer.
//
// Add a reporter:
// 1. Make a driver folder `drivers/<id>/` with a function that returns a `RecordReporter` (see drivers/lti-ags).
// 2. Add it to the one reporter list in `createAppRunner` (worker-main.ts). That list goes to
//    `registerRecordReporters` once, so record creation, read-back and the outbox use the same instances.
// 3. Add its id to `records.reporters` in the manifest of each channel that uses it. A channel declares
//    `records.readBack` only when one of its reporters has `readBack`.
import type { JobContext } from '@cogniate/shared';
import type { DeliveryOutcome, Outcome } from '@cogniate/tracking';
import type { BeginSend } from './dispatch-store.ts';

/** A learning record as `prepare` gets it (LA-ADR-03 D3). */
export interface LearningRecordView {
  attemptId: string;
  placementId: string;
  learnerSubject: string;
  outcome: Outcome;
  scoreGiven: number;
  scoreMaximum: number;
}
/** A placement (LA-ADR-03 D2). `graded`: the placement has a gradebook target. */
export interface PlacementView { id: string; graded: boolean }
/** A dispatch row as `deliver` gets it. */
export interface DispatchView {
  id: string;
  reporter: string;
  /** The value that `partitionKey` gave when the row was made. */
  partitionKey: string;
  placementId: string;
  learnerSubject: string;
  /** The value that `prepare` gave when the row was made. */
  payload: Record<string, unknown>;
  /** Tries counted in the retry window: each send that began and each run that threw. A `throttled` answer counts none. */
  tries: number;
  createdAt: number;
  /** Start of the 24 h retry window: the last Resend time, else `createdAt`. */
  retryFrom: number;
  /** Set while the row waits for its confirmation send (app contract §10 P2), else null. */
  confirmationAfter: number | null;
}
export type { DeliveryOutcome } from '@cogniate/tracking';
export interface ReadBackResult { resultScore: number | null; resultMaximum: number | null }
export type ReadBackContext = Pick<JobContext, 'traceId' | 'now' | 'logger'>;
export interface DeliveryContext extends JobContext {
  /** Check the current row and connection and persist the marker immediately before the POST. */
  beginSend(): BeginSend;
}
export interface RecordReporter {
  /** The `record_dispatch.reporter` value and the id in the manifests' `records.reporters`. Never change it. */
  id: string;
  /**
   * `bestResult` (LA-ADR-03 D6): the outbox offers only `final` records, makes a row only for a new best result of a
   * learner and placement, supersedes lower pending rows, and has at most one row of that key in flight.
   * `everyRecord` is reserved for LC; registration refuses every other value.
   */
  policy: 'bestResult';
  /** False: the record gets no dispatch row for this reporter (lti-ags: the placement has no gradebook target). */
  appliesTo(placement: PlacementView): boolean;
  /** The body to send. It is made once, stored as the row's payload, and given back to `deliver` on each try. */
  prepare(record: LearningRecordView): unknown;
  /**
   * The fairness key of a placement (LA-ADR-03 D7 "Fairness"), stored on each new row. The runner sends one row of a
   * partition at a time and takes partitions in turn; a `throttled` outcome pauses every pending row of the
   * partition. Use the remote system that sets the rate limit (lti-ags: the LTI platform).
   */
  partitionKey(placement: PlacementView): string;
  /**
   * Send one row. Call `ctx.beginSend()` immediately before the remote call, send only when it gives `started`, and
   * return null when it does not. Map every remote answer to an outcome; throw only for a bug (the outbox then
   * counts a try). `retryable` with `uncertain: true` only when the send began and no clear answer came back.
   * `throttled` counts no try and pauses the whole partition until `retryAt` (D7 "429").
   */
  deliver(dispatch: DispatchView, ctx: DeliveryContext): Promise<DeliveryOutcome | null>;
  /**
   * Optional (capability `records.readBack`): read the learner's current result from the remote system, store it,
   * and return it. It must never send a result. null means the placement has no read-back target.
   */
  readBack?(placement: PlacementView, learnerSubject: string, ctx: ReadBackContext): Promise<ReadBackResult | null>;
  /** Names of the send result log line. Default: event `record_dispatch` with fields `dispatch_id` and `reporter`. */
  logNames?: { event: string; idField: string };
}
