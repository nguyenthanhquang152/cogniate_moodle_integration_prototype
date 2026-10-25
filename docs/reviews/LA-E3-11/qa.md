# QA Review — `LA-E3-11` (AGS extras: submission times, `scoringUserId`, URL-keyed members)

- **Reviewer**: QA-4 (independent test author & verifier, lane L)
- **Round**: 2
- **Task**: `LA-E3-11` (`docs/architecture/ltiaas/tasks/LA-E3-11.md`)
- **Author**: Author-2 (`lti-author`)
- **Merge Commit / Integration SHA**: `151f6a9` / `aa3b214` (Round 1 K0/UNIT); `d12b7b94` (`QA_TEST_SHA=f4846bb0`, Round 2 Docker Slot 5 K1-SIM)
- **Isolated Clone**: `/Users/quangnguyen/cogniate-qa-runs/LA/sim-window-d12b7b94/clone` (detached at `d12b7b948cb1337ca1b9c53715df87d6270081d5`, `--no-hardlinks`, push URL `DISABLED`)
- **Logs Directory**: `/Users/quangnguyen/cogniate-qa-runs/LA/sim-window-d12b7b94/logs` (`LA-E3-11-k1sim.log`, `all-17-k1sim.log`)
- **Verdict**: **PASS (K0 + UNIT + K1-SIM all green)**

---

## 1. Test-First Authorship & Independence

Per `docs/team/charter.md` §1, §4, and §5, the `LA-E3-11` QA suite in `tests/ltiaas/tasks-lti/LA-E3-11/` was authored from only:
- `docs/architecture/ltiaas/tasks/LA-E3-11.md`
- `docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md` D9
- `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` §4.1 and §4.2

No product source code, Author commit messages, or reviewer notes were read during test authoring. All K0 assertions use boolean checks and never print product source code.

### Files Authored by QA-4
- `tests/ltiaas/tasks-lti/LA-E3-11/tsconfig.json`
- `tests/ltiaas/tasks-lti/LA-E3-11/vitest.config.mts`
- `tests/ltiaas/tasks-lti/LA-E3-11/README.md`
- `tests/ltiaas/tasks-lti/LA-E3-11/ags-extras.k0.test.ts`
- `tests/ltiaas/tasks-lti/LA-E3-11/ags-extras.k1sim.test.ts`

---

## 2. File Ownership & Scope Check (`151f6a9`)

`git show --stat 151f6a9` touches only the files allowed by `LA-E3-11.md`:
- `services/lti-service/src/platform/ags.ts`
- `services/lti-service/src/http/routes/services.ts`
- `services/lti-service/src/http/routes/compat.ts`
- `services/lti-service/src/platform/ags.test.ts`
- `services/lti-service/src/http/routes/services.test.ts`
- `services/lti-service/src/http/routes/compat.test.ts`

No files outside the task scope (`tests/**`, `docs/**`, or exclusive files owned by other lanes) were modified.

---

## 3. Acceptance Criteria Traceability Matrix

| AC ID | Kind | Spec Requirement | QA Suite / Test Case | Status |
| --- | --- | --- | --- | --- |
| `AC-LA-E3-11-01` | `K1-SIM` | Score call with `submission.startedAt`, `submission.submittedAt`, and `scoringUserId` returns `204` (`POST /api/lineitems/:id/scores`) and `200 {"ok":true}` (`POST /api/scores`); simulator receives all three fields unchanged. | `ags-extras.k1sim.test.ts > AC-LA-E3-11-01 & AC-LA-E3-11-02` (`2/2` K1-SIM tests pass in `72ms`; `LA-E3-11-k1sim.log`, `all-17-k1sim.log`) | **PASS (K1-SIM + UNIT)** |
| `AC-LA-E3-11-02` | `K1-SIM` | Score call with `"https://ext.example/rubric": {"criterion":"A","points":4}` forwards that member unchanged in the outbound score JSON; a non-URL or `http://` extra key is not forwarded. | `ags-extras.k1sim.test.ts > AC-LA-E3-11-01 & AC-LA-E3-11-02` (`LA-E3-11-k1sim.log`, `all-17-k1sim.log`) | **PASS (K1-SIM + UNIT)** |
| `AC-LA-E3-11-03` | `UNIT` | Score call with 9 URL-keyed members or a URL-keyed value of 4097 UTF-8 JSON bytes returns `400 INVALID_REQUEST` before any outbound call. | `ags-extras.k0.test.ts > AC-LA-E3-11-03 & AC-LA-E3-11-05 (UNIT)`, `ags.test.ts > accepts eight URL-keyed members and refuses a ninth (AC-03)`, `ags.test.ts > measures the JSON value as UTF-8 bytes, including JSON quoting and escapes (AC-03)`, `services.test.ts > refuses a ninth extension or a value over 4 KB before any outbound call (LA-E3-11 AC-03)` | **PASS** |
| `AC-LA-E3-11-04` | `K1-SIM` | Score call with `submission.startedAt: "not-a-date"` returns `400 INVALID_REQUEST` before any outbound call. | `ags-extras.k1sim.test.ts > AC-LA-E3-11-04` (`LA-E3-11-k1sim.log`, `all-17-k1sim.log`) | **PASS (K1-SIM + UNIT)** |
| `AC-LA-E3-11-05` | `UNIT` | Line-item create, update, read, and list preserve URL-keyed members returned by or sent to the platform. | `ags-extras.k0.test.ts > AC-LA-E3-11-03 & AC-LA-E3-11-05 (UNIT)`, `compat.test.ts > keeps URL-keyed line item members on POST, PUT, GET and list (LA-E3-11 AC-05)` | **PASS** |

---

## 4. K0 & Unit Execution Results

1. **QA-4 K0 Suite (`LA-E3-11-k0.log`)**:
   - Command: `LA_TARGET_ROOT="/Users/quangnguyen/cogniate-qa-runs/LA/qa4-r9-aa3b214/clone" npx --no-install vitest run --config ltiaas/tasks-lti/LA-E3-11/vitest.config.mts ltiaas/tasks-lti/LA-E3-11/ags-extras.k0.test.ts`
   - Result: **1 file passed, 3/3 tests passed (`13.15s`)**.
   - Checks verified:
     - Static check for `submission`, `startedAt`, `submittedAt`, `scoringUserId`, `https:` URL-keyed member filtering, 8-member bound, and 4096-byte bound.
     - F1 (`fitness:lms-names`) and F5 (`fitness:rules`) checks pass with 0 hits on `ags.ts`, `services.ts`, and `compat.ts`.
     - Unit test runner passes.
2. **Focused Unit Suite (`e3-11-unit.log`)**:
   - Command: `npx --no-install vitest run --reporter=verbose services/lti-service/src/platform/ags.test.ts services/lti-service/src/platform/platform.test.ts services/lti-service/src/http/routes/services.test.ts services/lti-service/src/http/routes/compat.test.ts`
   - Result: **4 test files passed, 107/107 tests passed (`5.80s`)**.
3. **Clone Working Tree Hygiene (`status-after.txt`)**:
   - `git status --porcelain` in `/Users/quangnguyen/cogniate-qa-runs/LA/qa4-r9-aa3b214/clone` is empty (`0` bytes).
