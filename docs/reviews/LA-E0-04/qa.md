Verdict: PASS
Round: 3

# LA-E0-04 One open-world rewrite of the closed-list assertions (LD-1): QA

Tester: lead QA (Round 1: `task_597ca321b1f4` / `ctx_dc11d8c6d070`, 2026-10-22; Round 2 overlay fix round 1: `task_5785f09e261c` / `ctx_0d5d78338442`, 2026-10-24; Round 2 overlay fix round 2: `task_e4e91f923e4c` / `ctx_a0b10ce4f402`, 2026-10-24; Round 3 overlay fix round 3: `task_a476d0cb4edf` / `ctx_20decc2fd3cd`, 2026-10-24). Spec: `docs/architecture/ltiaas/tasks/LA-E0-04.md` (with `BD-A1-119`). Design: TEST-STRATEGY v1.4 §4.3.

Independence: QA wrote the rewrite and the probes from the spec (`LA-E0-04.md`, `BD-A1-119`), TEST-STRATEGY §4.3, the app and LTI contracts (base and LA delta) and the frozen tests. QA read no product source, no Author notes and no reviewer file in Round 1; in overlay fix rounds 1–3, QA read `docs/reviews/LA-E0-04/reviewer-a.md` and `docs/reviews/LA-E0-04/reviewer-b.md` per task brief and still read zero product source (`apps/**`, `services/**`, `packages/**`).

**Done rule (plan LD-1): Round 3 overlay fix round 3 review ready (`docs/reviews/LA-E7-08/ld9-addendum-r5.md` §Round 3).** Round 1 reviews (`docs/reviews/LA-E0-04/reviewer-a.md`, `docs/reviews/LA-E0-04/reviewer-b.md`) approved rows 1–5, 7, 8, LD-6 (`storage-fixture-script.mjs`), `LA-IC-04`/`LA-IC-14`, and the project-prefix guard, and raised `A-LA-E0-04-01 = B-LA-E0-04-01` and `A-LA-E0-04-02`. Round 2 reviews closed `A-LA-E0-04-01 = B-LA-E0-04-01` and `A-LA-E0-04-02` (ratified as Lead decision **`LD-24`**). Round 3 reviews closed `A-LA-E0-04-03` (card loading settle wait) and `A-LA-E0-04-04` (`LD-24` citation and `18` app migrations in `cogniate.db`), and raised `A-LA-E0-04-05` (BLOCKER), `B-LA-E0-04-02` (MAJOR), and `B-LA-E0-04-03` (BLOCKER) on text-based card identity. Architect A1 ratified **`BD-A1-119`** (`article[data-channel-id]`), and Round 3 rewrites the card membership oracle to `BD-A1-119` with zero text guessing (see §Round 3 fixes below and `docs/reviews/LA-E7-08/ld9-addendum-r5.md` §Round 3).

