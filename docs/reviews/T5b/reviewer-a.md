Verdict: APPROVE
Round: 1

# T5b review: Reviewer-A (correctness and security)

Scope: `git diff ef2d2c0 64c101f -- . ':!docs' ':!tests'` (29 files). Spec: `tasks/T5b.md`, ADR-004 ("HTML: option C"), ADR-010 rules 5 and 8–10, app contract §5, §7–§10, §12, security §5, §7. This round also covers the follow-ups A-T5a-01, -02 and -06.

Method:
- I read every changed file at `64c101f` (`git show`). The only working-tree change is a QA test file.
- Read-only live checks on the Author's stack (`https://content.cogniate-content.test`, `curl --resolve … --cacert infra/.certs/root.crt`):
  - GET requests with large `Cookie` headers over HTTP/1.1 and HTTP/2;
  - one POST to `/rt/<random token>/commit`, which matches no session;
  - the running proxy file (`docker exec … cat`) and `docker port`.
- I made no writes. I did not read `reviewer-b.md`.

## The four Lens-A questions

1. **Can a forged or replayed late `finish` or `unload` change a grade?** Not beyond the accepted Q8 risk.
   - Only the holder of the runtime token can post to `/rt/{token}/commit`.
   - A late (stale) SCORM body is still checked (`checkScormCmi`), but its CMI is not used. The rules run on the stored CMI, and `last_seq` never goes down (`MAX(last_seq, ?)`).
   - A late `finish` only applies the LMSFinish rule. The token holder could get the same effect with an in-order forged `finish`, which T5a already accepted.
   - A duplicate is idempotent: the rule gives the same result, `syncDecision` makes no second row, and the attempt keeps its best result.
   - A late `commit` or `progress` still gets `409 STALE_SEQUENCE`. A late HTML `unload` is merged, and progress only grows.
   - For one edge case with two active sessions, see A-T5b-03.
2. **Can Resend lower or duplicate a grade?**
   - It cannot duplicate a grade. `resendSync` is synchronous (no `await`, so atomic in Node). It allows only `failed` or `conflict`, and it refuses a row when a `pending` or `sent` row has an equal or higher score.
   - It is scoped by library through `resource_link → connection` (another library gets 404). It is under the `/app-api` `Origin` rule (security §6).
   - It **can** lower a grade when the better row is `conflict` or `failed`: see A-T5b-02.
3. **Does the HTML tracker trust page data for grades?** Yes, as the accepted Q8 risk (security §7 WARNING).
   - The browser reads `data-cog-correct` and reports `'1'` or `'0'`. The dwell rule (10 s visible) and the scroll rule run only in the browser.
   - The server enforces these rules: seen pages ⊂ profile pages; answer keys ⊂ profile question ids (checked with a `Set`, so `__proto__` gives 400); values `'1'` or `'0'`; **the first answer stands** (a changed answer gives `400 INVALID_PROGRESS`, so a forged later `'1'` cannot fix a wrong first answer). The server also computes the score (round(correct / total × 100)) and the pass mark (`masteryScore`, else 70).
   - The page shows the correct option in its own markup, so a server-side answer key would not stop a learner with developer tools. No change is needed. Keep Q8 in the residual risks list (completion-type courses only).
4. **Is the cookie stripping complete?** No. The proxy refuses large cookie headers before `header_up -Cookie` runs: see A-T5b-01.

## What is right (checked, no finding)

- **A-T5a-01 resolved.** In `applyCommit`, a late `finish` or `unload` is accepted with `stale: true` in `commit_accepted`. A late `finish` sets `finished_at` and applies `finishStatus` to the stored CMI, which is the same or newer because the API changes nothing after `LMSFinish`. The test sends `unload` (N+2), then `finish` (N+1), and gets `completed` 100, one `pending` row and `[['unload', false], ['finish', true]]`. A later `commit` N+1 still gets 409.
- **A-T5a-03 resolved as a side effect.** The runtime's late `unload` is now accepted, so AC-T5-35 no longer depends on arrival order.
- **A-T5a-06 resolved.** In the worker, any error that is not an LTI error (for example a service key that cannot be decrypted) is now `failed` at once. It is logged once with `internal_error`, and `lastError` gives a trace id. It is no longer sent again every 2 s.
- **Grade policy in one place.** `syncResult` maps the answers: 2xx gives `sent`, 409 gives `conflict` (no retry), 400/403/404 or a local error give `failed`, and 401, 5xx or no answer retry at 5 s, 30 s, 2 min, 10 min, 30 min and then every hour. The retry window is 24 h from `retryFrom`, which is `resent_at` for a resent row (migration 007), else `created_at`. For a conflict, `lastError` keeps the LTI code (`PLATFORM_CONFLICT`) and adds "Moodle has a grade with a newer time".
- **HTML runtime.** `watchFrame` attaches when `readyState` is not `loading` (a 150 ms poll plus `load`), never only on `load` (AC-T5-36).
  - The visible-time dwell pauses on `visibilitychange` and `pagehide`. The scroll-end check allows 24 px of slack or a short page. The menu page counts as seen on visit.
  - Answers are caught with capture `click` and `change` listeners, and only the first answer counts.
  - Internal `.html` links lose `target` and `rel`. The tracker writes no `innerHTML` and changes no package bytes (AC-T5-10 test).
  - Question ids are in a `Map`, and progress uses null-prototype objects (A-T4a-07).
