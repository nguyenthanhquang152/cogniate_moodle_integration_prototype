Verdict: OWNED PREPARATION READY — harness checks only, no product verification
Behavior baseline: `56591df0e71939d5d62c9042c630c841d01f84e8` (ADR-011 revision 6)
Owner: independent Codex QA, common engine and Blackboard

## Independence and scope

This plan and its tests come from the accepted contracts. QA has not read the
authors' implementation, audit notes or code reviews. Harness self-checks are
not product PASS. Product runs need a frozen product SHA, a frozen test SHA and
a Lead-reserved stack. No stack is launched by this preparation task.

Canvas QA owns `tests/sim/canvas/**`, `tests/acceptance/M1/canvas/**` and all M2
browser tests. This worker owns simulator core/Blackboard, common/Blackboard M1
API cases, the host runner, migration and legacy non-browser checks.

## First checkpoint: simulator interface for Canvas QA

The simulator uses Node built-ins only. It imports no product module.

`tests/sim/core/runtime.mjs` exports `createRuntime(options)`. Options are
`{ publicLtiUrl, fetchJwks, log }`. `fetchJwks(url)` returns public JWKS using
verified TLS. `log(record)` receives redacted M3 `sim_hit` records.

`tests/sim/core/provider.mjs` exports `createProvider(runtime, config)`.
Configuration is plain independent fixture data:

```js
{
  id, issuer, family,
  auth: { host, path, methods: ['GET', 'POST'] },
  jwks: { host, path }, // path can be a RegExp with the client id as group 1
  token: { hosts: [], path, audience: 'string' }, // Blackboard uses 'array'
  sites: [{
    host, lineitems: '/api/lti/courses/course-1/line_items',
    nrps: '/api/lti/courses/course-1/names_and_roles',
    dlReturn: '/courses/course-1/deep_linking_response'
  }],
  pageHosts: [],
  dlData: 'query', // Blackboard uses 'claim'
  dlSubject: false, // Blackboard requires true
  documentTarget: 'iframe'
}
```

`createProvider` returns `{ id, hosts, handle(request) }`. `handle` resolves to
`null` for an unmatched route, or `{ status, headers, body }`.
The request is `{ method, host, url, headers, body }`; `url` is a URL and `body`
is a UTF-8 string. Provider modules export `createProviders(runtime)` returning
an array. Blackboard supplies one provider. Canvas supplies cloud and
self-hosted providers in `tests/sim/canvas/index.mjs`. Canvas owns its constants
and self-tests; shared protocol changes go through the Lead.

`runtime` owns scenarios, in-memory signing keys, tokens and record cursors.
The provider helper supplies auth, JWKS, token verification, AGS, NRPS, frame
and signed DL response verification. Scenario overrides can change claims,
roles, deployment, endpoints, crypto faults and ordered score answers.
Canvas uses query-only DL data and an iframe document target. The page-only
host never exposes token, AGS or NRPS routes.

Control endpoints on `lms-sim.test`:

- `GET /__sim/ready`: registered provider IDs.
- `POST /__sim/scenarios`: replace/create one scenario; returns its ID and
  login initiation fields. Fields: `id`, `provider`, `clientId`, `deploymentId`,
  `siteHost`, optional `pageHost`, `messageType`, `roles`, `claims`, `omit`,
  `fault`, `scoreAnswers`, `resource`, `subject`, `contextId`, `resourceLinkId`.
- `GET /__sim/records?since=N`: `{ cursor, records }`, excluding token values.
- `POST /__sim/reset`: clear scenarios, token/jti state and records; keys stay.
- `GET /__sim/secrets`: `{ values }`, captured token/assertion strings for the
  private run leak scan. This endpoint exists on the control host only. It
  never returns private keys, and values never enter simulator logs or shared
  evidence. Reset retains this capture until process exit so it cannot hide a
  leak from an earlier case. QA stores raw responses only in the private run
  folder and publishes redacted scan results.

The default server requires both provider modules. A missing Canvas module is
a startup error. An explicit Blackboard-only harness self-check is separate
from full preparation or product acceptance.

## Case IDs and handoff

Every case has a stable ID `M1-NN.owner.variant`, where owner is `common`,
`blackboard` or `canvas`. The case title includes `AC-M1-NN`, its evidence label
and that stable ID. Each owner supplies a `manifest.json` in its acceptance
folder with `{ id, ac, environment, title, kind, file }` entries. `environment`
is one of the six M3 labels. `kind` is `api`, `host` or `browser`.

