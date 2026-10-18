Verdict: APPROVE
Round: 1

# T5a review: Reviewer-A (correctness and security)

Scope: `git diff 61bef65 de6a1bb -- . ':!docs' ':!tests'` (45 files). Spec: `tasks/T5a.md`, ADR-004, ADR-010, app contract §5 (results), §6 `/play`, §7, §8, §10, §12, security §5, §7, §10, `apps/player-spike/SPIKE-NOTES.md`.

Method:
- I read the content host, `domain/attempts.ts`, `domain/results.ts`, `domain/score-syncs.ts`, `worker/score-sync.ts`, `packages/tracking`, `apps/player` (SCORM API, transport, runtime, shell), the LTI client change, the A-T4b2-03 change and the wiring.
- The Author edited `attempts.ts` and `content-host/server.ts` in the working tree during my review. All line numbers below are at `de6a1bb` (`git show`).
- I compared `finishStatus` with Moodle 5.2 `public/mod/scorm/datamodels/scorm_12.js` `StoreData(…, true)` (lines 621–642).
- Read-only live checks on the Author's stack (`https://content.cogniate-content.test`, `curl --resolve … --cacert infra/.certs/root.crt`):
  - **Package file:** `/pkg/<id>/index.html` gives `200 text/html`, `nosniff`, `frame-ancestors {content} {app}` and `Referrer-Policy: same-origin`. It has no `Set-Cookie` and no CORS headers.
  - **Raw paths:** with `--path-as-is`, `../`, `%2e%2e/`, `%2F..%2F`, `..%5c` and `./` give `400`. `%252e%252e/` and `//` give `404`. No body holds the target file.
  - **Range:** `Range: bytes=0-1023` on `lyra.mp4` gives `206 video/mp4` with `Content-Range: bytes 0-1023/10721508`.
  - **Unknown token:** a random 43-character token gives `404` for `/rt/{t}`, `/rt/{t}/state` and `POST /rt/{t}/commit`.
  - **Cookies:** see A-T5a-02.
- Log scan (counts only) of `cogniate-content.jsonl` and `cogniate-app.jsonl`:
  - 0 runtime tokens (43-character values), 0 `ply_` ids, 0 `pck_` ids, and 0 `SERVICE-AUTH`, `LTIK-AUTH` or `Bearer` strings.
  - Paths are route patterns (`/rt/:token/commit`, `/pkg/:packageId/*`).
- Read-only SQLite (`mode=ro`) only to get package ids. I made no writes.
- I did not read `reviewer-b.md`.

## What is right (checked, no finding)

- **Content host (`/pkg`).**
  - The raw path is checked before Fastify decodes it: encoded dot, slash, backslash or NUL, a backslash, and `.` or `..` segments.
  - Then each decoded segment is checked (no empty segment, no control character), the path is resolved under the package folder, `lstat` must give a regular file (not a symlink), and `realpath` must stay inside the package folder on every serve.
  - The MIME type comes from the allowlist of contract §7, else `application/octet-stream`.
  - `Range` covers a single range, a suffix range and an open range. An unsatisfiable range gives `416` with `bytes */size`. Several ranges give the whole file.
  - CSP is `frame-ancestors {content} {app}`. An `onSend` hook adds `nosniff` and `same-origin` and removes `set-cookie` from every response.
  - The request body limit is 64 KB.
- **Runtime token.** `/rt/{t}` looks up `sha256(t)` only. The token is `HMAC(APP_MASTER_KEY, 'runtime-token:' + playId)`, made in `/play`.
  - Unknown gives `404`. Expired gives `404` for the page and `410 RUNTIME_EXPIRED` for `state` and `commit`, which matches check (1) of contract §7.
  - The runtime page CSP is `default-src 'none'; script-src 'self'; connect-src 'self'; frame-src 'self'; frame-ancestors {app}`.
  - Token A gives only the state of attempt A, because the lookup is by token hash.
- **Commit endpoint.** The order is:
  1. body shape (`kind`, `event`, `sessionId` of this play session, integer `seq ≥ 1`);
  2. in one transaction: `seq > last_seq`, else `409 STALE_SEQUENCE` (a replayed body is stale);
  3. the CMI value rules, which give `400 INVALID_CMI` with `details.field` (lengths 255/4096, timespan, exit, ≤ 250 interactions with SCORM 1.2 `type` and `result`, scores `""` or 0 to 100);
  4. store, outcome and score sync, all in the same transaction (T5a design note).

  `checkScormCmi` reads only fixed keys and returns a new object with a fixed shape.