| Item | Value |
| --- | --- |
| Base | intake `1b17261be97c4701b928fa9dc2fa74c6d23028f6` (G-BASE `bd368ff`, product `9f8ac62`). The test files equal G-BASE: `git diff --stat bd368ff 1b17261 -- tests/acceptance tests/e2e tests/host tests/sim tests/fixtures tests/compat` is empty |
| Rewrite | QA worktree `la-qa`, uncommitted (the Lead commits by path): the 8 files of the final list below, plus `tests/ltiaas/k0/ld1/**` (probes and recorded answers) |
| Proof test SHA | `7372ce42a0bcf3b0ac837c29efd4dae9d7f544dc`: a local commit in the private source clone `~/cogniate-qa-runs/LA/E0/src-rw1` (parent = intake; not pushed). The frozen M1 and M2 runners need a committed test SHA. Its `tests/` tree is `9e53741c`; each of its 12 changed files is byte-equal (`cmp`) to the worktree file |
| Lanes | `qa-la-sim-r2` (M1), `qa-la-sim-r3` (M2): port 9443, subnet `172.20.0.0/16`, one LA stack at a time (another run's QA used `qa-multi-*` on this machine) |
| Engine facts (LD-3: facts, not a gate) | macOS 27.0.1 arm64, Docker 29.9.1, Compose 5.6.0, VM 7.75 GiB, 12 CPUs; the frozen M1 runner's G-1 identity check matched |
| Artifacts (private run folder, umask 077) | M1: `~/cogniate-qa-runs/LA/E0/src-rw1/tests/host/artifacts/qa-la-sim-r2-1b17261b-2026-10-22T06-29-57-401Z/` (`m1-case-results.json`, `summary.json`, `m1-identity.json`, evidence secret scan 0 hits of 1,300 values). M2: `…/qa-la-sim-r3-1b17261b-2026-10-22T06-53-41-653Z/` (`m2-case-results.json`, `summary.json`, secret scan 0 hits). Logs: `~/cogniate-qa-runs/LA/E0/logs/m1-sim-rw-r2.log`, `m2-rw-r3.log` |

## Acceptance criteria

| AC | Result | Test id | Command | Artifact |
| --- | --- | --- | --- | --- |
| AC-LA-E0-04-01 | PASS | E0 scan (below) | `git grep` at `1b17261` (patterns below) | this file, §E0 scan |
| AC-LA-E0-04-02 | PASS | rows 1, 3, 8: `M1-01.common.constants`, `M1-02.common.default-profile`, `M1-35.common.default-off`, `-default-on`, `-acceptance-off` | `node tests/host/run-m1.mjs --phase sim --provider all --sha 1b17261… --test-sha 7372ce4… --source <src-rw1>` | M1 `m1-case-results.json` (all 5 PASS) |
| AC-LA-E0-04-03 | PASS | row 2: `M1-01.common.constants` and the M2 stack gate `M2-STACK`; row 7: `M1-15.canvas.lms-providers` | the M1 command above; `node tests/e2e/host/run-m2.mjs --sha 1b17261… --test-sha 7372ce4… --source <src-rw1>` | M1 and M2 `summary.json` |
| AC-LA-E0-04-04 | PASS | row 6: `M2-01.cards` | the M2 command above | M2 `m2-case-results.json` |
| AC-LA-E0-04-05 | PASS | `tests/ltiaas/k0/ld1/open-world.test.mjs` and `open-world.test.ts`: "row N strictness" × 18 (6 rows × a changed, a removed and a moved baseline element) | `node --test tests/ltiaas/k0/ld1/open-world.test.mjs` and `npx vitest run --config tests/ltiaas/k0/vitest.config.mts tests/ltiaas/k0/ld1/open-world.test.ts` | 46/46 pass (Node test 39 ms; Vitest 13 ms) |
| AC-LA-E0-04-06 | PASS | same files: "row N openness" × 12 (an extra element of a registered channel passes, of an unregistered channel fails), `BD-A1-119` DOM oracle probes (unregistered `"Sakai"` and `"Campus Cloud"` cards fail in every state; registered card with custom title `'Teaching Hub'` and custom not-ready text passes; delayed loading settles and passes while permanently loading fails; unknown `data-channel-id` and missing registered card fail; `A-LA-E0-04-01 = B-LA-E0-04-01`, `A-LA-E0-04-03`, `A-LA-E0-04-05`, `B-LA-E0-04-02`, `B-LA-E0-04-03`), `M1-41.common.j-snapshot` migration-ledger prefix + candidate file probe (`A-LA-E0-04-02` / `LD-24`), additive fields (LA-IC-01) pass, a simulation profile in `default` fails, the Kajabi card at most once | same commands | same runs |
| AC-LA-E0-04-07 | PASS (list approval open) | `git diff --stat bd368ff..7372ce4 -- tests/acceptance tests/e2e tests/host tests/sim tests/fixtures` | see "Final LD-1 list" | 8 files: the 6 files of the spec and the 2 new helper files; rows 4 and 5: no changed line (`00-profiles.test.ts` capability lines and `31-canvas-grants.test.ts` are not in the diff) |

Each rewritten check calls the shared module `tests/acceptance/lib/open-world.mjs`. The K0 probes call the same functions with the same arguments as each call site, on answers recorded live at G-BASE (`tests/ltiaas/k0/ld1/g-base/acceptance.json`, `default.json`, `cards.json`; no secret in them). So the probes test the exact assertion code of M1 and M2.

## Regression (spec: M1 `sim` phase and M2 at G-BASE with the rewritten files)

| Suite | Result | Time |
| --- | --- | --- |
| M1 `--phase sim --provider all` | 394 rows, 394 PASS, 0 FAIL, 0 not applicable | Round 1 (`qa-la-sim-r2`): suite 22.3 min (`1,338,825 ms`), run 23.4 min; Slot 7 (`qalead-la-16`, `--test-sha 357d1799`): `394/394 PASS` (`400/400 PASS` in `summary.json`, including `M3-ISOLATION`), run 23.8 min |
| M2 | 64 cases, 64 PASS | Round 1 (`qa-la-sim-r3`): browser pass 1.9 min, run 2.9 min; Slot 7 (`qalead-la-17`, `--test-sha 357d1799`): `64/64 PASS` (`70 PASS`, `1 FAIL` `M3-06-M2` due to foreign `sto-*` containers in `summary.json`), run 3.3 min |

"Equal to LA-E0-02 except the rewritten ids": **PASS (verified in Slot 7 with `LA-E0-02`, `docs/reviews/LA-E0-02/qa.md`)**. On `1b17261be97c4701b928fa9dc2fa74c6d23028f6` with `--test-sha 357d17997b4d36dbfb6bde7568a4d87c0e3a14fc` (`/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-slot7-1b17261`), `qalead-la-16` (`M1 --phase sim --provider all`, `SLOT7/artifacts/qalead-la-16-1b17261b-2026-10-23T18-27-46-137Z/summary.json`) passed `394/394` manifest rows (`400/400 PASS` in `summary.json`), and `qalead-la-17` (`M2`, `SLOT7/artifacts/qalead-la-17-1b17261b-2026-10-23T18-52-05-778Z/summary.json`) passed `64/64` manifest cases (`70 PASS`, `1 FAIL` `M3-06-M2` `"volumes 35 → 34; containers 3 → 2"` explained by `213` foreign `sto-*` container create/destroy events; all 32 protected persistent volumes 100% byte-identical in `docker volume inspect` JSON). Every row and case of M1 `sim` (`394/394`) and M2 (`64/64`), including all rewritten `LD-1` IDs (`M1-01.common.constants`, `M1-02.common.default-profile`, `M1-15.canvas.lms-providers`, `M1-35.common.{default-off,default-on,acceptance-off}`, `M2-STACK`, `M2-01.cards`), passed identically across Round 1 and Slot 7 (`LA-E0-02`).

Runner records, not test rows: in Round 1 (`qa-la-sim-r2`), the M1 runner's `M3-ISOLATION` record was FAIL ("containers changed: 10; volumes changed: qa-multi-r1_*") when another run's QA (`qa-multi-r1`) restarted its own stack; in Slot 7 (`qalead-la-16`), `M3-ISOLATION` was `PASS`, while `qalead-la-17`'s `M3-06-M2` was `FAIL` ("volumes 35 → 34; containers 3 → 2") due to concurrent `sto-*` Savoy containers (`TEST-STRATEGY.md` §5.4 environment note). `TEARDOWN` was `PASS` in all runs (`0` `qalead-la-*` resources left).

## Final LD-1 list (for Reviewer-A, Reviewer-B and the Lead)

| File | Rows | Change |
| --- | --- | --- |
| `tests/acceptance/M1/common/00-profiles.test.ts` | 1, 2 | M1-01.common.constants: `checkProfiles(…, BASELINE_PROFILES)`, `checkSimulationProfiles(…)`. The `expectedProfiles` block moves unchanged into the module as `BASELINE_PROFILES`. The `label` and `sharedPlatform` checks stay. |
| `tests/acceptance/M1/common/90-simulation-gates.test.ts` | 8 | M1-35.*: `checkProfiles(…, BASELINE_REAL_PROFILES, { realOnly: true })` instead of `length, 6` |
| `tests/acceptance/M1/canvas/11-canvas-platforms.test.ts` | 7 | line 255 only: `checkLmsEntries(r.json.lms)` (a dynamic import on the same line, so no other line changes) |
| `tests/host/run-m1.mjs` | 3 | `defaultGate`: `checkProfiles(…, BASELINE_REAL_PROFILES, { realOnly: true })` with the registered channels of `GET /app-api/lms-providers` (seed portal user); the `M1-02.common.default-profile` note text |
| `tests/e2e/host/run-m2.mjs` | 2 | stack gate: `checkSimulationProfiles(…)` with `GET /api/providers` and `GET /app-api/lms-providers` |
| `tests/e2e/M2/01-cards.m2.ts` | 6 | M2-01.cards: `checkCards(<visible cards of the LMS Publishing grid>, [Moodle, Canvas, Blackboard texts], …)` |
| `tests/acceptance/lib/open-world.mjs` (new) | all | **Needs the Lead's approval as a list file (spec: "each file that the E0 scan adds … with the Lead's approval").** The shared pure checks and the baseline constants. Placed in the frozen tree on purpose: a later change to the rule shows in the §4.3 diff stat and needs approval, like an assertion change. |
| `tests/acceptance/lib/open-world.d.mts` (new) | all | its types, for the M1 and M2 type check (`npm --prefix tests run typecheck` passes) |

Rule of every check (the strictness argument for the reviewers): each baseline element is present exactly once, keeps every baseline field value (`assert.deepEqual` per field, so a missing field or `null`→other fails), and keeps its relative order; ids or `lms` values are unique. Extra fields on a baseline element pass (LA-IC-01 adds `channel`, `channelName`, `channelCapabilities`, the E2 trait fields). An extra element passes only if it belongs to a registered channel: a profile needs `channel` in the channel ids of `GET /app-api/lms-providers` (`channel`, or `lms` before LA-IC-01); an extra simulation id needs a simulation profile of such a channel; an extra `lms` entry needs `channel` = `lms` (app delta §2); an extra card must name a registered non-baseline channel. Rows 3 and 8 also refuse any simulation profile in the `default` profile. Before the rewrite, rows 3 and 8 checked only the count; now they also check the six baseline values and the order (stricter). Row 6 had no count or order before; now it has the order and the extra-card rule (stricter).

## E0 scan at G-BASE (AC-01, K0)

Method: `git grep` at the intake SHA `1b17261` over `tests/acceptance` (M1 and the legacy groups), `tests/e2e` (M2, T7), `tests/host` and `tests/compat`. The test files at the intake SHA equal G-BASE `bd368ff` (`git diff --stat bd368ff 1b17261 -- tests/acceptance tests/e2e tests/host tests/sim tests/fixtures tests/compat` is empty). Patterns: (1) every use of `/api/providers`, `/app-api/lms-providers` and `simulation_profiles`; (2) exact lists and counts (`.length, n`, `toHaveCount(n)`, `['moodle', 'canvas', 'blackboard']`, `Object.keys(…)`); (3) whole-object comparisons (`deepEqual`, `toEqual`) of connection DTOs, `lms-providers` entries, profiles, capabilities and cards. 49 + 102 + 105 + 13 lines; each relevant hit is classified below. A live check of the M2 card list (filter "LMS Publishing") was added because a card list is not visible in the test text.

| # | Hit (file:line at G-BASE) | Class | Decision |
| --- | --- | --- | --- |
| 1 | `tests/acceptance/M1/common/00-profiles.test.ts:42-45` (M1-01.common.constants): exact profile list and order, whole objects | §4.3 row 1 | rewrite |
| 2 | `00-profiles.test.ts:49` (M1-01.common.constants) and `tests/e2e/host/run-m2.mjs:124` (M2 stack gate): `simulation_profiles` equals the 2 ids | row 2 | rewrite (both) |
| 3 | `tests/host/run-m1.mjs:297` and `:302` (M1-02.common.default-profile): 6 profiles; the note "six real profiles" | row 3 | rewrite |
| 4 | `00-profiles.test.ts:110-111`, `:135-136`; `03-snapshot-controls.test.ts:21`; `canvas/11-canvas-platforms.test.ts:225`, `:258`: the six legacy capability flags | row 4 | no change: the six legacy flags stay byte for byte; the new set is `channelCapabilities` (LA-ADR-01 D3, D11) |
| 5 | `canvas/31-canvas-grants.test.ts:300`, `:307`: `details.capability` | row 5 | no change (LA-ADR-01 D3) |
| 6 | `tests/e2e/M2/01-cards.m2.ts:11-21` (M2-01.cards): "three LMS cards" | row 6 | rewrite. The test itself has no count; the rewrite adds the open-world card list (baseline order, extra cards). Live G-BASE fact: the filter shows 4 cards, Kajabi, Moodle, Canvas, Blackboard; Kajabi is a static non-LTI card (see note N1) |
| 7 | `canvas/11-canvas-platforms.test.ts:255` (M1-15.canvas.lms-providers): `lms` list | row 7 | rewrite (line 255 only) |
| 8 | `common/90-simulation-gates.test.ts:19` (M1-35.common.*): 6 profiles in the default profile | row 8 | rewrite |
| 9 | `canvas/11-canvas-platforms.test.ts:259` and `tests/e2e/M2/02-canvas-wizard.m2.ts:26`: the Canvas profile rows and labels | not LD-1 | no rewrite: Canvas-only lists; LA adds no Canvas profile (LTI delta §4.7). Canvas Dynamic Registration (`:218`, `:241`, `:257`) is LA-IC-14 |
| 10 | `00-profiles.test.ts:113`, `:129`; `T4b1/1-connect.spec.ts:123`; `T6/2-connect.spec.ts:110`; `tests/e2e/2-scenario-b.spec.ts:116`; `M2/03-blackboard-wizard.m2.ts:21`; `blackboard/30-grants.test.ts:154`; `canvas/31-canvas-grants.test.ts:196`: tool configuration rows of one LMS | not LD-1 | no rewrite: channel rows stay (app delta §3.3); Moodle row 13 is LA-IC-04 |
| 11 | `canvas/31-canvas-grants.test.ts:158`, `:173`: the whole Canvas configuration JSON | not LD-1 | no rewrite: LA-IC-04 (NRPS scope) owns it |
| 12 | `00-profiles.test.ts:149`; `canvas/11-canvas-platforms.test.ts:107`, `:250`; `canvas/31-canvas-grants.test.ts:28`, `:252`, `:384`, `:393`, `:438`; `blackboard/30-grants.test.ts:172`; `52-canvas-snapshot.test.ts:40`: before/after equality of the same answer | not LD-1 | no rewrite: both sides come from the same build, so additive fields are on both |
| 13 | `common/snapshot-migration.probe.ts:27`, `:113`; `blackboard/52-snapshot.test.ts:103`: `connection.platform` equal across an upgrade or a repeat | not LD-1 | no rewrite: LA adds no field to the `platform` sub-object (app contract §4.2 vs app delta §1) |
| 14 | `common/migration.probe.ts:40`: publications without `lms` and `connectionName` equal across the upgrade | not LD-1 | no rewrite: "JSON shapes do not change" for publications (app delta §6) |
| 15 | `canvas/11-canvas-platforms.test.ts:148`: whole LTI deployment answer | not LD-1 | no rewrite: not one of the three wire objects; LA adds no deployment field (LTI delta §4.6 adds platform fields only) |
| 16 | `blackboard/20-protocol.test.ts:112`, `canvas/21-canvas-protocol.test.ts:151`: `Object.keys` of the stored launch claims | not LD-1 | no rewrite: claim minimization, not a wire object; a claim policy change is LA-IC-08 |
| 17 | `tests/host/run-m1.mjs:286`, `tests/host/core.mjs:453`, `canvas/02-canvas-snapshot-isolated.test.ts:16`, `90-simulation-gates.test.ts:17`: `simulation_profiles` is `[]` in the default profile | near hit | no rewrite: stays true; the new channels have no simulator profile (LA-ADR-02 D7) |
| 18 | `tests/acceptance/T6/1-integrations.spec.ts:24` (via `lib/portal.ts:84`): at least 9 cards | near hit | no rewrite: already open-world |
| 19 | `00-profiles.test.ts:46`, `:64`: `sharedPlatform` per profile, `find` by id | near hit | no rewrite: open over extra profiles (new profiles have `sharedPlatform: null`, LTI delta §4.7) |

Result: the scan at G-BASE finds rows 1–8 and no other hit. Row 2 has two places. Rows 4 and 5 need no change.

## Notes

- N1 (row 6, live G-BASE fact): the "LMS Publishing" filter shows 4 visible cards: Kajabi ("Publish and sell your courses directly on Kajabi with seamless content sync."), Moodle, Canvas, Blackboard. Kajabi is a static integration card, not an LTI channel. The frozen test never checked it. The rewrite allows it by its exact text (`BASELINE_OTHER_CARDS`, at most once) and does not require it; any other extra card must name a registered channel. Reviewers: please confirm this reading of "each extra card belongs to a registered channel".
- N2: the frozen M1 and M2 runners accept only a committed test SHA, so the proof used the local commit `7372ce4` (private clone, not pushed). After the Lead's path commit, the files are byte-equal; the next R1 run uses the integration SHA.
- N3: no M1 or M2 case id, title or count changed (`vitest list`: 392 API cases, unique; M2 discovery unchanged, 64 cases).
- N4: deferred-candidate (MINOR, for `docs/team/ltiaas/deferred.md` if the Lead agrees): TEST-STRATEGY §4.3 row 1 says "the 6 baseline profiles"; in the `acceptance` profile the list has 8 (6 real + 2 simulation). The rewrite checks all 8.

## Round 2 fixes (`A-LA-E0-04-01 = B-LA-E0-04-01`, `A-LA-E0-04-02`, `A-LA-E0-04-03`, `B-LA-E0-04-02`, `A-LA-E0-04-04`; `docs/reviews/LA-E7-08/ld9-addendum-r5.md`)

1. **`A-LA-E0-04-01 = B-LA-E0-04-01` (BLOCKER, CLOSED in Round 2 — Row 6 extra-card membership oracle):**
   - `extraChannelNames(lmsProviders)` (`tests/acceptance/lib/open-world.mjs` and byte-identical `tests/ltiaas/lib/open-world.mjs`) returns the deduplicated exact channel `id` (`channel ?? lms`), `channelName`, `label`, and any explicit card title strings for each registered non-baseline channel (`['lti-generic', 'LMS']` in the K0 fixture when `lti-generic` is registered).
   - `lmsCardTexts(page)` (`tests/e2e/M2/01-cards.m2.ts`) extracts `{ text, channel, name, disabled, loading, notReadyLms }` per visible card in the `"LMS Publishing"` grid.
   - `checkCards` checks `allowed.has(...)` by **exact** `id` or `name` membership in the `Set` of registered non-baseline identifiers — never by substring (`String(text).includes(name)` is removed).
   - Verified by the mixed registered and unregistered K0 probe in `tests/ltiaas/k0/ld1/open-world.test.mjs` and `tests/ltiaas/k0/ld1/open-world.test.ts`.
2. **`A-LA-E0-04-02` (MAJOR, CLOSED in Round 2 and ratified as `LD-24` — `tests/host/m1-migration.mjs` `M1-41.common.j-snapshot` migration-ledger check and classification):**
   - Added `checkMigrationLedgers(oldLedger, newLedger, { expectedLtiLedger, expectedAppLedger })` in `open-world.mjs` and called it from `snapshotMigrationRun` in `tests/host/m1-migration.mjs`: (a) verifies that every historical ledger entry in `oldLedger[db]` is preserved in order as a non-empty prefix of `newLedger[db]`, (b) verifies `'012_connection_provider_snapshot.sql'` in `newLedger['cogniate-app/cogniate.db']`, and (c) keeps the exact comparison against the candidate's sorted migration files (`expectedLtiLedger`, `expectedAppLedger`).
   - Added the focused K0 negative and positive self-test in `open-world.test.mjs` and `open-world.test.ts` (proving that dropping or reordering a historical entry fails even if also removed or reordered in `expected*Ledger`), and updated `tests/ltiaas/GATE-RUN-PLAN.md` and `docs/reviews/LA-E7-08/qa.md` to classify `tests/host/m1-migration.mjs` explicitly as an assertion change on `M1-41.common.j-snapshot` (`BD-A2-108` / `LD-24` / `WE-F5`).
3. **`A-LA-E0-04-03` (MAJOR — Wait for `/connections` card loading to settle before reading cards in `M2-01.cards`):**
   - `lmsCardTexts(page)` (`tests/e2e/M2/01-cards.m2.ts`) now marks a card as `loading: true` when it has no `Connect`/`Manage` control or renders a `Loading…` placeholder leaf, and polls via `await expect.poll(...)` until `cards.length > 0 && cards.every((c) => !c.loading)` before returning the card descriptors.
   - `checkCards` and `checkExtraCard` (`open-world.mjs`) also reject any unsettled loading card (`!isLoadingCard(card)`).
   - Added the K0 `row 6 loading state (A-LA-E0-04-03)` test in `open-world.test.{mjs,ts}` verifying that delayed connections settle and pass, while permanently unresolved loading cards fail within the poll bound and are rejected by `checkCards`.
4. **`B-LA-E0-04-02` (MAJOR — Keep channel identity on disabled-control `ready: false` cards and distinct display titles):**
   - In `lmsCardTexts(page)`, when a card renders a disabled `Connect` button (`disabled: true`) and has no `href`/`id`, `notReadyLms` is extracted from the leaf notice `<LMS> is not set up for this Cogniate service yet.` and used as `channel` (`if (!channel && disabled && notReadyLms) channel = notReadyLms`).
   - In `checkExtraCard` (`open-world.mjs`), when `channel === null` (e.g. a disabled `ready: false` card or DOM stub with a distinct display title such as `card.title: 'Campus Learning'` for a channel with `id: 'campus'`, `channelName: 'Campus'`, `label: 'Campus LMS'`, or `'LTI 1.3'` for `'lti-generic'`), `matchesAllowedCardName(name, allowed)` and `notReadyLms` / `target` checks verify that the card belongs to a registered non-baseline channel while rejecting unregistered cards in the same state (`'Sakai Learning'`, `'Sakai LMS'`, etc.).
   - Added the K0 `row 6 not-ready disabled card with distinct display title (B-LA-E0-04-02)` test in `open-world.test.{mjs,ts}` (`44/44` K0 tests pass).
5. **`A-LA-E0-04-04` (MINOR, CLOSED in Round 3 — Replace `LA-H21` citation with `LD-24` and fix `cogniate.db` migration count to `18`):**
   - Replaced `LA-H21` with `LD-24` (alongside `BD-A2-108`) in `open-world.mjs`, `open-world.test.{mjs,ts}`, `docs/reviews/LA-E7-08/ld9-addendum-r5.md`, `docs/reviews/LA-E0-04/qa.md`, `docs/reviews/LA-E7-08/qa.md`, and `tests/ltiaas/GATE-RUN-PLAN.md`, and updated the `cogniate.db` migration count on `8fadb828` in `ld9-addendum-r5.md` from `14` to `18` (`21` in `lti.db`, `18` in `cogniate.db`).

## Round 3 fixes (`BD-A1-119`: `A-LA-E0-04-05`, `B-LA-E0-04-02`, `B-LA-E0-04-03`; `docs/reviews/LA-E7-08/ld9-addendum-r5.md` §Round 3)

1. **Rewrote the Row 6 card membership oracle to `BD-A1-119` (`article[data-channel-id]`):**
   - Removed every text-based card identity path (setup-notice regex, title suffix stripping, `notReadyLms` guessing, `href`/`id` fallback) from `tests/acceptance/lib/open-world.{mjs,d.mts}`, `tests/ltiaas/lib/open-world.{mjs,d.mts}`, and `tests/e2e/M2/01-cards.m2.ts`.
   - `extraChannelNames(lmsProviders)` returns the non-baseline `channel` ids (`entry.channel ?? entry.lms`) from `GET /app-api/lms-providers`.
   - `lmsCardTexts(page)` in `tests/e2e/M2/01-cards.m2.ts` extracts `{ text, channel, loading }` where `channel` is read strictly from `article[data-channel-id]` (`const article = c.matches('article[data-channel-id]') ? c : c.querySelector('article[data-channel-id]'); const channel = article ? article.getAttribute('data-channel-id') : null;`), keeping the approved `expect.poll(...)` loading settle wait (`A-LA-E0-04-03`).
   - `checkCards` rejects any loading card (`!isLoadingCard(card)`), checks the 3 baseline cards in order (and asserts `cardChannel(card) === BASELINE_LMS[i]` when extracted from the DOM), requires every card without `data-channel-id` (`channel === null`) to be one of the frozen static cards (`BASELINE_OTHER_CARDS`, each at most once), and asserts that the non-baseline `data-channel-id` values have no duplicates and equal the exact set of registered non-baseline channel ids (`allowed`), so both an unknown `data-channel-id` and a missing registered card fail.
2. **Added K0 `ld1` DOM probes (`tests/ltiaas/k0/ld1/open-world.test.{mjs,ts}`, `46/46` pass):**
   - Executes the literal `page.evaluate` callback from `tests/e2e/M2/01-cards.m2.ts` against constructed DOM trees and verifies:
     - Unregistered `"Sakai"` and `"Campus Cloud"` cards fail in every state (including disabled cards with generic `"LMS is not set up..."` notice, copied notice, or lookalike title).
     - A registered card with a custom title (`'Teaching Hub'`) and custom not-ready text (`'Campus is unavailable until your operator completes setup.'`, `'Ask your operator to enable Campus.'`) passes.
     - A loading card passes after it settles, and a permanently loading card fails.
     - A card with an unknown `data-channel-id`, a static card with `data-channel-id`, a baseline card with missing/wrong `data-channel-id`, or a missing registered card fails.
