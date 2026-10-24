Verdict: APPROVE
Round: 1

# LA-E5-01 review, Reviewer-B (lens: "Can a human team own it?")

Diff: `git diff 1b17261 381b4ac` (lane S1 commit `381b4ac`; integration merge `29c109d`). Spec: `docs/architecture/ltiaas/tasks/LA-E5-01.md`. Design: LA-ADR-06 D3, LA-ADR-07 D4, `operability.md` §2 and §6.4, contract delta §1.2, §1.3 and §3. I wrote my findings before I read the Author's open points. I did not open the other reviewer's file.

Counts: **0 BLOCKER, 0 MAJOR, 2 MINOR, 1 NIT.**

## Checks

| Check | Result |
| --- | --- |
| Files and ownership | All 21 files are on the spec's "May edit" list or are the tests of those files (`config.test.ts` is new; `logger.test.ts` and `api-errors.test.ts` get new cases). There are two Lead-approved RQ-2 edits: the `ACCEPTANCE_OPERATOR_HOST` line in `infra/scripts/lib.sh` and `.slice(0, 4)` in `db/migrations.test.ts`. S1 owns `infra/**`, `logger.ts`, `api-errors.ts` and the `lti:operator` script (`epics.md:545`, `:702`). |
| Must not edit | Not changed: `lti/**`, `http/routes/{protocol,registration}.ts`, `http/auth.ts`, the S2 operator modules, `packages/channels/**` and the app files. |
| No behaviour change outside the spec | `installApiBasics` (`http/app.ts:68-93`) moves the trace-id hook, the `http_request` line, the error handler and the 404 handler out of `buildApp` with no change, and keeps the order (`formbody` first, then the shared setup). The public listener gets no new route: the unit test gives `404` for `/operator/v1/operator-keys` on it. The full `services/lti-service` and `packages/shared` suites pass at HEAD: 43 files, 638 tests, no Docker. |
| No LMS name in core | None. The only `moodle` string is the existing `PUBLIC_MOODLE_URL` env value in the `config.test.ts` fixture. |
| UNIT ACs fail on the old behaviour | AC-11 (`http/operator/operator-keys.test.ts:53`) uses a controlled clock. It gives `200` at `expires_at − 1 s`, and at `expires_at + 1 s` it gives a `401` body equal to the body for an unknown key. The store test also checks the exact boundary (`store/operator-keys.test.ts:31`: `null` at `expires_at`). The old code has no listener and no table, so the test fails on it. AC-12 (`packages/shared/src/logger.test.ts:112`) logs the key in the field `note`. That name is not a secret name, so only the new `ltio_` value pattern can redact it, and the test fails without the pattern. It also checks the `OPERATOR-AUTH-V1` header and a value in a nested list. The 7 changed test files pass: 45 tests, about 0.5 s. |
| Readability and operability | The modules are small and their names are clear. The auth hook gives the same `401` for every failure and logs `api_auth_failed {scheme: "operator"}`, with the same event name as the public auth. `service_started` gets `operator_bind`. The mount list has one line per module (LD-10). The store does not send the hash out: `COLUMNS` leaves out `key_hash`, and the test checks that no 64-hex string is in the list body. Shutdown closes both listeners (`Promise.allSettled`). The bootstrap prints a clear WARNING with the `init --replace` command when the key file is lost. |

## Findings

### B-LA-E5-01-01 — MINOR — The design and runbook say `stack:up` makes the operator key; the code does it in `seed`

