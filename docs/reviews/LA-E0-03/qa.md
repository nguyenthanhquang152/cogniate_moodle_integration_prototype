Verdict: PASS
Round: 1

# LA-E0-03 Golden outputs G1–G4: QA

Tester: lead QA (Orca task `task_7f3254c0ae9f`, dispatch `ctx_e5d6bae0cd22`), 2026-10-22. Spec: `docs/architecture/ltiaas/tasks/LA-E0-03.md`. Design: `tests/ltiaas/TEST-STRATEGY.md` §4.5–§4.7.

Independence: QA wrote the golden capture and compare tool (`tests/ltiaas/golden/**`) from the task spec, `TEST-STRATEGY.md` §4.6–§4.7, the public API contracts and the frozen M1 helpers. QA read no product source, no Author notes and no reviewer file.

| Item | Value |
| --- | --- |
| Base SHA | `1b17261be97c4701b928fa9dc2fa74c6d23028f6` (G-BASE `bd368ff`, product `9f8ac62`) |
| Lane and slot | host-only (no Docker; LA is on a Docker hold while the other run holds the exclusive Docker window) |
| Golden tool files | `tests/ltiaas/golden/README.md`, `tests/ltiaas/golden/compare.mjs`, `tests/ltiaas/golden/run-golden.mjs`, `tests/ltiaas/golden/capture.golden.ts`, `tests/ltiaas/golden/vitest.config.mts`, `tests/ltiaas/golden/golden.k0.test.mjs`, `tests/ltiaas/golden/lib/compare.{mjs,d.mts}`, `tests/ltiaas/golden/lib/normalize.{mjs,d.mts}`, `tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/{G1,G2,G3,G4,meta}.json` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E0-03-01 | pending: Docker window (stored `1b17261…/G1.json` present; re-prove in LA Docker window) | `AC-04 support: the stored capture is complete (G1-G4, meta)` | `node --test tests/ltiaas/golden/golden.k0.test.mjs` | `tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/G1.json` |
| AC-LA-E0-03-02 | pending: Docker window (stored `1b17261…/G2.json` present; re-prove in LA Docker window) | same | same | `tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/G2.json` |
| AC-LA-E0-03-03 | pending: Docker window (stored `1b17261…/G3.json` and `G4.json` present; re-prove in LA Docker window) | same | same | `tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/G3.json`, `G4.json` |
| AC-LA-E0-03-04 | pending: Docker window (two fresh-stack captures of `1b17261…` with `settledPending` in `capture.golden.ts`) | `run-golden.mjs` + `compare.mjs` | — | Pending LA SIM Docker slot |
| AC-LA-E0-03-05 | PASS (K0) | `AC-05 normalization`, `AC-05 drop list`, `AC-05 secret scan` | `node --test tests/ltiaas/golden/golden.k0.test.mjs` | 3/3 pass; 0 secret hits across `G1.json`–`G4.json` |
| AC-LA-E0-03-06 | PASS (K0) | `AC-06 compare without Docker: the CLI compares the stored capture with itself in under 5 s` | `node --test tests/ltiaas/golden/golden.k0.test.mjs` | 45 ms (< 5,000 ms), `EQUAL: 0 differences` |
| AC-LA-E0-03-07 | PASS (K0) | `AC-07 negative control: one changed field in a copy of the capture fails and is named with the old and new value` | `node --test tests/ltiaas/golden/golden.k0.test.mjs` | Exits 1 and prints `DIFF G1 acceptance.providers.profiles[1].issuer (changed)` |
| AC-LA-E0-03-08 | PASS (K0) | `AC-08 expected delta`, `cliBinding` | `node --test tests/ltiaas/golden/golden.k0.test.mjs` | Explained delta passes; unnamed diff fails; missing expected change fails as `MISSING` |
| AC-LA-E0-03-09 | pending: Docker window (U1 seed rows in all 5 statuses `sent`, `pending`, `failed`, `conflict`, `superseded`) | `capture.golden.ts` | — | Pending LA SIM Docker slot |

## Notes

- **Fix for row D / E `503` race (`settledPending` in `capture.golden.ts`):** `waitSync(..., 'pending', 2)` previously returned as soon as the score worker incremented `tries` to `2` in SQLite before the second HTTP POST reached `lms-sim`. When `d2` launched immediately on the same `resource`, it registered a new scenario on `lms-sim` (`scoreAnswers: []`) that answered `204` to `d1`'s in-flight second POST instead of `503`. `settledPending` now waits for both the `score_sync` log event (`tries: 2, status: 'pending'`) and at least `tries` `503` score records in `/__sim/records` for that publication before starting the next step.
- **Measured time (K0 suite):** `node --test tests/ltiaas/golden/golden.k0.test.mjs` runs 9 tests in 212 ms (compare CLI: 5–45 ms).
