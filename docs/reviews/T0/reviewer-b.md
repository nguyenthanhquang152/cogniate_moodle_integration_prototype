Verdict: APPROVE
Round: 3

# T0 design review — Reviewer-B (lens: "Can a human team own it?")

Scope: everything under `docs/architecture/` (README, ADR-001 to ADR-010, two contracts, `rea-evaluation.md`, `open-questions.md`, tasks T1 to T8). Inputs: `CLAUDE.md`, `docs/team/charter.md`, `docs/research/inputs.md`, `infra/moodle/SPIKE-NOTES.md`, the spec, the dev-portal screenshot.

| Severity | Count | Ids |
| --- | --- | --- |
| BLOCKER | 0 | — |
| MAJOR | 5 | B-T0-01 to B-T0-05 |
| MINOR | 11 | B-T0-06 to B-T0-16 |
| NIT | 4 | B-T0-17 to B-T0-20 |

## What is good (keep it)

- Many diagrams. Each key flow has a sequence diagram. The terms table (README §2) exists.
- ADRs show options and reasons in tables. The "Facts from the spike → design consequence" table (README §11) is very useful.
- Most acceptance criteria are concrete, numbered and black-box. Each task has a self-check list.
- The open questions have a recommendation, an owner and "what it blocks".

## Answers to the Lead's questions

1. **What can we cut?** The Moodle course shell (web services), the compatibility-only endpoints on the critical path, two persisted caches, the ltik copy in the play session, key rotation, and two derived status values. See B-T0-07 and B-T0-03. None of these is needed for the goal.
2. **Task size and order.** The order is correct, but the path is fully serial and T3, T4 and T5 are too large (22, 21, 19 ACs). **T5 (player) is the most likely to blow up.** Split it and do a player spike early. See B-T0-03.
3. **Test strategy.** The three layers (unit, acceptance, E2E) are right. Gaps: ACs that use log lines that no contract defines, and "no request was made" checks that cannot fail (B-T0-04). The LTIAAS compatibility claim has no test (B-T0-05). Other gaps: test knobs (B-T0-12) and the wizard text (B-T0-13).
4. **Operability.** Not yet ready for humans. The "human browser" path does not handle CA trust, and certificate errors in iframes cannot be accepted (B-T0-02). The startup order can break a first run (B-T0-06). The fixtures are not in a clean clone (B-T0-14). There is no dev loop for the front end (B-T0-15). **The HTTPS + Caddy + four names cost is justified, but the fallback is not clear** (B-T0-01).
5. **Readability.** The diagrams and sentence style are mostly good (about 80% STE). The README is too long and mixes audiences. Some terms drift, and the same paths exist on two hosts. See B-T0-08, B-T0-09, B-T0-10.

---

## Findings

### B-T0-01 — MAJOR — The TLS fallback plan is not usable as written

- **Location:** `README.md` §10 (Ports row), §11 "Facts that would change a decision"; `adr/ADR-005-local-topology-tls-cookies.md` "Revisit when"; `tasks/T1.md` Design notes.
- **Problem:** The last fallback ("TLS work is more than half a day → spike layout, http, same-site") breaks the cookie design and many ACs, but the docs do not say what changes.
- **Evidence:**
  - First, the cost is justified. The spike says that its layout is same-site and hides the cross-site cookie path (SPIKE-NOTES §7 CAUTION, Risk 1). The two riskiest browser paths only exist cross-site: (a) the cross-site POST from `auth.php` with the `SameSite=None` state cookie, and (b) the Deep Linking modal iframe with a partitioned third-party cookie (README §9.4). On a same-site stack, T2 to T7 can pass and the first real pilot can still fail. The extra cost is one proxy, CA trust in three clients, one Moodle curl change, and the human-browser setup (B-T0-02). Four names cost almost nothing after the proxy exists.
  - The spike layout runs the tool **on the host** at `http://localhost:3000` with a socat sidecar (SPIKE-NOTES §6). README §10 runs Node and Playwright **in compose**. In a container, `localhost` is the container itself. SPIKE-NOTES §6 marks "tool in a container" as NOT VERIFIED.
  - On `localhost`, the app (`:4200`) and the content origin (`:4201`) are the same site, and cookies ignore ports. So the README §9.1 control ("content origin is a different site, no cookie tossing") is lost.
  - Many ACs hard-code `https://*.test` URLs and cookie flags: AC-T1-03, AC-T1-07, AC-T2-08 (`__Host-`, `Secure`, `SameSite=None`, `Partitioned`), AC-T4-01, AC-T5-01, AC-T5-03, AC-T5-17, AC-T7-07. No document lists which ACs change in the fallback.
  - URLs are literals in many places (contract §1.1, ADR-009 registration request, ADR-009 manual values). README §10 says "If 443 is busy … then every URL has `:PORT`". Nothing defines one place that builds these URLs.
  - Nobody owns the "half a day" decision.
- **Suggested fix:**
  1. Keep option C.
  2. Make the **first** fallback keep HTTPS: a CA made with `openssl` by `gen-env` and static certificates in Caddy (or in the Node proxy). The names, the cookies and the ACs stay the same. See also B-T0-06.
  3. If the http fallback stays as a last resort, write it as a table: hosts and ports, where Node and Playwright run, the cookie rules, the ACs that change or become N/A, and the human-review text. The Lead decides at the time-box, not the Author.
  4. Build every public URL from four config values (`PUBLIC_MOODLE_URL`, `PUBLIC_LTI_URL`, `PUBLIC_APP_URL`, `PUBLIC_CONTENT_URL`). Do not allow URL literals in code. Tests read the same values. Then `PUBLIC_PORT` works too.

