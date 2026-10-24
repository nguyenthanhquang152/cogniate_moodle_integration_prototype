Verdict: PASS (Round 2: AC-LA-E8-02-03 PASS for acme-lms under its pass rule, 39/39 with K-HYG and the fault matrix; 5/5 ACs PASS; open kit finding F-LA-E7-06-WALK-02 for LA-E7-06)
Round: 2

# LA-E8-02 Timed walkthrough of the add-channel guide (`acme-lms`): QA verification

Tester: QA-3 (Orca task `task_6d54786f890f`, dispatch `ctx_9202fe15cac7`), 2026-10-24. Spec: `docs/architecture/ltiaas/tasks/LA-E8-02.md` (with `docs/guides/ltiaas/add-a-channel.md`, `docs/architecture/ltiaas/tasks/LA-E8-01.md`, `docs/team/ltiaas/plan.md` §4 measure 5, and `tests/ltiaas/TEST-STRATEGY.md` §3.3 & §8).

Independence: QA-3 verified the walkthrough branch `nguyenthanhquang152/la-walk` (read-only on `/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-walk`) inside a private `--no-hardlinks` clone detached at `337b807dfe4f6b4201a1c0d122e7769944cc295e` without running any Docker command or editing `la-walk`, product source, or the guide.

| Item | Value |
| --- | --- |
| Base SHA | `3880a1b70d115c03f5a5accc813875332dcee64e` (`3880a1b7`, branch point of `nguyenthanhquang152/la-walk`) |
| Walkthrough product SHA | `337b807dfe4f6b4201a1c0d122e7769944cc295e` (`337b807d`, 3 commits on top of `3880a1b7`: `fe87eb45` channel `acme-lms`, `4d12a291` simulator `acme-lms-sim` + `hosts.json`, `337b807d` kit fixture `acme-lms.json`) |
| Walkthrough log SHA | `d6196d5242863e33f76a0b7d06c45554463bec6b` (`d6196d52`, adds root scratch report `WALKTHROUGH-LOG.md` on `nguyenthanhquang152/la-walk`; branch is never merged) |
| Walker | Fresh Claude Code session (Opus 5.5, effort `xhigh`), new to the repository, named by the Lead on 2026-10-24 |
| Lane and slot | Host-only (`0` Docker commands run; `AC-LA-E8-02-03` `K1-SIM` recorded as `pending: Docker window`) |
| Clone | `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E8-02/r1/clone`: `git clone --no-hardlinks --no-checkout` of `la-walk`, detached at `337b807dfe4f6b4201a1c0d122e7769944cc295e`, `npm ci --no-audit --no-fund` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E8-02/r1/logs/` (`umask 077`): `npm-ci.log`, `f2-channel-diff.log`, `test-k0.log`, `npm-run-check.log`, `sim-discovery.log`, `sim-tests.log`, `channel-unit.log`, `kit-k0.log`, `status-after.txt` (`0` bytes) |

## Acceptance criteria

| AC | Result | Test id / Check | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E8-02-01 | PASS (K0) | `fitness:channel-diff` (F2) on `337b807dfe4f6b4201a1c0d122e7769944cc295e` vs base `3880a1b70d115c03f5a5accc813875332dcee64e` | `npm run fitness:channel-diff -- --base 3880a1b70d115c03f5a5accc813875332dcee64e --channel acme-lms` | Exits `0` with `F2 PASS: core = 0, paths = 8` (`channel:acme-lms` × 4, `tests` × 1, `sim` × 3; §1 below). `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E8-02/r1/logs/f2-channel-diff.log` |
| AC-LA-E8-02-02 | PASS (K0) | `npm run test:k0`, `npm run check`, `packages/channels/acme-lms/channel.test.ts`, simulator discovery & self-tests | `npm run test:k0 && npm run check` | `npm run test:k0` passes `3/3` files, `163/163` tests (`608ms`) with `acme-lms` loaded alongside the 5 baseline channels; `npm run check` exits `0` (`lint` OK, `typecheck` OK, `test:unit` `205` files / `3,323` passed / `5` skipped incl. `acme-lms/channel.test.ts` `6/6` in `53ms`, `test:infra` `255/255`, `test:k0` `163/163`, `F1 PASS: 0 hits`, `F5 PASS: 6 rules, 0 hits`); simulator discovery prints `7` providers incl. `acme-lms-sim`; simulator self-tests pass `64/64` (`2.72s`). Note: the standalone kit self-test `kit.k0.test.ts` fails `2/25` on a closed-world L4 guard assertion (`F-LA-E7-06-WALK-01`, recorded against `LA-E7-06` in §3.2 below). `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E8-02/r1/logs/{test-k0,npm-run-check,channel-unit,sim-discovery,sim-tests,kit-k0}.log` |
| AC-LA-E8-02-03 | pending: Docker window | `K1-SIM` certification kit for `acme-lms` (`acme-lms-sim`) | `LA_RUN_DIR=/tmp/kit-run QA_KIT_CHANNELS=acme-lms QA_TASK=K1 npm --prefix tests run acceptance:api` (inside `e2e` container in a booked Docker window) | Pending a Lead-authorized Docker window after QA-K's `LA-E7-06` live kit fix lands. |
| AC-LA-E8-02-04 | PASS (K0) | Walkthrough timing & `plan.md` §4 measure 5 (`< 1 working day`) | `la-walk/WALKTHROUGH-LOG.md` §1, §2, §6 (`date -u` stamps) | Walker: fresh Claude Code Opus 5.5 (`xhigh`) session new to the repo (named by Lead, 2026-10-24). Start: `2026-10-24T13:44:56Z`; steps & checks done: `2026-10-24T13:52:30Z` (`7 min 34 s`); end (with log): `2026-10-24T13:53:45Z`. Total: **`8 min 49 s` (`529 s`) < 1 working day** (`plan.md` §4 measure 5 PASS; §2 below). |
| AC-LA-E8-02-05 | PASS (K0) | Guide findings for `LA-E8-01` (`L1`–`L4` + `U1`–`U10`) with step IDs | Cross-check of `la-walk/WALKTHROUGH-LOG.md` §4–§5 against `docs/guides/ltiaas/add-a-channel.md` (`3880a1b7`) | All `4` places where the walker left the guide (`L1`–`L4`) and all `10` unclear or stale points (`U1`–`U10`) verified against the guide text and recorded as `14` findings (`F-LA-E8-01-L1`..`L4`, `F-LA-E8-01-U1`..`U10`) with exact guide step IDs and line references in §3.1 below (none dropped). |

---

## 1. AC-LA-E8-02-01 & AC-LA-E8-02-02: F2 and K0 Host Verification on `337b807d`

### 1.1 F2 Channel-Diff Report (`f2-channel-diff.log`)

Command run in `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E8-02/r1/clone` at `337b807dfe4f6b4201a1c0d122e7769944cc295e` (the last product/test commit of the walkthrough before the root log commit `d6196d52`):

```text
$ npm run fitness:channel-diff -- --base 3880a1b70d115c03f5a5accc813875332dcee64e --channel acme-lms

