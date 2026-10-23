# Lead QA Docker Gate Run Plan and Master Slot Schedule (`LA-E0-02`, `LA-E0-03`, `LA-E0-04`, `LA-E7-08`)

- **Owner:** Lead QA (`QA`, `tests/ltiaas/**`)
- **Governance & Rules:** `docs/team/ltiaas/charter-LA.md` §0 (`ab1ca44`), `docs/team/ltiaas/plan.md` §6.1 (`LD-1`..`LD-19`), `tests/ltiaas/TEST-STRATEGY.md`, `docs/architecture/ltiaas/tasks/README.md` §2
- **Docker Window Status:** **HOST-ONLY until explicit `DOCKER-YES` grant per slot** (one QA stack at a time; 32 protected baseline volumes untouched)
- **Lead QA Compose Project Prefix:** `COMPOSE_PROJECT_NAME=qalead-la-<n>` (`qalead-la-1` .. `qalead-la-7`)
- **Lead QA Port & Subnet:** `PUBLIC_PORT=9473`, `STACK_SUBNET=172.23.0.0/16`
- **Intake Baseline SHA (`G-BASE`):** `1b17261be97c4701b928fa9dc2fa74c6d23028f6` (`LA-E0-01`)
- **Current Integration SHA:** `f2e340e0e5bce7e2071ca7d7dfecd92a40c12e5f` (product code identical to `19d6dc4a2ebe64dd5e97cb9ed43b0bb64c01c3e9`)
- **Private Run Root (`umask 077`):** `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/`
- **Host Course Fixture Zips (`COURSE_FIXTURES_DIR`):** `/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-bf09cdad-2026-10-22T12-05-24-521Z/tests/fixtures/courses`

---

## 1. Master Docker Slot Schedule (After QA-2 Slot 1)

### 1.1 Slot Order, Owners, SHAs, and Estimated Minutes

Only **one QA stack** runs at a time (`docs/team/ltiaas/charter-LA.md` §0). After **Slot 1 (`QA-2`, `qa2-la-sim-r1..r6`, ends ~`03:36Z`, ~`72 min`)**, the remaining Docker work runs in the following dependency order so that the verified two-capture `G-BASE` golden baseline (`1b17261`) exists before any candidate golden comparison or `U1` upgrade check needs it:

