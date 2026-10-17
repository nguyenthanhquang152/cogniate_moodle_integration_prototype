Verdict: APPROVE
Round: 1

# T4b2 review: Reviewer-A (correctness and security)

Scope: `git diff cded5ea 4c6a04d -- . ':!docs' ':!tests'`. Spec: `tasks/T4b2.md`, app contract §5 and §6 (at `61bef65`), §12, security §3 to §8, flows §6b and §6c.

Method:
- I read all 24 changed files.
- I did read-only checks on the Author's stack with `curl --resolve … --cacert infra/.certs/root.crt`:
  - `/tool/launch?ltik=short` and `/tool/deep-link` give `401 INVALID_LTIK`.
  - An unknown picker gives `404 PICKER_NOT_FOUND`. An unknown play id gives `404 PLAY_NOT_FOUND` for the shell and for the embedded page.
  - An unknown play id gives `404` JSON on `/app-api/play/…/status`, with no session and no `Set-Cookie`.
  - The error pages have `frame-ancestors https:; form-action 'none'`, `Referrer-Policy: same-origin` and `no-store`. They have no `X-Frame-Options` and no `Set-Cookie`.
- Log scan of `infra/.logs/cogniate-app.jsonl` (counts only):
  - 0 `ply_` ids, 0 `pck_` ids, 0 standalone 43-character tokens and 0 `ltik=`.
  - The request paths are logged as route patterns (`/tool/picker/:pickerId`, `/play/:playId`).
- Disclosure: one check sent a well-formed but fake ltik. That request wrote one `handoff` row in the Author's database (see A-T4b2-02). I made no other writes.
- Note for the Lead: the working tree holds T5a work in progress (`domain/attempts.ts`, `packages/tracking/`, and edits to `launch.ts` and `play.ts`). The live stack runs the working tree, so my live checks did not run exactly `4c6a04d`. My code findings use `git show 4c6a04d:…`.
- I did not read `reviewer-b.md`.

## What is right (checked, no finding)

- **Single-use handoff (security §4).** Both `/tool/launch` and `/tool/deep-link` use the same order:
  1. Check the format (`^[A-Za-z0-9_-]{43}$`). A malformed ltik writes no row.
  2. `useHandoff(sha256(ltik))` with `INSERT OR IGNORE`. This is atomic, and a second use gets `409 HANDOFF_USED` and `handoff_rejected`.
  3. Only then call `GET /api/idtoken`.

  The ltik goes into the `LTIK-AUTH-V2` header only after the format check, so header injection is not possible. A temporary LTI service failure after step 2 uses up the handoff, and the user must open the activity again. The contract order accepts this.
- **Publication only from the signed target (A-T0-03).** `publicationFromTarget(token.launch.target, urls.lti)` has these rules:
  - It accepts only the LTI service origin, a path that starts with `/lti/launch/`, and exactly one `resource=pub_…`.
  - It never reads the query of the app URL. The unit test (AC-T4-23) changes `resource` on `/tool/launch` and still gets the signed course.
  - `publicationOfConnection` joins `course.library_id = connection.library_id`, so a valid id of another library gives `404 publication_not_in_connection`. A withdrawn publication gives `410`. On error, no attempt is written.
- **Tenant isolation.** These paths all start at `platform.id` → `findLaunchConnection` (only `registered` or `connected`) → library:
  - the picker list (`pickablePublications`, which filters by connection and library);
  - the picker POST and the launch (`publicationOfConnection`);
  - the stats.

  `publicationJson` gets stats only after the library-scoped `getPublication`. Learners are counted by connection and course.
- **Rebind and attempts.** The resource link key is (connection, deployment, context, resource link). A new signed target updates `publication_id` and logs `resource_link_rebound`.
  - `chooseAttempt` continues the newest attempt only if it is `in_progress` and belongs to the course of the current publication. In all other cases it uses the current version.
  - The fallback reuses the row for the current version, so a rebind back to the first course (A → B → A) does not break the UNIQUE (resource link, user, version) key.
  - `linkPickToResourceLink` runs only when a link is created or rebound. This matches contract §5 `stats.activities`.