Each listed M1-37 and M1-38 letter and named variant is a separate ID, not one
large aggregate assertion. For example: `M1-37.blackboard.a`,
`M1-37.canvas.c2`, `M1-38.blackboard.g-existing`,
`M1-38.blackboard.g-absent`, `M1-38.canvas.g-late-create`.
Both-provider requirements have separate rows. Canvas QA supplies every
Canvas-specific branch, including shared criteria on Canvas. Common QA
supplies common metadata, default-profile gates, standard/Moodle controls,
migration and log checks, plus Blackboard cases.

The full runner reads all three manifests, rejects missing/empty suites,
duplicate IDs, absent test files, skipped/missing results and mixed SHAs.
Provider readiness means common plus that provider at one candidate SHA.
Harness-only checks never satisfy an M1 criterion.

## Environment and evidence

Use `SIM` for signed simulations. M1-23/M1-30 and real Moodle regressions use
`MOODLE-LIVE`. Documentation checks use `DOC`. Local Canvas, hosted Canvas and
Blackboard tenant checks remain separate and unverified without authorization.
No vendor DNS/certificates, production SSRF exceptions or relaxed TLS are used.
Private signing keys stay in memory. Shared evidence contains no grant codes,
ltiks, service keys, bearer tokens or client assertions.

Later product runs use a reserved `qa-multi-rN` lane, port 8443 and
`172.29.0.0/16`, one stack preferred. No Docker Desktop setting changes.
The migration/rollback runner needs a separate clean clone and the old SHA
named in M1. It must preserve the baseline containers and volumes.

## Prepared files and checks

The common manifest has 36 rows. The Blackboard manifest has 120 rows.
Together they contain 144 API cases and 12 host checks. The machine inventory
is `tests/acceptance/M1/{common,blackboard}/manifest.json`.
`common/coverage.mjs` defines the required owner/AC coverage and race variants
independently of test discovery.

Prepared code:

- `tests/sim/core/**`, `tests/sim/blackboard/**`, `tests/sim/server.mjs`:
  independent RSA signing, token and DL verification, service scopes, scores,
  host routing, private secret capture and simulator self-checks.
- `tests/acceptance/M1/common/**`, `tests/acceptance/M1/blackboard/**`:
  public API cases, fixtures, grant CLI bridge, gate schedules and migration
  probes. API runtime commits check scoring; they do not prove browser tracking.
- `tests/host/run-m1.mjs`, `m1-control.mjs`, `m1-migration.mjs` and
  `m1-migration.selftest.mjs`: frozen revisions, strict case accounting,
  operator actions, backup/restore checks and legacy orchestration.
- `tests/acceptance/run-api.mjs` and the `tests/package.json` script:
  select the ordered M1 Vitest configuration without changing legacy assertions.
- `tests/host/core.mjs`: opt-in legacy evidence sanitization and final default
  profile check; M1 and that legacy mode also compare protected volume metadata
  and other containers before and after the run.
- `tests/fixtures/multi-lms/**`: independent grade values and source pins.

On 2026-10-20, this preparation passed:

```sh
node tests/host/run-m1.mjs --harness-only --provider blackboard
node --check tests/host/run-m1.mjs
node --check tests/host/m1-migration.mjs
node --check tests/host/core.mjs
git diff --check -- tests docs/reviews/M1/qa-plan.md
```

The first command runs 16 harness self-checks, TypeScript checking and discovery
against both owned manifests. All 16 pass; discovery finds 144 API cases.
These checks make no product call and launch no stack. A default full selection
fails before Docker because the required Canvas manifest is absent.