- **Refresh.** `POST /publications/:id/results/refresh` is scoped by library. It makes one AGS results read for each learner and activity (`SERVICE-AUTH-V1`, with the line item URL rule in the LTI service). A failed read keeps the last value and logs `gradebook_refresh_failed`. `gradebookDiffers` is true only when the last sync is `sent` and Moodle's ratio differs from the best ratio (contract §5).
- **Shared value rules.** The player's `LMSSetValue` checks now use the constants of `@cogniate/tracking` (B-T5a-02), so the browser and the server cannot drift.
- **Partial A-T5a-02 progress.** The proxy now has `header_up -Cookie` and `header_down -Set-Cookie`. The runtime page sends `Clear-Site-Data: "cookies"`. The app container publishes no port, so only the proxy reaches the content listener. Five 4,000-character cookies over HTTP/1.1 now give `200` (T5a: `431`).

## Findings

### A-T5b-01: MINOR: A-T5a-02 is only partly fixed, because the proxy itself refuses large cookie headers before it strips them

- Location: `infra/proxy/Caddyfile` (no `max_header_size`; Caddy 2.11.7).
- Problem: Caddy refuses the request before `header_up -Cookie` runs, at about 16–20 KB of cookies over HTTP/2 and 20–40 KB over HTTP/1.1. A package that sets five 4 KB cookies therefore still blocks every request from that browser to the content origin, for all libraries. `Clear-Site-Data` cannot help, because the `/rt` request is refused too.
- Evidence (live, `/pkg/<id>/index.html`):
  - HTTP/1.1, one joined header: 5 × 4,000 characters give `200`. 10, 20, 25, 30 or 40 × 4,000 give `431`, with the body `431 Request Header Fields Too Large` and `Content-Type: text/plain; charset=utf-8`. That is Go's response, not Node's (Node sends no body).
  - HTTP/2, separate `cookie` fields as browsers send them: 3 × 4,000 give `200`. 5 × 4,000 give `GOAWAY error=1` from the server. 20 and 40 × 4,000 fail.
  - The app host behaves the same, so this is the proxy limit.
- Impact: the same cross-tenant availability problem as A-T5a-02 remains. It only needs five cookies instead of five over Node's limit. Browsers allow about 180 cookies of 4 KB for each host.
- Fix: in the global options, set `servers { max_header_size 1MB }`, which is above what a browser can send for one host (about 180 × 4 KB = 720 KB). Caddy uses it for HTTP/1.1 and HTTP/2. Then run the same probe again: 5, 50 and 170 cookies, over HTTP/1.1 and as separate HTTP/2 fields, must all give `200`. Keep "one content origin for each library" in the residual risks list.

### A-T5b-02: MINOR: Resend can lower Moodle's grade when the better row is `conflict` or `failed`

- Location: `services/cogniate-app/src/domain/score-syncs.ts` `resendSync` (`status IN ('pending', 'sent')`).
- Problem: the "equal or better" check counts only `pending` and `sent` rows. A user can therefore resend an older, lower `failed` row while the learner's better row is `conflict` or `failed`. After the send, Moodle shows the lower score.
- Evidence: ADR-010 rule 5 counts `pending`, `sent` **and `conflict`** rows when it decides whether a result is better ("never lower"). An example:
  1. Row 1 is 50/100 and `failed` (the learner was not gradable).
  2. Row 2 is 100/100 and `conflict`, or `failed` after a 24 h outage.
  3. Resend row 1 gives `200`, then `sent`, so Moodle shows 50 while `best` is 100.

  The T6 portal will show Resend on every `failed` or `conflict` row, so this human error is likely.
- Fix: refuse the resend (`409 SYNC_NOT_RESENDABLE`, "Resend the better result instead") when any other row of that learner and activity that is not `superseded` has a higher ratio. Or offer Resend only on the best row. Add a unit test for both cases (better row `conflict`, better row `failed`).

### A-T5b-03: NIT: a late body uses the attempt's stored CMI, which another active session of the same attempt can have written

- Location: `domain/attempts.ts` `applyCommit` (`storedCmi = … saved`, where `saved` is `attempt.cmi_or_progress`) and the `sessionMax(…, stored.session_time)` update.
- Problem: suppose two windows of the same attempt are open (S1 and S2). If S1's late `finish` arrives after S2 committed, the LMSFinish rule runs on S2's state, which can give an early final result and score sync. S2's `session_time` is also added to S1's maximum, so `total_time` counts S2 twice.
- Impact: small. The best-result rule limits the grade effect, and it needs two windows plus reordering.
- Fix: keep the last accepted CMI of each play session (a column on `play_session`) and use it for late bodies. Or note the edge case in the contract.

### A-T5b-04: NIT: two refresh robustness details

- Location: `services/cogniate-app/src/app/results.ts:53` (`scores.find(…) ?? scores[0]`), `:56` (`throw err`).
- Problem:
  - (a) If no entry has the learner's `userId`, the code stores the first entry, which can be another learner's grade.
  - (b) An error that is not an LTI error (for example a `decrypt` failure) stops the whole refresh with 500.
- Fix:
  - (a) Use only the entry with `userId === target.userSub`, else `null`. The LTI service filters by `userId` and returns it, so this is defensive.
  - (b) Treat it like a failed read: log it, keep the last value and continue.

## Counts

0 BLOCKER, 0 MAJOR, 2 MINOR (A-T5b-01, -02), 2 NIT (A-T5b-03, -04). A-T5a-01, -03 and -06 are resolved. A-T5a-02 is partly resolved and continues as A-T5b-01. A-T5a-04 and -05 were not in this batch.
