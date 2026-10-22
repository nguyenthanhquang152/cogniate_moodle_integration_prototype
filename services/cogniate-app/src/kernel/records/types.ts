import type { JobContext } from '@cogniate/shared';
import type { DeliveryOutcome, Outcome } from '@cogniate/tracking';
import type { BeginSend } from './dispatch-store.ts';

export interface LearningRecordView {
  attemptId: string;
  placementId: string;
  learnerSubject: string;
  outcome: Outcome;
  scoreGiven: number;
  scoreMaximum: number;
}
export interface PlacementView { id: string; graded: boolean }
export interface DispatchView {
  id: string;
  reporter: string;
  partitionKey: string;
  placementId: string;
  learnerSubject: string;
  payload: Record<string, unknown>;
  tries: number;
  createdAt: number;
  retryFrom: number;
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
  id: string;
  policy: 'bestResult';
  appliesTo(placement: PlacementView): boolean;
  prepare(record: LearningRecordView): unknown;
  partitionKey(dispatch: DispatchView): string;
  /** null means the placement has no read-back target. */
  readBack?(placement: PlacementView, learnerSubject: string, ctx: ReadBackContext): Promise<ReadBackResult | null>;
  /** null means beginSend refused the send (changed row, disabled connection, or stop). */
  deliver(dispatch: DispatchView, ctx: DeliveryContext): Promise<DeliveryOutcome | null>;
}
