Verdict: PASS (host-only K0 + UNIT; K1-SIM pending: Docker window)
Round: 1

# LA-E3-04 Deep Linking completeness: service part: QA verification

Tester: QA-4 (Orca task `task_fb862e2b49d1`, dispatch `ctx_6039a0441240`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E3-04.md` (with `LA-ADR-05` D3a/D3c/D3d, contract delta §4.1/§4.2, and `LA-ADR-04` D8 `LA-IC-12`). Suite: `tests/ltiaas/tasks-lti/LA-E3-04/` (QA-4 test-first; LD-9 `LA-IC-12` list in `tests/ltiaas/tasks-lti/LA-E3-04/README.md` approved by both reviewers).

Independence: QA-4 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files to author `tests/ltiaas/tasks-lti/LA-E3-04/`, and verified all host-only K0 and UNIT checks in an isolated `--no-hardlinks` clone of `a2dfc04` using boolean assertions that never print product source.

| Item | Value |
| --- | --- |
| SHA | `a2dfc0418ccf421891f260925ddee0d22371e240` (integration `a2dfc04`; holds `LA-E3-04` commit `f6d0601` in merge `3344520`) |
| Lane and slot | lane L; no Docker (`HOST-ONLY`; `K1-SIM` rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/qa4-r8-a2dfc04/clone`: `git clone --no-hardlinks --no-checkout`, detached at `a2dfc0418ccf421891f260925ddee0d22371e240`, push URL `DISABLED`, `npm ci` at root and `tests/` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/qa4-r8-a2dfc04/logs/` and `k0/` (umask 077): `npm-ci.log`, `npm-ci-tests.log`, `LA-E3-04-k0.log`, `e3-04-unit.log`, `k0/e3-04-k0.json`, `k0/e3-04-unit.log`, `rev.txt`, `remotes.txt`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E3-04-01 | pending: Docker window (K1-SIM) | `tests/ltiaas/tasks-lti/LA-E3-04/deep-linking.k1sim.test.ts > AC-LA-E3-04-01` | SIM Docker slot | Pending Docker window. Verified at host unit level in `services/lti-service/src/lti/deep-linking.test.ts > content items (contract §3.2) > allows cancellation and rejects line items only when explicitly refused` and `services/lti-service/src/http/routes/compat.test.ts > all Deep Linking routes sign cancellation with accept_multiple true (LA-E3-04 AC-07)` (`e3-04-unit.log`). |
| AC-LA-E3-04-02 | pending: Docker window (K1-SIM) | `deep-linking.k1sim.test.ts > AC-LA-E3-04-02` | SIM Docker slot | Pending Docker window. Verified at host unit level in `deep-linking.test.ts > two items when accept_multiple is false -> INVALID_CONTENT_ITEM; zero or one item is fine (AC-03)` and `compat.test.ts > all Deep Linking routes sign cancellation with accept_multiple false (LA-E3-04 AC-07)` (`e3-04-unit.log`). |
| AC-LA-E3-04-03 | PASS (UNIT + K0) | `services/lti-service/src/lti/deep-linking.test.ts > content items (contract §3.2) > two items when accept_multiple is false -> INVALID_CONTENT_ITEM; zero or one item is fine (AC-03)` + `keeps the twenty-item bound with accept_multiple undefined (AC-03)` + `keeps the twenty-item bound with accept_multiple true (AC-03)` + `keeps the twenty-item bound with accept_multiple false (AC-03)` + `deep-linking.k0.test.ts` | `LA_LEVEL=k0 LA_TARGET_ROOT=$PWD LA_RUN_DIR=~/cogniate-qa-runs/LA/qa4-r8-a2dfc04/k0 ./node_modules/.bin/vitest run --config tests/ltiaas/tasks-lti/LA-E3-04/vitest.config.mts --reporter=verbose` and `./node_modules/.bin/vitest run --reporter=verbose services/lti-service/src/lti/deep-linking.test.ts` | With `accept_multiple: false`, 0 or 1 item is accepted and 2 items give `400 INVALID_CONTENT_ITEM`; 21 items give `400 INVALID_CONTENT_ITEM` for `accept_multiple` `undefined`, `true` and `false`. `LA-E3-04-k0.log`, `e3-04-unit.log` |
| AC-LA-E3-04-04 | pending: Docker window (K1-SIM) | `deep-linking.k1sim.test.ts > AC-LA-E3-04-04` | SIM Docker slot | Pending Docker window. Verified at host unit level in `deep-linking.test.ts > allows cancellation and rejects line items only when explicitly refused` and `compat.test.ts > all Deep Linking routes refuse line items when accept_lineitem is false and accept the ungraded item (LA-E3-04 AC-07)` (`e3-04-unit.log`). |
| AC-LA-E3-04-05 | pending: Docker window (K1-SIM) | `deep-linking.k1sim.test.ts > AC-LA-E3-04-05` | SIM Docker slot | Pending Docker window. Verified at host unit level in `services/lti-service/src/lti/idtoken.test.ts > toIdToken > keeps accept_lineitem true and accept_media_types exactly in the shaped settings` and `keeps accept_lineitem false and accept_media_types exactly in the shaped settings` (`e3-04-unit.log`). |
| AC-LA-E3-04-06 | PASS (UNIT + K0) | `services/lti-service/src/lti/idtoken.test.ts > toIdToken > omits resourceLink and adds deepLinkingSettings for a deep-linking launch` + `deep-linking.k0.test.ts` | `./node_modules/.bin/vitest run --reporter=verbose services/lti-service/src/lti/idtoken.test.ts` | A Deep Linking launch whose settings lack `accept_lineitem` and `accept_media_types` omits `acceptLineItem` and `acceptMediaTypes` from `launch.deepLinkingSettings`. `LA-E3-04-k0.log`, `e3-04-unit.log` |
| AC-LA-E3-04-07 | PASS (UNIT + K0) | `services/lti-service/src/http/routes/compat.test.ts > T3c compat routes with real API authorization > all Deep Linking routes sign cancellation with accept_multiple true (LA-E3-04 AC-07)` + `all Deep Linking routes sign cancellation with accept_multiple false (LA-E3-04 AC-07)` + `all Deep Linking routes refuse line items when accept_lineitem is false and accept the ungraded item (LA-E3-04 AC-07)` + `deep-linking.k0.test.ts` | `./node_modules/.bin/vitest run --reporter=verbose services/lti-service/src/http/routes/compat.test.ts` | `POST /api/deeplinking`, `/api/deeplinking/message` and `/api/deeplinking/form` all return `200` and sign a valid JWT with `content_items: []` for `{contentItems: []}` (both `accept_multiple: true` and `false`), return `400 INVALID_CONTENT_ITEM` when `accept_lineitem: false` and an item has `lineItem`, and return `200` for the same item without `lineItem`. `LA-E3-04-k0.log`, `e3-04-unit.log` |

## Other checks

- **F1 (RQ-3):** All 4 task files (`services/lti-service/src/lti/deep-linking.ts`, `lti/idtoken.ts`, `http/routes/services.ts`, `http/routes/compat.ts`) have `0` F1 hits and `0` in `f1-baseline.json` (`k0/e3-04-k0.json`).
- **Reviewed `LA-IC-12` test-change list (plan LD-9):** Documented in `tests/ltiaas/tasks-lti/LA-E3-04/README.md` (and reviewed/approved by Reviewer-A and Reviewer-B): Author updated `services/lti-service/src/lti/deep-linking.test.ts` and `services/lti-service/src/http/routes/compat.test.ts` (`contentItems: []` → `null` in the invalid-content refusal row); `tests/api/lti-service.test.ts` (`AC-T3-08`) is updated in the SIM window per LD-9.
- **File scope (`f6d0601` in `3344520`):** Touches only `services/lti-service/src/lti/deep-linking*.ts`, `services/lti-service/src/lti/idtoken*.ts` and `services/lti-service/src/http/routes/compat.test.ts`. No app files or disallowed LTI files were touched.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/qa4-r8-a2dfc04/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0: PASS (`7.46s` K0 suite, `6.26s` focused 3-file unit run with 63 tests). `K1-SIM` (`AC-LA-E3-04-01`, `02`, `04`, `05`) is `pending: Docker window`.
