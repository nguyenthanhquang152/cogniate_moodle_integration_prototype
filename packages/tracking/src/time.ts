// SCORM 1.2 CMITimespan (app contract §7: `HH[HH]:MM:SS[.S[S]]`) in centiseconds, and the session time rule:
// each session counts once, with the LARGEST session_time seen in it (the package's value grows inside a session).

const TIMESPAN = /^(\d{2,4}):([0-5]\d):([0-5]\d)(?:\.(\d{1,2}))?$/;

/** Centiseconds of a SCORM 1.2 timespan, or null if the value does not match the format. */
export function parseTimespan(value: string): number | null {
  const m = TIMESPAN.exec(value);
  if (!m) return null;
  const fraction = m[4] === undefined ? 0 : Number(m[4].padEnd(2, '0'));
  return ((Number(m[1]) * 60 + Number(m[2])) * 60 + Number(m[3])) * 100 + fraction;
}

/** `HHHH:MM:SS.SS` (cmi.core.total_time). Hours are capped at 9999. */
export function formatTimespan(centiseconds: number): string {
  const cs = Math.max(0, Math.min(Math.round(centiseconds), 9999 * 360000 + 359999));
  const pad = (n: number, w: number) => String(n).padStart(w, '0');
  const hours = Math.floor(cs / 360000);
  const minutes = Math.floor((cs % 360000) / 6000);
  const seconds = Math.floor((cs % 6000) / 100);
  return `${pad(hours, 4)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(cs % 100, 2)}`;
}

/** The session's counted time after one more accepted commit: the largest value seen (arrival order does not matter). */
export function sessionMax(currentMaxCs: number, sessionTime: string | undefined): number {
  const cs = sessionTime === undefined ? null : parseTimespan(sessionTime);
  return cs === null ? currentMaxCs : Math.max(currentMaxCs, cs);
}

/** cmi.core.total_time at the start of a session: the sum of the counted time of the earlier sessions. */
export function totalTime(earlierSessionsMaxCs: readonly number[]): string {
  return formatTimespan(earlierSessionsMaxCs.reduce((sum, cs) => sum + cs, 0));
}
