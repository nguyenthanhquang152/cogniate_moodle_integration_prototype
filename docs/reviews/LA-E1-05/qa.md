Verdict: PASS
Round: 1

# LA-E1-05 S3 LTI profiles in channel folders, traits, generic check 14 and `PUBLIC_MOODLE_URL` removal: QA verification

Tester: QA-4 (Orca task `task_4850a4007ebe`, dispatch `ctx_ae67ca3cf8ee`), 2026-10-22. Spec: `docs/architecture/ltiaas/tasks/LA-E1-05.md`. Suite: `tests/ltiaas/tasks-lti/LA-E1-05/` (QA-4 test-first, committed in `104793a`).

Independence: QA-4 did not read product source, Author notes or reviewer files. QA-4 tested the profile registry through the public entry point `services/lti-service/src/profiles/index.ts` (`listProfiles`, `findProfile`, `profileDefinition`) of `docs/architecture/ltiaas/tasks/README.md` §3, found the Author's unit tests by name through the Vitest reporter, and read only `packages/channel-kernel/fitness-scope.json`, `infra/scripts/fitness/f1-baseline.json` (AC-11), and the file list of the product merge.

| Item | Value |
| --- | --- |
| SHA | `104793a9470d40ba33e228236559df2b7fd84b0d` (integration `104793a`; holds the LA-E1-05 product merge `aa0b200`, base parent `aab29a6`, and QA-4's suite) |
| Lane and slot | lane L; no Docker (HOST-ONLY; another run holds exclusive Docker) |
| Clone | `~/cogniate-qa-runs/LA/LA-E1-05/r1/clone`: `git clone --no-hardlinks --no-checkout`, detached at `104793a9470d40ba33e228236559df2b7fd84b0d`, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E1-05/r1/` (umask 077): `npm-ci.log`, `k0-vitest.log`, `k0/e1-05-ac02-traits.json`, `k0/e1-05-ac11-f1-deltas.json`, `check.log`, `unit-rows-by-id.log`, `unit-rows-files-verbose.log`, `e1-05-merge-files.txt`, `rev.txt`, `remotes.txt`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E1-05-01 | pending: Docker window | `profiles.k1sim.test.ts > AC-LA-E1-05-01` | — | Waits for a SIM Docker window to compare live `GET /api/providers` against golden G1 (`G1.json`). |
| AC-LA-E1-05-02 | PASS (K0) | `profiles.k0.test.ts > AC-LA-E1-05-02` | `LA_LEVEL=k0 QA_REPO_ROOT=$PWD LA_SCRATCH_CLONE=$PWD LA_BASE_SHA=aab29a6a1b413ee250382b4e61c6d07584169e7f LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E1-05/r1/k0 npx --no-install vitest run --reporter=verbose --config tests/ltiaas/tasks-lti/LA-E1-05/vitest.config.mts` | `listProfiles`, `findProfile` and `profileDefinition` show `endpoints: admin`, `privacyFloor: none`, `wireLms: null` for `standard`; `endpoints: fixed`, `privacyFloor: allowlist`, `wireLms: 'canvas' \| 'blackboard'` for the Canvas and Blackboard profiles; simulations on lists 8 profiles in baseline order, simulations off lists 6 real profiles and omits `blackboard-sim` and `canvas-sim-cloud`. `k0/e1-05-ac02-traits.json`, `k0-vitest.log` |
| AC-LA-E1-05-03 | PASS (UNIT) | Author tests: `services/lti-service/src/profiles/channel-registry.test.ts > manifest family guards (AC-03 and AC-04) > preserves the refused set for every baseline profile, including case folding` and `services/lti-service/src/http/routes/multi-lms.test.ts > login, launch checks 9, 13, 14, claim allowlist and idtoken (§9.7 to §9.9) > check 14: a Canvas- or Blackboard-signed launch on another profile is refused before storage; other values pass` | `npx --no-install vitest run --reporter=verbose services/lti-service/src/profiles/channel-registry.test.ts services/lti-service/src/http/routes/multi-lms.test.ts` | Refused set for `canvas`, `blackboardlearn`, `moodle`, `desire2learn` and absent `product_family_code` equals the baseline check 14 table, case-insensitively. Reviewer-B checks test quality. `unit-rows-files-verbose.log` |
| AC-LA-E1-05-04 | PASS (UNIT) | Author tests: `services/lti-service/src/profiles/channel-registry.test.ts > manifest family guards (AC-03 and AC-04) > checks a registration guard before storage (other profile: false)`, `> checks a registration guard before storage (other profile: true)`, and `> passes a registration guard on its owning channel` | as AC-03 | Registration-level guard (`{family: 'desire2learn', level: 'registration'}`) refuses `standard` (`MANUAL_SELF_LEGACY_CHANNELS`) with `PROVIDER_PROFILE_MISMATCH` before storage and passes on other profiles with `family_guard_mismatch` logged. `unit-rows-files-verbose.log` |
| AC-LA-E1-05-05 | PASS (UNIT) | Author tests: `services/lti-service/src/profiles/channel-registry.test.ts > profile load checks (AC-05 and load check 5) > stops loading and logs one error: unknown trait \| unknown flag \| source-supplied owner \| missing baseline wire value \| changed baseline wire value \| wire value on a new profile \| duplicate id in two folders \| missing registration profile` and `> loads a new profile without a wire override and takes its owner from the folder` (9 cases) | as AC-03 | Load checks 2, 5, 7 and 8 stop loading and log `channel_registry_invalid` for each invalid case. `unit-rows-files-verbose.log` |
| AC-LA-E1-05-06 | PASS (UNIT) | Author tests: `services/lti-service/src/profiles/channel-registry.test.ts > preserves text names for every baseline profile and family (AC-06)` and `services/lti-service/src/http/routes/multi-lms.test.ts > LMS name text table (security §12): Moodle texts byte for byte > every protocol action and cookie help text with Moodle equals the text before M1` | as AC-03 | `lmsNameOf` and `lmsNameOfFamily` return `Moodle`, `Canvas`, `Blackboard` from manifest `names.text` for every baseline profile and family. `unit-rows-files-verbose.log` |
| AC-LA-E1-05-07 | pending: Docker window | `profiles.k1sim.test.ts > AC-LA-E1-05-07` | — | Waits for a SIM Docker window (`/healthz` equal to G1 `ltiHealth` with `MOODLE_HOST` allowlist LA-IC-02, and Moodle-shaped `standard` launch without `PUBLIC_MOODLE_URL`). Unit check `packages/shared/src/config.test.ts > loadPublicUrls > returns the three service origins without a platform URL` passes now (`unit-rows-files-verbose.log`). |
| AC-LA-E1-05-08 | pending: Docker window | `profiles.k1sim.test.ts > AC-LA-E1-05-08` | — | Waits for a SIM Docker window (`allowlist` privacyFloor drops personal claims and logs `launch_claims_minimized`; `none` keeps them). |
| AC-LA-E1-05-09 | pending: Docker window | `profiles.k1sim.test.ts > AC-LA-E1-05-09` | — | Waits for a SIM Docker window (R1 M1 `sim` phase + M2 and golden G1–G4 compare). |
| AC-LA-E1-05-10 | pending: Docker window | R2-lite (`MOODLE-LIVE`) | — | Waits for a Moodle Docker window (T7 × 1 and T2a, T2b, T3a, T3b, T3c). |
| AC-LA-E1-05-11 | PASS (K0) | `profiles.k0.test.ts > AC-LA-E1-05-11` | as AC-02 | `packages/shared/src/config.ts` has F1 count 0 (both at its path and unmasked without path exception) and is removed from `packages/channel-kernel/fitness-scope.json` `coreExceptions`; F1 counts of task files decrease by 82 (`profiles/canvas.ts` -33, `profiles/blackboard.ts` -21, `profiles/index.ts` -19, `lti/checks.ts` -6, `profiles/types.ts` -2, `lti/launch.ts` -1) and none rise (RQ-3). `k0/e1-05-ac11-f1-deltas.json`, `check.log` |

### R0 `npm run check` counts (`check.log`)

| Count | LA-E0-01 (`1b17261`) | `104793a` |
| --- | --- | --- |
| Vitest (`test:unit`) | 70 files; 1,123 passed, 5 skipped | 90 files; 1,316 passed, 5 skipped |
| Infra (`node --test`) | 111 pass, 0 fail (14 suites) | 184 pass, 0 fail (20 suites) |
| K0 (`test:k0`) | — | 2 files; 42 passed, 0 failed |
| Fitness (`fitness:lms-names`, `fitness:rules`) | — | F1 PASS (80 files with hits, 677 hits, delta -82 from `LA-E1-05`); F5 PASS (2 rules, 0 hits) |

`git status --porcelain` in the clone is empty after the run (`status-after.txt`).

## Other checks

- The LA-E1-05 product merge `aa0b200` edits only files within scope (`packages/channels/{moodle,canvas,blackboard}/lti-profiles.ts`, `services/lti-service/src/profiles/**`, `services/lti-service/src/lti/{checks,claims,launch}.ts`, `services/lti-service/src/http/routes/{protocol,multi-lms.test}.ts`, `services/lti-service/src/testkit.ts`, `services/cogniate-app/src/{testkit,providers/canvas.test}.ts`, `packages/shared/src/{config,config.test,service.test}.ts`, `packages/channel-kernel/fitness-scope.json`, `packages/channel-kernel/src/legacy-wire.ts`; `e1-05-merge-files.txt`) and touches none of the "Must not edit" files (`http/routes/platforms.ts`, `http/{app,auth,error-page,context}.ts`, `lti/codes.ts`, `services/lti-service/src/config.ts`, `store/**`, `packages/channels/*/manifest.ts`).
- QA test-harness note: updated `tests/ltiaas/tasks-lti/LA-E1-05/profiles.k0.test.ts` (`callProfileDefinition` calls `profileDefinition(id)` with 1 argument instead of passing the boolean `simulationsOn` as the second `source` parameter, and `GBASE_F1_COUNTS` uses the exact counts from `infra/scripts/fitness/f1-baseline.json`).

## Regression and time

R0: `npm run check` on the clean clone (PASS, 75.5 s). R1 (`AC-09`) and R2-lite (`AC-10`) are pending a Docker window. Measured time of the new K0 suite: `profiles.k0.test.ts` 8.05 s (`AC-LA-E1-05-02` 78 ms, `AC-LA-E1-05-11` 7.91 s).
