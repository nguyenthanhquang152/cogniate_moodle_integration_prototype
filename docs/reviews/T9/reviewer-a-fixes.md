Verdict: APPROVE
Round: 2

# Fix commits after T9 conformance: Reviewer-A (correctness and security)

History: the round 1 verdict was APPROVE (3 NIT; below). The round 2 verdict (`2676cc7`) is APPROVE (section "Round 2 (2676cc7)" at the end).

Scope:
- Author-2 (Codex): `655ab78` (C-T8-01), `804a139` (P2, P5), `ab0119b` (P11), `5b10196` (P1).
- Author: `8059c31` (C-T8-02, C-T8-03, A-T7-04, A1–A4, A6, A7, infra README D2/D3/D8).

Specs: `docs/reviews/T9/architect-conformance.md` §2 and §4, app contract §6, §11 (single-runner rule), security §2.6, §9, §10a, ADR-010 rule 5.

Method: I read every code change (`git show`) and the new tests. I checked the build compose labels and the `deactivateOrphan` path, and I confirmed (`git grep`) that no code still uses the removed `createHealthServer` or `traceIdFrom`. Read-only; nothing committed. I did not read `reviewer-b.md`.

## The Lens-A questions

1. **Races left open?**
   - **`.mbz` reservation (C-T8-01): closed.** The check (`latestBuild` queued or running, `activeBuildCount`) and the reservation (`createBuild`) now run with **no `await` between them**. Node runs one request at a time and SQLite is synchronous, so two parallel POSTs cannot both reserve a build. The request file is written only after the slot is held. A failed write marks the reservation failed (`stale(b, …)`). `refresh` returns early when a newer build was reserved during its `readFile`. Every active build of the library is refreshed before the count, which also closes my A-T8-04(a).
   - **Runner lock (C-T8-02): atomic.** `ln` of a temp file that already holds the PID creates the lock completely or not at all. A stale lock is taken over under a `mkdir` mutex, and the holder is checked again inside it. A PID counts only if `ps` shows `build-runner.sh` (A1, PID reuse). One theoretical gap remains: A-FX-03.
2. **Can a grade still go down?** No.
   - **P2:** `recordSend` now updates a row only `WHERE status = 'pending'`. A lower row that a better result superseded during its own request can no longer come back to `pending` (and be retried later) or be marked `sent`. The worker sends one row at a time, so the higher row is always sent after it, with a later LTI service timestamp. The new test proves it: 60 is in flight, then 80 supersedes it, then the 60 send fails. The 60 row stays `superseded` with no next try, and only 80 is ever sent to Moodle.
   - **P5:** the Resend "best final attempt" guard uses `CAST(score_given AS REAL) / score_maximum`, which resolves my A-T5b-05. The test (60 and 80 with the best row deleted) gets `409`.
   - **P11:** the player status names the score that Moodle keeps. It comes from the newest sync row, which since T5b round 2 is the learner's best. It goes only to the holder of the play id. The shell sets it with `textContent`, and the server render escapes it.
3. **Orphan platform left active? (P1)** Mostly closed.
   - `deactivateOrphan` now runs for **every** error once the platform id is known. Before, a non-LTI error was re-thrown first, which left the orphan active. `deactivateOrphan` still checks `platformOwner` first, so another connection's platform is never touched, and it logs (not throws) a failed patch.
   - The app now waits 15 s for `completeRegistration`, longer than the LTI service's 5 s Moodle call. So the normal "Moodle is slow" case comes back as the service's own result (`tool_may_exist` or `504 PLATFORM_TIMEOUT`), not as an app-side timeout.
   - The uncertain outcomes (`tool_may_exist`, `LTI_SERVICE_UNREACHABLE`, `504 PLATFORM_TIMEOUT`, all with no platform id yet) show `MOODLE_TOOL_MAY_EXIST`.
   - The remaining case is A-FX-02.
4. **Outbound guards intact with the per-request timeout?** Yes. `once()` only replaces the timer value (`req.timeoutMs ?? timeoutMs`). The https rule, the IP check inside the connect lookup, the redirect refusal, the 1 MB limit and the one-retry rule for GET did not change. Only `completeRegistration` (app to LTI service, an allowlisted internal host) sets it. See A-FX-02 for the documentation.
5. **Can two runners still both act?** Not in practice (point 1).
6. **Can the sweep touch another stack or a live build?**
   - **No other stack.** Every build container, volume and network carries `org.cogniate.stack=${BUILD_STACK}` (the `x-owner` anchor on both services, the network and both volumes). `BUILD_STACK` is the runner's own `COMPOSE_PROJECT_NAME`. The sweep lists only resources with `label=org.cogniate.stack=$STACK` before it matches `cogniate-build-<24 hex>`.
   - **No live build of its own stack.** At runner start, `watch` and `once` hold the lock (`take_lock`) before they sweep. The `sweep` mode (used by `stack:reset`, which stops the runner first) does not take the lock, but `check_lock` refuses it while a live runner holds the lock. So no build of this stack is active during a sweep. A runner started in the same instant as a `sweep` is the only gap, and it is the same kind of narrow race as A-FX-03.
7. **Symlink, FIFO or folder in the queue (A3).**
   - `is_request_file` (`-f` and not `-L`) runs before the `mv`. Anything else with a request name is rejected, gets a sanitized `failed` status (C-T8-03), and is removed with `rm -rf --`, which never follows a link.
   - A swap after the check is still refused by the no-follow `validate` (round 2 probe), and `processing/` is not app-writable.
   - The new `stage` copies the package from the app-writable upload store with `O_NOFOLLOW | O_NONBLOCK` and `fstat` (regular file only). It creates the copy with `O_EXCL | O_NOFOLLOW` at mode 0600 and checks the **SHA-256 of the copy** against the request. A planted symlink, FIFO or swapped file is refused.
   - The status reason for a rejected request takes only the field name from `queue.mjs`'s fixed messages, filtered to `[A-Za-z0-9 ()_-]` and at most 60 characters, so no request content leaks.