- **SCORM 1.2 rules.**
  - `finishStatus` is the same as Moodle `StoreData(…, true)`: `not attempted` becomes `completed`, then in normal mode with credit a set raw score and a mastery score decide `passed` or `failed`. A preview has `no-credit`.
  - The rule also applies to later commits in a finished session, so a late `unload` does not lower the stored status.
  - `total_time` is the sum of the largest `session_time` of each other play session of the attempt, so arrival order and the duplicate `unload` do not change it.
  - `entry` is fixed at the first state read: `ab-initio`, `resume` after `exit = suspend`, else `""`.
  - The API keeps package element names in a `Map` (A-T4a-07). Its error codes match contract §8: 301 before `LMSInitialize`; 101 after `LMSFinish`, with no second `LMSInitialize`; 201 for a non-empty argument or an unknown element; 401 for `student_preference`; 403, 404 and 405; 402 for keywords. A new array index must be ≤ `_count`.
  - `window.API` is frozen.
- **Grade policy (ADR-010).**
  - `agsScore` follows the rule 4 table: completed or passed with no raw score gives 100/100, failed with no raw score gives 0/100, a max of 0 or `""` gives 100, and raw is capped at max.
  - `improves` keeps the best outcome of the attempt, so a commit never lowers it (AC-T5-12).
  - `syncDecision` makes a row only if the score is higher than every `pending`, `sent` or `conflict` row of that learner and activity. It marks lower `pending` rows `superseded`. One final result therefore gives one row, even after a repeated `finish` or `unload` (AC-T5-20, AC-T5-34).
  - Previews never make a row.
- **Score sync worker.** It sends the due `pending` rows one at a time, in order (an in-process single flight), with `SERVICE-AUTH-V1` and the stored service key (decrypted in memory).
  - When the launch had no line item, it calls `GET /api/lineitems?resourceLinkId=` and keeps the first id. The LTI service still applies the line item URL rule of security §8 when it posts.
  - The answers map as follows: 204 gives `sent`, 409 gives `conflict`, 400/403/404 give `failed`, and other errors retry at 5 s, 30 s, 2 min, 10 min, 30 min and then every hour, until `failed` after 24 h.
  - The `score_sync` log has no secret. `lastError` holds only the code and the service's short description.
  - A row that is superseded while it is in flight ends as `sent`, which is correct. The later, higher row gets a later LTI service timestamp.
- **Results API.** `GET /publications/:id/results` first calls `getPublication(db, libraryId(req), id)` (library B gets 404). It then reads attempts by the publication's own connection and course. Groups use a `Map` with a JSON key. Preview rows are kept apart.
- **A-T4b2-03 resolved.**
  - `play_session.id` and `picker_session.id` are `sha256(raw id)`. `getPlay`, `getPicker` and the runtime lookup hash the raw value from the URL.
  - The shell and the embedded page echo `req.params.playId` (HTML-escaped) only after a successful lookup.
- **Player shell.** The script `/_player/shell.js` loads with the page nonce, and its fetch uses `credentials: 'omit'`. The status text comes from one function on the server and in the browser. The shell has no `Permissions-Policy`. The sandbox and `allow` values have not changed since T4b2.

## Findings

### A-T5a-01: MINOR: a `finish` that arrives after a higher-`seq` body of the same page load is lost, so the LMSFinish rule is not applied

- Location: `apps/player/src/runtime/transport.ts:38,47-48` (the `seq` is set at send time), `services/cogniate-app/src/domain/attempts.ts:216,220-222` (at `de6a1bb`).
- Problem: the server applies the LMSFinish rule only to an accepted `finish` or to commits after one. When the runtime's `unload` (seq N+1) arrives before the `finish` (seq N), these steps occur:
  1. The `unload` is stored without the rule. A blank SCO stays `not attempted`, so the outcome is `in_progress`.
  2. The `finish` then gets `409 STALE_SEQUENCE`.
  3. The runtime ignores the error (`.catch(() => undefined)`), so nothing sends it again.
- Evidence:
  - Contract §7 and the spike say "The arrival order is not the `seq` order".
  - The Author's live log has a real case at `2026-10-18T06:17:29.948Z`: seq 5 was accepted 11 ms after seq 3, and seq 4 was rejected with `STALE_SEQUENCE`.
  - A `finish` closely followed by another body occurs when a SCO calls `LMSFinish` in `beforeunload`, `unload` or `pagehide`, which is common in authoring tools, or when the learner closes the window right after the end.
  - No unit test sends `unload` before a lower-`seq` `finish`.
- Impact:
  - For SCOs that never set `lesson_status`, no grade goes to Moodle and the attempt stays `in_progress`.
  - The same happens for SCOs that set `incomplete` with a raw score, because the mastery rule would make that `passed` or `failed`.
  - The Cogniate export is not affected: it sets `passed` or `failed` itself and calls `LMSFinish` at the end, and after that only the `unload` arrives, with the same CMI.
  - The ACs pass for this reason, so I do not mark it MAJOR.