> cogniate-moodle-lti-prototype@0.0.0 fitness:channel-diff
> node infra/scripts/fitness/channel-diff.mjs --base 3880a1b70d115c03f5a5accc813875332dcee64e --channel acme-lms

channel:acme-lms	packages/channels/acme-lms/README.md
channel:acme-lms	packages/channels/acme-lms/channel.test.ts
channel:acme-lms	packages/channels/acme-lms/lti-profiles.ts
channel:acme-lms	packages/channels/acme-lms/manifest.ts
tests	tests/ltiaas/kit/channels/acme-lms.json
sim	tests/sim/acme-lms/index.mjs
sim	tests/sim/acme-lms/protocol.test.mjs
sim	tests/sim/hosts.json
F2 PASS: core = 0, paths = 8
```

- **Result:** **`F2 PASS: core = 0, paths = 8`** (exit `0`). Every touched path belongs to `channel:acme-lms` (`4` files), `tests` (`1` file), or `sim` (`3` files), matching the §1 table of `docs/guides/ltiaas/add-a-channel.md` (`:75-85`).
- Note: Commit `d6196d5242863e33f76a0b7d06c45554463bec6b` adds only the root scratch log `WALKTHROUGH-LOG.md` (`F2 FAIL: core = 1, paths = 9` if run at `d6196d52` because root files outside the §1 table are classified as `core`).

### 1.2 K0 and Repository Checks (`test-k0.log`, `npm-run-check.log`, `sim-discovery.log`, `sim-tests.log`, `channel-unit.log`)

| Check | Command | Measured Time | Result & Counts |
| --- | --- | --- | --- |
| K0 contract suite | `npm run test:k0` | `608 ms` | **`PASS` (exit `0`):** `3` test files, `163/163` tests passed (`tests/ltiaas/k0/contract.test.ts` `117`, `tests/ltiaas/k0/ld1/open-world.test.ts` `44`, `tests/ltiaas/k0/smoke.test.ts` `2`) with `acme-lms` discovered and validated alongside `moodle`, `canvas`, `blackboard`, `lti-generic`, and `brightspace`. |
| Repository check | `npm run check` | `84.1 s` | **`PASS` (exit `0`):** `lint` (`0` errors), `typecheck` (`0` errors across all workspaces, `tsconfig.node.json`, `tsconfig.portal.json`), `test:unit` (`205` files, `3,323` passed, `5` skipped), `test:infra` (`255/255` passed in `24.19 s`), `test:k0` (`163/163` passed in `489 ms`), `F1 PASS: 0 files with hits, 0 hits`, `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits`. |
| New channel unit test | `npx --no-install vitest run packages/channels/acme-lms` | `53 ms` | **`PASS` (exit `0`):** `1` file, `6/6` tests passed (`packages/channels/acme-lms/channel.test.ts`). |
| Simulator provider discovery (guide Step 7 item 5) | `node --input-type=module -e "..."` | `< 100 ms` | **`PASS` (exit `0`):** `acme-lms-sim blackboard-sim brightspace-sim canvas-sim-cloud canvas-sim-self generic-sim moodle-sim` (`7` providers total: the `6` baseline providers + `acme-lms-sim`). |
| Simulator self-tests (`tests/sim/README.md`) | `node --test 'tests/sim/core/*.test.mjs' 'tests/sim/*/protocol.test.mjs'` | `2.72 s` | **`PASS` (exit `0`):** `64/64` tests passed, including `tests/sim/acme-lms/protocol.test.mjs` (`5/5` passed) and `tests/sim/core/loading.test.mjs` (`36/36` passed). |
| Kit host self-test (`kit.k0.test.ts`) | `LA_LEVEL=k0 npx --no-install vitest run --config tests/ltiaas/kit/vitest.config.mts` | `188 ms` | **`23/25 PASS`, `2/25 FAIL` (exit `1`):** Open-world discovery and shipped-channel audit (`B-LA-E7-06-06 / LA-E8-01`) **`PASS`** with `acme-lms.json`; the `2` failures are in the closed-world `L4` self-test assertions of `tests/ltiaas/kit/kit.k0.test.ts:1709, 1748` (recorded as finding `F-LA-E7-06-WALK-01` for `LA-E7-06` in §3.2 below, not a guide failure). |

---

## 2. AC-LA-E8-02-04: Walker Identity, Step Timings, and `plan.md` §4 Measure 5

- **Walker:** Fresh Claude Code session (model: Claude Opus 5.5, effort `xhigh`), new to the repository, designated by the Lead on `2026-10-24`.
- **Walkthrough Branch & Commits (`nguyenthanhquang152/la-walk`, never merged):**
  1. Base: `3880a1b70d115c03f5a5accc813875332dcee64e`
  2. `fe87eb45a9e33d87a83c3fd3ef988ef52cf50141` — `Walk: add channel acme-lms (manifest, profile, README, unit test)` (`4` files in `packages/channels/acme-lms/`)
  3. `4d12a291bd780bd87158000511ff532c20f95ba6` — `Walk: add simulator provider acme-lms-sim and its hosts.json entry` (`3` files in `tests/sim/`)
  4. `337b807dfe4f6b4201a1c0d122e7769944cc295e` — `Walk: add kit fixture acme-lms` (`1` file: `tests/ltiaas/kit/channels/acme-lms.json`)
  5. `d6196d5242863e33f76a0b7d06c45554463bec6b` — `Walk: WALKTHROUGH-LOG for LA-E8-02 (acme-lms)` (`1` root log file: `WALKTHROUGH-LOG.md`)
- **Measured Timings (`la-walk/WALKTHROUGH-LOG.md` §1, §2, §6):**

| Phase / Guide Step | UTC Window (`2026-10-24`) | Duration | Summary |
| --- | --- | --- | --- |
| Setup (`npm ci`) | `13:44:56Z–13:45:05Z` | `0m 09s` | Installed root `node_modules` (`exit 0`). |
| Read guide & §0 (`§0.1`–`§0.5`) | `13:45:05Z–13:46:34Z` | `1m 29s` | Read `docs/guides/ltiaas/add-a-channel.md`, linked `brightspace` / `lti-generic` / `sim` / `kit` examples, and `@cogniate/channel-kernel` types (`L1`). |
| Step 1 (`mkdir packages/channels/acme-lms`) | `13:46:37Z` | `0m 01s` | Created folder without `app.ts` or `portal/`. |
| Steps 2–4 (`manifest.ts`, `lti-profiles.ts`, guard) | `13:46:37Z–13:47:16Z` | `0m 39s` | Wrote `manifest.ts` (`order: 6`, `manual` with `operatorGrant`, `guardedFamilies: [{ family: 'acme', level: 'registration' }]`) and `lti-profiles.ts` (`listOrder: 100`, `dynamicRegistration: null`). |
| Step 5 (Move Moodle `standard` connections) | `13:47:16Z` | `0m 00s` | Not run (`HOST-ONLY`, simulated-only LMS; `L2`). |
| Step 6 (`README.md` & `channel.test.ts`) | `13:47:16Z–13:47:52Z` | `0m 36s` | Wrote `README.md` and `channel.test.ts` (`6/6` pass). |
| Steps 7–8 (`tests/sim/acme-lms/` & `hosts.json`) | `13:47:52Z–13:48:40Z` | `0m 48s` | Wrote `tests/sim/acme-lms/index.mjs`, `protocol.test.mjs` (`5/5` pass), `tests/sim/hosts.json` entry (`acme-lms-sim`), and ran Step 7 item 5 discovery check. |
| Step 9 (`tests/ltiaas/kit/channels/acme-lms.json`) | `13:48:40Z–13:49:58Z` | `1m 18s` | Wrote `acme-lms.json` and diagnosed the `2/25` kit `L4` self-test failure (`L3`). |
| Step 10.1 (Commit files) | `13:49:58Z–13:50:00Z` | `0m 02s` | Created commits `fe87eb45`, `4d12a291`, `337b807d`; verified `git status --short` empty. |
| Step 10.2 (Run host checks) | `13:50:00Z–13:52:30Z` | `2m 30s` | Ran F2 (`core = 0, paths = 8`), `npm run check` (`1m 30s`, PASS), `npm run test:k0` (`163/163` PASS), discovery, kit host check, and registry check (`L4`). |
| Step 11 (Optional admin guide) | — | `0m 00s` | Skipped (optional; `U10`). |
| Walkthrough log (`WALKTHROUGH-LOG.md`) | `13:52:42Z–13:53:45Z` | `1m 03s` | Wrote and committed `WALKTHROUGH-LOG.md` (`d6196d52`). |
| **Total (Steps + Checks: `13:44:56Z–13:52:30Z`)** | `13:44:56Z–13:52:30Z` | **`7 min 34 s` (`454 s`)** | **Below 1 working day (`plan.md` §4 measure 5: PASS)** |
| **Total (Start to Log End: `13:44:56Z–13:53:45Z`)** | `13:44:56Z–13:53:45Z` | **`8 min 49 s` (`529 s`)** | **Below 1 working day (`plan.md` §4 measure 5: PASS)** |

---

## 3. AC-LA-E8-02-05: Findings for `LA-E8-01` (Guide) and `LA-E7-06` (Kit Self-Test)

### 3.1 Findings for `LA-E8-01` (`docs/guides/ltiaas/add-a-channel.md` at `3880a1b7`) — All 14 Walker Items (`L1`–`L4` and `U1`–`U10`)

Every place where the walker left the guide or needed help outside it (`L1`–`L4` in `WALKTHROUGH-LOG.md` §4) and every unclear or stale point (`U1`–`U10` in `WALKTHROUGH-LOG.md` §5) has been checked against `docs/guides/ltiaas/add-a-channel.md` and turned into a finding with its guide step ID:

| Finding ID | Walker Ref | Guide Step ID & Lines (`add-a-channel.md`) | Category | Guide Text Checked & Exact Issue | Recommended Guide Fix for `LA-E8-01` (Docs) |
| --- | --- | --- | --- | --- | --- |
| `F-LA-E8-01-L1` | `L1` | **Step 2 (`:103-127`), Step 3 (`:155-178`), Step 9 (`:324-327`)** | Left guide (read `packages/channel-kernel/src/{profiles,capabilities,manifest,legacy-wire}.ts`) | Step 3 (`:175`) says: `` `dynamicRegistration` \| only if the LMS supports Dynamic Registration; leave it out otherwise ``. In `packages/channel-kernel/src/profiles.ts`, omitting `dynamicRegistration` (`undefined`) means "no profile limit on DR", whereas `dynamicRegistration: null` is required when the LMS does not support Dynamic Registration (as on `blackboard`). In addition, Step 2 (`:113`) and Step 9 (`:325`) do not state how omitting the `dynamic` registration method changes the 17 capability keys (`registration.dynamic: false`, `binding.authority: { manual: 'operatorGrant' }`) and `expect.legacyFlags.dynamicRegistration: false` relative to `brightspace.json`. | 1. In **Step 3** (`:162, :175`), state explicitly: set `dynamicRegistration: null` when the LMS does not support Dynamic Registration (do not omit the key).<br>2. In **Step 9** (`:325`), state that a manual-only channel sets `capabilities.registration.dynamic: false`, `capabilities.binding.authority: { manual: "operatorGrant" }`, and `expect.legacyFlags.dynamicRegistration: false`. |
| `F-LA-E8-01-L2` | `L2` | **Step 1 (`:62-66`), Step 4 (`:202`), Step 5 (`:204-246`), Done checklist (`:372`)** | Left guide / step not runnable for a simulated-only or host-only walk | Step 4 (`:202`) says *"If you guard a family, do step 5 before the channel ships"*, and Step 5 (`:206, :216-244`) requires a live stack and the `tenant GET '/api/platforms?profile=standard'` helper before adding the guard. For a simulated-only LMS (or a host-only branch before a stack exists), no live Moodle `standard` platform can have signed the new family code, and `tenant GET` cannot be run without a stack. | In **Step 5** (`:204-215`), add an explicit branch for a simulated-only LMS or a clean environment with no existing live Moodle `standard` platforms: state that no active `standard` platform can sign the new family and record Step 5 as `N/A (no live standard platforms)`. |
| `F-LA-E8-01-L3` | `L3` | **Step 4 (`:185-202`), Step 9 (`:328`), Step 10.2 (`:352`)** | Left guide (read `tests/ltiaas/kit/kit.k0.test.ts` to diagnose `2/25` failure) | Step 9 (`:328`) and Step 10.2 (`:352`) state that `LA_LEVEL=k0 npx --no-install vitest run --config tests/ltiaas/kit/vitest.config.mts` passes *"16 of 16"* with a sixth fixture. When the walker added a channel that guards a product family at `level: 'registration'` (per Step 4 `:188`), the kit's `L4` probe selector added `acme:registration_guarded:warn_passthrough` to every other channel's probe table, causing `2/25` self-tests in `kit.k0.test.ts` to fail (see `F-LA-E7-06-WALK-01` in §3.2). The guide does not mention that adding a `registration`-level guard changes the kit's cross-channel `L4` probe matrix. | In **Step 4** (`:191-196`) or **Step 9** (`:328-330`), note that adding a `registration`-level `guardedFamilies` entry adds a cross-channel `registration_guarded` (`warn_passthrough`) probe for every other channel in the kit's `L4` family-guard suite, and update the test count after QA-K fixes `kit.k0.test.ts` (`F-LA-E7-06-WALK-01`). |
| `F-LA-E8-01-L4` | `L4` | **Step 10.2 (`:350`)** | Extra check outside guide to verify channel loading | Step 10.2 (`:350`) says `npm run test:k0` expected result is *"pass, with your channel loaded and no kernel edit"*. Because `npm run test:k0` prints only the 3 test file names (`contract.test.ts`, `open-world.test.ts`, `smoke.test.ts`) and not the loaded channel IDs, the walker wrote a temporary script calling `loadChannelFolders` and `buildChannelRegistry` (and inspected root `package.json`) to verify that `acme-lms` was actually loaded. | In **Step 10.2** (`:350`), either give a one-line `node`/`tsx` or `vitest -t` command that prints the discovered channel IDs, or explain that `tests/ltiaas/k0/contract.test.ts` and `open-world.test.ts` dynamically iterate over `loadChannelFolders()` (`packages/channels/*/manifest.ts`) and fail if any folder is not loaded. |
| `F-LA-E8-01-U1` | `U1` | **§0.4 (`:40-50`)** | Unclear for a simulated-only LMS | §0.4 (`:42-49`) instructs the walker to collect vendor facts and cite their source and status (`confirmed`, `design`, `UNVERIFIED`), as in `packages/channels/brightspace/README.md`, but gives no guidance when the target is a synthetic / simulated-only LMS with no external vendor documentation. | In **§0.4** (`:42-50`), add one sentence stating that for a synthetic or simulated-only LMS, standard LTI 1.3 defaults (issuer = site origin, endpoints on the issuer origin, token audience = token URL) should be used and marked `design` or `UNVERIFIED (simulated only)` in `README.md`. |
| `F-LA-E8-01-U2` | `U2` | **Step 2 (`:113`)** | Ambiguous instruction between the two reference channels | Step 2 (`:113`) says for `capabilities`: *"the capability values; `registration.scopes` = the four AGS scopes \| copy them"*. However, the two reference channels named in lines `:7, :103, :324` (`brightspace` and `lti-generic`) differ on `content.multiple` (`false` in `brightspace`, `true` in `lti-generic`) and `ops.connectionCheck` (`false` in `brightspace`, `true` in `lti-generic`). | In **Step 2** (`:113`), replace *"copy them"* with explicit rules for the channel-specific capability flags (`content.multiple`: `true` unless the LMS picker rejects multiple items; `ops.connectionCheck`: `false` unless an app connection-check handler is wired; `registration.dynamic`: `true` only if `registration` includes `dynamic`). |
| `F-LA-E8-01-U3` | `U3` | **Step 2 (`:112, :116, :120-127, :134-138`)** | Coupling between `registration` methods and `setup.bindingFields` not stated | Step 2 (`:112`) says `dynamic` is included *"if the LMS supports Dynamic Registration"*, while the `setup.bindingFields` row (`:116`) unconditionally says *"the manual fields with `FieldSpec.default` values; the three `dynamic` fields"*. If `dynamic` is omitted from `registration`, the three `method: 'dynamic'` binding fields (`clientId`, `deploymentId`, `grantCode`) must also be omitted. | In **Step 2** (`:116`), clarify that the three `method: 'dynamic'` entries in `setup.bindingFields` are included only when `registration` includes the `dynamic` method. |
| `F-LA-E8-01-U4` | `U4` | **Step 4 (`:183-202`)** | Guard guidance for a manual-only LMS | Step 4 (`:185-196`) lists three effects of a `registration`-level family guard, where effect 3 (*"A new Dynamic Registration of the family on an `lti-generic` connection is refused at `complete`"* — also cited in §0.3 `:36`) only applies to an LMS that supports Dynamic Registration, without stating whether a manual-only named channel should still guard its family for effects 1 and 2 (launch warning on `lti-generic` and launch refusal on Moodle `standard`). | In **Step 4** (`:191-202`), state explicitly that a manual-only named channel still guards its `product_family_code` at `level: 'registration'` when the family code is known (for effects 1 and 2: `lti-generic` launch warning and Moodle `standard` launch refusal), or leaves `guardedFamilies: []` when no distinct family code exists. |
| `F-LA-E8-01-U5` | `U5` | **Step 7 (`:302`)** | Stale `NOTE` in guide | Step 7 (`:302`) has: *"NOTE: The simulator self-test `tests/sim/core/loading.test.mjs` compares the committed host manifest with a fixed list of six providers. With a seventh provider that one test fails."* In fact, `tests/sim/core/loading.test.mjs` calls `verifyOpenWorldSimManifest` and passes `36/36` (`64/64` across all sim tests) with a seventh provider (`acme-lms-sim`). | Remove the stale `NOTE` at **Step 7** (`:302`) (and optionally mention that `node --test 'tests/sim/core/*.test.mjs' 'tests/sim/*/protocol.test.mjs'` passes open-world with the new provider). |
| `F-LA-E8-01-U6` | `U6` | **Step 7 (`:255`)** | Contradiction between `add-a-channel.md` and linked `tests/sim/README.md` | Step 7 (`:255`) tells the walker: *"Follow `tests/sim/README.md`, with one rule: the module returns one provider. Do not copy `tests/sim/generic/index.mjs`..."*, whereas the linked section of `tests/sim/README.md` still says *"Copy `tests/sim/generic/index.mjs` to start"*. | Either qualify the reference in **Step 7** (`:255`, e.g., *"Use the template below instead of the `generic/index.mjs` copy note in `tests/sim/README.md`; see `tests/sim/README.md` only for the config field reference"*), or align `tests/sim/README.md` if in scope. |
| `F-LA-E8-01-U7` | `U7` | **Step 7 item 4 (`:286`)** | Over-simplified instruction for `protocol.test.mjs` | Step 7 item 4 (`:286`) says: *"If you copy `tests/sim/brightspace/protocol.test.mjs`, change its import (`brightspace`, `BRIGHTSPACE_TOKEN_AUDIENCE`, `BRIGHTSPACE_DEPLOYMENTS`) to the exports of your module, and change every Brightspace host, path and value in it."* Because `brightspace/protocol.test.mjs` specifically tests D2L quirks (UUID deployments, off-host token endpoint, fixed custom token audience, and Dynamic Registration), a channel created from the Step 7.1 template (`:263-281`, which has none of those quirks) cannot simply substitute strings in `brightspace/protocol.test.mjs`. | In **Step 7 item 4** (`:286`), state that `tests/sim/brightspace/protocol.test.mjs` assertions for UUID deployments, off-host token URLs, fixed audience, and Dynamic Registration apply only if the new LMS uses those features; otherwise keep or adapt only the loader/host, launch claims, token/AGS/NRPS, and Deep Linking assertions that match the new provider config. |
| `F-LA-E8-01-U8` | `U8` | **Step 9 (`:328`), Step 10.2 (`:352`)** | Stale test count (`"16 of 16"` vs `25` tests) | Both **Step 9** (`:328`) and **Step 10.2** (`:352`) state that `LA_LEVEL=k0 npx --no-install vitest run --config tests/ltiaas/kit/vitest.config.mts` passes *"16 of 16"*. `tests/ltiaas/kit/kit.k0.test.ts` now has **`25` tests**. | Update `"16 of 16"` in **Step 9** (`:328`) and **Step 10.2** (`:352`) to match the current `kit.k0.test.ts` test count (`25 of 25` once `F-LA-E7-06-WALK-01` is resolved). |
| `F-LA-E8-01-U9` | `U9` | **Step 10.2 (`:350`)** | Unobservable claim in `npm run test:k0` stdout | Companion to `F-LA-E8-01-L4`: Step 10.2 (`:350`) states that `npm run test:k0` passes *"with your channel loaded"*, but Vitest's default summary output (`3 passed (3)`, `163 passed (163)`) does not display the list of loaded channel IDs. | Same fix as `F-LA-E8-01-L4` in **Step 10.2** (`:350`): note how `contract.test.ts` / `open-world.test.ts` load every folder under `packages/channels/` or provide a one-liner that prints the loaded channel IDs. |
| `F-LA-E8-01-U10` | `U10` | **§1 table (`:84`), Step 11 (`:365-367`)** | When Step 11 (admin guide) is skipped | Step 11 (`:365-367`) is marked `(optional)`, and for a simulated-only walkthrough LMS with no real vendor admin UI, no separate `docs/guides/ltiaas/<id>-admin.md` file is needed because `packages/channels/<id>/README.md` holds the facts and steps. | In **Step 11** (`:365-367`), add a brief note that Step 11 is skipped for a simulated-only test channel (so F2 reports `paths = 7` or `8` without a `docs` line). |