8. **Does fail closed really delete nothing? (A-T7-04)** Yes. With no terminal and no `--yes` or `E2E_CONFIRM=1`, `confirm_stack_delete` prints "Nothing was deleted." and exits 1. It still runs before the build and `stack-reset.sh` in `e2e-reset.sh`, and before the exit trap and the reset in `qa-suite.sh`. QA's runner already passes `--yes`. A-T7-04 is resolved.

Also checked:
- C-T8-03: the runner's `lang` pattern equals the app's rule, and an idnumber over 100 characters is refused.
- A4: the removed `createHealthServer` and `traceIdFrom` were the T1 placeholder. Nothing imports them, and both services keep their own redacted `http_request` logging.

## Findings

### A-FX-01: NIT: a superseded row whose in-flight send succeeded leaves no trace

- Location: `services/cogniate-app/src/worker/score-sync.ts` (the `score_sync` log only `if (recordSend(…))`); `domain/score-syncs.ts` `recordSend`.
- Problem: when a better result supersedes a row while its send is in flight and that send **succeeds**, Moodle briefly holds the lower score. The row stays `superseded` with no `sent_at`, and no `score_sync` event is written.
- Impact: audit only. The higher row follows at once, with a later timestamp.
- Fix: when `recordSend` changes nothing, still log `score_sync {sync_id, status: "superseded", send_result: <sent|failed|…>}`. Optionally set `sent_at` on the superseded row when the send succeeded.

### A-FX-02: NIT: after an uncertain registration, a platform that the LTI service makes later stays active; the per-request timeout needs a line in security §9

- Location: `services/cogniate-app/src/tool-pages/register.ts` (`uncertain` with `platformId === null`); `packages/shared/src/outbound.ts` (`OutboundRequest.timeoutMs`).
- Problem:
  - If the LTI service finishes the registration after the app gave up (over 15 s, or the connection broke), it creates an active platform with no owner. The app never learns its id. A launch from it still gets only the "not available" page (security §8), but security §2.6 says orphans are switched off at once. The registration session stores `platform_id`.
  - `timeoutMs` has no bounds in the shared client (NaN or 0 fires at once; a huge value overflows to 1 ms), and security §9 still says "Timeout 5 s".
- Fix:
  - On an uncertain outcome, read `GET /api/registrations/{id}` once (now, or at the next view of the connection). If it names a platform that no connection owns, call `deactivateOrphan`.
  - Clamp `timeoutMs` to 1–60,000 ms in `once()`.
  - Add to security §9: "a caller may set a longer timeout for one internal call (registration complete: 15 s)".

### A-FX-03: NIT: a theoretical double take-over of a stale runner lock

- Location: `infra/scripts/build-runner.sh` `take_lock` (`find "$LOCK.takeover" -mmin +1 -exec rmdir {} \;` before `mkdir`).
- Problem: two runners that start within microseconds of each other while a take-over mutex older than 1 minute exists can interleave. Runner B's `find` matches the old mutex, runner A removes it and makes a new one, and then B's `rmdir` removes A's **new** mutex. Both then enter the take-over, and B's `rm -f "$LOCK"` can remove A's fresh lock before B links its own.
- Impact: it needs a killed runner plus a simultaneous double start (`npm run stack:up` already starts at most one runner), so it is very unlikely.
- Fix: remove a stale mutex only if it is still the one that was found (for example, store the holder's PID inside the mutex and check it before `rmdir`). Or replace the scheme with `flock` on a lock file descriptor where it is available.

## Counts

0 BLOCKER, 0 MAJOR, 0 MINOR, 3 NIT (A-FX-01 to -03). Resolved by these commits: C-T8-01, P2, P5 (= A-T5b-05), P11, P1 (main path), C-T8-02, C-T8-03, A-T7-04, A-T8-04(a), A3. Not committed (Lead's instruction).

## Round 2 (2676cc7)

Scope: `git show 2676cc7` (spec `bb7c785`). Read-only; nothing committed. I did not read `reviewer-b.md`.

- **A-FX-01 resolved.** When `recordSend` changes nothing, the worker now logs `score_sync {sync_id, status: "superseded", send_result, tries}`. So a lower score that reached Moodle during its supersede is visible in the log. The test asserts the new line.
- **A-FX-02 (clamp part) resolved.** `once()` uses the client default for `undefined`, `NaN`, 0 and negative values, and otherwise `Math.min(60 000, Math.max(1, value))`. `Infinity` gives 60 000 ms and a fraction gives 1 ms, so a bad value can no longer fire at once or overflow. The other guards did not change. The orphan read-back and the security §9 sentence are still open, as a NIT for the Architect or Author.
- **Register confirm page script: CSP stays strict, and there is no new sink.**
  - The script is a fixed string with no interpolated data. It goes into the existing `<script nonce="…">` of `layout()` (nonce escaped), on a page whose CSP already has `script-src 'nonce-…'`, `form-action 'self'` and `frame-ancestors {site}`. There is no inline handler and no `unsafe-inline`.
  - It only disables the submit button and sets a status line with `textContent`. The form posts the same hidden `registrationId` and `ref` fields (the button has no name), so the `Origin` rule and the single-use `ref` are unchanged.
- **P11 texts.** With no attempt score, the text starts with "Completed" instead of "Completed — score ." (an empty score). The text is still plain and is set with `textContent` or escaped.

Round 2 counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 new NIT. Still open: A-FX-02 (the orphan read-back and the §9 sentence), A-FX-03.
