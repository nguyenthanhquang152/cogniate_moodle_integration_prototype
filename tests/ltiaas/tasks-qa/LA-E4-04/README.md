# LA-E4-04: Progress record emission (no outbound dispatch)

Owner: QA-3 (`tests/ltiaas/tasks-qa/LA-E4-04/`).
Spec: [`docs/architecture/ltiaas/tasks/LA-E4-04.md`](../../../../docs/architecture/ltiaas/tasks/LA-E4-04.md).

## Acceptance Criteria Mapping

| AC | Level | Test File / Evidence | Description |
| --- | --- | --- | --- |
| `AC-LA-E4-04-01` | `UNIT` | `services/cogniate-app/src/kernel/records/records.test.ts` | An attempt from launch to a final result writes `attempt.started`, `attempt.progressed`, `attempt.submitted`, and `attempt.final` in `outcome_record` with the right payloads; a resumed session of the same attempt writes no second `attempt.started` record. |
| `AC-LA-E4-04-02` | `K1-SIM` | `progress-no-dispatch.k1sim.test.ts` | One attempt with several progress commits, then a final result (both SCORM 1.2 on Blackboard SIM and HTML on Canvas SIM): the simulator AGS score records (`/__sim/records`) and `GET /app-api/publications/:id/results` show only the final score of the attempt and no progress dispatch row. |
| `AC-LA-E4-04-03` | `UNIT` | `services/cogniate-app/src/kernel/records/records.test.ts` | The payload of `attempt.final` has `attemptStartedAt` and `attemptSubmittedAt`; an attempt that started and was submitted before progress records existed uses the nearest known times. |
| `AC-LA-E4-04-04` | `K1-SIM` | `G1–G4` golden capture & compare (`qalead-la-72` in D1, `qalead-la-92` in D2 on `a8bbac53`) | Golden `G3` equals the `G-BASE` (`1b17261b`) baseline (`EQUAL: 280 differences (0 not explained), 0 expected changes missing`). |
| `AC-LA-E4-04-05` | `UNIT` | `services/cogniate-app/src/kernel/records/records.test.ts` | A legacy final attempt without records takes its stored `updated_at` as the submission time and keeps it; the first commit writes the legacy submission even when it changes nothing else. |

## Running

- **Live SIM stack (`K1-SIM` inside `e2e` container on an authorized SIM slot):**
  ```sh
  COMPOSE_PROJECT_NAME=qa3-la-e404-r1 PUBLIC_PORT=9473 STACK_SUBNET="172.23.0.0/16" \
    node tests/ltiaas/tasks-qa/LA-E4-04/run-sim.mjs --sha 48c01495fd18d846577fc4782f52167b18e1c5a9 \
    --source /Users/quangnguyen/cogniate-qa-runs/LA/qa3-la-e404-r1/clone --replace-tests \
    --tests-from /Users/quangnguyen/cogniate-qa-runs/LA/qa3-la-e404-r1/clone/tests
  ```
