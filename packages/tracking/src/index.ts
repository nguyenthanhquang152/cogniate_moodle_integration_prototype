// @cogniate/tracking: pure tracking rules (ADR-008). Imports nothing from the services; the player bundles it too.
export {
  EXIT_VALUES, INTERACTION_RESULTS, INTERACTION_TYPES, LESSON_STATUS, MAX_IDENTIFIER, MAX_INTERACTIONS, MAX_LOCATION, MAX_OBJECTIVES, MAX_SUSPEND_DATA, checkScormCmi,
  isDecimal, isScore, isTime, isTimespan,
} from './cmi.ts';
export type { CmiCheck, ScormCmi, ScormInteraction, ScormObjective, ScormScore } from './cmi.ts';
export { agsScore, agsScoreBody, bestAttempt, finishStatus, improves, isFinal, nextRetryAt, outcomeFromStatus, ratio, resendDecision, syncDecision, dispatchResult } from './outcome.ts';
export type { AgsScore, Credit, Outcome, DeliveryOutcome, SyncRow, SyncStatus } from './outcome.ts';
export type { RuntimeState } from './contract.ts';
export { playStatusText } from './status-text.ts';
export type { PlayStatus } from './status-text.ts';
export { formatTimespan, parseTimespan, sessionMax, totalTime } from './time.ts';
export { DEFAULT_MASTERY, checkHtmlProgress, emptyProgress, htmlOutcome } from './html.ts';
export type { HtmlProfile, HtmlProgress, ProgressCheck } from './html.ts';
