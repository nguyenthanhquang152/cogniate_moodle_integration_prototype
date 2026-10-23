# QA Review — `LA-E3-12` (Small spec gaps: `scoreGiven: null`, NRPS `service_versions`, trusted extra audiences)

- **Reviewer**: QA-4 (independent test author & verifier, lane L)
- **Round**: 2
- **Task**: `LA-E3-12` (`docs/architecture/ltiaas/tasks/LA-E3-12.md`)
- **Author**: Author-2 (`lti-author`)
- **Merge Commit / Integration SHA**: `a2dfc04` / `aa3b214` (Round 1 K0/UNIT); `d12b7b94` (`QA_TEST_SHA=f4846bb0`, Round 2 Docker Slot 5 K1-SIM)
- **Isolated Clone**: `/Users/quangnguyen/cogniate-qa-runs/LA/sim-window-d12b7b94/clone` (detached at `d12b7b948cb1337ca1b9c53715df87d6270081d5`, `--no-hardlinks`, push URL `DISABLED`)
- **Logs Directory**: `/Users/quangnguyen/cogniate-qa-runs/LA/sim-window-d12b7b94/logs` (`LA-E3-12-k1sim.log`, `all-17-k1sim.log`)
- **Verdict**: **PASS (K0 + UNIT + K1-SIM all green)**

---

## 1. Test-First Authorship & Independence

Per `docs/team/charter.md` §1, §4, and §5, the `LA-E3-12` QA suite in `tests/ltiaas/tasks-lti/LA-E3-12/` was authored from only:
- `docs/architecture/ltiaas/tasks/LA-E3-12.md`
- `docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md` D10
- `docs/architecture/ltiaas/adr/LA-ADR-07-security-and-tenancy.md` D8
- `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` §4.3, §4.4, and §4.6

No product source code, Author commit messages, or reviewer notes were read during test authoring. All K0 assertions use boolean checks and never print product source code.

### Files Authored by QA-4
- `tests/ltiaas/tasks-lti/LA-E3-12/tsconfig.json`
- `tests/ltiaas/tasks-lti/LA-E3-12/vitest.config.mts`
- `tests/ltiaas/tasks-lti/LA-E3-12/README.md`
- `tests/ltiaas/tasks-lti/LA-E3-12/small-spec-gaps.k0.test.ts`
- `tests/ltiaas/tasks-lti/LA-E3-12/small-spec-gaps.k1sim.test.ts`

*(Note: LD-9 record `LA-IC-13` confirming 0 golden / 0 frozen-test changes for migration `018_trusted_audiences.sql` is recorded by the lead QA.)*

---

## 2. File Ownership & Scope Check (`a2dfc04`)

`git show --stat a2dfc04` touches only the files allowed by `LA-E3-12.md`:
- `services/lti-service/src/platform/ags.ts`
- `services/lti-service/src/platform/nrps.ts`
- `services/lti-service/src/lti/checks.ts`
- `services/lti-service/src/store/platforms.ts`
- `services/lti-service/src/http/routes/platforms.ts`
- `services/lti-service/src/db/migrations/018_trusted_audiences.sql`
- `services/lti-service/src/platform/ags.test.ts`
- `services/lti-service/src/platform/platform.test.ts`
- `services/lti-service/src/lti/checks.test.ts`
- `services/lti-service/src/store/platforms.test.ts`
- `services/lti-service/src/http/routes/platforms.test.ts`

No files outside the task scope (`tests/**`, `docs/**`, or exclusive files owned by other lanes) were modified.

---

## 3. Acceptance Criteria Traceability Matrix

| AC ID | Kind | Spec Requirement | QA Suite / Test Case | Status |
| --- | --- | --- | --- | --- |
| `AC-LA-E3-12-01` | `K1-SIM` | Score call with `{userId:"u1", scoreGiven:null, activityProgress:"Initialized", gradingProgress:"NotReady"}` succeeds and omits `scoreGiven` from the outbound body. | `small-spec-gaps.k1sim.test.ts > AC-LA-E3-12-01` (`3/3` K1-SIM tests pass in `109ms`; `LA-E3-12-k1sim.log`, `all-17-k1sim.log`) | **PASS (K1-SIM + UNIT)** |
| `AC-LA-E3-12-02` | `K1-SIM` | Launch whose NRPS claim has `service_versions: ["1.0"]` gets `403 SERVICE_NOT_AVAILABLE` on `GET /api/memberships` and `GET /api/members` with no outbound NRPS call; `service_versions: ["2.0"]` and absent `service_versions` both succeed. | `small-spec-gaps.k1sim.test.ts > AC-LA-E3-12-02` (`LA-E3-12-k1sim.log`, `all-17-k1sim.log`) | **PASS (K1-SIM + UNIT)** |
| `AC-LA-E3-12-03` | `K1-SIM` | Launch `id_token` with `aud: ["<clientId>", "https://extra.example"]` and `azp: "<clientId>"` is rejected with `401 INVALID_ISSUER_OR_AUDIENCE` when `trustedAudiences` is `[]`, and accepted when `trustedAudiences` is `["https://extra.example"]`. | `small-spec-gaps.k1sim.test.ts > AC-LA-E3-12-03` (`LA-E3-12-k1sim.log`, `all-17-k1sim.log`) | **PASS (K1-SIM + UNIT)** |
| `AC-LA-E3-12-04` | `UNIT` | Existing platform rows receive `trusted_audiences = '{}'` on migration and all existing platform tests pass. | `small-spec-gaps.k0.test.ts > AC-LA-E3-12-04 (UNIT)`, `store/platforms.test.ts > migration 018 gives old platforms an empty trusted list and preserves all old fields (LA-E3-12 AC-04)`, `http/routes/platforms.test.ts > trusted audiences (LA-E3-12 AC-04)` | **PASS** |

---

## 4. K0 & Unit Execution Results

1. **QA-4 K0 Suite (`LA-E3-12-k0.log`)**:
   - Command: `LA_TARGET_ROOT="/Users/quangnguyen/cogniate-qa-runs/LA/qa4-r9-aa3b214/clone" npx --no-install vitest run --config ltiaas/tasks-lti/LA-E3-12/vitest.config.mts ltiaas/tasks-lti/LA-E3-12/small-spec-gaps.k0.test.ts`
   - Result: **1 file passed, 3/3 tests passed (`15.45s`)**.
   - Checks verified:
     - Static check for NRPS `service_versions` `"2.0"` check (`SERVICE_NOT_AVAILABLE`) and `trustedAudiences` / `trusted_audiences` across `checks.ts`, `store/platforms.ts`, `http/routes/platforms.ts`, and `018_trusted_audiences.sql`.
     - F1 (`fitness:lms-names`) and F5 (`fitness:rules`) checks pass on all `LA-E3-12` core files and migration `018_trusted_audiences.sql`.
     - Unit test runner passes.
2. **Focused Unit Suite (`e3-12-unit.log`)**:
   - Command: `npx --no-install vitest run --reporter=verbose services/lti-service/src/platform/ags.test.ts services/lti-service/src/platform/platform.test.ts services/lti-service/src/lti/checks.test.ts services/lti-service/src/store/platforms.test.ts services/lti-service/src/http/routes/platforms.test.ts services/lti-service/src/http/routes/compat.test.ts`
   - Result: **6 test files passed, 177/177 tests passed (`4.77s`)**.
3. **Clone Working Tree Hygiene (`status-after.txt`)**:
   - `git status --porcelain` in `/Users/quangnguyen/cogniate-qa-runs/LA/qa4-r9-aa3b214/clone` is empty (`0` bytes).
