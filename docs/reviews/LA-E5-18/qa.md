# QA Review — `LA-E5-18` (Tenant ids in protocol log lines)

- **Reviewer**: QA-4 (independent test author & verifier, lane L2)
- **Round**: 1
- **Task**: `LA-E5-18` (`docs/architecture/ltiaas/tasks/LA-E5-18.md`)
- **Author**: Author-2 (`lti-author`)
- **Merge Commit / Integration SHA**: `1e65040` / `aa3b214` (code identical to `836d579`)
- **Isolated Clone**: `/Users/quangnguyen/cogniate-qa-runs/LA/qa4-r9-aa3b214/clone` (detached at `aa3b2141e96b6723b5af8fa40ed86904970f4dc0`, `--no-hardlinks`, push URL `DISABLED`)
- **Logs Directory**: `/Users/quangnguyen/cogniate-qa-runs/LA/qa4-r9-aa3b214/logs`
- **Verdict**: **PASS (K0 / UNIT green; K1-SIM suites authored and ready for Docker window)**

---

## 1. Test-First Authorship & Independence

Per `docs/team/charter.md` §1, §4, and §5, the `LA-E5-18` QA suite in `tests/ltiaas/tasks-lti/LA-E5-18/` was authored from only:
- `docs/architecture/ltiaas/tasks/LA-E5-18.md`
- `docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md` D10 (row "Tenant id in logs")
- `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` §6

No product source code, Author commit messages, or reviewer notes were read during test authoring. All K0 assertions use boolean checks and never print product source code.

### Files Authored by QA-4
- `tests/ltiaas/tasks-lti/LA-E5-18/tsconfig.json`
- `tests/ltiaas/tasks-lti/LA-E5-18/vitest.config.mts`
- `tests/ltiaas/tasks-lti/LA-E5-18/README.md`
- `tests/ltiaas/tasks-lti/LA-E5-18/protocol-tenant-logs.k0.test.ts`
- `tests/ltiaas/tasks-lti/LA-E5-18/protocol-tenant-logs.k1sim.test.ts`

---

## 2. File Ownership & Scope Check (`1e65040`)

`git show --stat 1e65040` touches:
- `services/lti-service/src/lti/login.ts`
- `services/lti-service/src/lti/launch.ts`
- `services/lti-service/src/http/routes/protocol.ts`
- `services/lti-service/src/lti/login.test.ts`
- `services/lti-service/src/lti/launch.test.ts`

Note: `services/lti-service/src/http/routes/protocol.ts` is owned by Author-2 (`lti-author`) and wires the protocol route call site so `launch_claims_minimized` and `launch_check_failed` receive the resolved tenant ids (`tenantLogIds`). No files outside Author-2's ownership (`tests/**`, `docs/**`, or exclusive files owned by other lanes) were modified.

---

## 3. Acceptance Criteria Traceability Matrix

| AC ID | Kind | Spec Requirement | QA Suite / Test Case | Status |
| --- | --- | --- | --- | --- |
| `AC-LA-E5-18-01` | `K1-SIM` | A rejected login for a known account and unknown `iss` logs `event: "login_rejected"` with `tool_account_id: "<accountId>"` and no `platform_id` field. | `protocol-tenant-logs.k1sim.test.ts > AC-LA-E5-18-01: rejected login for a known account and unknown iss returns 400 and logs login_rejected with tool_account_id and no platform_id` (plus unit coverage in `login.test.ts > tenant ids in login_rejected > an unknown iss (AC-LA-E5-18-01 at unit level): tool_account_id only, no platform_id field`) | `pending: Docker window` (UNIT verified) |
| `AC-LA-E5-18-02` | `K1-SIM` | A launch that fails check 6 (signature) for a known platform logs `event: "launch_check_failed"` with `check: 6`, `tool_account_id`, and `platform_id`. | `protocol-tenant-logs.k1sim.test.ts > AC-LA-E5-18-02: launch failing check 6 (signature) for a known platform returns 401 and logs launch_check_failed with check: 6, tool_account_id and platform_id` (plus unit coverage in `launch.test.ts > launch_check_failed (contract delta §6) > a bad signature for a known platform logs check 6 with tool_account_id and platform_id (AC-LA-E5-18-02 at unit level)`) | `pending: Docker window` (UNIT verified) |
| `AC-LA-E5-18-03` | `K1-SIM` | A valid launch logs `event: "launch_accepted"` with `tool_account_id`, `platform_id`, and `binding`. | `protocol-tenant-logs.k1sim.test.ts > AC-LA-E5-18-03: valid launch succeeds (302) and logs launch_accepted with tool_account_id, platform_id and binding` (plus unit coverage in `launch.test.ts > launch_accepted (contract delta §6) > a valid launch logs tool_account_id, platform_id and binding cookie, and no other new field (AC-LA-E5-18-03 at unit level)`) | `pending: Docker window` (UNIT verified) |
| `AC-LA-E5-18-04` | `UNIT` | A rejected login for an unknown `:accountId` path logs no `tool_account_id` field (not `""`, not the raw path string). | `protocol-tenant-logs.k0.test.ts > AC-LA-E5-18-04 (UNIT)`, `launch.test.ts > tenantLogIds > gives each id only when its row is known, never an empty string`, `login.test.ts > tenant ids in login_rejected > a login for an unknown account nobody logs no tool_account_id field: the old field set (AC-LA-E5-18-04)`, `login.test.ts > tenant ids in login_rejected > a login for an unknown account Not-An-Id! logs no tool_account_id field: the old field set (AC-LA-E5-18-04)` | **PASS** |

---

## 4. K0 & Unit Execution Results

1. **QA-4 K0 Suite (`LA-E5-18-k0.log`)**:
   - Command: `LA_TARGET_ROOT="/Users/quangnguyen/cogniate-qa-runs/LA/qa4-r9-aa3b214/clone" npx --no-install vitest run --config ltiaas/tasks-lti/LA-E5-18/vitest.config.mts ltiaas/tasks-lti/LA-E5-18/protocol-tenant-logs.k0.test.ts`
   - Result: **1 file passed, 3/3 tests passed (`17.84s`)**.
   - Checks verified:
     - Static check across `login.ts`, `launch.ts`, and `protocol.ts` for `login_rejected`, `launch_check_failed`, `launch_claims_minimized`, `launch_accepted`, `tool_account_id`, `platform_id`, `tenantLogIds`, and `binding`.
     - F1 (`fitness:lms-names`) and F5 (`fitness:rules`) checks pass on `login.ts`, `launch.ts`, and `protocol.ts`.
     - Unit test runner passes.
2. **Focused Unit Suite (`e5-18-unit.log`)**:
   - Command: `npx --no-install vitest run --reporter=verbose services/lti-service/src/lti/login.test.ts services/lti-service/src/lti/launch.test.ts services/lti-service/src/lti/storage-check.test.ts services/lti-service/src/http/routes/protocol.test.ts`
   - Result: **4 test files passed, 44/44 tests passed (`2.56s`)**.
3. **Clone Working Tree Hygiene (`status-after.txt`)**:
   - `git status --porcelain` in `/Users/quangnguyen/cogniate-qa-runs/LA/qa4-r9-aa3b214/clone` is empty (`0` bytes).
