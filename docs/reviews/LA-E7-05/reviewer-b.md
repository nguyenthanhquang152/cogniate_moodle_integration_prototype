Verdict: APPROVE
Round: 2

# LA-E7-05 review, Reviewer-B2 (lens: "Can a human team own it?")

## Round 2 (Reviewer-B2)

Diff: `git diff 19059aa d40826d -- tests/sim tests/e2e/ltiaas docs/reviews/LA-E7-05/qa.md`. That is the QA-E2E fix rounds 2 and 3 (`d2166d7`, `d40826d`), and the range has no other `tests/sim` work. I did not open any reviewer-a file. I did not run Docker.

Round-2 counts: **0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT (new).** All six round-1 findings are closed.

### How I checked (round 2)

- Scratch clone of `d40826d` (private `/tmp` folder, `--no-hardlinks`; deleted after the run).
  - `node --test tests/sim/core/*.test.mjs tests/sim/*/protocol.test.mjs`: **56 of 58 passed**. The 2 failures are not LA-E7-05 work; see "Other observation".
  - All LA-E7-05 self-tests pass, and so does the new README sync test.
- Mutation: I deleted the `allowNullScore` row from the README table, and the README sync test failed.
- Probe (a temporary test with the generic fixture, deleted after the run):
  - P1, misspelt and removed names:
    - `scoreAnswer` → `Unknown scenario option "scoreAnswer" (did you mean "scoreAnswers"?)`;
    - `acceptMultple` → the same message, with "did you mean "acceptMultiple"?";
    - `dr.tokenFromat` → `Unknown scenario dr option "dr.tokenFromat" (did you mean "dr.tokenFormat"?)`;
    - the removed aliases `platformStorage` and `adminRole` are refused.
  - P2, the round-1 leak case: scenario A has `secondKey` and scenario B is posted later. The JWKS has **1** key. After an auth request for A, it has 2 keys, and A's token `kid` is in it.
  - P3: `GET /any/prefix/lti/jwks.json` is not served (`null`).
- I searched `tests/ltiaas`, `tests/e2e` and `tests/sim` for every removed alias. No consumer uses one.

### Round-1 findings

| Id | Round-1 severity | Status | Evidence |
| --- | --- | --- | --- |
| B-LA-E7-05-01 | MAJOR | Closed | `runtime.mjs` has one list per level: `SCENARIO_OPTIONS` (41), `DR_OPTIONS` (14), and `LEGACY_SCENARIO_ALIASES` (7, each kept only for the frozen LA-E5-14 suite, and the README table names it). `scenario()` refuses every unknown key and suggests the closest name (probe P1). The README has one table per list, with type, default, scope and effect, plus the return shape, the answer object, the query parameters and the reserved Bearer values. A self-test keeps the three README tables equal to the three code lists (my mutation made it fail). |
| B-LA-E7-05-02 | MINOR | Closed | `secondKey`, `jwksKeys` and `storageTarget` now follow the provider's *active* scenario, or `?scenario=<id>`. The README marks their scope. Probe P2 shows no leak from an older scenario. See the new NIT B-LA-E7-05-07 for the wording of "active". |
| B-LA-E7-05-03 | MINOR | Closed | Cancel is opt-in: `dlAllowCancel` defaults to `false`, so an empty response gives `DL item count` as before. `matchesEndpointPath` (`provider.mjs:36-47`) matches only the exact path, or the issuer-path prefix of a scenario (probe P3). qa.md round 3 also records the byte-equal default record keys (A-LA-E7-02-04). |
| B-LA-E7-05-04 | MINOR | Closed | One `answerOf` and one `nextAnswer` in `runtime.mjs` serve the token, NRPS and score answers, and `persistent` works on all three. DR is now `core/dr.mjs` (221 lines) and storage is `core/storage.mjs` (127 lines). `provider.mjs` is down from 716 to 409 lines. |
| B-LA-E7-05-05 | NIT | Closed | The page script has no local store. Every operation goes to `/__storage` and is recorded. |
| B-LA-E7-05-06 | NIT | Closed | The labels say what was expected, for example `DL item type must be ltiResourceLink`, `DL item lineItem.scoreMaximum must be 100`, `DR application_type must be "web"`, and `DR bearer token must equal scenario.registration.registrationToken`. |

### New finding

#### B-LA-E7-05-07 — NIT — The README does not define "active scenario", and the round-1 AC table in qa.md still names removed aliases