| Slot | Owner | Compose Project(s) | Port / Subnet | Target SHA | Tasks & Suites Covered | Est. Minutes | Why This Slot Position |
| --- | --- | --- | --- | --- | --- | :---: | --- |
| **Slot 1** *(active)* | **QA-2** | `qa2-la-sim-r1` .. `r6` | `9443` / `172.20.0.0/16` | `f2e340e` (code `19d6dc4`) | Lanes `S1` & `S2` (`tests/ltiaas/tasks-ops/K1-SIM-RUN-PLAN.md`: 11 tasks, 64 `K1-SIM` ACs across 6 batches) | **~72 min** *(ends ~03:36Z)* | Already running under Lead grant #1 (`docs/team/ltiaas/briefs/p4/QA2-sim1.md`). |
| **Slot 2** | **Lead QA** | `qalead-la-1`, `qalead-la-2` | `9473` / `172.23.0.0/16` | **Intake SHA `1b17261`** (`G-BASE`) | **`LA-E0-03` (`AC-01..04`)**: Two independent fresh-stack `G-BASE` golden captures (`g-base-1` on `qalead-la-1`, `g-base-2` on `qalead-la-2`) + host-only determinism compare (`0` diffs between `g-base-1`, `g-base-2`, and committed `tests/ltiaas/golden/1b17261...`) + saves private `u1-seed.json` (`0600`) | **28 min** (`14 + 14`) | **Must run first after Slot 1** so the verified two-capture `G-BASE` baseline and `u1-seed.json` exist before any candidate golden compare or `U1` upgrade run. |
| **Slot 3** | **Lead QA** | `qalead-la-3`, `qalead-la-4` | `9473` / `172.23.0.0/16` | **Current SHA `f2e340e`** *(or wave-end SHA)* | **Run 3A (`qalead-la-3`, 14 min):** `LA-E0-03` (`AC-09`) & `LA-E7-08` (`AC-03`) candidate `G1`–`G4` capture + host compare vs `G-BASE` (`1b17261`) with all approved LD-9 deltas (`LA-IC-12, -13, -15..-20` + `LA-IC-01`). Also unblocks all 10 QA-3/QA-4 golden-compare rows on host (`0` extra Docker).<br>**Run 3B (`qalead-la-4`, 81 min):** `LA-E7-08` B1–B2 SIM gate: M1 `migration` (`35` rows) + `snapshot-upgrade` (`7` rows) (`20 min`), `U1` SIM upgrade continuity on `013`+`014` (`16 min`), and `R1` (`M1 --phase sim --provider all` `394` rows `25 min` + `M2` `64` browser cases `20 min`). | **95 min** (`14 + 81`) | Produces the candidate golden capture for all task suites and closes `LA-E0-03`, `LA-E7-08` SIM (`AC-02,03,04`), and all per-step `R1` / `migration` / `U1` SIM rows (`LA-E1-05..11`, `LA-E4-02`). |
| **Slot 4** | **QA-3** | `qa3-la-sim-r1` .. `r3` | `9453` / `172.21.0.0/16` | **Current SHA `f2e340e`** *(or wave-end SHA)* | Lanes `K`, `R`, `P` (`tests/ltiaas/tasks-core/K1-SIM-RUN-PLAN.md`): Batch 1 (`LA-E5-12` `AC-01..07` + `LA-E1-08` `AC-02` K1-CAP C2 guards, `7 min`), Batch 2 (`LA-E4-03` `AC-02..05` K1-AGS A1–A6, `429` throttle, partition fairness, in-flight restart, `8 min`), Batch 3 (`LA-E2-03` `AC-03..05,07` if merged, `5 min`) + host golden-binding runs (`1 min`, no Docker) | **15–20 min** | Fast SIM window closing all QA-3 `K1-SIM` rows and golden-binding Vitest checks (using Slot 3's capture). |
| **Slot 5** | **QA-4** | `qa4-la-sim-r1` .. `r4` | `9463` / `172.22.0.0/16` | **Current SHA `f2e340e`** *(or wave-end SHA)* | Lanes `L` & `L2` (`tests/ltiaas/tasks-lti/K1-SIM-RUN-PLAN.md`): Batch 1 (`qa4-la-sim-r1`, 9 suites: `LA-E1-10`, `LA-E3-01`, `LA-E3-02`, `LA-E3-04`, `LA-E3-13`, `LA-E3-06`, `LA-E3-11`, `LA-E3-12`, `LA-E5-18`, `26 min`), Batch 2 (`qa4-la-sim-r2`: `LA-E3-03`, `LA-E5-14`, `10 min`), Batch 3 (`qa4-la-sim-r3`: `LA-E5-06`, `8 min`), Batch 4 (`qa4-la-sim-r4`: `LA-E1-05` `AC-07,08`, `8 min`) | **52 min** | Closes all 13 merged QA-4 `K1-SIM` task suites on the simulator lane. |
| **Slot 6** | **QA-E2E** | `qa-e2e-la-sim-r1` .. `r2` | `9443` / `172.20.0.0/16` | **Current SHA `f2e340e`** *(or wave-end SHA)* | **`LA-E7-09` (`AC-01..08`, ~`15 min`):** Moodle-shaped `standard` simulator channel end-to-end (`R2-sim` manual connect, `.mbz`, Deep Linking, SCORM 1.2 + HTML grades `200`/`409`/`503`, check 14 refusal, speed vs Moodle 5.2).<br>**`K2` SIM Browser Suites (`~20 min`):** `LA-E3-01 AC-11` & `LA-E3-02 AC-08,09` (3P-cookie-blocked Chromium `lti.put_data` / `lti.get_data`), `LA-E3-05 AC-01..05` (picker Cancel & multi-pick), `LA-E1-10 AC-03,05,06` (manifest LMS names in browser). | **35 min** (`15 + 20`) | Runs after QA-E2E's Round 4 fix lands; verifies `LA-E7-09` (`R2-sim`) and all `K2` SIM browser cases before live Moodle slots. |
| **Slot 7** | **Lead QA** | `qalead-la-5` *(SIM)*, `qalead-la-6` *(Moodle)* | `9473` / `172.23.0.0/16` | **Intake SHA `1b17261`** (`G-BASE` + `--replace-tests` for `LA-E0-04`) | **`LA-E0-02` (`AC-02..10`) & `LA-E0-04` (`AC-02..04`):**<br>• **Run 7A (`qalead-la-5`, SIM, `65 min`):** M1 `sim` (`394` rows), M2 (`64` cases), M1 `migration` (`35`) & `snapshot-upgrade` (`7`) on `1b17261` with LD-1 open-world tests (`LA-E0-04 AC-02,03`).<br>• **Run 7B (`qalead-la-6`, Moodle 5.2, `40 min` T7 × 3 + demo / `+95 min` legacy `T1–T8`):** `T7 × 3` (`3 × 17` checks + demo videos, `LA-E0-04 AC-04`), legacy `T1, T2a, T2b, T3a, T3b, T3c, T4a, T4b, T5, T6, T8`, `rate-peaks.mjs`, and `docker stats` peak memory sampler. | **105 min** *(SIM + T7×3 core)* / **200 min** *(with full T1–T8 legacy)* | Records the `1b17261` baseline regression and `LA-E0-04` LD-1 parity comparison without delaying Slots 2–6. *(Note: Run 7A can also be pulled right after Slot 2 if desired.)* |
| **Slot 8** | **Lead QA + QA-E2E** | `qalead-la-7` | `9473` / `172.23.0.0/16` | **Current SHA `f2e340e`** *(or wave-end SHA)* | **Wave-End `MOODLE-LIVE` (`R2-lite` / `R2` + `K2` Moodle `U1`/`U2`):**<br>• `T7 × 1` (`12 min`, or `T7 × 3` `36 min` for full `R2`) — `LA-E7-08 AC-02`, `LA-E1-05 AC-10`, `LA-E1-07 AC-08`, `LA-E1-08 AC-08`, `LA-E1-09 AC-05`, `LA-E4-02 AC-10`, `LA-E4-03 AC-09`.<br>• `U1` & `U2` Moodle upgrade continuity (`20 min`) — `LA-E7-08 AC-04`, `LA-E1-11 AC-04,05`, `LA-E4-02 AC-06`.<br>• `R2-lite` targeted Moodle suites (`33 min`): `T2a`/`T2b`/`T3a`/`T3b`/`T3c` (`LA-E1-05 AC-10`), `T4b1`/`T4b2` (`LA-E1-07 AC-08`, `LA-E1-09 AC-05`), `T5a`/`T5b` with `LD-6` `record_dispatch` P5 fixture (`LA-E4-02 AC-10`, `LA-E4-03 AC-09`), `T6` (`LA-E1-09 AC-05`, `LA-E1-11 AC-06`), `T8` (`LA-E1-08 AC-08`). | **65 min** *(R2-lite + T7×1 + U1/U2)* / **89 min** *(with T7×3)* | Batching all live Moodle 5.2 checks into one shared Moodle cold-start slot avoids repeated ~8 min Moodle container boots. |

### 1.2 Summary of What Runs on Intake SHA (`1b17261`) vs Current Integration SHA (`f2e340e` / Wave-End SHA)

| Target SHA | Runs That Must Execute on This SHA | Compose Projects | Total Est. Minutes |
| --- | --- | --- | :---: |
| **Intake SHA `1b17261be97c4701b928fa9dc2fa74c6d23028f6` (`G-BASE`)** | 1. **`LA-E0-03` (`AC-01..04`)**: Two fresh-stack `G-BASE` golden captures (`g-base-1`, `g-base-2`) + determinism diff + `u1-seed.json` (Slot 2).<br>2. **`LA-E0-02` (`AC-02..10`) & `LA-E0-04` (`AC-02..04`)**: Baseline M1 (`sim`, `migration`, `snapshot-upgrade`), M2 (`64` cases), `T7 × 3` (`3 × 17` + demo), and legacy `T1–T8` + `rate-peaks.mjs` + memory peaks, comparing pass/fail counts with `--replace-tests` for the 8 `LD-1` open-world files (Slot 7). | `qalead-la-1`, `qalead-la-2`, `qalead-la-5`, `qalead-la-6` | **133 min** *(core SIM + T7×3)* / **228 min** *(with full T1–T8 legacy)* |
| **Current Integration SHA `f2e340e0e5bce7e2071ca7d7dfecd92a40c12e5f` (code `19d6dc4` / Wave-End SHA)** | 1. **`LA-E0-03` (`AC-09`) & `LA-E7-08` (`AC-03`)**: Candidate golden capture (`G1`–`G4`) + host compare against `G-BASE` with `LA-IC-12, -13, -15..-20` + `LA-IC-01` (Slot 3A).<br>2. **`LA-E7-08` (`AC-01..06`)**: Wave-end B1–B2 SIM gate — M1 `migration` (`013`+`014`) & `snapshot-upgrade`, `U1` SIM upgrade continuity, `R1` (`M1 sim` `394` rows + `M2` `64` cases) (Slot 3B).<br>3. **QA-2 (`Slot 1`), QA-3 (`Slot 4`), QA-4 (`Slot 5`), QA-E2E (`Slot 6`: `LA-E7-09` + `K2` SIM)**.<br>4. **Wave-End `MOODLE-LIVE` (`Slot 8`)**: `T7 × 1` (or `× 3`), Moodle `U1`/`U2`, and `R2-lite` (`T2a–T3c`, `T4b`, `T5a/b`, `T6`, `T8`). | `qa2-la-sim-r1..6`, `qalead-la-3`, `qalead-la-4`, `qa3-la-sim-r1..3`, `qa4-la-sim-r1..4`, `qa-e2e-la-sim-r1..2`, `qalead-la-7` | **262 min** *(Slots 3–6 + Slot 8 R2-lite, after QA-2 Slot 1)* |

---

## 2. Recorded Pre-Window Host-Only Gate Result on `f2e340e` (Code `19d6dc4`)

Executed on **2026-10-23** (`08:45–09:05 +07:00`) in an isolated `--no-hardlinks` clone at `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/pre-window-f2e340e/clone` (`umask 077`, push disabled, **`0` Docker commands run**). Logs are saved in `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/pre-window-f2e340e/logs/`:

| Pre-Window Gate Check | Command | Result | Measured Time & Evidence Log |
| --- | --- | :---: | --- |
| **1. `tests/` & `tests/ltiaas/` TypeScript Check** (`la-qa/tests` synced) | `npm --prefix tests run typecheck && npx --prefix tests tsc --noEmit -p tests/ltiaas/tsconfig.json` | **PASS** (exit `0`) | `4.1 s` — `0` errors across all `tests/acceptance`, `tests/e2e`, and `tests/ltiaas/**` suites (`01-ltiaas-typecheck.log`, `01b-tests-typecheck.log`). *(Note: raw `f2e340e` without `la-qa/tests` overlay had 4 TS errors in `tasks-lti/{LA-E3-11..13,LA-E5-18}` already fixed by QA-4 in `la-qa`.)* |
| **2. `LA-E0-03` Golden K0 Suite (`AC-05..08` + `LD-9` `LA-IC-12..20`)** | `node --test tests/ltiaas/golden/golden.k0.test.mjs` | **PASS** (`12/12`) | `280.7 ms` — normalization, drop list, secret scan (`0` hits on `1b17261`), `< 5 s` compare, negative control, expected deltas, `cliBinding`, `LA-IC-16` allowlist rule, `LA-IC-15` conflict text, and combined `LA-IC-12, -13, -15..-20` check (`02-golden-k0.log`). |
| **3. `LA-E0-03` Golden Compare CLI Self-Check** | `node tests/ltiaas/golden/compare.mjs --base tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6 --candidate tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6 --expected LA-IC-12,LA-IC-13,LA-IC-17,LA-IC-18,LA-IC-19,LA-IC-20` | **PASS** (`EQUAL`) | `3 ms` — `EQUAL: 0 differences (0 not explained), 0 expected changes missing` (`03-golden-compare.log`). |
| **4. `LA-E0-04` LD-1 Open-World K0 Suite (`AC-01, 05, 06`)** | `node --test tests/ltiaas/k0/ld1/open-world.test.mjs` | **PASS** (`40/40`) | `56.4 ms` — positive baseline, additive `LA-IC-01` fields, extra `zz-lms` channel/profile/card/sim-profile, and negative controls (`04-ld1-open-world.log`). *(Note: requires Lead path-commit of `tests/acceptance/lib/open-world.mjs` from `la-qa` or `--replace-tests`.)* |
| **5. Root `test:k0` Contract Suite** | `npm run test:k0` | **PASS** (`121/121`) | `658 ms` — `3` test files (`121` tests passed) (`05-k0-contract.log`). |
| **6. Architecture Fitness `F1` (`fitness:lms-names`) & `F5` (`fitness:rules`)** | `npm run fitness:lms-names && npm run fitness:rules` | **PASS** (exit `0`) | `F1 PASS: 0 files with hits, 0 hits`; `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` (`06b-f1-lms-names.log`, `06c-f5-rules.log`). |
| **7. Simulator Self-Tests (`AC-LA-E7-02-01..07`)** | `node --test tests/sim/core/selftest.mjs tests/sim/blackboard/selftest.mjs tests/sim/canvas/selftest.mjs tests/sim/generic/selftest.mjs tests/sim/brightspace/selftest.mjs` | **PASS** (`58/58`) | `3.40 s` — all `58` simulator self-tests pass with `la-qa/tests/sim` synced (`07a-sim-selftests.log`). |
| **8. M1 Host Control, Migration & Phase Self-Tests (`0` Docker)** | `node --test tests/host/m1-control.selftest.mjs tests/host/m1-migration.selftest.mjs tests/host/m1-phases.selftest.mjs` | **PASS** (`23/23`) | `2.81 s` — `23/23` pass (`07b-m1-host-selftests.log`). |
| **9. M2 Harness Self-Test & 64-Case Discovery (`0` Docker)** | `COURSE_FIXTURES_DIR=/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-bf09cdad-2026-10-22T12-05-24-521Z/tests/fixtures/courses node tests/e2e/host/run-m2.mjs --harness-only` | **PASS** (`6/6` + `64` cases) | `1.9 s` — `m2-harness: 6/6 selftests passed; 64 M2 browser cases discovered and accounted; T7 selection unchanged` (`07c-m2-harness-only.log`). |
| **10. `AC-LA-E7-08-05` Frozen-Test Diff Audit (`1b17261..f2e340e`)** | `git diff --stat 1b17261be97c4701b928fa9dc2fa74c6d23028f6..f2e340e0e5bce7e2071ca7d7dfecd92a40c12e5f -- tests/acceptance tests/e2e tests/host tests/sim tests/fixtures` | **PASS** | Only `LD-1` open-world files (`8` files in `la-qa`), `LD-6` `tests/host/p5-fixture.mjs` (`record_dispatch`), runner-only project-name/port plumbing in `tests/host/*`, and additive simulator files in `tests/sim/**`. Zero unauthorized frozen-test assertion edits. |
| **11. `AC-LA-E7-08-06` Storage Script Diff Audit (`1b17261..f2e340e`)** | `git diff --stat 1b17261be97c4701b928fa9dc2fa74c6d23028f6..f2e340e0e5bce7e2071ca7d7dfecd92a40c12e5f -- infra/scripts/stack-data.sh infra/scripts/storage-compat.sh` | **PASS** (`0` files) | `0` lines changed in `infra/scripts/stack-data.sh` or `infra/scripts/storage-compat.sh` (`LD-3`). |
| **12. Full `R0` (`npm run check`) on Clean Clone of `f2e340e`** | `npm run check` | **PASS** (exit `0`) | Workspaces typecheck + ESLint (`F3`) + Vitest unit suites (`180` files, `2,857` passed, `5` skipped) + `test:infra` (`254` passed, `23` suites) + `test:k0` (`3` files, `121` passed) + `F1` (`0` hits) + `F5` (`6` rules, `0` hits) (`08-npm-run-check.log`). |

---

## 3. Pre-Flight Checklist, Docker Boundary Records, and Pre-Checks

### 3.1 Runner Project-Prefix & Expected-Delta Pre-Check in Scratch Clones (Lesson L1)

1. **`qalead-la-<n>` Project-Prefix Guard in `tests/host/` and `tests/e2e/host/`:**
   - The brief assigns `COMPOSE_PROJECT_NAME=qalead-la-<n>`, `PUBLIC_PORT=9473`, `STACK_SUBNET=172.23.0.0/16`.
   - In the frozen host runners, `tests/host/core.mjs:76` and `tests/host/m1-control.mjs:17` match `!/^qa[234]?-[a-z0-9-]+$/`, `tests/host/run-t1.mjs:93` matches `!/^qa-[a-z0-9-]+$/`, and `tests/e2e/host/run-t7.mjs:63` matches `!/^qa-e2e[a-z0-9-]*$/` (whereas `tests/ltiaas/golden/run-golden.mjs` accepts any project prefix).
   - **Rule in every scratch clone before running `tests/host/run-*.mjs` or `tests/e2e/host/run-*.mjs`:** Run the 1-second runner-guard helper below inside the scratch clone (allowed by `AC-LA-E7-08-05`: runner changes with no assertion change):
     ```sh
     node -e '
       const fs = require("fs");
       for (const [f, from, to] of [
         ["tests/host/core.mjs", "/^qa[234]?-[a-z0-9-]+$/", "/^(?:qa[234]?|qalead)-[a-z0-9-]+$/"],
         ["tests/host/m1-control.mjs", "/^qa[234]?-[a-z0-9-]+$/", "/^(?:qa[234]?|qalead)-[a-z0-9-]+$/"],
         ["tests/host/run-t1.mjs", "/^qa-[a-z0-9-]+$/", "/^(?:qa|qalead)-[a-z0-9-]+$/"],
         ["tests/e2e/host/run-t7.mjs", "/^qa-e2e[a-z0-9-]*$/", "/^(?:qa-e2e|qalead-la)[a-z0-9-]*$/"],
       ]) {
         if (fs.existsSync(f)) fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(from, to));
       }
     '
     ```
2. **`LA-IC-01.json` Expected-Delta File for Full `G1`–`G4` Compare on `f2e340e`:**
   - `tests/ltiaas/golden/expected/` holds `LA-IC-12.json`, `LA-IC-13.json`, `LA-IC-15.json` .. `LA-IC-20.json`.
   - At `f2e340e` (after `LA-E1-05` and `LA-E1-06`), `G1` and `G3` also include the additive `LA-IC-01` fields (`channel` on `G1.{default,acceptance}.providers.profiles[*]` and `G1.providersAfter.profiles[*]`; `channel`, `channelName`, `channelCapabilities` on `G1.{default,acceptance}.lmsProviders.lms[*]`, `G1.lmsProvidersAfter.lms[*]`, `G1.connections[*]`, `G1.connectionList.connections[*]`, `G3.blackboard.connection`, and `G3.canvas.connection`), and `tests/ltiaas/tasks-core/LA-E1-06/golden-g1.k1sim.test.ts:90` + `LA-E1-07/golden.k1sim.test.ts:15` reference `tests/ltiaas/golden/expected/LA-IC-01.json` (plus `BINDING` in `tests/ltiaas/tasks-core/LA-E1-01/golden-binding.ts`).
   - In Slot 3A (`qalead-la-3`), pass `--expected LA-IC-01,LA-IC-12,LA-IC-13,LA-IC-15,LA-IC-16,LA-IC-17,LA-IC-18,LA-IC-19,LA-IC-20` with `LA-IC-01.json` containing the 10 additive path patterns above.

### 3.2 Before-Slot Docker Boundary Snapshot & VM Wake (`umask 077`, `charter-LA.md` §0)

Run at the start of **every** granted Lead QA Docker slot before starting any stack:

```sh
umask 077
export SLOT_ID="slot2-golden-base" # or slot3-gate-b1b2, slot7-e002-base, slot8-moodle-live
export RUN_DIR="$HOME/cogniate-qa-runs/LA/GATE/$SLOT_ID-$(date -u +%Y%m%dT%H%M%SZ)"
export BOUNDARY_DIR="$RUN_DIR/boundary"
export COURSE_FIXTURES_DIR="/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-bf09cdad-2026-10-22T12-05-24-521Z/tests/fixtures/courses"
mkdir -p "$BOUNDARY_DIR"

# 1. Wake Docker VM clock & check available memory (>= 5 GiB free for SIM, >= 8 GiB for Moodle)
docker run --rm alpine true
vm_stat
sysctl vm.swapusage

# 2. Record before-slot Docker state & 32 protected baseline volumes (charter-LA §0)
docker ps -a --no-trunc > "$BOUNDARY_DIR/docker-ps-before.txt"
docker network ls --no-trunc > "$BOUNDARY_DIR/docker-networks-before.txt"
docker volume ls > "$BOUNDARY_DIR/docker-volumes-before.txt"
docker volume ls -q | sort > "$BOUNDARY_DIR/docker-volume-names-before.txt"
if [ -s "$BOUNDARY_DIR/docker-volume-names-before.txt" ]; then
  docker volume inspect $(cat "$BOUNDARY_DIR/docker-volume-names-before.txt") \
    > "$BOUNDARY_DIR/docker-volumes-inspect-before.json"
fi

# 3. Confirm no other QA stack is running and no stale qalead-la-* resources exist
docker ps --format '{{.Names}}\t{{.Status}}'
docker ps -a --filter "name=qalead-la-"
docker network ls --filter "name=qalead-la-"
docker volume ls --filter "name=qalead-la-"
```

### 3.3 Owned-Only Cleanup & After-Slot Docker Boundary Verification

Run at the end of **every** Lead QA Docker slot (and between `qalead-la-<n>` projects):

```sh
umask 077
# 1. Tear down only our own qalead-la-<n> compose project(s) — NEVER run `docker system prune` or touch qa-multi-*
for proj in qalead-la-1 qalead-la-2 qalead-la-3 qalead-la-4 qalead-la-5 qalead-la-6 qalead-la-7; do
  if docker ps -a --format '{{.Names}}' | grep -q "^${proj}-"; then
    docker compose -p "$proj" -f infra/compose.yaml --profile moodle --profile acceptance --profile test down -v --remove-orphans || true
  fi
  own_vols=$(docker volume ls -q --filter "name=^${proj}_")
  if [ -n "$own_vols" ]; then
    docker volume rm $own_vols || true
  fi
  own_nets=$(docker network ls -q --filter "name=^${proj}_")
  if [ -n "$own_nets" ]; then
    docker network rm $own_nets || true
  fi
done

# 2. Record after-slot Docker state & verify 0 diffs on the 32 protected baseline volumes
docker ps -a --no-trunc > "$BOUNDARY_DIR/docker-ps-after.txt"
docker network ls --no-trunc > "$BOUNDARY_DIR/docker-networks-after.txt"
docker volume ls > "$BOUNDARY_DIR/docker-volumes-after.txt"
docker volume ls -q | sort > "$BOUNDARY_DIR/docker-volume-names-after.txt"
if [ -s "$BOUNDARY_DIR/docker-volume-names-after.txt" ]; then
  docker volume inspect $(cat "$BOUNDARY_DIR/docker-volume-names-after.txt") \
    > "$BOUNDARY_DIR/docker-volumes-inspect-after.json"
fi

diff -u "$BOUNDARY_DIR/docker-volume-names-before.txt" "$BOUNDARY_DIR/docker-volume-names-after.txt" \
  | tee "$BOUNDARY_DIR/volumes-names-diff.txt"
diff -u "$BOUNDARY_DIR/docker-volumes-inspect-before.json" "$BOUNDARY_DIR/docker-volumes-inspect-after.json" \
  | tee "$BOUNDARY_DIR/volumes-inspect-diff.txt"
```

---

## 4. Detailed Execution Plan & Exact Commands Per Lead QA Run

### 4.1 Slot 2: `LA-E0-03` Baseline Golden Captures on Intake SHA `1b17261` (`qalead-la-1`, `qalead-la-2` — Est. `28 min`)

- **Tasks & ACs:** `LA-E0-03` (`AC-LA-E0-03-01`, `AC-LA-E0-03-02`, `AC-LA-E0-03-03`, `AC-LA-E0-03-04`)
- **Target SHA:** `1b17261be97c4701b928fa9dc2fa74c6d23028f6` (`--replace-tests` from `la-qa/tests` so `tests/ltiaas/golden/run-golden.mjs` and `capture.golden.ts` are present in the `1b17261` clone)
- **Compose Projects:** `qalead-la-1` (capture #1, ~`14 min`), `qalead-la-2` (capture #2, ~`14 min`)
- **Port & Subnet:** `PUBLIC_PORT=9473`, `STACK_SUBNET=172.23.0.0/16`
- **`tasks/README.md` §2 Forms Used:** Form (a) (`run-golden.mjs` wraps `gen-env`, `stack:up`, default-profile `G1` read, `test:acceptance` with `QA_TASK=GOLDEN`, `stack:down`), Form (f) (`m1-control.mjs` operator CLI listener during capture).

```sh
umask 077
export BASE_SHA="1b17261be97c4701b928fa9dc2fa74c6d23028f6"
export LA_QA="/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa"
export SLOT2_DIR="$HOME/cogniate-qa-runs/LA/LA-E0-03/r2-docker"
mkdir -p "$SLOT2_DIR/captures" "$SLOT2_DIR/logs"

# 1. Capture #1 on fresh stack (qalead-la-1, ~14 min)
COMPOSE_PROJECT_NAME=qalead-la-1 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 \
  node "$LA_QA/tests/ltiaas/golden/run-golden.mjs" \
    --sha "$BASE_SHA" \
    --label g-base-1 \
    --out "$SLOT2_DIR/captures/g-base-1" \
    --workdir "$SLOT2_DIR/clone-1" \
    --replace-tests --tests-from "$LA_QA/tests" \
  2>&1 | tee "$SLOT2_DIR/logs/capture-1.log"

# Preserve private U1 seed state (mode 0600) from capture #1 for U1 upgrade verification
cp -p "$SLOT2_DIR/clone-1/tests/acceptance/artifacts/golden/g-base-1/private/u1-seed.json" \
      "$SLOT2_DIR/u1-seed-1b17261.json"
chmod 600 "$SLOT2_DIR/u1-seed-1b17261.json"

# 2. Capture #2 on a second fresh stack (qalead-la-2, ~14 min)
COMPOSE_PROJECT_NAME=qalead-la-2 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 \
  node "$LA_QA/tests/ltiaas/golden/run-golden.mjs" \
    --sha "$BASE_SHA" \
    --label g-base-2 \
    --out "$SLOT2_DIR/captures/g-base-2" \
    --workdir "$SLOT2_DIR/clone-2" \
    --replace-tests --tests-from "$LA_QA/tests" \
  2>&1 | tee "$SLOT2_DIR/logs/capture-2.log"

# 3. Determinism compare (AC-LA-E0-03-04: 0 differences between capture #1 and capture #2, and vs stored 1b17261)
node "$LA_QA/tests/ltiaas/golden/compare.mjs" \
  --base "$SLOT2_DIR/captures/g-base-1" \
  --candidate "$SLOT2_DIR/captures/g-base-2" \
  2>&1 | tee "$SLOT2_DIR/logs/compare-1-vs-2.log"

node "$LA_QA/tests/ltiaas/golden/compare.mjs" \
  --base "$LA_QA/tests/ltiaas/golden/$BASE_SHA" \
  --candidate "$SLOT2_DIR/captures/g-base-1" \
  2>&1 | tee "$SLOT2_DIR/logs/compare-stored-vs-1.log"
```

---

### 4.2 Slot 3A: `LA-E0-03` (`AC-09`) & `LA-E7-08` (`AC-03`) Candidate Golden Capture & Compare on `f2e340e` (`qalead-la-3` — Est. `14 min`)

- **Tasks & ACs:** `LA-E0-03` (`AC-LA-E0-03-09`), `LA-E7-08` (`AC-LA-E7-08-03`), plus host-only golden-binding ACs for `LA-E1-01` (`AC-03`), `LA-E1-02` (`AC-09`), `LA-E1-05` (`AC-01..06, 09`), `LA-E1-06` (`AC-05`), `LA-E1-07` (`AC-07`), `LA-E1-08` (`AC-01`), `LA-E1-09` (`AC-01`), `LA-E1-10` (`AC-01, 04`), `LA-E4-02` (`AC-08`), `LA-E4-05` (`AC-05`).
- **Target SHA:** `f2e340e0e5bce7e2071ca7d7dfecd92a40c12e5f` (code `19d6dc4`, or current wave-end integration SHA)
- **Compose Project:** `qalead-la-3` (`PUBLIC_PORT=9473`, `STACK_SUBNET=172.23.0.0/16`)

```sh
umask 077
export TARGET_SHA="f2e340e0e5bce7e2071ca7d7dfecd92a40c12e5f"
export BASE_SHA="1b17261be97c4701b928fa9dc2fa74c6d23028f6"
export LA_QA="/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa"
export SLOT3_DIR="$HOME/cogniate-qa-runs/LA/LA-E7-08/r1-docker"
mkdir -p "$SLOT3_DIR/captures" "$SLOT3_DIR/logs" "$SLOT3_DIR/expected"

# 1. Prepare expected-delta directory (all 8 approved LD-9 files + LA-IC-01 additive wire fields)
cp "$LA_QA/tests/ltiaas/golden/expected/"*.json "$SLOT3_DIR/expected/"
cat > "$SLOT3_DIR/expected/LA-IC-01.json" <<'EOF'
{
  "id": "LA-IC-01",
  "approval": "docs/reviews/LA-E1-02/qa.md, docs/reviews/LA-E1-05/qa.md, docs/reviews/LA-E1-06/qa.md",
  "changes": [
    { "file": "G1", "path": "default.providers.profiles[*].channel", "rule": "string" },
    { "file": "G1", "path": "acceptance.providers.profiles[*].channel", "rule": "string" },
    { "file": "G1", "path": "providersAfter.profiles[*].channel", "rule": "string" },
    { "file": "G1", "path": "default.lmsProviders.lms[*].channel", "rule": "string" },
    { "file": "G1", "path": "default.lmsProviders.lms[*].channelName", "rule": "string" },
    { "file": "G1", "path": "default.lmsProviders.lms[*].channelCapabilities", "rule": "object" },
    { "file": "G1", "path": "acceptance.lmsProviders.lms[*].channel", "rule": "string" },
    { "file": "G1", "path": "acceptance.lmsProviders.lms[*].channelName", "rule": "string" },
    { "file": "G1", "path": "acceptance.lmsProviders.lms[*].channelCapabilities", "rule": "object" },
    { "file": "G1", "path": "lmsProvidersAfter.lms[*].channel", "rule": "string" },
    { "file": "G1", "path": "lmsProvidersAfter.lms[*].channelName", "rule": "string" },
    { "file": "G1", "path": "lmsProvidersAfter.lms[*].channelCapabilities", "rule": "object" },
    { "file": "G1", "path": "connections[*].channel", "rule": "string" },
    { "file": "G1", "path": "connections[*].channelName", "rule": "string" },
    { "file": "G1", "path": "connections[*].channelCapabilities", "rule": "object" },
    { "file": "G1", "path": "connectionList.connections[*].channel", "rule": "string" },
    { "file": "G1", "path": "connectionList.connections[*].channelName", "rule": "string" },
    { "file": "G1", "path": "connectionList.connections[*].channelCapabilities", "rule": "object" },
    { "file": "G3", "path": "blackboard.connection.channel", "value": "blackboard" },
    { "file": "G3", "path": "blackboard.connection.channelName", "value": "Blackboard" },
    { "file": "G3", "path": "blackboard.connection.channelCapabilities", "rule": "object" },
    { "file": "G3", "path": "canvas.connection.channel", "value": "canvas" },
    { "file": "G3", "path": "canvas.connection.channelName", "value": "Canvas" },
    { "file": "G3", "path": "canvas.connection.channelCapabilities", "rule": "object" }
  ]
}
EOF

# 2. Capture candidate G1-G4 on f2e340e (qalead-la-3, ~14 min)
COMPOSE_PROJECT_NAME=qalead-la-3 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 \
  node "$LA_QA/tests/ltiaas/golden/run-golden.mjs" \
    --sha "$TARGET_SHA" \
    --label "cand-${TARGET_SHA:0:7}" \
    --out "$SLOT3_DIR/captures/cand-${TARGET_SHA:0:7}" \
    --workdir "$SLOT3_DIR/clone-golden" \
    --replace-tests --tests-from "$LA_QA/tests" \
  2>&1 | tee "$SLOT3_DIR/logs/capture-candidate.log"

# 3. Compare candidate capture against G-BASE with all approved LD-9 expected deltas + LA-IC-01 (< 1 s, 0 Docker)
node "$LA_QA/tests/ltiaas/golden/compare.mjs" \
  --base "$LA_QA/tests/ltiaas/golden/$BASE_SHA" \
  --candidate "$SLOT3_DIR/captures/cand-${TARGET_SHA:0:7}" \
  --expected "LA-IC-01,LA-IC-12,LA-IC-13,LA-IC-15,LA-IC-16,LA-IC-17,LA-IC-18,LA-IC-19,LA-IC-20" \
  --expected-dir "$SLOT3_DIR/expected" \
  --sim-hosts "$LA_QA/tests/sim/hosts.json" \
  2>&1 | tee "$SLOT3_DIR/logs/compare-candidate-vs-gbase.log"
```

---

### 4.3 Slot 3B: `LA-E7-08` Wave-End SIM-Lane Gate for B1–B2 (`qalead-la-4` — Est. `81 min`)

- **Tasks & ACs:** `LA-E7-08` (`AC-LA-E7-08-01..06`), plus per-step SIM regression/migration ACs: `LA-E1-05` (`AC-09`), `LA-E1-06` (`AC-07, 08`), `LA-E1-07` (`AC-07`), `LA-E1-08` (`AC-07`), `LA-E1-10` (`AC-02`), `LA-E1-11` (`AC-06`), `LA-E4-02` (`AC-06, 07, 09`).
- **Target SHA:** `f2e340e0e5bce7e2071ca7d7dfecd92a40c12e5f` (code `19d6dc4`, with `--replace-tests` from `la-qa/tests` so the 8 `LD-1` open-world files and `tests/acceptance/lib/open-world.mjs` are active)
- **Compose Project:** `qalead-la-4` (`PUBLIC_PORT=9473`, `STACK_SUBNET=172.23.0.0/16`)
- **Background Resource Sampler:** `docker stats --no-stream` loop every 5 s writing `$SLOT3_DIR/logs/docker-stats-qalead-la-4.jsonl`.

```sh
umask 077
export TARGET_SHA="f2e340e0e5bce7e2071ca7d7dfecd92a40c12e5f"
export BASE_SHA="1b17261be97c4701b928fa9dc2fa74c6d23028f6"
export LA_QA="/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa"
export SLOT3_DIR="$HOME/cogniate-qa-runs/LA/LA-E7-08/r1-docker"
export COURSE_FIXTURES_DIR="/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-bf09cdad-2026-10-22T12-05-24-521Z/tests/fixtures/courses"

# Start background Docker memory/CPU peak sampler (every 5 s)
(
  while true; do
    docker stats --no-stream --format '{"ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","name":"{{.Name}}","cpu":"{{.CPUPerc}}","mem":"{{.MemUsage}}"}' \
      >> "$SLOT3_DIR/logs/docker-stats-qalead-la-4.jsonl" 2>/dev/null || true
    sleep 5
  done
) &
STATS_PID=$!
trap 'kill $STATS_PID 2>/dev/null || true' EXIT

# Prepare clean test-overlay source with qalead-la-<n> runner-guard regex enabled
export OVERLAY_TESTS="$SLOT3_DIR/tests-overlay"
rm -rf "$OVERLAY_TESTS"
cp -R "$LA_QA/tests" "$OVERLAY_TESTS"
node -e '
  const fs = require("fs");
  for (const [f, from, to] of [
    ["host/core.mjs", "/^qa[234]?-[a-z0-9-]+$/", "/^(?:qa[234]?|qalead)-[a-z0-9-]+$/"],
    ["host/m1-control.mjs", "/^qa[234]?-[a-z0-9-]+$/", "/^(?:qa[234]?|qalead)-[a-z0-9-]+$/"],
    ["host/run-t1.mjs", "/^qa-[a-z0-9-]+$/", "/^(?:qa|qalead)-[a-z0-9-]+$/"],
    ["e2e/host/run-t7.mjs", "/^qa-e2e[a-z0-9-]*$/", "/^(?:qa-e2e|qalead-la)[a-z0-9-]*$/"],
  ]) {
    const p = process.env.OVERLAY_TESTS + "/" + f;
    if (fs.existsSync(p)) fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(from, to));
  }
'

# 1. M1 migration (35 rows, migrations 013 + 014) & snapshot-upgrade (7 rows) (~20 min)
COMPOSE_PROJECT_NAME=qalead-la-4 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$OVERLAY_TESTS/host/run-m1.mjs" \
    --sha "$TARGET_SHA" \
    --phase migration \
    --workdir "$SLOT3_DIR/m1-migration" \
    --replace-tests --tests-from "$OVERLAY_TESTS" \
  2>&1 | tee "$SLOT3_DIR/logs/m1-migration.log"

COMPOSE_PROJECT_NAME=qalead-la-4 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$OVERLAY_TESTS/host/run-m1.mjs" \
    --sha "$TARGET_SHA" \
    --phase snapshot-upgrade \
    --workdir "$SLOT3_DIR/m1-snapshot-upgrade" \
    --replace-tests --tests-from "$OVERLAY_TESTS" \
  2>&1 | tee "$SLOT3_DIR/logs/m1-snapshot-upgrade.log"

# 2. U1 SIM-Channel Upgrade Continuity (1b17261 seed -> stack:data-backup -> checkout f2e340e -> 013+014 -> verify rows, Resend, new grade) (~16 min)
#    Seeds on 1b17261 via capture.golden.ts, backs up stack data, switches clone to $TARGET_SHA, starts stack (running 013 + 014),
#    and verifies that pre-upgrade sent/conflict/failed/superseded/pending rows, Resend of failed row, and a new learner grade on
#    the existing resource link all succeed without creating a duplicate placement.
COMPOSE_PROJECT_NAME=qalead-la-4 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$OVERLAY_TESTS/host/run-m1.mjs" \
    --sha "$TARGET_SHA" \
    --phase sim --provider all \
    --workdir "$SLOT3_DIR/m1-sim" \
    --replace-tests --tests-from "$OVERLAY_TESTS" \
  2>&1 | tee "$SLOT3_DIR/logs/m1-sim-all.log"

# 3. M2 Browser Suite (64 cases across 9 .m2.ts files, ~20 min)
COMPOSE_PROJECT_NAME=qalead-la-4 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$OVERLAY_TESTS/e2e/host/run-m2.mjs" \
    --sha "$TARGET_SHA" \
    --workdir "$SLOT3_DIR/m2-sim" \
    --replace-tests --tests-from "$OVERLAY_TESTS" \
  2>&1 | tee "$SLOT3_DIR/logs/m2-sim.log"
```

---

### 4.4 Slot 7: `LA-E0-02` Baseline Regression Record & `LA-E0-04` LD-1 Parity on Intake SHA `1b17261` (`qalead-la-5`, `qalead-la-6` — Est. `105 min` Core / `200 min` Full Legacy)

- **Tasks & ACs:**
  - `LA-E0-02` (`AC-LA-E0-02-02` .. `AC-LA-E0-02-10`)
  - `LA-E0-04` (`AC-LA-E0-04-02`, `AC-LA-E0-04-03`, `AC-LA-E0-04-04`: pass/fail counts of M1, M2, and T7 on `1b17261` with the 8 `LD-1` open-world files equal `LA-E0-02`)
- **Target SHA:** `1b17261be97c4701b928fa9dc2fa74c6d23028f6` (`G-BASE`)
- **Compose Projects:** `qalead-la-5` (SIM lane, ~`65 min`), `qalead-la-6` (Moodle 5.2 lane, ~`40 min` for `T7 × 3 + demo`, plus ~`95 min` if full `T1–T8` legacy Moodle run is executed)
- **Port & Subnet:** `PUBLIC_PORT=9473`, `STACK_SUBNET=172.23.0.0/16`

```sh
umask 077
export BASE_SHA="1b17261be97c4701b928fa9dc2fa74c6d23028f6"
export LA_QA="/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa"
export SLOT7_DIR="$HOME/cogniate-qa-runs/LA/LA-E0-02/r2-docker"
export COURSE_FIXTURES_DIR="/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-bf09cdad-2026-10-22T12-05-24-521Z/tests/fixtures/courses"
mkdir -p "$SLOT7_DIR/logs"

# Start background Docker memory/CPU peak sampler (every 5 s, AC-LA-E0-02-09)
(
  while true; do
    docker stats --no-stream --format '{"ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","name":"{{.Name}}","cpu":"{{.CPUPerc}}","mem":"{{.MemUsage}}"}' \
      >> "$SLOT7_DIR/logs/docker-stats-slot7.jsonl" 2>/dev/null || true
    sleep 5
  done
) &
STATS7_PID=$!
trap 'kill $STATS7_PID 2>/dev/null || true' EXIT

# Prepare 1b17261 test overlay with LD-1 open-world files + qalead-la-<n> runner-guard regex
export E004_TESTS="$SLOT7_DIR/tests-ld1-overlay"
rm -rf "$E004_TESTS"
cp -R "$LA_QA/tests" "$E004_TESTS"
node -e '
  const fs = require("fs");
  for (const [f, from, to] of [
    ["host/core.mjs", "/^qa[234]?-[a-z0-9-]+$/", "/^(?:qa[234]?|qalead)-[a-z0-9-]+$/"],
    ["host/m1-control.mjs", "/^qa[234]?-[a-z0-9-]+$/", "/^(?:qa[234]?|qalead)-[a-z0-9-]+$/"],
    ["host/run-t1.mjs", "/^qa-[a-z0-9-]+$/", "/^(?:qa|qalead)-[a-z0-9-]+$/"],
    ["e2e/host/run-t7.mjs", "/^qa-e2e[a-z0-9-]*$/", "/^(?:qa-e2e|qalead-la)[a-z0-9-]*$/"],
  ]) {
    const p = process.env.E004_TESTS + "/" + f;
    if (fs.existsSync(p)) fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(from, to));
  }
'

# --- Run 7A: SIM Baseline on 1b17261 (qalead-la-5, ~65 min) ---
# 1. M1 sim phase (394 rows across blackboard, canvas, cross, common) — AC-LA-E0-02-02 & AC-LA-E0-04-02 (~25 min)
COMPOSE_PROJECT_NAME=qalead-la-5 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$E004_TESTS/host/run-m1.mjs" \
    --sha "$BASE_SHA" --phase sim --provider all \
    --workdir "$SLOT7_DIR/m1-sim" \
    --replace-tests --tests-from "$E004_TESTS" \
  2>&1 | tee "$SLOT7_DIR/logs/m1-sim.log"

# 2. M2 browser suite (64 cases across 9 files) — AC-LA-E0-02-04 & AC-LA-E0-04-03 (~20 min)
COMPOSE_PROJECT_NAME=qalead-la-5 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$E004_TESTS/e2e/host/run-m2.mjs" \
    --sha "$BASE_SHA" \
    --workdir "$SLOT7_DIR/m2" \
    --replace-tests --tests-from "$E004_TESTS" \
  2>&1 | tee "$SLOT7_DIR/logs/m2.log"

# 3. M1 migration (35 rows) & snapshot-upgrade (7 rows) — AC-LA-E0-02-03 (~20 min)
COMPOSE_PROJECT_NAME=qalead-la-5 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$E004_TESTS/host/run-m1.mjs" \
    --sha "$BASE_SHA" --phase migration \
    --workdir "$SLOT7_DIR/m1-migration" \
    --replace-tests --tests-from "$E004_TESTS" \
  2>&1 | tee "$SLOT7_DIR/logs/m1-migration.log"

COMPOSE_PROJECT_NAME=qalead-la-5 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$E004_TESTS/host/run-m1.mjs" \
    --sha "$BASE_SHA" --phase snapshot-upgrade \
    --workdir "$SLOT7_DIR/m1-snapshot" \
    --replace-tests --tests-from "$E004_TESTS" \
  2>&1 | tee "$SLOT7_DIR/logs/m1-snapshot.log"

# --- Run 7B: Moodle 5.2 Baseline on 1b17261 (qalead-la-6, ~40 min T7×3+demo / +95 min legacy T1-T8) ---
# 4. T7 × 3 consecutive pass + demo video — AC-LA-E0-02-05 & AC-LA-E0-04-04 (~40 min)
COMPOSE_PROJECT_NAME=qalead-la-6 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$E004_TESTS/e2e/host/run-t7.mjs" \
    --sha "$BASE_SHA" --runs 3 \
    --workdir "$SLOT7_DIR/t7" \
    --replace-tests --tests-from "$E004_TESTS" \
  2>&1 | tee "$SLOT7_DIR/logs/t7-x3.log"

# 5. Legacy T1-T8 suites on 1b17261 — AC-LA-E0-02-06, -07, -08 (~95 min total if full legacy is run)
for runner in run-t1.mjs run-t2a.mjs run-t2b.mjs run-t3a.mjs run-t3b.mjs run-t3c.mjs run-t4a.mjs run-t4b.mjs run-t5.mjs run-t6.mjs run-t8.mjs; do
  name="${runner%.mjs}"
  COMPOSE_PROJECT_NAME=qalead-la-6 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 \
    COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
    node "$E004_TESTS/host/$runner" \
      --sha "$BASE_SHA" \
      --workdir "$SLOT7_DIR/$name" \
      --replace-tests --tests-from "$E004_TESTS" \
    2>&1 | tee "$SLOT7_DIR/logs/$name.log"
done

# 6. Outbound request rate peaks (AC-LA-E0-02-08, host-only post-processing)
node "$E004_TESTS/host/rate-peaks.mjs" "$SLOT7_DIR" \
  > "$SLOT7_DIR/logs/rate-peaks.json"
```

---

### 4.5 Slot 8: Wave-End `MOODLE-LIVE` (`R2-lite` / `R2` + `K2` Moodle `U1`/`U2`) on `f2e340e` (`qalead-la-7` — Est. `65 min` R2-lite / `89 min` Full T7×3)

- **Tasks & ACs Covered:**
  - `LA-E7-08` (`AC-LA-E7-08-02` `T7 × 1` / `× 3`; `AC-LA-E7-08-04` Moodle `U1`)
  - `LA-E1-05` (`AC-LA-E1-05-10`: `T7 × 1`, `T2a`, `T2b`, `T3a`, `T3b`, `T3c`)
  - `LA-E1-07` (`AC-LA-E1-07-08`: `T7 × 1`, `T4b1`, `T4b2`)
  - `LA-E1-08` (`AC-LA-E1-08-08`: `T7 × 1`, `T8`)
  - `LA-E1-09` (`AC-LA-E1-09-05`: `T7 × 1`, `T4b2`, `T5a`, `T6`)
  - `LA-E1-11` (`AC-LA-E1-11-04` `K2 U1`, `AC-LA-E1-11-05` `K2 U2`, `AC-LA-E1-11-06` `T6` subset)
  - `LA-E4-02` (`AC-LA-E4-02-06` `U1`, `AC-LA-E4-02-10` `T5a`, `T5b` with `LD-6` `record_dispatch` P5 fixture, `T7 × 1`)
  - `LA-E4-03` (`AC-LA-E4-03-09`: `T5a`, `T5b`, `T7 × 1`)
- **Target SHA:** `f2e340e0e5bce7e2071ca7d7dfecd92a40c12e5f` (code `19d6dc4`, or wave-end integration SHA)
- **Compose Project:** `qalead-la-7` (`PUBLIC_PORT=9473`, `STACK_SUBNET=172.23.0.0/16`)

```sh
umask 077
export TARGET_SHA="f2e340e0e5bce7e2071ca7d7dfecd92a40c12e5f"
export SLOT8_DIR="$HOME/cogniate-qa-runs/LA/MOODLE-LIVE/r1-docker"
export OVERLAY_TESTS="$HOME/cogniate-qa-runs/LA/LA-E7-08/r1-docker/tests-overlay"
export COURSE_FIXTURES_DIR="/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-bf09cdad-2026-10-22T12-05-24-521Z/tests/fixtures/courses"
mkdir -p "$SLOT8_DIR/logs"

# 1. T7 on Moodle 5.2 (--runs 1 for B1-B2 wave-end gate ~12 min; --runs 3 for final R2 gate ~36 min)
COMPOSE_PROJECT_NAME=qalead-la-7 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$OVERLAY_TESTS/e2e/host/run-t7.mjs" \
    --sha "$TARGET_SHA" --runs 1 --no-demo \
    --workdir "$SLOT8_DIR/t7" \
    --replace-tests --tests-from "$OVERLAY_TESTS" \
  2>&1 | tee "$SLOT8_DIR/logs/t7.log"

# 2. R2-lite Moodle suites (T2a, T2b, T3a, T3b, T3c, T4b, T5 with LD-6 record_dispatch P5 fixture, T6, T8) (~33 min)
for runner in run-t2a.mjs run-t2b.mjs run-t3a.mjs run-t3b.mjs run-t3c.mjs run-t4b.mjs run-t5.mjs run-t6.mjs run-t8.mjs; do
  name="${runner%.mjs}"
  COMPOSE_PROJECT_NAME=qalead-la-7 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 \
    COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
    node "$OVERLAY_TESTS/host/$runner" \
      --sha "$TARGET_SHA" \
      --workdir "$SLOT8_DIR/$name" \
      --replace-tests --tests-from "$OVERLAY_TESTS" \
    2>&1 | tee "$SLOT8_DIR/logs/$name.log"
done
```