### B-T0-02 — MAJOR — A human cannot start and demo the stack in their own browser with the current plan

- **Location:** `README.md` §10 "Human browser (optional)"; `adr/ADR-005…` Consequences; `adr/ADR-008…` "Root scripts"; `tasks/T1.md` (`infra/README.md`).
- **Problem:** The docs treat the human browser as a host-name mapping only, but the browser must also trust the dev CA. No single command starts a ready demo.
- **Evidence:**
  - The human path covers `/etc/hosts` (needs `sudo`) or a Chrome flag. It does not cover the CA. Caddy in a container cannot install its root into macOS.
  - Three key screens are **iframes**: the registration frame in Moodle, the "Select content" modal (README §9.4 CAUTION), and the runtime frame in the player (README §5). Chrome shows no "Proceed" button for a certificate error in an iframe, so the frame stays blank. The human must first open each host in a tab and accept the warning, and Chrome forgets this decision later.
  - The Chrome `--host-resolver-rules` flag works only when Chrome starts as a new instance with its own profile. The README does not say this.
  - A first run needs at least seven steps, which are spread over four documents: `npm ci`, `gen-env`, `npm run build` (AC-T6 setup), `stack:up`, `seed`, the host mapping, and the CA trust. There are seven seed and reset commands: `seed`, `seed:lti-manual`, `seed:lti-activity`, `lti:bootstrap`, `stack:reset`, `e2e:reset`, `gen-env` (T1, T2, T4, T7, contract §6).
  - There is no demo state. To see one learner launch, a human must do the whole admin, teacher and publish flow by hand (T7 Scenario A, steps 1 to 4).
- **Suggested fix:**
  1. `npm run demo`: run `gen-env` if `.env` is missing, then build, `stack:up` and `seed` (idempotent). Then print the four URLs and the user names. Read the passwords from `.env`.
  2. `npm run demo:browser`: open a dedicated Chromium profile with `--host-resolver-rules="MAP *.test 127.0.0.1"` and the dev CA trusted (or certificate errors ignored, **only** in that throwaway profile). This changes nothing on the Mac. As an option for the human's daily browser, add `npm run trust-ca` and `untrust-ca` (login keychain) plus the hosts line.
  3. `npm run demo:prepare`: drive Scenario A up to "the learner can open the activity" (by API and CLI), so that a demo starts in about 2 minutes.
  4. Put one command table in `infra/README.md` (command, when to use it, what it deletes or keeps).
  5. Add an AC to T1 (or to the T9 docs task): "A person who did not build the stack follows `infra/README.md` on macOS and reaches the Moodle login and the portal in their browser in ≤ 10 minutes, with images already pulled."

### B-T0-03 — MAJOR — T3, T4 and T5 are too large for one session and one review; T5 is the most likely to blow up

- **Location:** `tasks/T3.md`, `tasks/T4.md`, `tasks/T5.md`, `tasks/T7.md` Scope; `README.md` §13 task index.
- **Problem:** The critical path is fully serial (T1 → T7), and three middle tasks each have about 20 ACs over several features. One surprise stalls everything behind it.
- **Evidence:**
  - AC counts: T1 12, T2 17, **T3 22**, **T4 21**, **T5 19**, T6 10, T7 12.
  - T3 has six features: service keys, Deep Linking (three endpoints), the token client, AGS (CRUD, scores, results), NRPS, dynamic registration, and OAuth stubs.
  - T4 has a mock session, a package inspector (15 reject codes), dynamic and manual connections, a web services client, publications and course shell, the picker, the launch and the tool-page CSP.
  - Why T5 is the riskiest:
    - It has the most browser unknowns: the real `scorm-api.js` in three nested documents on two origins with a sandbox, `sendBeacon` on `pagehide`, and scroll and visibility events in a child frame.
    - The fit of `scorm-again` is unknown. The fallback "the Author writes the needed subset itself" (ADR-004 Decision) is a large hidden task.
    - It is fifth on the serial path, so there is no slack after it.
    - Each full-course test needs ≥ 11 s of dwell time per page, so each fix round is slow.
  - T7 Scope says "Fix the bugs that the E2E finds in T1–T6". This has no size limit.
  - Charter §2 allows three rounds for each task. A large diff collects more findings in each round and is more likely to reach round 3 and escalate.
- **Suggested fix:**
  1. **T5-spike** (half a day, in parallel with T2, no LTI): put a static runtime page on the content origin, and load the real SCORM package in the nested frames with `scorm-again`. Prove the `301` probe, `LMSFinish` and the commit transport. Output: a decision between `scorm-again` and our own subset.
  2. **T5a**: content host, SCORM runtime, `packages/tracking`, score sync (AC-T5-01 to 08, 12, 13, 15, 16). **T5b**: HTML runtime (AC-T5-09 to 11), retry, results refresh, log grep (AC-T5-14, 18, 19).
  3. **T3a** (critical path): service keys, token client, `POST /api/deeplinking`, scores POST and GET, line item GET (only what the app uses). **T3b**: dynamic registration (it needs the T4 confirm page anyway). **T3c** (off the critical path, after or in parallel with T7): `/deeplinking/form`, the `/message` alias, line item POST, PUT and DELETE, NRPS, OAuth stubs, platform DELETE.
  4. **T4a**: upload and `package-inspector`. This is pure code with no Moodle, so it can start right after T1. **T4b**: connections, publications, picker, launch.
  5. T6 can start after T4b. Only AC-T6-08 needs T5.
  6. T7: build the harness and an API-driven Scenario A after T5a. Change to the portal UI steps when T6 is done. Time-box "fix bugs" and open one new task for each bug class.
  7. Add a task DAG diagram (Mermaid) with the critical path marked to README §13.