- **File:** `tests/sim/README.md:60` (it says only that a re-post "marks it as the active scenario"), `:108-110` (scope "active scenario (or `?scenario=<id>`)"); `tests/sim/core/provider.mjs:121` (an auth request also sets the active scenario); `docs/reviews/LA-E7-05/qa.md`, the Round 1 AC rows for AC-05..07 (`nrpsMembers`, `platformStorage: true`, `useSecondKey`, `adminRole`, `tokenError`).
- **Problem:**
  - The JWKS and `/__frame` follow the active scenario, because the product fetches them without `?scenario=`. The code sets the active scenario on a POST **and** on each auth request (`login_hint`). The README names only the POST. So a test author cannot predict which key set the product sees between two launches.
  - A reader who copies an option name from the qa.md round-1 evidence table now gets `400 Unknown scenario option`.
- **Suggested fix:** Add one sentence to the README: "The active scenario of a provider is the scenario of its latest POST or latest auth request; `?scenario=<id>` overrides it." Add a line under qa.md round 3: "Round-1 alias names (`nrpsMembers`, `platformStorage`, `useSecondKey`, `adminRole`, `tokenError`) were removed in round 3. Use the README tables."

### Other observation (not an LA-E7-05 finding; for the Lead)

At the integration commit `d40826d`, `node --test tests/sim/core/loading.test.mjs` has **2 failures**:
- "accepts and merges repeated alias and allowlist host inside one entry" (`:126`);
- the shared table test "loadHostManifest and infra/scripts/lib.sh agree on shared hosts.json table cases" (`:76`).

The table case comes from `19059aa` (LA-E7-02 round 3). It expects a repeated host to be merged. A1 BD-A1-53 changed the rule: one strict rule, and a repeated host is refused by both readers. `lib.sh` now refuses it (S1), but the case and the simulator loader still expect a merge. qa.md round 3 records 58/58 at `7623e61` on `la-qa`, which is before that change. This is the QA-E2E part of BD-A1-53, not LA-E7-05 work. But until it lands, the integration tree has two red simulator self-tests.

## Round 1

Round-1 verdict: CHANGES_REQUESTED.

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22). Diff: `git diff 0e65ab1^ 0e65ab1 -- tests/sim docs/reviews/LA-E7-05/qa.md`. I review only the LA-E7-05 parts; the LA-E7-02 round-2 fixes in the same commit are out of scope. Spec: `docs/architecture/ltiaas/tasks/LA-E7-05.md`. Design: TEST-STRATEGY §2.8; LA-ADR-02 D7; LA-ADR-05 D1, D3, D4; LA-ADR-08. I did not open any reviewer-a file. I did not run Docker.

Counts: **0 BLOCKER, 1 MAJOR, 3 MINOR, 2 NIT.**

The work covers the whole scope:
- the DR platform side for the generic, Moodle-shaped, D2L and Canvas configs;
- the throttling answers, the DL options and NRPS members;
- the platform-storage frame;
- the Should and Could options.

Some parts are easy to own:
- Each provider gets a small `dr` block in its own `index.mjs` (hosts, config paths, registration paths, token format), so the DR data stays next to the other host data.
- The records are good evidence for the K1 tests. They show `ts`, `status`, `retryAfter`, `itemCount`, `cancelled`, the registration scopes, messages and redirect URIs, and the storage operation with origin and `message_id`.
- The throttling self-test has a comment at each step and reads well.

My MAJOR is the option set. More than 30 option names and values are in the code but not in the README. Most options have two to four names. A misspelt or unknown option has no effect, and the scenario then runs with the default.

## How I checked

- Scratch clone of `0e65ab1` (private `/tmp` folder, `--no-hardlinks`; deleted after the run). `node --test tests/sim/core/*.test.mjs tests/sim/*/protocol.test.mjs`: **23 tests passed**. `F1 PASS: 32 files with hits, 184 hits`.
- Probe: a temporary test with the generic fixture of `generic/protocol.test.mjs`, deleted after the run. It had three parts:
  - P1: option names that a test author can easily write;
  - P2: two scenarios of one provider in one run;
  - P3: request paths with an added prefix.
- I compared the option list in the README with each name that `runtime.scenario` and `core/provider.mjs` read.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | Only `tests/sim/**` and `docs/reviews/LA-E7-05/qa.md`. No `infra/**`, no product code, no M1 or M2 test files. OK. |
| Ownership | Lane QA-E2E. OK. |
| No behaviour change outside the spec | Two defaults changed. See B-LA-E7-05-03. |
| No LMS name in core | `tests/sim/**` is not a core path. F1 passes. |
| UNIT ACs | None. All ACs are K1-SIM, and qa.md marks them `pending: Docker window`, with host-only self-tests as the proof so far. |
| Can a test author pick and combine options from the README alone? | No. See B-LA-E7-05-01 and -02. |

## Findings

### B-LA-E7-05-01 — MAJOR — The README does not list all the options, most options have aliases, and the simulator accepts misspelt or unknown options without an error