- **Deep-link reasons and roles.** The reasons `invalid_ltik`, `not_deep_linking`, `role_not_allowed` and `unknown_platform` are all present. A resource launch ltik always gives `not_deep_linking` before the role check (AC-T4-20). The role check is the exact suffix list. For the order of `unknown_platform`, see A-T4b2-01.
- **Picker POST.** The order follows contract §6:
  1. `openPicker`: `404`, `410 PICKER_USED`, `410 PICKER_EXPIRED`.
  2. `Origin === PUBLIC_APP_URL`, else `403` and `csrf_rejected`. The picker is not used.
  3. Publication of this connection and available, else `400` with no deep-linking call.
  4. Atomic `claimPicker` (`WHERE used_at IS NULL AND expires_at > ?`).
  5. `POST /api/deeplinking`. On failure the code calls `releasePicker`.

  The answer `target` origin must equal the issuer origin of the picker, else the code releases the picker and sends `502`. The content item matches flows §6b: `ltiResourceLink`, title ≤ 255, a URL on the LTI service launch path, and `lineItem.scoreMaximum: 100`.
- **Auto-submit and framing.**
  - The auto-submit page CSP is `script-src 'nonce-…'; frame-ancestors {issuer}; form-action {return origin}`. The JWT and the action are HTML-escaped. The `/tool/deep-link` → picker redirect uses `no-referrer`. The picker pages use `same-origin`, so the form POST sends a real `Origin` (security §5).
  - Tool pages set no cookies, so the third-party iframe needs no partitioned cookie.
- **Player shell and embedded page.**
  - `/play/{id}` has `frame-ancestors 'none'; frame-src {content}; connect-src 'self'; script-src 'nonce-…'; form-action 'none'`.
  - `/play/{id}/embedded` has `frame-ancestors {issuer}; form-action 'none'`, where the issuer comes from the stored platform. The embedded page opens only for `documentTarget === 'iframe'`.
  - The runtime iframe has `sandbox="allow-scripts allow-same-origin"` and `allow="autoplay; fullscreen"`, which match security §7.
  - The Lead's brief says "frame-ancestors {content} {app}". That is the `/pkg` rule (T5a), not the shell rule. The code follows the security §5 table.
  - "Back to Moodle" uses the return URL only if it is https on the issuer origin.
- **Runtime token.** `HMAC-SHA256(APP_MASTER_KEY, 'runtime-token:' + playId)` (base64url). Only its SHA-256 is stored (`runtime_token_hash UNIQUE`). The play session stores no ltik.
- **Logs.** `launch_accepted` logs `attempt_id` and `preview`. `resource_link_rebound` logs `rl_` and `pub_` ids. The rejection events log a reason or code only. No event logs an ltik, a play id, a picker id or a runtime token.
- **XSS.** The course title, package title, context title and activity title are escaped in the picker and in the shell.
- **A-T4b1-03 resolved.**
  - `register.ts` refuses a platform with `active = false` (`REGISTRATION_FAILED`, `platformId = null`, so the code does not change that platform).
  - The "known client id" path of the LTI service now keeps the stored `active` value.
  - A test was added in `registration.test.ts`.

## Unit-test-only ACs (AC-T4-20, -22, -23, -26, -27, -29)

Unit tests are enough for the Author's round. The unit tests go through the real Fastify routes (`inject`), check the log events and check that no deep-linking call occurs. QA already has black-box specs for all six ACs:
- `tests/acceptance/T4b2/2-launch.spec.ts`, `3-rebind.spec.ts`, `5-negative.spec.ts` and `zz-headers-errors.spec.ts`;
- `tests/host/run-t4b.mjs`.

The AC-T4-23 spec sends Moodle's id_token POST from Node, changes `resource` in the real `303`, and opens it in the browser.

Condition: AC-T4-22 (Origin) and AC-T4-23 (signed target) are the two key security properties of this task. QA must run them black-box on the real stack before T4b2 is done, with no waiver. Only `role_not_allowed` (AC-T4-20) can stay unit-only, because Moodle does not send that case (the spec says so).

## Findings

### A-T4b2-01: MINOR: the `/tool/deep-link` check order differs from contract §6 step (2b)