### B-T0-04 — MAJOR — Some ACs use undefined log lines, and the "no request was made" checks cannot fail

- **Location:** `tasks/T3.md` AC-T3-05, AC-T3-16, AC-T3-22; `tasks/T4.md` AC-T4-18; `contracts/lti-service-api.md` §1.4; `README.md` §9.8.
- **Problem:** QA must write tests from the spec only (charter §1), but these ACs need log event names that no contract defines. A log search for "no request to `evil.test`" passes even when the service sends the request and does not log it.
- **Evidence:**
  - AC-T3-22 expects the event `platform_token` with `cache: "miss"` and `"hit"`. AC-T4-18 expects `launch_rejected reason=publication_not_in_connection`. AC-T3-05 expects "the service log shows the outbound guard blocked the host". AC-T3-16 expects "the log shows no request to `evil.test`".
  - The contracts define only redaction rules and `X-Trace-Id`. They define no event names or fields, and no rule that every outbound call is logged.
  - Several ACs need Docker access, but no document says which tools QA may use. Examples: AC-T1-09 (`docker port`), AC-T4-05 (`find / -name evil.html` in the container), AC-T5-14 (`docker compose stop`), AC-T8-03.
- **Suggested fix:**
  1. Add a "Log events" table to each contract. Give the event name, the level and the required fields. Examples: `outbound_request {host, method, status, ms}`, `outbound_blocked {host, reason}`, `platform_token {cache}`, `launch_rejected {reason}`, `launch_check_failed {check, code}`, `score_sync {status, tries}`. Every event has `trace_id`. Every outbound call writes exactly one `outbound_request` or `outbound_blocked` event.
  2. For negative network checks, add a request sink on the compose network with the alias `evil.test`. Assert three things: the error code (for example `INVALID_LINE_ITEM_ID`), zero hits on the sink, and no `outbound_*` event for that host. The error code shows which rule stopped the call, so the test does not pass only because the private-IP guard blocked the host.
  3. In a short "QA rules" section (for example `tasks/README.md`), list the tools QA may use: Playwright, HTTP calls, `docker compose exec|logs|stop|port`, Moodle web services and CLI. QA may not read service code or database files.

### B-T0-05 — MAJOR — No test proves the LTIAAS compatibility claim

- **Location:** `adr/ADR-003-ltiaas-compatibility-scope.md` (sentence after the promises table); `rea-evaluation.md` "What this means for the product".
- **Problem:** The docs promise that "a tool back end written against the public LTIAAS API … works with our service after two changes", but the only client in the plan is our own app, written from our own contract.
- **Evidence:**
  - The product docs repeat the claim: "It changes two values: the base URL and the API key."
  - Every AC tests our contract. No AC uses a client that was written by someone else. The product team will repeat a claim that has no evidence.
  - The goal says "LTIAAS-compatible self-hosted service", so this claim is part of the goal.
- **Suggested fix:** Choose one option.
  1. Add one AC (T3c or T7): run an independent client against the stack for `idtoken`, deep linking, scores and memberships. For example, use the MIT `LTIAAS/ltiaas-python-sdk` (inputs §3) as a **test-only** dependency in a container. The Lead first checks this against the clean-room rule and Q1.
  2. If option 1 is not allowed: QA writes a small client from the public reference names only (not from our contract), and runs it as one AC.
  3. As a minimum: change the claim to what we test ("same paths, header schemes and field names as our contract, which follows the public reference").

### B-T0-06 — MINOR — The startup order and the CA and API-key life cycle are not defined

- **Location:** `README.md` §10 TLS row; `tasks/T1.md` Design notes and ACs; `contracts/lti-service-api.md` §6; `contracts/cogniate-app-api.md` §1.
- **Problem:** On the first `stack:up`, the Node services can start before the CA file and the API-key file exist, and nothing in T1 checks this.
- **Evidence:**
  - Caddy makes the CA after it starts. T1 writes the CA file "after the proxy has made its CA".
  - Node reads `NODE_EXTRA_CA_CERTS` only at process start. If the file is missing, Node continues without it, and every HTTPS call to `moodle.test` fails until a restart. `node --watch` does not restart for a certificate file.
  - `seed` writes the API key to `infra/.secrets/` after `cogniate-app` has started (contract §6). If the app reads the key at start, it holds no key, or an old key after a reset.
  - If `stack:reset` deletes the Caddy data volume, a new root CA appears. Then Moodle's `moodleorgca.crt`, the Node containers and any human trust (B-T0-02) become stale.
  - No T1 AC checks Node → `https://moodle.test`. AC-T1-05 checks only Moodle → LTI service, and the T1 Node services are stubs.
- **Suggested fix:** Make the dev CA and the leaf certificate (SAN for the four names) in `gen-env` with `openssl`. Do this before any container starts. Keep them in `infra/.certs/`, and do not delete them in `stack:reset`. Caddy loads the static files. The app reads the API-key file at each use, or `seed` restarts `cogniate-app`. Add AC-T1-13: "On a first run and after `stack:reset`, `fetch('https://moodle.test/login/index.php')` from the `lti-service` and `cogniate-app` containers returns 200."

### B-T0-07 — MINOR — Scope that we can cut or simplify without losing the goal

- **Location:** see the table.
- **Problem:** Several parts are not needed to prove the goal, but they add code, secrets, states and ACs.
- **Evidence and suggested fix:**