- **File:** `tests/sim/README.md:31-41`; `tests/sim/core/runtime.mjs:48-118` (`scenario()` spreads `...structuredClone(input)` and checks only `id`, `provider`, `clientId`, `deploymentId` and the hosts); `tests/sim/core/provider.mjs` (the readers listed below).
- **Problem:**
  - **The README is not complete.** The code reads these names, and the README does not name them:
    - NRPS and token: `nrpsAnswer`, `membershipsAnswer`, `nrpsStatus`, `membershipsStatus`, and `persistent` and `body` inside an answer;
    - roles and keys: `placement: 'ungraded'`, `systemAdmin`, `adminRole: 'system'`, `signingKey: 'second'`, and the `jwksKeys` values `'both'` and `'second-only'`;
    - the ID token: `extraAudiences`, `azp`;
    - Deep Linking: `acceptTypes`, `acceptPresentationDocumentTargets`, `autoCreate`, `acceptLineItem`, `dlMultiple`, `dlUngraded`, `dlAllowCancel`;
    - scores: `allowNullScore`;
    - DR: `targetLinkUri`, `registrationToken`, `drOperation`, top-level `tokenFormat`, `dr.registrationTokenFormat`, `dr.issuer`, `dr.updateId`, `dr.scope`, `dr.tokenFault`, `dr.configPath`, `dr.configHost`, `foreignTokenHost`, `authorizationEndpoint`, `jwksUri`, `registrationPath`, `registrationEndpoint`, `productFamilyCode`, `grantedScope`, `strictOpaque`, `strictTokenFormat`, `enforceToken`, `enforceRegistrationToken`;
    - query parameters: `second_token_host`, `token_host`, `authorization_server` and `scenario` on the configuration URL, and `storage` on `/__frame`;
    - the Bearer values `invalid` and `bad-token` (`provider.mjs:478`).

    The README also does not describe the new `registration` object that `scenario()` returns (`openidConfiguration`, `registrationToken`, `tokenFormat`, `startUrl`; `runtime.mjs:132`). A DR test needs that object first.
  - **Aliases.** Most options have two to four names, and the code decides which name wins (for example `dr.tokenFormat ?? dr.registrationTokenFormat ?? registrationTokenFormat ?? tokenFormat`). The aliases do not follow one pattern. `tokenAnswer` (singular) works and `nrpsAnswer` works, but `scoreAnswer` does not. Each alias adds a branch to the code that a maintainer must keep.
  - **No error for a wrong name.** The scenario keeps every input key. A key that no reader knows has no effect. The test then runs with the default and can pass for the wrong reason. For example, a retry test that expects "the score is stored in the end" passes, because there was never a `429`.
- **Evidence (probe P1):**
  - `scoreAnswer: { status: 429, retryAfter: 30 }` (singular): the score POST gets `204`.
  - `acceptMultple: true` (a typo): the ID token has `accept_multiple: false`.
  - `tokenAnswerz: [429]`: `scenario()` accepts it with no error.
- **Suggested fix:**
  - Keep **one name per option**. Remove the aliases, or keep each alias only where an existing test uses it, and mark it "old name" in the README.
  - In `runtime.scenario`, check each key against one table of known options. For an unknown key, throw `Unknown scenario option "<key>"`, and name the closest known option ("Did you mean scoreAnswers?"). The control route then answers `400`, so the test fails at setup.
  - Write that table into the README: name, type, default, effect, and scope (this scenario, or the whole provider; see B-LA-E7-05-02). Add the `registration` return value, the query parameters and the special Bearer values. Make the README table and the code table the same list (for example, generate one from the other, or add a self-test that compares them).

### B-LA-E7-05-02 — MINOR — Some options act on every scenario of the provider, and the README does not say which

- **File:** `tests/sim/core/provider.mjs:15-22` (`publicKeys`: the JWKS has both keys when *any* scenario of the provider sets `secondKey`, `useSecondKey`, `signingKey: 'second'` or `jwksKeys: 'both'`); `:693-695` (`/__frame` adds the storage frame when *any* scenario sets `storageTarget`); `:351-363` (`findDrScenario`: without `?scenario=`, it falls back to the issuer path, then the host, then the newest scenario).
- **Problem:** A K1 run posts many scenarios to one simulator process. Because of these options, a scenario changes the answers for the other scenarios of its provider until `POST /__sim/reset`. For example, a "JWKS has one key" check fails, or a frame has a storage frame that its scenario did not ask for. The README describes each option as a scenario option, so a test author cannot know this.
- **Evidence (probe P2):** Scenario A has `secondKey: true` and `storageTarget`, and scenario B (posted later) has neither. The JWKS has **2** keys, and `/__frame` has the `/__storage` frame.
- **Suggested fix:** In the option table of B-LA-E7-05-01, mark these options "provider-wide until `/__sim/reset`". Where you can, make them per scenario. `/__frame` can take a `scenario` query parameter, as the DR configuration URL already does. The JWKS can stay provider-wide, but it should be documented.