### 3.2 Finding for `LA-E7-06` (QA-K Kit Host Self-Test — Not a Guide Defect)

| Finding ID | Target Task & File | Failing Tests in `kit-k0.log` | Root Cause & Required QA-K Fix |
| --- | --- | --- | --- |
| `F-LA-E7-06-WALK-01` | **`LA-E7-06`** (`tests/ltiaas/kit/kit.k0.test.ts:1699-1755`) | 1. `A-LA-E7-06-07 / B-LA-E7-06-02 (L4): fixture guard data equals LA-ADR-01 D6, and the L4 selector picks probes from the declared guard levels for every target` (`kit.k0.test.ts:1709`)<br>2. `A-LA-E7-06-07 / B-LA-E7-06-02 (L4): the L4 case body passes on a check-14 fake for every shipped target and fails on wrong product behaviour` (`kit.k0.test.ts:1748`) | When a new channel fixture (`tests/ltiaas/kit/channels/acme-lms.json`) declares a `registration`-level guarded family (`expect.guardedFamilies: [{ family: "acme", level: "registration" }]`), `selectFamilyGuardProbes` in `tests/ltiaas/kit/lib/cases.ts` rightly adds `acme:registration_guarded:warn_passthrough` to the probe list of other channels (such as `brightspace`). However, the two `L4` K0 self-tests in `tests/ltiaas/kit/kit.k0.test.ts:1699-1755` hardcode closed-world expectations assuming `desire2learn` (`brightspace`) is the only `registration`-guarded family in `tests/ltiaas/kit/channels/*.json` (so `table('brightspace')` expects `['canvas:launch_guarded:refuse', 'moodle:unguarded:pass']` with `0` `registration_guarded` probes, and the check-14 fake in `:1720-1755` only logs `family_guard_mismatch` for `desire2learn`). QA-K is making those two `L4` self-tests open-world across all discovered fixtures in `LA-E7-06`. |