| Item | Where | Cut or simplify | Effect |
| --- | --- | --- | --- |
| Moodle course shell through web services | README §6e; T4 web services client, AC-T4-11, AC-T4-13; T6 checkbox, AC-T6-07; encrypted WS token | Move it to stretch (with T8). The teacher adds the activity to an existing course. If you keep it, define in contract §4 the **three** web services functions that the app needs. The seed service has nine, including user create and enrol. | One client, one secret, three ACs and one wizard step fewer |
| Compatibility-only endpoints | ADR-003 "In" list | Move them off the critical path (B-T0-03, T3c) | About six ACs fewer before the E2E |
| `ACCESS_TOKEN` and `SCORE_CLOCK` tables | README §8.1 | Use in-memory maps. A restart loses only a cache. After a restart, `now` is already more than last + 1 s. | Two tables and the encryption code fewer |
| ltik copy in `PLAY_SESSION` | README §8.2 `ltik_encrypted`; app contract §6 "Play session … holds the ltik"; T4 Design notes | Remove it. No play-session step uses it: commits use the runtime token and score sync uses the service key. Keep the ltik only in the picker session. | One stored secret fewer |
| Signing-key rotation and retired keys in the JWKS | LTI contract §2.3, §6 `--rotate-*` | Make it optional. Use one active key. | Less CLI code and fewer tests |
| Publication states `linked` and `in_use`, connection state `expired` | README §6e, §7; app contract §4, §5 | Store only `available` and `withdrawn` (and `pending` with `registrationUrlExpiresAt`). Show "Linked" and "In use" from `stats`. | Fewer state transitions |
| "Download SCORM zip" | T8 AC-T8-01 | Move it into T6. It needs almost no work and helps MoodleCloud users now (Q12). | Value comes earlier |

### B-T0-08 — MINOR — The same paths exist on two hosts with different meanings

- **Location:** `contracts/lti-service-api.md` §1.1, §2.2, §2.4; `contracts/cogniate-app-api.md` §6; `README.md` §4.
- **Problem:** `/lti/launch` and `/lti/register` exist on both `lti.cogniate.test` and `app.cogniate.test`, so logs, tickets and docs are ambiguous.
- **Evidence:** On the LTI service, `POST /lti/launch` is the `id_token` redirect URI and `GET` returns `405`. On the app, `GET /lti/launch` is a tool page with `ltik`. The same is true for `/lti/register/{account}` and `/lti/register`. A human who reads "GET /lti/launch 405" cannot tell which service answered. The tool URLs are tool-account settings (contract §1.1), so a rename has no LTIAAS compatibility cost.
- **Suggested fix:** Rename the app tool pages to `/tool/launch`, `/tool/deep-link`, `/tool/picker/{id}` and `/tool/register`. Keep `/lti/*` only on the LTI service.

### B-T0-09 — MINOR — Some terms drift between documents

- **Location:** `README.md` §2 and §6d; `adr/ADR-004…`; `tasks/T5.md` title; `contracts/*`.
- **Problem:** The same word means different things, and one thing has different names. This breaks the charter rule "same word for the same thing".
- **Evidence:**
  - "Registration" has five uses: the dynamic registration flow, the `REGISTRATION_SESSION` row, "platform registration" (the glossary record), the connection state `registered`, and the app `registrationUrl` (a page). The LTI service `registration_url` is a different URL.
  - "HTML runtime" (glossary, contract, ADR-008) and "HTML tracker" (T5 title, README §6d, ADR-004) name the same thing. "HTML tracking" is used too.
  - "Tool account" is used in the contracts and the data model, but it is not in the glossary.
  - Moodle labels and our terms are not mapped: "Select content" = content picker, "grade sync" = score sync, the Moodle "tool" = connection, "empty Moodle course" (UI) = course shell.
- **Suggested fix:** Add glossary rows for tool account, registration session and course shell. Use only "HTML runtime". Add a "Moodle label" column to the glossary for the terms that the admin and the teacher see.

### B-T0-10 — MINOR — The README is too long and mixes audiences for the product team

- **Location:** `README.md` (whole file); §9.4; line 33 (WARNING); `contracts/cogniate-app-api.md` line 5 (WARNING); README §9.4 CAUTION.
- **Problem:** The 925-line README mixes the overview with build details, and it has no one-page entry or "proven / not proven" view.
- **Evidence:**
  - T0 is about 3,860 lines in total. The README holds §1, §3 and §6 (overview) next to §8 (full ER diagrams with column types), §9.2 (the 12 checks) and §9.3 (secrets).
  - No table maps the four goal parts (publish both formats with LTI 1.3, LTIAAS-compatible service, portal Integrations UI, E2E on real Moodle) to the ACs that prove them.
  - In §9.4, the "Launch container decision" paragraph and the CAUTION paragraph have seven sentences each. The STE limit is six.
  - "WARNING: The Cogniate side is a mock" is not a risk to people or data. "CAUTION: Deep Linking always runs in an iframe" is not a risk of damage. Signal words used for plain information make real warnings weaker (inputs §7).
- **Suggested fix:** Keep the README as an overview of ≤ 200 lines: goal, terms, context, flows, decisions, a "proven / not proven" table, and the task DAG. Move §8 to `data-model.md`, §9 to `security.md`, and §10 to §11 to `local-stack.md`. Use NOTE for information. Split the long paragraphs.

### B-T0-11 — MINOR — Error pages and failed syncs give a human no next step

- **Location:** `contracts/lti-service-api.md` §1.3, §1.4, §2.1, §2.2; `contracts/cogniate-app-api.md` §6, §10; `tasks/T6.md` Results view.
- **Problem:** A teacher's screenshot of an error page cannot be linked to a log line, and nobody can send a failed score again.
- **Evidence:**
  - Only 5xx API errors carry the trace id. The HTML error pages (ten launch codes, register, picker, play) show a code but no trace id.
  - `X-Trace-Id` is defined for each response. Its propagation (app → LTI service → Moodle, worker → LTI service) is not defined, so one flow can have three trace ids.
  - A score sync goes to `failed` after six tries. The API, the portal and the CLI have no "send again" action.
  - Nothing says which of the 12 launch checks failed in the log.
