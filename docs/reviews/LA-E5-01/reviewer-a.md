Verdict: APPROVE
Round: 1

# LA-E5-01 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: `git diff 1b17261 381b4ac` (lane commit `381b4ac`; merged as `29c109d`).
- References: `docs/architecture/ltiaas/tasks/LA-E5-01.md`; LA-ADR-06 D3 ("Trust bootstrap"); contract delta §1.2, §1.3 and §3 (operator-key rows); LA-ADR-07 D4. Lead-approved RQ-2 edits: `infra/scripts/lib.sh` (`ACCEPTANCE_OPERATOR_HOST`) and `migrations.test.ts` (`.slice(0, 4)`).
- Blind review: I did not open the other reviewer's file. I wrote my findings before I judged the Author's open points.
- **Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 2 NIT.**

## Checks

| Check | Result |
| --- | --- |
| Credential and storage | Correct. The key is `ltio_` + `randomToken()` (32 random bytes, 43 base64url characters). Only the SHA-256 hash is stored (`store/operator-keys.ts:63-69`). The hash column never leaves the store module (`COLUMNS`, `:42`), so the list answer has no key and no hash (`http/operator/operator-keys.ts:21-23`). |
| Grammars apart (design note) | Yes. `findActiveOperatorKey` takes only `ltio_` keys (`store/operator-keys.ts:76`), and the tenant lookup takes only `ltis_` keys (`store/accounts.ts:30`). They use different tables. Tests: `store/operator-keys.test.ts:36`, `http/operator/operator-keys.test.ts:40` (a tenant key on the operator listener gives the same `401`) and `:65` (an operator key as Bearer on `/api/platforms` gives `401`). |
| One `401` for every failure | Yes. A missing header, another scheme, the wrong grammar, an unknown, expired or revoked key all give `401 INVALID_OPERATOR_AUTHORIZATION_HEADER` (`http/operator/index.ts:77-85`). The hook runs at `onRequest`, before any body parse. The `api_auth_failed` line has no credential. |
| Expiry boundary (AC-11) | Correct. A key is active while `now < expires_at` (`store/operator-keys.ts:49-51`). The controlled-clock test checks `expires_at − 1 s` (passes) and `expires_at + 1 s` (unknown-key `401`) (`operator-keys.test.ts:53`). The range rule is 1 hour to one calendar year with both ends included, default 90 days. The error text is "Invalid field: expiresAt. …", the base format for the field (`validation.ts`). |
| Revoke | `409 OPERATOR_KEY_IN_USE` for the key of the request is checked first, then `404` for an unknown id. A second revoke keeps the first `revoked_at` (`store/operator-keys.ts:84-87`). |
| `init` (trust bootstrap) | Correct, and it runs in one `BEGIN IMMEDIATE` transaction (`packages/shared/src/migrations.ts:21-22`), so two `init` runs cannot both make a first key. `refuse` exits 1 with one line and no change. `--if-none` exits 0 with `operator key exists`. `--replace` revokes every key, then makes one. Only active keys count, so after every key expires `init` makes a new one. The new key is the only stdout line, and `process.exitCode` lets stdout flush before the process ends (`cli/operator.ts:63-77`). |
| Key file | `infra/scripts/lti-bootstrap.sh:30-33`: the key stays in a shell variable (`printf` is a builtin, so it is never on a command line). It is written with `umask 077` to a temporary file and then renamed, with the folder at mode `0700` (the same pattern as `stack-up.sh:31-32`). A failed or unexpected CLI output writes nothing and exits 1. |
| Listener and binds | The default profile binds `127.0.0.1:4110` (the compose default `${ACCEPTANCE_OPERATOR_HOST:-127.0.0.1}`). Only `apply_profile acceptance` sets `0.0.0.0`. Port 4110 is not published, and the proxy has no route (unit test: the public listener has no operator route). `service_started` has `operator_bind`, and shutdown closes both listeners. |
| Log redaction (AC-12) | `ltio_…` values and the `OPERATOR-AUTH-V1` header are redacted, also inside nested values (`packages/shared/src/logger.ts:56-60`; test `logger.test.ts:112`). The text `ltio_ +` in prose stays readable. |
| UNIT ACs fail on the old behaviour | Yes. AC-11 needs the new listener and table, and AC-12 needs the new redaction pattern. |
| "Must not edit" and ownership | Respected. `lti/**`, `routes/{protocol,registration}.ts`, `http/auth.ts` and the S2 modules are unchanged. The shared setup moved into `installApiBasics` without changing the public app: same hooks, same error body and 404, same `rewriteUrl`, `maxParamLength` and `formbody`. |
| No LMS name in core paths | Yes. |

## Findings

- **A-LA-E5-01-01 (NIT): the design and the spec name different places for `init --if-none`.**
  - Where: LA-ADR-06 D3 "Trust bootstrap" ("`stack:up` always uses `--if-none`, so a restart on an existing volume works") versus the spec scope and the code. The code runs it in `infra/scripts/lti-bootstrap.sh:30`, which only `npm run seed` calls (`infra/scripts/seed.sh:43-44`).
  - Problem: after `stack:up` alone, no operator key exists until `seed` runs. AC-06's "a second `stack:up` on the same volume succeeds" is then always true, and it does not exercise `--if-none`. The behaviour is safe either way: a second seed keeps the key.
  - Suggested fix: align the texts. Either A2 changes D3 and operability to "`seed` (`lti-bootstrap.sh`)", or AC-06 says "a second `npm run seed` on the same volume succeeds and keeps the key file".
- **A-LA-E5-01-02 (NIT): `stack:reset` leaves `infra/.secrets/lti-operator-key`.**
  - Where: `infra/scripts/stack-reset.sh`. Its `rm` list removes `seed.json` and `lti-api-key.*`, not the operator key file. That file is outside this task's "May edit" list.
  - Problem: after a reset, the file holds a key for a deleted database until the next `seed` writes a new one (the script overwrites it when `init` prints a new key). It is a dead credential, so the risk is small. But the reset header promises to delete the LTI key files.
  - Suggested fix: the owner of `stack-reset.sh` adds `"$INFRA_DIR/.secrets/lti-operator-key"` to the `rm` list (one-line request).

## Author's open points (judged after my findings)

- The key is made by `lti-bootstrap.sh` (seed), not `stack:up`: this follows the spec. The design difference is A-LA-E5-01-01.
- `stack-reset.sh` does not delete the key file: A-LA-E5-01-02.
- CLI choices: all acceptable. These are stdout = key only (safe to capture), refusals on stderr, exit 1 (an active key exists) and 2 (usage), the name pattern (it gives a safe audit actor `operator:<name>`), `opk_` ids, revoke that keeps the first `revoked_at`, and `404` for an unknown id.

## Notes (no finding)

- An unknown path on the operator listener gives `404` without authentication (`operator-keys.test.ts:79`), so a caller with no key can tell which routes exist. That is acceptable for a loopback listener (and in `acceptance`, the stack network). `LA-E5-21` refuses a non-loopback bind in `production`.
- An operator can issue a key under another operator's name (contract delta §3 has a free `operator` field). Attribution stays traceable once LA-E5-02 records `operator_key.issue` with the issuing actor.
- K1-SIM ACs (AC-01 to AC-10) wait for QA-2's Docker window. The unit tests already cover their logic.