## Round 2

Tester: QA-K (Claude Code Opus 5.5 xhigh; Orca task `task_b17ef21ecd13`, dispatch `ctx_88d1b9d39f2d`), 2026-10-24. Scope: AC-LA-E8-02-03, the K1-SIM kit run for the walkthrough channel `acme-lms` (DOCKER-YES, 75 minutes from 2026-10-24T14:51:05Z). Round 1 is unchanged. No file on the walk branch, no kit file and no product file was changed; no product source was read.

### R2.1 Source and kit

| Item | Value |
| --- | --- |
| Walk clone | `~/cogniate-qa-runs/LA/LA-E7-06/walk/clone`: `git clone --no-hardlinks` of the `la-walk` worktree, detached at `d6196d5242863e33f76a0b7d06c45554463bec6b` (`337b807d` plus the walker's log; base `3880a1b7` holds product `a8bbac53`) |
| Kit tree of the walk branch at `d6196d52` | `564f4049991aa9cf577c40d55cbc355940d79ea4` |
| Kit tree of integration `d9a4f482` (QA-K round 7 fix) | `8ad870fa1b33c93268bb0cdfb11dd86289a650c4` |
| Copy | `tests/ltiaas/kit/**` replaced by `git archive d9a4f482 tests/ltiaas/kit`, then the walker's `tests/ltiaas/kit/channels/acme-lms.json` restored from `d6196d52` (`cmp`: equal to the walker's file). `diff -r` against the `d9a4f482` kit: only `channels/acme-lms.json` |
| Kit tree after the copy (the run clone's `KIT` result) | `db27da51d9d88d4e2ee12f19a05c67212cf1a503` |
| `git status --short` of the walk clone after the copy | ` M` `tests/ltiaas/kit/README.md`, `kit.k0.test.ts`, `lib/cases.ts`, `lib/fixtures.ts`, `lib/runtime.ts`, `suites/k1-ags.k1sim.test.ts`, `suites/k1-cap.k1sim.test.ts`, `suites/k1-dl.k1sim.test.ts`, `suites/k1-launch.k1sim.test.ts`, `suites/k1-nrps.k1sim.test.ts`, `suites/k1-reg.k1sim.test.ts`; `??` `tests/ltiaas/kit/k0-data/`, `lib/wave-producer.d.mts`, `lib/wave-producer.mjs`, `run-k1sim.mjs` (`~/cogniate-qa-runs/LA/LA-E7-06/walk/git-status-after-copy.txt`) |
| Kit K0 on this kit tree (with `acme-lms`; scratch clone at `d6196d52` with `npm ci`) | **32 of 32 PASS**; `tsc` clean (`~/cogniate-qa-runs/LA/LA-E7-06/walk/kit-k0-acme.log`). F-LA-E7-06-WALK-01 (§3.2) is resolved on `8ad870fa` |

### R2.2 Command: why not `QA_KIT_CHANNELS=acme-lms`

The brief's acme-lms-only command was not possible with the kit runner at tree `8ad870fa`. QA-K did not change any kit code:

- `tests/ltiaas/kit/run-k1sim.mjs:178`: the runner stops at result `WAVE` unless `LA_WAVE_ID` and `LA_K1_WAVE_SPEC` are set, and the producer needs a non-empty spec. The runner needs frozen-suite wave sources for every run. QA-K stopped and asked the Lead.
- `tests/ltiaas/kit/run-k1sim.mjs:206`: the in-container step sets `QA_KIT_CHANNELS: 'all'`, so a channel selection cannot be passed.
- `acme-lms` does not use the wave sources. The kit pass rule reads wave evidence only for a capability with a non-empty `coveredBy` (`tests/ltiaas/kit/lib/fixtures.ts:1361`), and `acme-lms` has `coveredBy: {}`. Only Moodle's `coveredBy` (T3b, T7, T8) reads them.

Lead decision (option 1, answer to QA-K's question): the unchanged runner, the round 8 wave spec (the same T3b, T7 and T8 files as LA-E7-06 R8.3), and `QA_KIT_CHANNELS=all` on the walk clone. The run therefore certifies all 6 discovered channels. The `acme-lms` verdict comes from its own pass-rule rows, K-HYG and the global fault matrix. The other 5 channels give a no-regression note. The Lead records the hard-coded channel list as a kit usability item for LG.

### R2.3 Run `qa4-la-walk-r1`

| Item | Value |
| --- | --- |
| Lane | project `qa4-la-walk-r1`, `PUBLIC_PORT 9443`, `STACK_SUBNET 172.20.0.0/16`; one stack (QA-3 ran `qa3-la-e404-*` on 9473 and 172.23.0.0/16 at the same time) |
| Time (`date -u`) | 2026-10-24T14:52:44Z–15:00:08Z; in-container step 390 s |
| Invocation (from the walk clone) | `COMPOSE_PROJECT_NAME=qa4-la-walk-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 LA_K1_WAVE_SPEC=~/cogniate-qa-runs/LA/LA-E7-06/wave-spec-r8.json LA_WAVE_ID=la-final-wave-a8bbac53 LA_K1_KIT_FROM=<walk clone>/tests/ltiaas/kit node tests/ltiaas/kit/run-k1sim.mjs --sha d6196d52 --source <walk clone> --workdir ~/cogniate-qa-runs/LA/LA-E7-06/walk/r1/run-clone` |
| In-container command | README §3: `QA_KIT_CHANNELS=all QA_TASK=K1 npm --prefix tests run acceptance:api`, `retries: 0` |
| Host results | `PRE`, `CLONE`, `KIT` (`db27da51`), `H1`, `SETUP`, `WAVE` (T3b, T7, T8 PASS), `HOSTCTL` (m1-cli 74 of 74 exit 0, m1-restart 12 of 12 exit 0), `TEARDOWN`: PASS. `SUITE` and `PASSRULE`: FAIL (the brightspace finding in R2.5). No host-runner stop, so no rerun |
| Kit run | run id `kit-run-1792853625241-ozmtxy`; ledger 234 records (234 unique ids, one run id): **232 PASS, 2 FAIL**, 0 skipped, 0 duplicates; Vitest 235 tests (the 234 cases plus `GLOBAL:K-HYG:SUMMARY`): 232 passed, 3 failed |
| Files | `~/cogniate-qa-runs/LA/LA-E7-06/walk/clone/tests/host/artifacts/qa4-la-walk-r1-d6196d52-2026-10-24T14-52-44-685Z/` (`summary.json`, `kit-run/`, `container-k1/vitest-results.json`, `service-logs/`); run clone `~/cogniate-qa-runs/LA/LA-E7-06/walk/r1/run-clone` |

### R2.4 Verdict for `acme-lms` (AC-LA-E8-02-03)

**PASS.** K1 passes for the new simulator channel under the pass rule (TEST-STRATEGY §2.6). In `k1-kit-summary.json`, `acme-lms` has `ok: true`: 39 expected `RUN` cases, **39 PASS**, no failed, missing or extra case.

| Suite | `acme-lms` cases (all PASS) |
| --- | --- |
| K1-REG (6) | `R1`, `R1-DEPLOYMENTS`, `R2`, `R4`, `R5`, `R6` (R3 and R-CHECK are N/A: `registration.dynamic` and `setup.connectionCheck` are false, with their `C2` guards PASS) |
| K1-CAP (7) | `C1`, `C2:publish.createCourse`, `C2:registration.dynamic`, `C2:setup.artifacts`, `C2:setup.connectionCheck`, `C2:siteApi.token`, `C3` |
| K1-LAUNCH (10) | `L1`–`L10` (L4: the `launch`-level probe refused; the `desire2learn` registration-level probe passes with the LTI log `family_guard_mismatch`) |
| K1-DL (8) | `D1`–`D8` (`D5-UNGRADED` N/A: `content.ungraded` is `notBuilt`) |
| K1-AGS (6) | `A1`–`A6` |
| K1-NRPS (1) | `N1` |
| K-HYG (1) | `acme-lms:K-HYG:H2` |

Global cases: `GLOBAL:K1-LAUNCH:L-FAULTS` (the 12-fault matrix, once per run on the protocol-control fixture) PASS, `GLOBAL:K1-NRPS:N2` PASS, `GLOBAL:K-HYG:H1` (secret scan of all logs, simulator records and run artifacts) PASS. `GLOBAL:K-HYG:SUMMARY` fails only because of brightspace (R2.5).

No-regression note for the other 5 channels on the walk base: moodle 37 of 37, canvas 38 of 38, blackboard 39 of 39, lti-generic 39 of 39 PASS; **brightspace 37 of 39** (`K1-REG:R3` and its `K-HYG:H2` FAIL, R2.5). The walker's channel exposed a kit defect on brightspace; it is not a regression of brightspace.

### R2.5 Finding for `LA-E7-06` (kit defect, class (b))

| Finding ID | File | Problem | Evidence | Suggested fix |
| --- | --- | --- | --- | --- |
| `F-LA-E7-06-WALK-02` | `tests/ltiaas/kit/lib/fixtures.ts:1848` (`drFamilyGuardRefusedAtComplete`), used by `tests/ltiaas/kit/suites/k1-reg.k1sim.test.ts:440` | The BD-A1-121 branch rule picks the complete-refusal branch (start `303`, `REGISTRATION_FAILED 502`) for every `registration`-level family whose owner is `any-https`. It does not check that the owner channel has Dynamic Registration. BD-A1-121 says the complete-refusal branch applies when "the DR start rule also lets the owner channel pass". The start "applies the loosest rule of any DR profile" (LA-ADR-02 D5, last paragraph). A channel without Dynamic Registration gives no DR rule, so no loaded channel lets the configuration pass, and the start keeps `400 PROVIDER_PROFILE_MISMATCH`. With `acme-lms` loaded (`registration.dynamic: false`, family `acme` guarded at the `registration` level), brightspace's R3 registration-level probe becomes `acme`, and the kit expected the wrong branch | `brightspace:K1-REG:R3` FAIL "family acme (BD-A1-121): expected 400 to be 303". The stack answered the contract answer: LTI log `registration_rejected {code: PROVIDER_PROFILE_MISMATCH, detail: family=acme}` with `GET /lti/register/:account 400` (trace `a42da1fb28e8f2273c3ee167f67099ef`, 14:56:40.805Z). The same run's L4 shows the `acme` family at launch as `family_guard_mismatch` (14:57:28Z), as LA-ADR-01 D6 says. Not a walker or guide defect (the fixture follows the guide and passes its own pass rule); not a product defect (the answer is the contract's `PROVIDER_PROFILE_MISMATCH` page and BD-A1-121's start-refusal branch) | In `drFamilyGuardRefusedAtComplete`, also require `owner.capabilities['registration.dynamic'] === true`. Add a K0 row: an extra fixture copied from the generic fixture with `registration.dynamic: false` and a registration-level family gives the start-refusal branch for brightspace. QA-K did not change the kit because the round 8 reviews are running; reported to the Lead |

### R2.6 Docker records (umask 077: `~/cogniate-qa-runs/LA/LA-E7-06/walk/r1/docker-records/`)

Before and after (`ps -a`, networks, volumes, with inspect), `events-qa4-la-walk-r1.jsonl` (2,582 own-label events), `events-all.jsonl`, `ps-watch.log` (15 s), `compare.txt`. Lane after: 0 containers, 0 volumes, 0 networks; volumes 32 → 32, no inspect changed; protected lines (`qa3-la-*`, `qalead-la-*`, `qa-e2e-*`, `la-g1-diag-*`, `sto-*`) 0 → 0. Teardown: the shared owned-only teardown. QA-K's watchers stopped after the run.

### R2.7 Acceptance criteria after Round 2

| AC | Result |
| --- | --- |
| AC-LA-E8-02-01, -02, -04, -05 | PASS (Round 1, unchanged) |
| AC-LA-E8-02-03 | **PASS** for `acme-lms` (R2.4: 39 of 39, its pass rule `ok: true`, K-HYG H1/H2 and the fault matrix PASS). Open: `F-LA-E7-06-WALK-02` (kit, LA-E7-06), which makes the whole-run SUMMARY fail on brightspace when the new channel is loaded |