- **Suggested fix:**
  1. Show the code, the trace id and one action line on every HTML error page.
  2. The app sends `X-Trace-Id` to the LTI service, and the LTI service reuses it.
  3. Log `launch_check_failed {check, code}` (B-T0-04).
  4. Add `POST /app-api/score-syncs/:id/retry` and a "Send again" button for `failed` rows.

### B-T0-12 — MINOR — The docs do not say how QA turns test knobs on, or how T7 proves that they are off

- **Location:** `tasks/T2.md` AC-T2-07; `tasks/T4.md` AC-T4-09; `contracts/cogniate-app-api.md` §4; `tasks/T7.md` Scope.
- **Problem:** AC-T2-07 and AC-T4-09 need `LTIK_TTL_SECONDS=5` and `REF_TTL_SECONDS=5` on a running service, but no document says how to set them. T7 requires "no test knobs", but no check proves it.
- **Evidence:** No compose override file, command or restart step is named. The knobs are in three files, and there is no list of them.
- **Suggested fix:** Put all knobs in one table (name, default, test value, AC). Add one file `infra/compose.knobs.yaml` and one command (`npm run stack:up -- --knobs`). Each service logs `test_knob_active` at start, and `/healthz` returns `knobs: []`. Add an AC to T7: "`/healthz` of every service shows no knobs."

### B-T0-13 — MINOR — No test checks the Moodle steps that the Connect wizard shows

- **Location:** `tasks/T6.md` Scope (Connect wizard, step 3a and step 3b), AC-T6-04, AC-T6-05; `tasks/T7.md` Scenario A.
- **Problem:** The wizard text is the main interface for the Moodle admin, but T7 follows the steps in `T7.md`, not the steps on the screen. A wrong menu path or label in the wizard passes all tests.
- **Evidence:** AC-T6-04 and AC-T6-05 check the URL, the copy button and the values. They do not check the step text. SPIKE-NOTES §5a, §5b show the exact Moodle 5.2.4 labels and paths.
- **Suggested fix:** Keep the wizard steps as data (one JSON file). Add an AC to T6 or T7: Scenario A reads the steps from the wizard page and follows them, and QA checks that each label exists on the live Moodle 5.2.4 page.

### B-T0-14 — MINOR — A clean clone has no course fixtures

- **Location:** `tasks/T4.md` "Fixtures"; `open-questions.md` Q15; `tasks/T1.md` AC-T1-01 ("clean clone").
- **Problem:** The T4 to T7 tests read the zips from `docs/raw/data/courses/`, but these files are untracked (git status `?? docs/raw/data/`). A clean clone, and the team after hand-over, cannot run them.
- **Evidence:** Q15 is still open, and its "Blocks" column says only "QA fixture path in CI".
- **Suggested fix:** Decide Q15 before T4 starts. Use one variable `COURSE_FIXTURES_DIR`. Add `npm run fixtures:check`, which compares the two SHA-256 values (record them in the repo) and prints how to get the files.

### B-T0-15 — MINOR — The front end has no dev loop

- **Location:** `adr/ADR-008-repo-layout-and-stack.md` Layout and Stack; `tasks/T6.md` AC setup; `tasks/T5.md`.
- **Problem:** The portal and the player are static builds that `cogniate-app` serves, and no watch mode is defined. Every UI change needs a full `npm run build`.
- **Evidence:** The portal must run on `https://app.cogniate.test` because of the `__Host-` cookie and the `Origin` check (app contract §1). So a plain `vite dev` on `localhost:5173` cannot call the API. T5 is the riskiest task, and its player code needs fast reloads.
- **Suggested fix:** Add `npm run dev:web` (`vite build --watch` for the portal and the player; the services serve the mounted build folders). Another option is a Caddy route from `app.cogniate.test` to a Vite dev server. Write the choice in ADR-008.

### B-T0-16 — MINOR — The content-host security boundary is not visible in the code layout

- **Location:** `README.md` §4 table; `adr/ADR-008…` Layout.
- **Problem:** `services/cogniate-app` holds four roles in one process: app API and tool pages, the untrusted content host, the score sync worker, and SPA serving. Nothing keeps the content-host code apart.
- **Evidence:** The content host is the main untrusted boundary (README §9.1), but ADR-008 gives it no folder and no import rule. `packages/shared` is a catch-all (errors, HTTP client, crypto, logger) with no limit.
- **Suggested fix:** In ADR-008, add the folders `src/app/`, `src/tool-pages/`, `src/content-host/`, `src/worker/` and `src/domain/`. Add an ESLint `no-restricted-imports` rule: `content-host` imports only `domain/attempts` and `packages/tracking`. Limit `shared` to the four listed modules.

### B-T0-17 — NIT — Wrong section reference in T2

- **Location:** `tasks/T2.md` Scope ("Auth middleware for the three schemes (README §1.2)").
- **Problem:** The README has no §1.2. The header grammar is in `contracts/lti-service-api.md` §1.2.
- **Suggested fix:** Change the reference to the contract §1.2.

### B-T0-18 — NIT — Two values for the lifetime of the Deep Linking response JWT

- **Location:** `README.md` §9.2 ("`exp = iat + 300 s`"); `tasks/T3.md` AC-T3-08 ("`exp - iat ≤ 600`").
- **Problem:** The design and the AC give different numbers.
- **Suggested fix:** Use 300 s in both places.

### B-T0-19 — NIT — The AC-T1-02 time limit does not say if image pulls count

