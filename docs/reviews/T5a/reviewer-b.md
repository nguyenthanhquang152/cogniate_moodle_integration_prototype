Verdict: APPROVE
Round: 1

# T5a review — Reviewer-B (lens: "Can a human team own it?")

Scope: `git diff 61bef65 de6a1bb -- . ':!docs' ':!tests'` (45 files). Spec: `tasks/T5a.md`, app contract §5–§8, §10, §12, ADR-004, ADR-008, ADR-010, data-model §2, §3.

| Check | Result |
| --- | --- |
| `npm run check` (HEAD contains `de6a1bb`) | Pass: 38 test files, 544 tests (the Lead's clean worktree: 539) |
| Import fence | `content-host/server.ts` imports only `../domain/attempts.ts`, `@cogniate/shared`, Node and Fastify. It holds. |
| B-T4b2-02 (my item) | **Resolved**: `domain/attempts.ts` (254 lines) holds the attempt model, the attempt rule and the commit logic. `domain/launch.ts` shrank by about 107 lines. |

| Severity | Count | Ids |
| --- | --- | --- |
| BLOCKER | 0 | — |
| MAJOR | 0 | — |
| MINOR | 4 | B-T5a-01 to B-T5a-04 |
| NIT | 1 | B-T5a-05 |

## Lead's focus questions

- **Is `packages/tracking` a clear, pure, well-tested core?** Yes.
  - The modules are small and each states its rule source: `cmi.ts` (contract §7 value rules, `checkScormCmi` returns a normalized copy or the first bad field), `outcome.ts`, `time.ts` and `status-text.ts`. They have no I/O and import nothing from the services.
  - `outcome.ts` holds Moodle's `LMSFinish` rule, `outcomeFromStatus`, the ADR-010 mapping (`agsScore`, `agsScoreBody`), `improves`, `syncDecision` and `nextRetryAt`.
  - `time.ts` has the "each session counts once, with its largest session_time" rule.
  - `tracking.test.ts` has 150 lines over these.
  - **Could a developer change the grade policy in one place?** Not fully. Most of it is in `outcome.ts`, but two parts are elsewhere (B-T5a-01).
- **Player readability for a developer new to SCORM:** Good.
  - `scorm12/api.ts` writes the SCORM 1.2 data model as one table (element → mode r/w/rw, keyword, check) and the error strings as a second table. The header states the session rule ("one runtime page load = one session; after LMSFinish every call answers 101").
  - `runtime/main.ts` says in four lines what the runtime page does (read state → define `window.API` → set the package iframe `src`).
  - `runtime/transport.ts` explains each transport choice with its T5-spike evidence (keepalive `fetch`, one `sendBeacon` on `pagehide`, no `postMessage`).
  - The value rules are copied from tracking instead of imported (B-T5a-02).
- **Import fence for content-host:** Holds (above). One side effect: the content host cannot use the app's typed error table (B-T5a-05).
- **Worker structure and retries:** Clear. The header states the answer mapping (204 sent, 409 conflict, 400/403/404 failed, others retry at 5 s … then hourly until 24 h). There is one trace id for each row and try, `nextRetryAt` comes from tracking, and `kick()` runs at once after a commit with "run once more if busy". One failure mode loops (B-T5a-03).
- **Results API shape vs contract:** `publicationResults` returns exactly the contract §5 `ResultRow` fields (`learner`, `activity {resourceLinkId, contextTitle, title}`, `preview`, `best`, `attempts[]`, `scoreSyncs[]` oldest first, `gradebook: null` until the T5b refresh).
- **`npm run dev:web` loop:** It works. It runs `npm run dev -w @cogniate/player` (`vite build --watch`). Compose mounts `apps/` read-only into `cogniate-app`. `stack-up.sh` builds the player once if `apps/player/dist/runtime.js` is missing, and says so.
- **Unit-only ACs:** see B-T5a-04.

---

## Findings

### B-T5a-01 — MINOR — The grade policy is in three places, not one

- **Location:** `packages/tracking/src/outcome.ts` (`improves`, `syncDecision`, `nextRetryAt`); `services/cogniate-app/src/domain/results.ts` `bestAttempt` ("the final one with the highest score; else the newest in progress; else the newest"); `services/cogniate-app/src/worker/score-sync.ts` (answer → status mapping: 409 → `conflict`, 400/403/404 → `failed`, others → retry).
- **Problem:** ADR-010 promises that "if product wants latest result instead of best result, only rule 4 changes". Today "best wins" is in `improves` and `syncDecision` (tracking) **and** in `bestAttempt` (domain). The ADR-010 rules 8 and 9 (conflict, failed, retry) are split between the worker and tracking. A developer who changes the policy must find three files.
- **Evidence:** `bestAttempt` is pure (it takes a list and returns one), so nothing ties it to the database module. The worker's `if (err.status === 409) … else if (400 || 403 || 404) … else nextRetryAt(…)` is policy written inline.
- **Suggested fix:**
  1. Move `bestAttempt` to `@cogniate/tracking`, next to `improves`.
  2. Add a pure `syncResult(httpStatus, tries, createdAt, now)` to tracking, and let the worker call it.
  3. Put a short "Grade policy (ADR-010)" header in `outcome.ts` that lists every policy function, and name that file in ADR-010.

### B-T5a-02 — MINOR — The player copies the SCORM value rules instead of importing them from tracking

- **Location:** `apps/player/src/scorm12/api.ts` lines 13–19 (`STATUS`, `EXIT`, `INTERACTION_TYPES`, `RESULTS`, `DECIMAL`, `TIMESPAN`) and the `score`/`maxLen` checks in `MODEL`; `packages/tracking/src/cmi.ts` (`LESSON_STATUS`, `EXIT_VALUES`, `INTERACTION_TYPES`, `INTERACTION_RESULTS`, `isScore`, the 4096 limits); `apps/player/src/runtime/main.ts` (`interface RuntimeState`, declared again).
- **Problem:** The same SCORM 1.2 value rules exist twice, once checked in the browser (`LMSSetValue`) and once on the server (`checkScormCmi`). If they drift, the player accepts a value that the server then rejects with `400 INVALID_CMI`, and the learner's progress of that commit is lost.
- **Evidence:**
  - `apps/player/package.json` already depends on `@cogniate/tracking`, and the tracking header says "the player bundles it too". But `api.ts` imports nothing from it; only `transport.ts` imports a type.
  - `RuntimeState` (contract §7) is also written separately in the player and in the content host.
- **Suggested fix:** Let `api.ts` build its checks from the tracking exports (the lists, `isScore`, `parseTimespan`, the length limits). Put the contract §7 types (`RuntimeState`, the commit body) in tracking (or a small shared contract module), and use them on both sides.

### B-T5a-03 — MINOR — One failing row is retried every 2 s forever

- **Location:** `services/cogniate-app/src/worker/score-sync.ts` `send()` (an error that is neither an `LtiServiceError` nor `NO_GRADEBOOK_COLUMN` is rethrown before `recordSend`) and `drain()` (it logs `internal_error` and goes on).
- **Problem:** If a row fails with an unexpected error, for example `decrypt` of the service key after `APP_MASTER_KEY` changed, or a database error, the row is not updated. It stays due, so the 2 s timer tries it again and again, without backoff, with one `internal_error` line every 2 s, and the portal shows it as `pending` forever.
- **Evidence:** `recordSend` runs only after the `try/catch` that rethrows (`else { throw err; }`). `drain()` catches the error with `trace_id: 'score-sync'` (not the row's trace id).
- **Suggested fix:**
  1. In `send()`, treat any other error like a network error: record the try with `nextRetryAt` (or `failed` after 24 h) and `lastError = "internal error (trace id …)"`, and log `internal_error` with the row's trace id.
  2. Replace the `throw new Error(NO_GRADEBOOK_COLUMN)` plus message comparison with a typed result or error class, so the control flow is visible.

### B-T5a-04 — MINOR — Some unit-only ACs make claims that a unit test cannot prove

(Completed after the test mapping below.)

### B-T5a-05 — NIT — Small consistency points

- **Location and fix:**
  - `services/cogniate-app/src/content-host/server.ts` writes its error codes as literals with hand-set statuses (`apiErrorBody(410, 'RUNTIME_EXPIRED', …)`, `apiErrorBody(result.status, result.code, …)`). The fence correctly stops it from importing `app/api-errors.ts`, but the typed-codes rule (B-T2a-02) is lost on the untrusted boundary. Give the content host its own small table with the shared `defineErrorTable` (for example `content-host/errors.ts`: `NOT_FOUND`, `RUNTIME_EXPIRED`, `INVALID_REQUEST`, `INVALID_CMI`, `STALE_SEQUENCE`, `INTERNAL_ERROR`).
  - A root `AGENTS.md` ("instructions for Codex agents … You are Author-2") came with the T5a commit. It is not a build file, so the Lead should confirm who owns it. It repeats `CLAUDE.md` (two rule files can drift) and names a role, "Author-2", that charter §1 does not list.
