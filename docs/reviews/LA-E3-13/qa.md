# QA Review — `LA-E3-13` (Deep Linking per-type item fields)

- **Reviewer**: QA-4 (independent test author & verifier, lane L2)
- **Round**: 1
- **Task**: `LA-E3-13` (`docs/architecture/ltiaas/tasks/LA-E3-13.md`)
- **Author**: Author-2 (`lti-author`)
- **Merge Commit / Integration SHA**: `84d5679` / `aa3b214` (code identical to `836d579`)
- **Isolated Clone**: `/Users/quangnguyen/cogniate-qa-runs/LA/qa4-r9-aa3b214/clone` (detached at `aa3b2141e96b6723b5af8fa40ed86904970f4dc0`, `--no-hardlinks`, push URL `DISABLED`)
- **Logs Directory**: `/Users/quangnguyen/cogniate-qa-runs/LA/qa4-r9-aa3b214/logs`
- **Verdict**: **PASS (K0 / UNIT green; K1-SIM suites authored and ready for Docker window)**

---

## 1. Test-First Authorship & Independence

Per `docs/team/charter.md` §1, §4, and §5, the `LA-E3-13` QA suite in `tests/ltiaas/tasks-lti/LA-E3-13/` was authored from only:
- `docs/architecture/ltiaas/tasks/LA-E3-13.md`
- `docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md` D3e
- `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` §4.5

No product source code, Author commit messages, or reviewer notes were read during test authoring. All K0 assertions use boolean checks and never print product source code.

### Files Authored by QA-4
- `tests/ltiaas/tasks-lti/LA-E3-13/tsconfig.json`
- `tests/ltiaas/tasks-lti/LA-E3-13/vitest.config.mts`
- `tests/ltiaas/tasks-lti/LA-E3-13/README.md`
- `tests/ltiaas/tasks-lti/LA-E3-13/deep-linking-per-type.k0.test.ts`
- `tests/ltiaas/tasks-lti/LA-E3-13/deep-linking-per-type.k1sim.test.ts`

---

## 2. File Ownership & Scope Check (`84d5679`)

`git show --stat 84d5679` touches only the files allowed by `LA-E3-13.md`:
- `services/lti-service/src/lti/deep-linking.ts`
- `services/lti-service/src/lti/deep-linking.test.ts`

No files outside the task scope (`tests/**`, `docs/**`, or exclusive files owned by other lanes) were modified.

---

## 3. Acceptance Criteria Traceability Matrix

| AC ID | Kind | Spec Requirement | QA Suite / Test Case | Status |
| --- | --- | --- | --- | --- |
| `AC-LA-E3-13-01` | `UNIT` | A `link`, `file`, or `image` item without `url`, with a non-string `url`, or with an `http://` `url` returns `400 INVALID_CONTENT_ITEM` whose `description` names the item index. | `deep-linking-per-type.k0.test.ts > AC-LA-E3-13-01 & AC-LA-E3-13-02 (UNIT)`, `deep-linking.test.ts > per-type fields (LA-ADR-05 D3e) > a link/file/image without url / http url / null url / non-string url / unparseable url / javascript url / data url -> 400 INVALID_CONTENT_ITEM; description names the item index (AC-LA-E3-13-01)` | **PASS** |
| `AC-LA-E3-13-02` | `UNIT` | An `html` item without `html` or with a non-string `html` returns `400 INVALID_CONTENT_ITEM` whose `description` names the item index. | `deep-linking-per-type.k0.test.ts > AC-LA-E3-13-01 & AC-LA-E3-13-02 (UNIT)`, `deep-linking.test.ts > per-type fields (LA-ADR-05 D3e) > an html item without html / null html / non-string html / only a url -> 400 INVALID_CONTENT_ITEM with the index (AC-LA-E3-13-02)` | **PASS** |
| `AC-LA-E3-13-03` | `K1-SIM` | Valid `link`, `file`, `image`, and `html` items (when allowed by `accept_types`) sign and verify on `/api/deeplinking`, `/api/deeplinking/form`, and `/api/deeplinking/message`. | `deep-linking-per-type.k1sim.test.ts > AC-LA-E3-13-03: valid link, file, image and html items sign and verify on /api/deeplinking, /api/deeplinking/form and /api/deeplinking/message` (plus unit coverage in `deep-linking.test.ts > keeps valid link, file, image and html items exactly as sent`) | `pending: Docker window` (UNIT verified) |
| `AC-LA-E3-13-04` | `K1-SIM` | Existing `ltiResourceLink` Deep Linking tests pass unchanged. | `deep-linking-per-type.k1sim.test.ts > AC-LA-E3-13-04: existing ltiResourceLink Deep Linking item behavior (default url and custom string map) passes unchanged` (plus unit coverage in `deep-linking.test.ts > does not change ltiResourceLink items (AC-LA-E3-13-04 at unit level)`) | `pending: Docker window` (UNIT verified) |

---

## 4. K0 & Unit Execution Results

1. **QA-4 K0 Suite (`LA-E3-13-k0.log`)**:
   - Command: `LA_TARGET_ROOT="/Users/quangnguyen/cogniate-qa-runs/LA/qa4-r9-aa3b214/clone" npx --no-install vitest run --config ltiaas/tasks-lti/LA-E3-13/vitest.config.mts ltiaas/tasks-lti/LA-E3-13/deep-linking-per-type.k0.test.ts`
   - Result: **1 file passed, 3/3 tests passed (`5.02s`)**.
   - Checks verified:
     - Static check on `services/lti-service/src/lti/deep-linking.ts` for `link`, `file`, `image`, `html`, `https:`, and `INVALID_CONTENT_ITEM`.
     - F1 (`fitness:lms-names`) and F5 (`fitness:rules`) checks pass with 0 hits on `deep-linking.ts`.
     - Unit test runner passes.
2. **Focused Unit Suite (`e3-13-unit.log`)**:
   - Command: `npx --no-install vitest run --reporter=verbose services/lti-service/src/lti/deep-linking.test.ts services/lti-service/src/http/routes/compat.test.ts`
   - Result: **2 test files passed, 74/74 tests passed (`5.70s`)**.
3. **Clone Working Tree Hygiene (`status-after.txt`)**:
   - `git status --porcelain` in `/Users/quangnguyen/cogniate-qa-runs/LA/qa4-r9-aa3b214/clone` is empty (`0` bytes).