- **Location:** `tasks/T1.md` AC-T1-02 ("≤ 15 min").
- **Problem:** The Moodle image (1.6 GB) and the Playwright image can take longer than the limit on a slow network.
- **Suggested fix:** Write "with the images already pulled", and report the pull time separately.

### B-T0-20 — NIT — The generated tool name uses an en dash

- **Location:** `contracts/cogniate-app-api.md` §6 `POST /lti/register` (`"<library name> – Cogniate"`); 6 uses in the tasks.
- **Problem:** People type a hyphen, so text matches in tests and searches in Moodle fail.
- **Suggested fix:** Use an ASCII hyphen or brackets: "Cogniate (Thanh's Library)".

---

## Round 2

Round 2 verdict: **CHANGES_REQUESTED** (one new MAJOR: B-T0-21).

Input: commit `b06aa8a` (`docs/architecture/**`) and `docs/architecture/review-response-T0.md`, compared with my round-1 findings above. I did not read `reviewer-a.md` before I finished this section.

What I checked:

- I read every rewritten file in my lens.
- I counted the ACs in each task.
- I searched all architecture docs for old terms and paths (`HTML tracker`, `/lti/*` on the app host, en dash, `linked`/`in_use`/`expired` states, `TTL_SECONDS=5`).
- A script checked that every log event named in an AC exists in a contract "Log events" table. Result: all events are defined.
- A script measured sentence length: the README has 0 sentences over 25 words, and `local-stack.md` has 0.

| Severity (round 2, new) | Count | Ids |
| --- | --- | --- |
| BLOCKER | 0 | — |
| MAJOR | 1 | B-T0-21 |
| MINOR | 3 | B-T0-22, B-T0-23, B-T0-24 |
| NIT | 1 | B-T0-25 |

### Round-1 findings: verification

| Id | Sev. | Status | Evidence |
| --- | --- | --- | --- |
| B-T0-01 | MAJOR | **Resolved** | ADR-005 option C. The CA and leaf are made by `gen-env` and kept on reset. `local-stack.md` §4 has the F1 to F3 table, the list of ACs that change under F3, and "the Lead decides". Four `PUBLIC_*_URL` values are used in all contracts and ACs. |
| B-T0-02 | MAJOR | **Resolved** | `demo` and `demo:browser` (T1, built and working), `demo:prepare` (T7, AC-T7-15), the command table (`infra/README.md`), AC-T9-01 (≤ 10 min for a new person). |
| B-T0-03 | MAJOR | **Resolved, with a follow-up** | T3, T4 and T5 are split, and there is a T5-spike. README §7 has the DAG with the critical path. T7 has a bug-fix time-box and may start API-first after T5a. But T2 grew to 30 ACs, and T4b has 24: see B-T0-21. |
| B-T0-04 | MAJOR | **Resolved** | LTI contract §5 and app contract §12 have event tables. Every outbound call writes one `outbound_*` event. The `evil.test` sink and the three-oracle rule are in tasks README §2. QA tools are listed. Every AC event is defined (checked by script). |
| B-T0-05 | MAJOR | **Resolved** | T3c AC-T3-27 runs the MIT `ltiaas` SDK as a black box in a container. ADR-003 has the narrow claim, and contract §8 has the differences table. |
| B-T0-06 | MINOR | Resolved | CA before containers (built in T1). The app reads the API key at each use (security §10). AC-T1-13 exists, and the reach check passes on the live stack. |
| B-T0-07 | MINOR | Resolved | Course shell → T8. Caches in memory (ADR-006). No ltik in the play session (T4b design note). One signing key. Publication states are `available`/`withdrawn`, and "Linked", "In use" and "Link expired" are derived labels, defined in one place each. "Download SCORM package" → T6. |
| B-T0-08 | MINOR | Resolved | Tool pages are `/tool/*`. No app-host `/lti/` path remains. |
| B-T0-09 | MINOR | Resolved | The glossary has a "Moodle label" column and the new terms. Only "HTML runtime" is used for the component. |
| B-T0-10 | MINOR | Resolved | README is 180 lines: an overview with a "what the plan proves" table, the DAG and links. Detail is in four files. WARNING is used only for data risks (security.md, two uses). |
| B-T0-11 | MINOR | Resolved | Error pages show the code, trace id and an action line. `X-Trace-Id` propagates. `launch_check_failed {check, code}` exists. Resend exists. One small gap: see B-T0-25. |
| B-T0-12 | MINOR | Resolved, with a follow-up | One knob table and AC-T7-13. Hidden overrides are still possible: B-T1-05 (unregistered keys) and B-T0-23 (acceptance profile). |
| B-T0-13 | MINOR | Resolved | `moodle-steps.json`, AC-T6-12, AC-T7-14. |
| B-T0-14 | MINOR | Resolved | `COURSE_FIXTURES_DIR` and `fixtures:check` (built in T1). Q15 stays open for humans. |
| B-T0-15 | MINOR | Resolved | `npm run dev:web` in ADR-008 and T5a, on the real app origin. |
| B-T0-16 | MINOR | Resolved, with a follow-up | ADR-008 has the service folders and the `content-host` import fence. The "shared = exactly four modules" rule already disagrees with T1: B-T0-22. |
| B-T0-17 to B-T0-20 | NIT | Resolved | T2 references contract §1.2. One JWT rule (`exp − iat = 330 ± 1`). "Images already pulled" is in AC-T1-02, AC-T7-01 and AC-T8-02. The tool name is `Cogniate (<library>)`. |

### B-T0-21 — MAJOR — T2 is now the largest task (30 ACs), and T4b still has 24

