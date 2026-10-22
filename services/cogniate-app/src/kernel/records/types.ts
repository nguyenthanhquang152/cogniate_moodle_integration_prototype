import type { JobContext } from '@cogniate/shared';
import type { Outcome } from '@cogniate/tracking';
import type { BeginSend, DueSync } from './dispatch-store.ts';

export interface LearningRecordView {
  attemptId: string;
  placementId: string;
  learnerSubject: string;
  outcome: Outcome;
  scoreGiven: number;
  scoreMaximum: number;
}
export interface PlacementView { id: string; graded: boolean }
export type DispatchView = DueSync & { reporter: string; partitionKey: string };
export type DeliveryOutcome =
  | { kind: 'accepted' }
  | { kind: 'conflict' | 'rejected' | 'local_failure'; text: string }
  | { kind: 'retryable'; text: string; uncertain: boolean };
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
  /** null means beginSend refused the send (changed row, disabled connection, or stop). */
  deliver(dispatch: DispatchView, ctx: DeliveryContext): Promise<DeliveryOutcome | null>;
}