- Fix (choose one, then the Architect adds one line to contract §7):
  - (a) On the server, accept a stale `finish` as a flag. If `seq ≤ last_seq` and the session has no `finished_at`, set `finished_at`, apply `finishStatus` to the stored CMI, and derive the outcome and the score sync again. After `LMSFinish` the API accepts no change, so the stored CMI of that page load is the same or newer.
  - (b) The runtime adds `"afterFinish": true` to every body that it sends after `LMSFinish`, and the server treats such a body as finished.
  - In both cases, add a unit test with the arrival order `unload(N+1)` then `finish(N)`.

### A-T5a-02: MINOR: a package can set cookies on the shared content origin and make every course there fail in that browser (`431`)

- Location: `infra/proxy/Caddyfile:34-36` (the content site forwards all request headers); `content-host/server.ts` (Node default header limit of 16 KB). The host removes `Set-Cookie` only from its own responses.
- Problem: package scripts run on the content origin with `allow-same-origin`, so they can write `document.cookie` with `path=/` and a long life. The browser then sends those cookies with every package, runtime-page and beacon request to the content origin. Above about 16 KB, the content host refuses every request.
- Evidence: live probe on `/pkg/<id>/index.html` over HTTP/1.1. Four cookies of 4,000 characters give `200`. Five give `431`. Over HTTP/2, curl gets a stream framing error. Browsers allow about 180 cookies of 4 KB for each host, so five cookies are well inside the limit.
- Impact: this is cross-tenant availability. One malicious package of library A blocks the courses of every library for each learner who opened it, until the cookies expire. The fetch commits use `credentials: 'omit'`, but the iframe navigation, the package files and `sendBeacon` all send cookies.
- Fix:
  - In the content site, use `reverse_proxy cogniate-app:4201 { header_up -Cookie }`. The content host uses no cookies, and Caddy's own header limit is much larger.
  - Optionally, send `Clear-Site-Data: "cookies"` on the `/rt/{token}` page, so that each launch also removes them from the browser.
  - Add to the residual risks list: libraries share one content origin, and therefore also share `localStorage`, IndexedDB and Cache Storage. Production needs a content origin for each library or each package.

### A-T5a-03: NIT: AC-T5-35 ("exactly one `commit_accepted {commit_event: "unload"}`") can fail when the code is correct

- Location: `tasks/T5a.md` AC-T5-35; `apps/player/src/runtime/main.ts:65`.
- Problem: the runtime's `pagehide` fires before the SCO's `pagehide` (spike, Chromium), so the beacon gets a lower `seq` than the SCO's last commits. If one of those commits arrives first, the beacon is stale. The server then rejects it, which is correct because the newer full CMI is already stored, and no `unload` is accepted.
- Evidence: the spike saw the arrival order `commit/8, commit/7, unload/4`. The live log above shows that this kind of reordering happens on the stack.
- Fix: the Architect and QA change the AC to "at most one accepted `unload`, and the stored attempt is `in_progress` with the last `suspend_data`". Or they accept the possible flake.

### A-T5a-04: NIT: a reload of the player shell is a new SCORM session for the package, but the server counts one session for each play session

- Location: `attempts.ts:180` (`max_session_time_cs` for each play session); `runtimeState` (the `entry` is fixed at the first state read).
- Problem: contract §8 says "One runtime page load = one session". After a reload of `/play/{id}`, the package starts `session_time` from zero again. The server keeps only the largest value for that play session, so the time of the shorter page load is lost. `entry` also stays at its first value (for example `ab-initio`).
- Impact: only `total_time` is too small. There is no grade effect.
- Fix: either write "one launch = one session" in the contract, or count each page load (for example, give each state read a page-load number and sum the maxima).

### A-T5a-05: NIT: `cmi.launch_data` is always `""`

- Location: `attempts.ts:186` (`launchData: ''`).
- Problem: contract §8 says the value is the manifest `adlcp:datafromlms` or `""`, but the code never reads the manifest value.
- Fix: carry `datafromlms` from the package inspector to the tracking profile, or change the contract to `""` for the prototype. The Cogniate export does not use it.

### A-T5a-06: NIT: a send that throws a non-LTI error stays due, so it is tried and logged every 2 s

- Location: `worker/score-sync.ts:67` (`throw err`), `:81`.
- Problem: an error that is not an `LtiServiceError` goes up to `drain`, which logs `internal_error`. An example is a `decrypt` failure after a change of `APP_MASTER_KEY`. The row stays `pending` with a past `next_try_at`, so the 2 s timer sends it again with no limit.
- Fix: in `send`, record such an error as `failed`, with a short `lastError` such as "Service key cannot be decrypted", or give it the normal retry schedule.

## Counts

0 BLOCKER, 0 MAJOR, 2 MINOR (A-T5a-01, -02), 4 NIT (A-T5a-03 to -06). A-T4b2-03 is resolved. I recommend that A-T5a-01 and A-T5a-02 go into the T5b batch.