- **Location:** `tasks/T2.md`, `tasks/T4b.md`; `tasks/README.md` §1; README §7.
- **Problem:** The round-1 split fixed T3, T4 and T5, but T2 grew from 17 to 30 ACs, and T4b has 24. Each mixes concerns with different risks, and T2 is the first coded task on the critical path after the spike.
- **Evidence:**
  - AC counts: T1 13, **T2 30** (AC-T2-17 merged), T3a 14, T3b 7, T3c 6, T4a 6, **T4b 24**, T5a 18, T5b 12, T6 14, T7 15.
  - **T2 holds four concerns:**
    1. LTI core: SQLite, keys, JWKS, auth, platforms API, login, launch, ltik, ID token.
    2. A matrix of 10 negative launch checks with a QA-signed platform (AC-T2-20 to AC-T2-28, AC-T2-30).
    3. The SSRF-guarded outbound client.
    4. A new compose profile `acceptance` with a sink host, a static `qa-platform.test` host, a **second** leaf certificate and allowlist entries (H6).
  - Item 4 is infrastructure work of the T1 kind (certificates, compose, proxy), not LTI work.
  - **T4b holds two flows with different risks:**
    - Connect + publish: dynamic registration in Moodle's iframe, manual registration, refused "update" (AC-T4-07 to -10, -30, -12, -14).
    - Picker + launch handoff + embedded launch + rebinding + five tool-page security ACs (AC-T4-15 to -29, -31, -32).
  - The charter allows three review rounds for each task. A task with 24 to 30 ACs and a large QA harness is the one most likely to reach round 3.
  - Also, `T2.md` says "Depends on: T1, T5-spike done", and `T3b.md` says "Depends on: T3a". Neither is a technical dependency: T2 does not use the spike, and T3b needs only T2. So the spike's half-day time-box can block T2 for no technical reason.
- **Suggested fix:**
  1. Move H6 (the `acceptance` profile, the sink, `qa-platform.test`, the second leaf, the allowlist) into T1 round 2 or a small infra task "T1b". The same scripts and the same Author already own certificates and profiles there.
  2. Split T2:
     - **T2a**: core and happy path (AC-T2-01 to -08, -12 to -16, -18, -19, -29, -31). Implement all 12 checks and unit-test them here.
     - **T2b**: the black-box negative matrix with the QA platform (AC-T2-09 to -11, -20 to -28, -30).
     - T3a depends on T2a only, so T2b leaves the critical path. It must PASS before T7.
  3. Split T4b into **T4b1** (connect + publish, 7 ACs) and **T4b2** (picker, launch, tool-page security, 17 ACs).
  4. Write only technical dependencies in "Depends on". T2 depends on T1, and T3b on T2. Keep the one-Author order in tasks README §1. T5a still depends on the T5-spike note.
  5. T5a (18 ACs) is fine as it is. The spec already says that the Lead re-checks its size if the spike chooses our own SCORM subset.

### B-T0-22 — MINOR — ADR-008 limits `packages/shared` to four modules that T1 does not have

- **Location:** `adr/ADR-008-repo-layout-and-stack.md` Layout ("exactly four modules: errors, http-client (SSRF guard), crypto, logger"); `tasks/T1.md` Scope (LC-T1-02 `loadPublicUrls()`, H3 `KNOB_REGISTRY` in `packages/shared/src/knobs.ts`).
- **Problem:** The approved T1 deltas put the public-URL config, the knob registry and the startup helpers into `shared`, so the "exactly four" rule is false on day one. A rule that the code breaks from the start teaches people to ignore the rule.
- **Evidence:** The T1 code (`bc530a7`) has `config.ts`, `knobs.ts`, `logger.ts`, `service.ts` and `http.ts` (inbound server helpers; B-T1-06). ADR-008 does not name config or knobs. ADR-008 "Root scripts" also misses `stack:moodle-reach-check` and `stack:node-reach-check`, which T1 has.
- **Suggested fix:** List the real modules in ADR-008, one line each: `config` (public URLs), `knobs` (registry), `logger`, `errors`, `server` (inbound helpers, startup), `outbound` (SSRF-guarded client, T2), `crypto`. Keep the rule "a new module needs a reason in the done report". Add the two reach-check scripts to the root-script list.

### B-T0-23 — MINOR — The `acceptance` profile changes service config, but no check can see it

- **Location:** `local-stack.md` §3 (`acceptance` profile: "Both names are added to `OUTBOUND_PRIVATE_HOST_ALLOWLIST` in this profile only"); `tasks/README.md` §3 ("No other knob exists"), §4; `tasks/T7.md` AC-T7-13.
- **Problem:** In the `acceptance` profile, the services run with a wider outbound allowlist (`evil.test`, `qa-platform.test`). But `/healthz` shows only registered knobs, so a stack that still runs in this mode shows `knobs: []`, and AC-T7-13 passes.
- **Evidence:**
  - The allowlist is an env value of `lti-service` and `cogniate-app`, not a registered knob.
  - The docs do not say how `npm run test:acceptance` moves the running stack into and out of this mode. T1's `test:acceptance` only starts the `e2e` container.
  - After an acceptance run, a developer who then runs `npm run demo` may demo a stack that allows `evil.test`.
- **Suggested fix:**
  1. Report the mode in `/healthz` and in `service_started`, for example `"profile": "acceptance"` and the active allowlist entries.
  2. AC-T7-13 also checks `profile: "default"`.
  3. In `local-stack.md` §3, write the steps of `test:acceptance` (start with the override, run, restore), and say what is left when a run stops halfway.

### B-T0-24 — MINOR — No deterministic recipe makes `conflict` and `failed` rows, so three ACs may have no input

