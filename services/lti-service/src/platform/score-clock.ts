// Score timestamps (contract §3.6, ADR-010 rule 7). Moodle answers 409 when the stored grade time is the same or newer
// (seconds), so each (platform, line item, user) gets times at least 1 s apart. The clock is in memory; at start its
// floor is the start time + 2 s, so scores sent just before a restart do not cause a 409 after it.

export interface ScoreClock {
  /** Next timestamp (ISO 8601 UTC with ms) for this key; `given` (a client timestamp) is used as given. */
  next(platformId: string, lineItemUrl: string, userId: string, given?: string): string;
}

export function createScoreClock(now: () => number = Date.now): ScoreClock {
  const floor = now() + 2000;
  const last = new Map<string, number>();
  return {
    next(platformId, lineItemUrl, userId, given) {
      const key = JSON.stringify([platformId, lineItemUrl, userId]);
      const prev = last.get(key);
      if (given !== undefined) {
        const ms = Date.parse(given);
        if (Number.isFinite(ms)) last.set(key, Math.max(prev ?? ms, ms));
        return given;
      }
      const t = Math.max(now(), floor, prev === undefined ? 0 : prev + 1000);
      last.set(key, t);
      return new Date(t).toISOString();
    },
  };
}