- **File:** `docs/architecture/ltiaas/operability.md:249`; `docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md:160`, `:436`; compare `docs/architecture/ltiaas/tasks/LA-E5-01.md:36` and `infra/scripts/lti-bootstrap.sh:25-44`, which `infra/scripts/seed.sh:43-44` calls.
- **Problem:** The code does what the task spec says: `lti-bootstrap.sh` runs `init --if-none`. But the operator runbook and the ADR tell a person that `stack:up` makes the key. After `npm run stack:up` alone there is no `infra/.secrets/lti-operator-key`, and an operator who reads §6.4 will look for it there. Also, the regression line "M1 `sim` phase on a stack that ran `stack:up` twice (the second run uses `init --if-none`)" is true only when `seed` runs twice.
- **Evidence:** `operability.md:249`: "(`stack:up` uses `init --if-none`, which changes nothing when a key exists.)". `LA-ADR-06:160`: "`stack:up` always uses `--if-none`". `LA-ADR-06:436`: "`stack:up` runs `lti:operator init --if-none` before `lti:bootstrap`". Task spec `:36`: "`infra/scripts/lti-bootstrap.sh` runs `lti:operator init --if-none` before the bootstrap". `stack-up.sh` is not on the spec's file list.
- **Suggested fix:** Change no code. The Architect changes the three places to "`npm run seed` (`lti-bootstrap.sh`)". QA-2 runs the AC-06 "second run" check as a second `seed`, not only as a second `stack:up`.

### B-LA-E5-01-02 — MINOR — `stack:reset` keeps a dead operator key file

- **File:** `infra/scripts/stack-reset.sh:36` (header `:2-4`).
- **Problem:** `stack:reset` deletes `lti.db` (`infra/.data/lti-service`), `seed.json` and the tenant `lti-api-key.*` files, but not `infra/.secrets/lti-operator-key`. After a reset, that file holds a key that no database knows. Between `stack:reset` and the next `seed`, the e2e container and the LA-E5-05 CLIs read it and get `401` with no hint. A "delete all stack data" command also leaves a secret file behind. The next `seed` writes over the file, so the risk is low.
- **Evidence:** `rm -f "$INFRA_DIR/.secrets/seed.json" "$INFRA_DIR/.secrets/moodle-ws.json" "$INFRA_DIR/.secrets"/lti-api-key.* …` has no `lti-operator-key`. The header says that the script deletes "infra/.secrets/seed.json and the LTI API key files". The Author was right not to edit the script, because it is not on this task's file list. S1 owns it (`epics.md:545`, "other `infra/**`").
- **Suggested fix:** In an S1 follow-up, add `"$INFRA_DIR/.secrets/lti-operator-key"` to the `rm -f` at `:36` and "the operator key file" to the header. The Lead adds `stack-reset.sh` to the file list of that commit.

### B-LA-E5-01-03 — NIT — A host user name that the name rule refuses stops `seed` with no hint

- **File:** `infra/scripts/lti-bootstrap.sh:29-30`.
- **Problem:** When `OPERATOR_NAME` is not set, the script uses `$(id -un)`. If that name does not match `OPERATOR_NAME` (`store/operator-keys.ts:11`), for example a macOS name that starts with `_` or a name of more than 64 characters, the CLI exits 2 and `set -e` stops `seed`. The person sees only "The operator name must be 1 to 64 characters…". The line does not say that the name came from the host user, or that `OPERATOR_NAME` fixes it.
- **Suggested fix:** Before the `init` call, check `op_name` against the same pattern. If it does not match, print "Set OPERATOR_NAME to a valid operator name (host user '<name>' is not valid)" and exit 2.

## Author's open points (read after the findings above)

- **Key made in `seed`, not `stack:up`:** I accept the code, because it follows the task spec, which binds the build. The ADR and the runbook must change (B-LA-E5-01-01).
- **`stack-reset.sh` keeps the key file:** this is B-LA-E5-01-02. Do it in a follow-up; it does not block this task.
- **CLI choices:** I accept all of them. When stdout holds only the key, the bootstrap can use the strict `^ltio_…{43}$` match and refuse anything else. Exit 1 for a refusal and exit 2 for a usage error is the usual split and agrees with the ADR text "exit 1, one line". The name rule gives a safe audit actor. `opk_` ids follow the id prefix style. The idempotent revoke keeps the first `revokedAt`, and a test checks it. The route checks the `409` for its own key before the `404` for an unknown id, and the result is the same in both orders.
- **Waiting for QA:** AC-01 to AC-10 are K1-SIM. They wait for the QA-2 Docker window.