- **Location:** `tasks/T5b.md` AC-T5-31, AC-T5-32; `tasks/T6.md` AC-T6-14; `adr/ADR-010…` rule 8; app contract §10.
- **Problem:** AC-T5-31 accepts either outcome ("The row becomes `sent` or `conflict` … If `conflict`: …"), so it cannot fail on its main point. AC-T6-14 needs "a `conflict` row (from AC-T5-31)", and AC-T5-32 needs a `conflict` or `failed` row.
- **Evidence:**
  - ADR-010 says that a 409 "also happens after a teacher override". Moodle returns 409 only when the stored grade time is the same as or newer than our `timestamp`. Our timestamp is "now", which is after the override, so Moodle may answer 204.
  - In that case, AC-T5-31 gives `sent` (Moodle keeps the override 50), AC-T6-14 has no row to test, and the portal shows "Sent" next to a gradebook value of 50 with no explanation.
  - A `failed` row needs 24 h of retries, or a `400`/`404`, and no AC says how to get either.
- **Suggested fix:**
  1. Check Moodle 5.2.4's answer once now (score after an override). Then write **one** expected result in AC-T5-31.
  2. Give QA a fixed recipe for each state. Example for `conflict`: post a score through the API with `timestamp = now + 1 h` (the documented `timestamp` addition), run `stack:restart -- lti-service` (this clears the in-memory clock), then let the learner complete. Example for `failed`: unenrol the learner in the Moodle UI before completion, so Moodle answers `400`.
  3. If a `sent` score does not change the gradebook, the results view shows "Moodle keeps a teacher grade" after "Refresh from Moodle".

### B-T0-25 — NIT — Small leftovers

- **Location and fix:**
  - `tasks/T1.md` Scope, `adr/ADR-005…`, `local-stack.md` §2 say "blocked hosts = default minus `172.16.0.0/12`". The T1 code removes only the stack subnet, which is safer. Write "default minus the stack subnet" (see B-T1-09).
  - `adr/ADR-002…` Consequences: "The T2 and T3 specs" → "T2 and T3a".
  - LTI contract §5 and app contract §12: "Every event: … `trace_id`" does not say where a lifecycle event gets its id. Add the Lead's rule ("one boot trace id per process for events without a request"), and fix T1 H7 `trace_id?` as the Lead said.
  - LTI contract §5 lists `service_started {version, knobs}`, but the T1 code logs `port`, `public_url`, `node`. Choose one field set. If the Lead accepts B-T1-04, write "every request except container health checks" for `http_request`.
  - Tasks README §3: `BUILD_RUNNER_FAIL_AT` is a string knob, but the T1 knob registry accepts whole numbers only. Note that T8 extends the registry type.

---

## Round 3

Round 3 verdict: **APPROVE**. No open BLOCKER or MAJOR finding from Reviewer-B.

Input: commit `10887ce` compared with `dadd9de`, and the Round 3 table of `review-response-T0.md`. Scope (Lead): B-T0-21, the round-2 MINORs and NIT, and the size and clarity of the new task files.

| Id | Status | Evidence |
| --- | --- | --- |
| B-T0-21 | **Resolved** | AC counts: T2a 17 (plus the merged AC-T2-17 line), T2b 13, T4b1 9, T4b2 17, T5a 18, T5b 13. No task has more than 18 ACs. "Depends on" lists technical dependencies (T2a: T1; T4a: T1; T3b: T2a + T2b; T4b1: T3b + T4a; T4b2: T3a + T4b1). The one-Author order and the dependency list are both in tasks README §1. The DAG (README §7) matches, except B-T0-26. H6 is in T2b, which runs right after T2a. That is acceptable: T2b is small and owns only the profile and the negative matrix. |
| B-T0-22 | Resolved | ADR-008 lists the real `shared` modules (`config`, `knobs`, `logger`, `server`, `errors`, `outbound`, `crypto`), with the "new module needs a reason" rule. The root-script list has both reach checks. |
| B-T0-23 | Resolved | `/healthz` and `service_started` show `profile` and the allowlist (both contracts). local-stack §3 has the `test:acceptance` steps (start, run, restore, also on failure, and the killed-run case). AC-T7-13 checks `"profile": "default"`. |
| B-T0-24 | Resolved | AC-T5-31 (`conflict`: future `timestamp` + restart) and AC-T5-32 (`failed`: unenrol, then Resend) are fixed recipes in a separate course. AC-T5-33 has one expected result for a teacher override (`sent` + `gradebookDiffers`). AC-T6-14 uses these three rows. |
| B-T0-25 | Resolved | Curl wording ("only `STACK_SUBNET` cut out") in T1 and local-stack; ADR-002 task names; boot trace id in both contracts and security §11; `service_started` fields match the T1 code; string-knob note; the `GET /healthz` log exception (Lead decision B-T1-04) in both contracts and security. |

New task files: T2b and T4b1 have a clear goal, scope, "Out" list and setup line. T4b2's setup starts from the T4b1 state. Each is about one review session.

### B-T0-26 — NIT — T3a says it needs only T2a, but its setup needs the T2b profile

- **Location:** `tasks/T3a.md` "Depends on: T2a" and "Setup: T2b setup (`STACK_PROFILE=acceptance` …)"; AC-T3-16 ("zero sink hits"); README §7 dotted arrow "T2a → T3a: needs T2a only"; tasks README §1.
- **Problem:** The `evil.test` sink and the `acceptance` profile come from T2b. A second Author who starts T3a after T2a only cannot run its setup or AC-T3-16.
- **Suggested fix:** Write "Depends on: T2a (code); T2b (`acceptance` profile for the setup and AC-T3-16)". Change the dotted arrow text, or remove it. This does not change the one-Author order.
