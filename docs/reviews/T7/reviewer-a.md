Verdict: APPROVE
Round: 1

# T7 review: Reviewer-A (correctness and security)

Scope:
- The Author's harness (`8b45d15`, `4a35ee0`): `infra/scripts/{e2e-reset,e2e-wait,demo-prepare,moodle-cron,qa-suite}.sh`, `infra/demo/prepare.mjs`, `infra/moodle/php/{start_lti_registration,activate_lti_tool,add_lti_activity}.php`.
- The QA-E2E suite: `tests/e2e/**` (specs, `lib/capture.ts`, `lib/e2e.ts`, `lib/learner.ts`, `lib/oracle.ts`, `host/run-t7.mjs`).

Spec: `tasks/T7.md`, `docs/architecture/README.md` §6. QA verdict: `docs/reviews/T7/qa.md` (PASS, 15/15 ACs, 3 runs).

Method:
- I read all harness files, the three scenario specs, the capture, evidence and oracle libraries, and the secret handling of the host runner.
- I scanned `qa.md` for secret-looking values. The 4 standalone 43-character strings are run folder names (`qa-e2e-…-517Z`), not tokens.
- I did not read `reviewer-b.md`.

## The four Lens-A questions

1. **Does `demo:prepare` or a Moodle PHP helper bypass a control that production keeps, in a way that hides a real failure?** No. The proof does not use them.
   - The E2E suite never calls a CLI helper: no `moodle-php`, `start_lti_registration`, `activate_lti_tool`, `add_lti_activity`, `seed:lti-*` or `demo:prepare` in `tests/e2e/**`.
   - Scenario A drives the real Moodle UI: Manage tools, "Add LTI Advantage" in the `startltiadvregistration.php` frame, the app's `/tool/register` page in Moodle's frame, Activate, the tool settings, activities through `modedit.php` with "Select content", and the Deep Linking return to `contentitem_return.php` (captured).
   - The oracle (`cogniate_qa_oracle` web service) is read-only: grade items, completion, course contents.
   - In `demo:prepare`, the shortcuts are labelled as demo set-up, and AC-T7-15 is not a §6 proof:
     - The CLI makes the registration token the way `startltiadvregistration.php` does (scope `reg`, a new client id, 1 h, site key). The registration itself still runs over HTTPS with all checks: the LTI service reads Moodle's OpenID configuration and registers at Moodle's registration endpoint, which validates the token, and then come the app's confirm page and `POST /tool/register`.
     - The CLI also activates the tool (a database update that matches the admin's "Activate" and settings).
     - It creates the activities with `toolurl=…/lti/launch/cogniate?resource=pub_…`, without Deep Linking. A launch of such an activity still takes the publication from the **signed** `target_link_uri`, so no app control is bypassed. Only the picker and the Deep Linking response JWT are skipped, and the E2E covers those (AC-T7-03, AC-T7-08).
2. **Least privilege and no printed secrets.**
   - The helpers run as the Moodle CLI user (full Moodle rights, by nature) and touch only the named records: one tool type, one course module.
   - `start_lti_registration.php` reads the `ref`-bearing URL from stdin (`--url=-`). `prepare.mjs register -` reads its URL from stdin.
   - `demo-prepare.sh` prints only step names, platform and tool-type ids, the tool name and the activity URLs. The passwords are named as "in `.env` and seed.json".
   - `e2e-wait.sh` gives the admin password to curl through a `0600` temp file (`password@file`), never on the command line, and prints only health bodies and the final URL.
   - One leak path in `demo-prepare.sh`: see A-T7-01.
3. **Does Scenario C really test replay and secret leakage?** Yes, for what AC-T7-10 asks.
   - **C1** posts the captured learner launch form (`id_token` + `state`, whose first post was a 303) again, from a browser page **and** from Node, both with the first launch's `__Host-lti_state_*` cookie. It requires "not a redirect", the page code `INVALID_STATE`, and `launch_check_failed {code: INVALID_STATE}` in `lti-service.jsonl`. That proves the state is single-use in the real flow. The nonce binding (an old `id_token` with a new state) and the ltik handoff replay are proven elsewhere (T2a ACs; AC-T4-24), not in T7.
   - **C2** captures ltiks (the launch 303 `Location`, `/tool/launch`, `/tool/deep-link`), `id_token`s (launch forms and Deep Linking response JWTs), runtime tokens (the runtime frame, `learner.ts`), service keys (from `GET /api/idtoken` for each captured ltik) and the API keys (`infra/.secrets/lti-api-key.*`).
     - It searches every `infra/.logs/*.jsonl` for the full value and, for a JWT, also the payload and signature parts (each needle at least 16 characters).
     - It **requires at least one value of each kind**, so an empty capture cannot pass.
     - QA's run 1 result: 8 ltiks, 3 service keys, 4 runtime tokens, 11 `id_token`s and 2 API keys, with 0 hits. Runs 2 and 3: 28 captured, 0 found.
     - For the scope limits, see A-T7-02.
4. **Gap between what T7 proves and README §6.**
   - T7 proves the "Full E2E on a real Moodle 5.2" row (AC-T7-01, AC-T7-11: three runs, `retries: 0`, about 3 min each) on a local Moodle **5.2.4** in Chromium, with the default profile and no knobs (AC-T7-13). It also supports the SCORM, HTML, Deep Linking and registration, portal and tenant-isolation rows (AC-T7-02 to AC-T7-09).
   - The §6 "Not proven" line already lists the real limits: MoodleCloud (Q5), Safari Deep Linking (Q16), the player in Firefox and Safari, and a real person closing a real window. T7 adds nothing to that list.
   - Two notes for the Lead or Architect: the §6 "Status" column still says "planned" for the rows that T7 now proves; and the "LTI 1.3 security" row rests on the T2 ACs, because T7's C1 covers only the single-use state.

## Other checks (no finding)

- `e2e:reset` first builds the player and the portal from the current code, then `stack:reset` (with its own-project guard), `stack:up` with `STACK_PROFILE=default`, `seed`, and `e2e-wait`. `qa-suite.sh` repeats `e2e-wait` after the run and fails the run if the stack is no longer clean. `E2E_RESET=0` is marked "debugging only".
- `moodle:cron` is a fallback. QA did not need it (qa.md, AC-T7-05).
- `tests/e2e/artifacts/` is git-ignored, and no artifact is tracked. Evidence JSON masks secrets (`masked()`: first 6 characters and the length). `host/run-t7.mjs` redacts the known secrets (`.env` `*PASSWORD|SECRET|KEY|TOKEN*`, `infra/.secrets/*`) in text files and replaces `captured-secrets.jsonl` with a masked list.

## Findings

### A-T7-01: NIT: `demo-prepare.sh` puts the registration URL (with `ref`) and the registration JWT on a process command line

- Location: `infra/scripts/demo-prepare.sh` `jget` (`node -e '…' "$1" "$2"`), used with `$c` (holds `registrationUrl` with `ref`) and `$reg_start` (holds the URL with `registration_token`).
- Problem: the script sends these URLs through stdin so that they never appear on a command line (comments in `start_lti_registration.php` and `prepare.mjs`), but `jget` passes the whole JSON as an argument. Each value is visible in the local process list for the life of that `node` process.
- Impact: small (local only, a few milliseconds, single-use values with a life of 1 h or 24 h on a dev stack).
- Fix: let `jget` read the JSON from stdin (`printf '%s' "$c" | node -e '…' "$key"`).

### A-T7-02: NIT: the C2 grep asserts only the five AC kinds, and only in `infra/.logs/*.jsonl`

- Location: `tests/e2e/3-scenario-c.spec.ts` C2 (`asked`). The `state` and `registration_ref` kinds are captured but only reported.
- Problem: security §11 says that the logger redacts `ref` and runtime tokens. Play ids and picker ids are bearer capabilities too (security §10). A hit for `state` or `ref` only adds a note, and play and picker ids are not searched. The search covers the three service JSON logs but not the container stdout (the same events) or the proxy and Moodle container logs (the proxy has no access log, so this is a small gap).
- Fix: also assert `state`, `registration_ref`, and the raw `ply_` and `pck_` ids from the `/play/…` and `/tool/picker/…` URLs. Optionally add `docker compose logs` of the services to the search.

### A-T7-03: NIT (handover): Playwright traces hold raw secrets

- Location: `tests/e2e/artifacts/**/trace.zip` (and the HTML report), copied by `host/run-t7.mjs` without redaction (redaction applies to text files only).
- Problem: a trace records the request bodies, cookies and typed fields, including `id_token`s, ltiks, state cookies and the Moodle and portal passwords. The folder is git-ignored and local, so there is no leak today.
- Fix: keep traces out of any shared evidence (for example the T9 human review pack), or record the shared runs with traces off and screenshots only. Say this in `tests/e2e/README.md`.

## Counts

0 BLOCKER, 0 MAJOR, 0 MINOR, 3 NIT (A-T7-01 to -03).