The source pins record the retrieved bytes of the official Blackboard
[token documentation](https://docs.blackboard.com/docs/blackboard/lti/1.3/lti-subsystems/lti-sub-authentication)
and [DL return documentation](https://docs.blackboard.com/docs/blackboard/lti/1.3/dl/dl-return-token).
They support the array audience and response claim fixtures.
`provider-sources.json` also records upstream Canvas revision
`1c9f0bb8013ed69c4f2efe11fd483025469b7e6c`; Canvas QA must independently read
the relevant files before using that revision for its fixtures.
The behavior baseline remains the accepted ADR revision.

## Acceptance inventory

Every row below is **PREPARED or ASSIGNED, NOT RUN**. `C` means common QA,
`B` means Blackboard QA, and `V` means Canvas QA. An assigned part is mandatory
before the criterion can pass. Labels apply to results, not to provider metadata
or the mere existence of a profile.

| M1 AC | Owner | Label | Observable oracle and case group |
| --- | --- | --- | --- |
| 01 | C, B | SIM | Exact ordered constants; empty/ready shared-platform metadata; `00-profiles` |
| 02 | C | SIM | Default health, six profiles, three rejected ids, absent helper containers; host gate |
| 03 | C | SIM | Standard DTO, generation zero, strict fields, reserved issuers, no row on rejection |
| 04 | B, V | SIM | Exact endpoints; fixed-profile override refusals and no sink hit |
| 05 | B, V | SIM | Every origin-rule input at both APIs, canonical values, no outbound request |
| 06 | B | SIM | One shared platform; duplicate, PATCH and DELETE guards; idempotent operator CLI |
| 07 | C, B, V | SIM | Deployment CRUD, encoded ids, conditional ref rotation, staging and generation; old-key failures |
| 08 | V | SIM | Signed cloud DL, exact return query, verified JWT, no `sub`/data claim, frame policy |
| 09 | V | SIM | Grade fixtures, token assertion, browser top-level/frame behavior and static Moodle control |
| 10 | B | SIM | Signed DL and return verification; same user/context ids in two libraries; forbidden picker POST |
| 11 | B | SIM | Six grade fixtures, 80/60/90 best result, cold-cache array audience, per-site score records |
| 12 | C, B, V | SIM | All foreign service claims rejected before storage/service calls; standard positive control |
| 13 | B, V | SIM | Missing client, mismatched/unknown/inactive deployment; login and prepared signed launch; old keys |
| 14 | C, B, V | SIM | Exact claim/member allowlist and removed-name log; anonymous runtime; standard name retained |
| 15 | C, B, V | SIM | Provider/connection DTOs, readiness, defaults, dynamic and profile mismatch refusals |
| 16 | V | SIM | Every signed role-set row: picker authority, preview, result and grade presence |
| 17 | V | SIM | Initial Canvas grant, strict fields, single consumption, repeated request, other-library conflict |
| 18 | B, V | SIM | Disconnect, unredeemed grant revocation, due-time pending-score failure, unaffected school |
| 19 | C, B, V | SIM | Exact Moodle/Blackboard rows; Canvas JSON, inline public key, headers and invalid modes |
| 20 | V | SIM | Added deployment approval, repeated POST without remote call, unchanged original authority |
| 21 | C, B, V | SIM | Moodle-only operation refusals, no remote request/publication write, Moodle CLI refusal |
| 22 | B, V | SIM | Signed site mismatch and precise log; LMS-specific player/error text; standard text control |
| 23 | C | MOODLE-LIVE | Old revision dynamic registration, accepted grade, K0, stopped backup and migrated history |
| 24 | C, B, V | SIM | Exact event shapes; captured-value scan of service, gate, simulator and redacted evidence |
| 25 | C, B, V | SIM | Normalized site/service/profile values, including standard issuer-origin control |
| 26 | V | SIM | Self-hosted auth/JWKS/service routing and signature flow; page-host service refusal |
| 27 | B | SIM | Disconnect/rebind generation, K1/ltik invalid after restart, old activity denied, new grade sent |
| 28 | B | SIM | Once-only code, CLI names/expiry/list, generation one, one redemption and replacement revocation |
| 29 | B, V | SIM | Every a–m negative; precise public status, unchanged remote state and grant rejection reason |
| 30 | C | MOODLE-LIVE | Later accepted grade, damaged-backup refusals without mutation, restore, old-code launch, lost write |
| 31 | B, V | SIM | Authenticated routes/headers and sign-in redirects; publication LMS/name fields |
| 32 | V | SIM | Distinct page/service origins, exact DL destination, token/score host, both negative directions |
| 33 | B, V | SIM | Direct API 400/422 mapping, failed row at try one, 60 s no retry, explicit best-score resend |
| 34 | B, V | SIM | Fresh signed security-fault matrix on all three new profiles; no state-cookie/replay shortcuts |
| 35 | C | SIM | All three disabled combinations; stored platform login, prepared launch and old key denied |
| 36 | B, V | SIM | Service-key URL origin/path/query/encoding attacks, positive claim URL, no outbound call |
| 37 | B, V | SIM | Every schedule below: gate phases, remote ref/generation and app authority reported separately |
| 38 | B, V | SIM | Every containment/recovery variant below; no transfer and unaffected owner proof |
| 39 | C, V | SIM | Family controls, standard squatting denial before storage, ordered recovery and residual D-12 race |
| 40 | V | SIM | Third-host DL rejection; actual browser CSP refusal; top-level fallback return URL |

The API-only runtime identity check in M1-14 is supplemented by Canvas QA's
browser runtime observation. M1-09/40 browser cases must appear in the Canvas
manifest with `kind: "browser"` and stable case tags; the host runner reads both
Vitest and Playwright reports. An expected browser failure, retry, skip or
missing report cannot satisfy those rows.

M1-29 allocation: Blackboard owns b–h, j, applicable k variants, all four l
routes and m. Canvas owns a, i, its c–h counterparts, its service URL and
registered CLI refusals, and applicable l/m checks. Blackboard k's reserved
deployment refusal is exercised by M1-37 l. `DEPLOYMENT_FIXED` is a product
unit-test requirement because a valid black-box grant cannot reach it.

The exact mandatory M1-37 case suffixes are:

- Blackboard: `a`, `b`, `d`, `e`, `f`, `g`, `i`, `j`, `k-after-a`,
  `k-after-b`, `l`, `m`, `n`, `o`, `q`, `r`.
- Canvas: `c`, `c2`, `d`, `e`, `f`, `g`, `h`, `i`, `j`, `m`, `n`,
  `p-create`, `p-activate`, `q`, `r`, `s-retry`, `s-dead`, `s-compensation`,
  `t`, `u-after-c`, `u-after-c2`.

The exact mandatory M1-38 case suffixes are:

- Blackboard: `a`, `b`, `c`, `e`, `g-existing`, `g-absent`.
- Canvas: `a`, `b`, `d`, `e`, `f`, `f-held-delete`, `g-late-create`.

Each suffix is a result row, including both k/u cancel variants, all s
added-deployment variants and all late writes. Evidence includes gate request
ids and phase timestamps, remote active/ref/generation state, public connection
state, grant event counts and launch/grade authority. A live schedule that
misses the fixed five-second deadline is `BLOCKED`, never PASS. The runner
returns nonzero for it. No product timeout is changed.

| M2 AC | Owner / label | Required browser evidence |
| --- | --- | --- |
| 01 | V / SIM | Three cards, isolated newest status, Moodle card regression |
| 02 | V / SIM | Disabled Blackboard setup, then ready shared id |
| 03 | V / SIM | All URL rules and field errors, pending canonical connection |
| 04 | V / SIM | Exact copy/download/inline JSON and denied-clipboard fallback |
| 05 | V / SIM | Canvas success/errors, empty approval input and absent browser storage |
| 06 | V / SIM | Blackboard success/conflict/lost-answer retry, fixed reservation, no endpoint inputs |
| 07 | V / SIM | Badges, both site values, Canvas-only added deployment |
| 08 | V / SIM | Moodle-only sections and publish controls |
| 09 | V / SIM | Each LMS disconnect dialog and disabled state |
| 10 | V / SIM | Generic publishing options and Canvas learner/result labels |
| 11 | V / SIM | Keyboard flow, focus/status announcements, axe severity |
| 12 | V / SIM | Full portal, teacher and learner path for each simulated provider |
| 13 | V / SIM | Direct routes, cross-provider navigation and cross-library not-found |

Canvas QA owns all M2 browser files, including the Blackboard wizard. Each
wizard step needs a screenshot with the approval code redacted.

| M3 AC | Owner / label | Completion gate |
| --- | --- | --- |
| 01 | C + V / SIM; 23/30 MOODLE-LIVE | Complete manifests, two full runs at identical product/test SHAs |
| 02a | V / MOODLE-LIVE | All 15 T7 criteria in three consecutive default-profile runs |
| 02b | C / SIM or MOODLE-LIVE per legacy case | All named legacy suites and existing knob passes; final default/no-knob checks |
| 03 | V / SIM | Complete M2 rows and wizard screenshots |
| 04 | C + V / SIM | Memory-only signing keys, no private fixture files, redacted simulator/gate logs |
| 05 | V / each live label | Authorized live matrix with version/browser/date; otherwise UNVERIFIED |
| 06 | C + V / DOC run record | Reserved lane, baseline container/volume inventory, scoped teardown |
| 07 | C + V / each run's label | Zero captured-secret hits; raw traces only in private run folder |

Legacy orchestration runs T2a/T2b/T3a/T3b together, T3a/T3c, T4a,
T4b1/T4b2, T5a/T5b/T6 and T8, in sequence. Existing host runners retain their
own required AC lists and knob passes. Signed QA-platform subcases get `SIM`;
real Moodle subcases get `MOODLE-LIVE` in the final report. A suite-level exit
code alone does not assign one label to all its subcases. No legacy assertion
was weakened or changed in this dispatch.

| M4 AC | Owner / label | Required review evidence |
| --- | --- | --- |
| 01 | Docs / DOC | Every step has its evidence label; unverified live steps state that limit |
| 02 | Docs + Lead / DOC | Claims match live rows; README identifies signed simulation |
| 03 | Docs / DOC | T9 sentence/paragraph measurements |
| 04 | Docs / DOC | No DataCamp identifiers/copied prose; primary-source links |
| 05 | Docs / DOC | Offline review page, required views and all three blockers |
| 06 | Architect / DOC | Conformance decision, no open BLOCKER/MAJOR |
| 07 | Lead / DOC | Q19–Q22 and D-1–D-12 decisions |
| 08 | Docs + Lead / DOC | Exact D-12 residual race, scope, impact and operator order; no prevention claim |

## Later execution commands and resources

The Lead must first commit the tests, freeze both exact 40-character SHAs, and
reserve the stack lane. The runner refuses modified/untracked test source for
a product run. `--harness-only` deliberately permits the preparation tree.

After the full Canvas handoff, run:

```sh
export COMPOSE_PROJECT_NAME=qa-multi-r1
export PUBLIC_PORT=8443
export STACK_SUBNET=172.29.0.0/16
export COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses
node tests/host/run-m1.mjs --sha "$QA_PRODUCT_SHA" --test-sha "$QA_TEST_SHA"
```

`QA_PRODUCT_SHA` and `QA_TEST_SHA` are the Lead's frozen values. Default `full`
runs SIM then migration/rollback twice, compares every case at those same SHAs,
then runs the legacy host runners sequentially. No parallel stack is started.
Targeted commands use the same environment:

```sh
node tests/host/run-m1.mjs --phase sim --provider blackboard --sha "$QA_PRODUCT_SHA" --test-sha "$QA_TEST_SHA"
node tests/host/run-m1.mjs --phase sim --sha "$QA_PRODUCT_SHA" --test-sha "$QA_TEST_SHA"
node tests/host/run-m1.mjs --phase migration --sha "$QA_PRODUCT_SHA" --test-sha "$QA_TEST_SHA"
node tests/host/run-m1.mjs --phase legacy --sha "$QA_PRODUCT_SHA" --test-sha "$QA_TEST_SHA"
```

A Blackboard selection is partial readiness evidence only. The deployed
simulator still requires both provider modules. Migration uses its own clone
and starts at `b0b83a8`; it keeps the original environment, keys and data while
switching code. Its private backup stays outside shared evidence. Maintenance
checks read copied migration ledgers only; they never write SQL.

Resource estimate, not a measurement: allow 20–40 minutes per SIM pass,
30–60 minutes per migration/rollback pass and 60–120 minutes for all legacy
runners on warm images. Allow extra image/build time on a cold machine.
Use one stack within the current roughly 7.75 GiB Docker limit. Keep at most
two stacks across both QA workers, and do not change Docker settings.
Local Canvas is a separate feasibility decision after SIM passes.

The host report saves identity, commands, times, image ids/digests, health,
case rows, gate evidence, sanitized logs and secret-scan counts under
`tests/host/artifacts/<run-id>/`. Raw values, state files, browser traces and
maintenance backups stay in private run folders. Canvas browser cases must
capture `/__sim/secrets` privately after their last token activity; the API
secret scan runs before the browser pass.

## Remaining gates and useful counterexamples

Canvas simulator, Canvas manifest/cases and browser coverage are not present
yet. Full selection must fail until they arrive. The migration HTTP form driver,
maintenance manifest reader, CLI timing, gate wiring, artifact/environment
forwarding and baseline behavior are prepared but not exercised against a
product build. The backup reader checks semantic fields because the accepted
contract does not prescribe JSON property spelling; an unexpected encoding
must be reported and reconciled with the contract before a run can pass.

No product candidate or stack lane was used in this dispatch. No author source,
author audit note or code review was consulted. Hosted tenant access is unknown;
Canvas hosted/local and Blackboard live rows remain UNVERIFIED. A real provider
version or token policy cannot be inferred from profile constants.

These tests reject a provider-name-only implementation: wrong fixed endpoints;
scalar Blackboard assertion audience; missing signed DL `sub`/data;
foreign service URLs; two libraries routed by issuer alone; active remote
records without an approved binding; first-claim squatting; stale activation,
compensation or delete after a new owner; reused service keys after a generation
change; lost Moodle history/key compatibility; and accepted Moodle-only
operations on either new provider.