- Location: `services/cogniate-app/src/tool-pages/launch.ts:152-156` (at `4c6a04d`).
- Problem: the code checks the connection (`unknown_platform`) after the message type and the role, but contract §6 (at `61bef65`) puts it at step (2b), before the message type.
- Evidence: the code order is `if (token.launch.type !== 'LtiDeepLinkingRequest') …; if (!hasStaffRole(…)) …; const connection = findLaunchConnection(…)`. The contract says "(2b) `platform.id` is a connection (`404` page, `deep_link_rejected {reason: unknown_platform}`); (3) `launch.type` …". The Architect wrote (2b) after the code commit `4c6a04d`.
- Impact: there is no security effect, because all paths reject. A resource ltik from a platform without an active connection gets `403 not_deep_linking` and not `404 unknown_platform`, so the page and the log reason do not match the contract.
- Fix: move the `findLaunchConnection` and `httpsOrigin` check to directly after `handoff()`, as in `/tool/launch`, and add a unit test for the order. Or the Architect changes the contract to the code order. Make one of them change, so that QA tests one order.

### A-T4b2-02: MINOR: no table is pruned, and any well-formed ltik writes a `handoff` row

- Location: `tool-pages/launch.ts:72` at `4c6a04d` (`useHandoff` before `getIdToken`), `domain/migrations/004_launch.sql` (`handoff`, `picker_session`, `play_session`).
- Problem: each request with a 43-character ltik writes one permanent row before the LTI service checks the ltik, and no code deletes old `handoff`, expired `picker_session` or expired `play_session` rows.
- Evidence: `grep "DELETE FROM (handoff|picker_session|play_session)"` in `services/cogniate-app/src` finds nothing. My one live request with a fake ltik got `401 INVALID_LTIK` and wrote one row.
- Impact: unauthenticated requests make the table grow with no limit, which is a slow disk-use DoS. Expired picker rows also keep the encrypted ltik (see A-T4b2-04).
- Fix: keep the single-use-first order (the contract requires it). Add pruning at startup and every hour:
  - `handoff` rows older than the longest ltik life plus the clock skew;
  - `picker_session` and `play_session` rows that expired more than one day ago.

  If the Lead prefers, T8 can do this. Record it in the residual risks list.

### A-T4b2-03: MINOR: play ids and picker ids are stored in clear, unlike the other bearer tokens

- Location: `004_launch.sql` (`play_session.id`, `picker_session.id` are the primary keys); contract §6 "Play session" sentence.
- Problem: the play id is the only authorization for `/play/{id}`, the status and (through the shell) the runtime URL, but the database stores it in clear. A database copy can therefore open every live player for up to 24 h, and every open picker for up to 1 h.
- Evidence: the portal session token (`001_init.sql:21`, `token_hash`) and the registration ref (`002_connections.sql:11`, `ref_token_hash`) are stored only as SHA-256. The contract says "only its hash is stored, so a database copy alone cannot rebuild a runtime URL". That is true only offline. With a stored play id, `GET /play/{id}` on the live server returns the runtime URL. The picker POST takes any `Origin` header from a non-browser client.
- Impact: a person with database read access can act as a learner in an active play session. In T5a this includes CMI writes that become Moodle grades. A person who also has a valid picker id can send a deep-linking pick for a teacher.
- Fix: key `play_session` and `picker_session` by `sha256(id)`. The URL keeps the raw id, and the runtime token stays `HMAC(masterKey, raw play id)`. Or the Architect accepts the risk and corrects the contract sentence. This is for the Author and the Architect, and it is best done before T5a builds on `play_session`.

### A-T4b2-04: NIT: a used picker keeps the encrypted ltik

- Location: `domain/pickers.ts` (`claimPicker`), `tool-pages/picker.ts` (after a successful `deepLinking`).
- Problem: after a successful pick, `ltik_encrypted` stays in `picker_session` until the row is deleted, which never happens (A-T4b2-02).
- Impact: this is small. The value is encrypted with `APP_MASTER_KEY`, and the ltik expires. But with the key, it gives `LTIK-AUTH-V2` access to that launch until it expires.
- Fix: after the answer target check passes, set `ltik_encrypted = X''` (the column is `NOT NULL`). Do not do this in the release path, because a retry still needs the ltik.

## Counts

0 BLOCKER, 0 MAJOR, 3 MINOR (A-T4b2-01 to -03), 1 NIT (A-T4b2-04). A-T4b1-03 is resolved.
