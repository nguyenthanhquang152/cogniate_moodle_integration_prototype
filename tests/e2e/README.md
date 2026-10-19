# T7 end-to-end suite (QA-E2E)

Owner: QA-E2E. Source: `docs/architecture/tasks/T7.md` (Scenarios A, B, C; AC-T7-01 to AC-T7-15).

The suite drives the real UIs: the Cogniate portal (`PUBLIC_APP_URL`) and Moodle 5.2.4 (`PUBLIC_MOODLE_URL`). It uses no test knob and no `acceptance` profile.

## Files

| File | Content |
| --- | --- |
| `0-start.spec.ts` | AC-T7-13 at the start. A new run state. |
| `1-scenario-a.spec.ts` | A1–A6: dynamic registration (the admin follows `moodle-steps.json`), both courses, both learners. AC-T7-02 to -07, -14. |
| `2-scenario-b.spec.ts` | B1–B6: manual registration, "QA Library B", isolation. AC-T7-08, -09. |
| `3-scenario-c.spec.ts` | C1 replay → `INVALID_STATE`. C2 grep of `infra/.logs/*.jsonl` for every captured ltik, service key, runtime token, id_token, API key, state, registration ref, play id and picker id. AC-T7-10. |
| `9-end.spec.ts` | AC-T7-13 at the end. `evidence/summary.json`. |
| `demo-check.spec.ts` | AC-T7-15 player check. Runs only in the demo pass (`QA_E2E_DEMO=1`). |
| `lib/` | Moodle, portal, learner and oracle steps; run state; evidence. |
| `host/run-t7.mjs` | Host runner: clone, N runs, demo pass, teardown. |

Each scenario step is one test. A step reads the result of earlier steps from `artifacts/state.json`. So one failed check does not stop the later steps.

## Run

Clean run in a fresh clone, on an own stack (charter §3a):

```sh
COMPOSE_PROJECT_NAME=qa-e2e-r1 PUBLIC_PORT=8543 STACK_SUBNET=172.31.0.0/16 \
COURSE_FIXTURES_DIR=$PWD/docs/raw/data/courses \
  node tests/e2e/host/run-t7.mjs --sha <commit> --runs 3 --demo
```

In a checkout that has a stack: `npm run test:e2e` (it runs `e2e:reset` first).

## Evidence

`tests/e2e/artifacts/` (git-ignored): `evidence/*.png` (grader reports, completion, portal results, Moodle tool settings), `evidence/*.json`, Playwright traces and the HTML report. The host runner copies each run to `artifacts/runs/<run id>/` and masks secrets (first 6 characters and the length).

CAUTION: Playwright traces (`trace.zip`) and the HTML report hold raw secrets of the test stack: passwords typed into forms, `id_token`s, ltiks, state cookies. The runner masks secrets in text files only. Do not put traces or the HTML report into shared evidence (for example the human review pack). For a run that you want to share, use the screenshots and the JSON files in `evidence/`, or run with traces off.