### B-LA-E7-05-03 — MINOR — Two defaults are no longer today's behaviour

- **File:** `tests/sim/core/provider.mjs:324-325` (Deep Linking return); `:663`, `:672`, `:676` (`path.endsWith(config.jwks.path | auth.path | token.path)`).
- **Problem:** The task rule is "every option defaults to today" (Goal; AC-LA-E7-05-01).
  - The Deep Linking return now accepts `content_items: []` by default, unless `dlAllowCancel: false`. Before, the default answer was the `DL item count` error. So in M1 and M2, a product that sends an empty response by mistake gets `200 {accepted: true}`.
  - The JWKS, auth and token routes now match any path that **ends with** the configured path. Before, the path had to match exactly. A product that builds a wrong endpoint URL with an extra prefix now passes against the simulator. This change is needed only for an issuer with a path, and `matchesDrPath` (`:365-377`) already handles that case exactly, with the issuer prefix.
- **Evidence (probe P3):** `GET /any/prefix/lti/jwks.json` on `generic.sim.test` gives `200`. `POST /x/lti/oauth2/token` reaches the token handler (`400` from the assertion check), and before it was not served. The `DL item count` default is in the old code (`required(… items.length === 1, 'DL item count')`).
- **Suggested fix:** Make Cancel opt-in (`dlAllowCancel: true`, documented). Match these three paths exactly, or with the prefix of a scenario's issuer path, in the same way as `matchesDrPath`. Lens A may weigh the safety side. I note it here because a test author relies on "defaults = today".

### B-LA-E7-05-04 — MINOR — The answer code is written three times with different features, and `provider.mjs` is one 716-line function

- **File:** `tests/sim/core/provider.mjs:160-187` (token answers), `:212-228` (NRPS answers), `:261-278` (score answers); the file has 716 lines, and `createProvider` holds auth, token, services, Deep Linking, the DR configuration, registration and the storage frame.
- **Problem:** The three blocks read `status`, `retryAfter`, `headers['Retry-After' | 'retry-after']`, `message ?? body` and `error`, each in its own copy, and they do not behave the same:
  - only token answers have `persistent` and an `invalid_client` form;
  - token and NRPS answers take a singular alias, and score answers do not;
  - the default error bodies are different.

  A new answer feature (for example a `Retry-After` HTTP date for A2 LA-E5-14) must be added three times. A newcomer who looks for the DR or storage code must read the whole closure.
- **Suggested fix:** Add one helper, `answerOf(raw, { okStatus, defaultMessage })`, that returns `{ status, headers, body, recordFields }`, and use it in all three places, with `persistent` for all. Move the DR configuration and registration to `core/dr.mjs`, and the storage frame and its route to `core/storage.mjs`. `createProvider` then only routes.

### B-LA-E7-05-05 — NIT — The storage frame has a second, silent store in the page script

- **File:** `tests/sim/core/provider.mjs:559-597` (`storageScript`; `localStore` at `:562`).
- **Problem:** When the `POST /__storage` call fails, the script answers from its own `Map`, with the same rules written again in browser code. Then the frame answers `lti.get_data` from data that the server and `/__sim/records` never saw, and a K2 failure is hard to explain.
- **Suggested fix:** Remove the fallback, so a failed call gives no answer. If the fallback is necessary, add a comment that says why, and send a record for it.

### B-LA-E7-05-06 — NIT — Some error texts are labels only, and one label is used for two checks

- **File:** `tests/sim/core/provider.mjs:332` and `:336` (both `'DL item'`); the DR checks in `registerTool` (for example `'DR application_type'`, `'DR lti-tool-configuration'`).
- **Problem:** A K1 test that fails on a simulator `400` shows only the label. `'DL item'` can mean a wrong `type` or a wrong `lineItem.scoreMaximum`. The DR labels name the field, but not the expected value.
- **Suggested fix:** Say what was expected, for example `'DL item type must be ltiResourceLink'`, `'DL item lineItem.scoreMaximum must be 100'`, `'DR application_type must be "web"'`.

## Not checked

- The K1-SIM ACs AC-01..07 and the M1 `sim` phase and M2 regression with defaults (QA, in the Docker window).
- Lens-A items: whether the DR documents and the registration checks match the 1EdTech Dynamic Registration spec in each detail; the storage frame's origin rules beyond the self-test.
