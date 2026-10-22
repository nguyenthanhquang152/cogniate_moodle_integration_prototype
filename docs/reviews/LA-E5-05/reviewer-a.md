Verdict: APPROVE
Round: 1

# LA-E5-05 review, lens A ("Is it right and is it safe?")

Reviewer: Reviewer-A2 (Claude Code Opus 5.5 xhigh, plan LD-22). Date: 2026-10-22.
Spec: `docs/architecture/ltiaas/tasks/LA-E5-05.md`. Design: LA-ADR-06 D3 ("CLIs"), D5 (emergency rotation), D7 (CLI rotation); operability §2; BD-A2-14, BD-A2-25, BD-A2-33, BD-A2-34.

Diff: `git diff 9cbd043 8706619 -- services/lti-service/src/cli infra/scripts/lti-bootstrap.sh infra/scripts/lti-bootstrap.test.mjs infra/scripts/stack-reset.sh services/lti-service/src/http/routes/multi-lms.test.ts` (commits `a1b8505`, `0fa5091`, `f0ce5bf`, `e809772`, `18fca25`, `736d4df`).

Method: a throwaway `git archive 8706619` copy under `/private/tmp`, with a clone of the integration `node_modules`. I ran the CLI and route unit tests (6 files, 160 passed), the wrapper test `node --test infra/scripts/lti-bootstrap.test.mjs` (4 of 4; its `lib.sh` is a fake transport, so no Docker runs), and 8 mutants in that copy only. I used no Docker and no network. I did not change the integration worktree, except for this file.

## Summary

| Id | Severity | Topic |
| --- | --- | --- |
| A-LA-E5-05-01 | NIT | A lost answer to `--rotate-api-key` gives "Cannot reach the operator API", but the rotation may have committed |
| A-LA-E5-05-02 | NIT | Each `npm run seed` sends `PATCH {name}` and writes an `account.update` event, also when the name did not change |

There is no BLOCKER, no MAJOR and no MINOR finding. The lens-A points pass (see "Checks that pass").

## Findings

### A-LA-E5-05-01 — NIT — an unclear message after a lost rotation answer

- **File:** `services/lti-service/src/cli/operator-client.ts` (`catch { throw new Error(\`Cannot reach the operator API at ${base}. …\`) }`).
- **Problem:** the same line covers "not sent" and "sent, but the answer was lost", for example after the 10 s timeout. For `--rotate-api-key`, the server may have revoked the old keys and issued a new key that nobody saw. Then the app's key file holds a revoked key. A second `--rotate-api-key` repairs this, because it revokes the unseen key and issues a new one. The line does not tell the operator that.
- **Suggested fix:** after a send that started, say "the request may have been applied; run the same command again". The rotation calls are safe to repeat.

### A-LA-E5-05-02 — NIT — an audit event with no real change on every seed

- **File:** `services/lti-service/src/cli/bootstrap.ts` (`if (!created && input.name !== undefined) await client.request('PATCH', path, { name: input.name })`).
- **Problem:** `npm run seed` always passes `--name`, so every seed of an existing account writes `account.update`, even when the name is the same. This is not wrong (every CLI write is audited), but it adds noise to the audit log.
- **Suggested fix:** the CLI already reads the account with `GET`, so it can skip the `PATCH` when the name is equal.

## Checks that pass

| Item | Result |
| --- | --- |
| No secret in argv, env or logs (lens focus) | The CLI reads the operator key only from `LTI_OPERATOR_KEY_FILE` (default `/run/secrets/lti/lti-operator-key`) and sends it only in the `Authorization` header to the operator listener, with `redirect: 'error'`, so a redirect cannot carry the header elsewhere. A wildcard bind address maps to loopback, and the host and port are checked. Error lines never hold the key: `cliError` keeps the message, joins it to one line and drops the stack (mutant B8, multi-line output, is killed). The wrapper keeps the key in shell variables and passes files, never the value, on a command line. The new API key still reaches only stdout, and it goes to `node` on stdin (unchanged). |
| The key copy cannot leak or go stale (lens focus, BD-A2-34) | The copy goes to `infra/.secrets/lti/lti-operator-key` (the folder the `e2e` container cannot see, BD-A2-03). The write is `umask 077`, a temp file, `chmod 600`, then `mv`, inside a `0700` folder. A missing original deletes the copy at the start. If the database then says "operator key exists", the wrapper deletes the copy again and exits 1 with one line. `stack:reset` deletes the copy and keeps the key ring. Mutants B6 (stale copy kept) and B7 (copy not private) are each killed by the wrapper test. |
| Every CLI write is audited (lens focus) | `bootstrap.ts` and `shared-platform.ts` no longer open `lti.db`. Every change is an operator API call (account create or `PATCH`, API key issue, signing key retire, create and activate, shared platform), so the endpoints of LA-E5-04, LA-E5-07 and LA-E5-10 write the audit events with the operator of the key file. The only direct database write left is `lti:operator init` (LA-E5-01, out of scope). |
| API key rotation (lens focus, BD-A2-33) | `--rotate-api-key` is one `POST …/api-keys {…, revokeOthers: true}`: one server transaction revokes all active keys and issues the new one. So no sequence can leave an account with no key, or an old key alive after a success. With no active key, the CLI issues without `revokeOthers`. Mutant B1 (no `revokeOthers`) is killed. See A-LA-E5-05-01 for a lost answer. |
| Signing key rotation (BD-A2-14) | The steps: retire a waiting `next` key with `{immediate: true}`, create a key, then activate it with `{force: true}`; with no active key, create already activates (BD-A2-24). These are three calls, not one transaction, but no step leaves the account without an active key. A failure after the retire keeps the old active key. A failure after the create leaves a published `next` key, and a rerun removes it. A lost answer to the activate leaves a correct rotation. Mutants B2 (no retire) and B3 (no `force`) are each killed. |
| Failure paths are one line (lens focus) | A missing, malformed, unknown, expired or revoked operator key gives one line that names the file (the operator API answers `401` for all of these; mutant B4 is killed). An unreachable listener, invalid JSON and API refusals each give one line, and the process sets `exitCode = 1`. An unknown account on `lti:shared-platform` gives one line. |
| Behaviour kept | The stdout line keeps `{account, created, kid, apiKey}`; `apiKey` is `null` when unchanged. A second run without flags issues no API key. `--name` changes only when given (BD-A2-25; mutant B5 is killed). New accounts get today's URLs from `PUBLIC_APP_URL`. `lti:shared-platform` keeps `{platformId, created}`, with `created` from `201`. `--ensure-key-file`, `--quiet` and `init --if-none` keep their meaning. |
| Ownership | `http/operator/**`, `seed.sh` and the app files are untouched. The `stack-reset.sh` line is S1's own file (BD-A2-34 asks for it). |
