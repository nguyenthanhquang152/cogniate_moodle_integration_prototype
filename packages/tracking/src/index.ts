// @cogniate/tracking: pure tracking rules (ADR-008). Imports nothing from the services; the player bundles it too.
export { EXIT_VALUES, INTERACTION_RESULTS, INTERACTION_TYPES, LESSON_STATUS, MAX_INTERACTIONS, MAX_OBJECTIVES, checkScormCmi, isScore } from './cmi.ts';
export type { CmiCheck, ScormCmi, ScormInteraction, ScormObjective, ScormScore } from './cmi.ts';
export { agsScore, agsScoreBody, finishStatus, improves, isFinal, nextRetryAt, outcomeFromStatus, ratio, syncDecision } from './outcome.ts';
export type { AgsScore, Credit, Outcome, SyncRow, SyncStatus } from './outcome.ts';
export { playStatusText } from './status-text.ts';
export type { PlayStatus } from './status-text.ts';
export { formatTimespan, parseTimespan, sessionMax, totalTime } from './time.ts';
