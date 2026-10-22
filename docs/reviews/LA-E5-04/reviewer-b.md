Verdict: APPROVE
Round: 1

# LA-E5-04 review, Reviewer-B2 (lens: "Can a human team own it?")

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22). Diff: `git diff a00c090^1 a00c090` (the merge of lane S1 for LA-E5-04, with the RQ-2 commits `5a422c9` and `1f860ad`). Spec: `docs/architecture/ltiaas/tasks/LA-E5-04.md`. Design: LA-ADR-06 D2, D7 "First key"; LA-ADR-05 D7; LA-ADR-07 D1; contract delta §1.3, §1.5, §3, §5; operability §8; BD-A2-07, BD-A2-12. I did not open any reviewer-a file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 2 MINOR, 3 NIT.**

The tenant model reads well. Each part is in its own small module: the resolver is 21 lines, the validation 24 lines, and the shared-platform rules 37 lines, which the operator endpoint and the old CLI now share. The store has one function per operation. `requireWritableAccount` is the one BD-A2-12 guard: the route calls it, and the store calls it again inside the write transaction. The routes, bodies, codes and audit actions equal contract delta §3 and §5. Operability §8 ("suspend, undo with active, close is final") matches what the API does. The tests read like the AC list. Each test name says what it proves, and the failure cases use `it.each` with the bad value in the name. My findings are about what the `400` answers tell an operator, and about the meaning of `claimPolicy: null`.

## How I checked

- Scratch clone of `a00c090` in a private `/tmp` folder (`git clone --no-hardlinks`, `node_modules` copied). The shared LA worktree did not change.
- `vitest run` on `services/lti-service/src/{accounts,http,store,cli,jobs}`: **28 files, 358 tests passed**.
- Operator probe through `buildOperatorApp` (a temporary test file, deleted after the run). I ran create with a bad id, create with a fragment in `launchUrl`, create, PATCH with a content-host URL, `publicBaseUrl`, `status: "paused"`, close, PATCH after close, shared platform after close, and GET. I recorded each body and the log lines.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | No change to `lti/**`, `routes/protocol.ts` or `routes/registration.ts`. The `store/tool-keys.ts` change is the RQ-2 commit `5a422c9` (`createFirstToolKey`, BD-A2-07). The S2 fixture change is `1f860ad`. `http/auth.ts`, `api-errors.ts`, `main.ts` and `http/operator/index.ts` are S1 files in B1. One more S2 file changes outside the named RQ commits: `http/operator/signing-keys.test.ts` gets `urls: URLS` in its two `buildOperatorApp` calls, because `OperatorDeps.urls` is now required. That edit is mechanical; the Lead records it. |
| Ownership | Lane S1, B1. OK, with the note above. |
| No behaviour change outside the spec | The `/api/*` gate adds `403 TOOL_ACCOUNT_SUSPENDED` after authentication, and a closed account's key now fails as an invalid credential (AC-05, AC-08). The CLI `lti:shared-platform` keeps its rules (see the text note in B-LA-E5-04-05). OK. |
| No LMS name in core | The added non-test lines contain no LMS word. OK. |
| UNIT ACs fail on the old behaviour | AC-10 (`resolver.test.ts`, byte-for-byte URLs), AC-11 (`accounts/migration.test.ts` on an M1 schema with migrations `< 005`), AC-12 (`store/accounts.test.ts`, the hash of the spied `randomBytes(32)` and two different hashes). The old tree has no resolver, no `createAccount` and no new columns, so each test fails there. OK. |
| Design notes | Before LA-E5-07, close replaces `api_key_hash` (`store/accounts.ts:87`). A later change gives `409 ACCOUNT_CLOSED`. `account.status` and `account.update` are separate actions. The bootstrap keeps the `PUBLIC_APP_URL` tool URLs. The first key is prepared before `audit.change`, and an audit failure rolls back the account and the key (`accounts.test.ts:52-64`). OK. |
| Account lifecycle from the API alone | Create, read, list, suspend, resume, close and the closed-account refusals work, with clear `409` texts. Purge is out of scope (LA-E5-20, Should). The `400` texts are the gap (B-LA-E5-04-01). |

## Findings

### B-LA-E5-04-01 — MINOR — Every `400` names the field but not the rule, so the operator must guess what is wrong

- **File:** `services/lti-service/src/http/operator/accounts.ts:32`, `:48`, `:70` (`invalid(parsed.error)`); `services/lti-service/src/accounts/validation.ts:17` (`refine` without a message); `services/lti-service/src/http/validation.ts:16` (the shared helper keeps only the path).
- **Problem:** The account fields have exact rules: id `^[a-z0-9][a-z0-9-]{0,62}$`; tool URLs https, no user info, no fragment, at most 2,048 characters, not on the LTI or content host; `publicBaseUrl` only `null` in LA; `status` one of three values. The operator sees only `Invalid field: <name>.` A URL can fail for five different reasons, and the answer does not say which one.
- **Evidence:** Probe bodies, all `400 INVALID_REQUEST`:
  - `"Invalid field: id."` for `Tenant_1`;
  - `"Invalid field: launchUrl."` for `https://tool.test/l#x` and for a URL on the content host;
  - `"Invalid field: publicBaseUrl."` for `https://t.test`;
  - `"Invalid field: status."` for `paused`.
- **Suggested fix:** Keep the field name (AC-03 and AC-04 need it), and add the rule. Give `toolUrlSchema` a refine message, and add one map from field to rule sentence in the account route. For example: `launchUrl must be an https URL without user info or fragment, at most 2048 characters, not on the LTI or content host`; `publicBaseUrl must be null (host mode is not available)`; `status must be active, suspended or closed`; `id: 1 to 63 characters a-z, 0-9 and '-', starting with a letter or digit`. `invalid()` is shared, so change only this route group, or give `invalid()` an optional rule map.

### B-LA-E5-04-02 — MINOR — `claimPolicy: null` means "passthrough" (keep every claim), but the code does not say so, and an operator can set it on a new account

- **File:** `services/lti-service/src/store/accounts.ts:27-28`, `:63`, `:84`; `services/lti-service/src/http/operator/accounts.ts:21`; design LA-ADR-05 D7 rows "Privacy floor" and "Defaults".
- **Problem:** LA-ADR-05 D7 says that `null` is the default of the existing accounts and means `passthrough` (keep every claim). New accounts get `allowlist` with every `keep` off (privacy by default, LA-H4). In the code:
  - The allowlist object is called `DEFAULT_CLAIM_POLICY`, and nothing near it says that `null` means the least private mode.
  - Both `POST` and `PATCH` accept `claimPolicy: null` (`.nullable()`), and `createAccount` stores it (`:63`). An operator who sends `null` to "clear" or "reset" the policy turns on passthrough without writing that word.
  - LA-E3-10 must then decide whether `null` on a new account is passthrough or not. BD-A2-21 limits that meaning to "existing accounts".
- **Evidence:** `accounts.test.ts:109` sets `{limits: null, claimPolicy: null}` with `200`. `toAccount` returns `null`, so GET shows `null` for a new account after that call, and also for `cogniate` after the migration.
- **Suggested fix:** Route to A2 before LA-E3-10. A suggested rule: `null` is only the migration value of old rows, and the API refuses `claimPolicy: null` on `POST` and `PATCH` (`400`, "send an explicit policy; passthrough is {mode: 'passthrough', …}"). In any case, add one comment at `:27-28`: "null = passthrough, the value of accounts from before LA (LA-ADR-05 D7 'Defaults'); new accounts get DEFAULT_CLAIM_POLICY."

### B-LA-E5-04-03 — NIT — A final close is one field in a general `PATCH` (route to A2)

- **File:** `services/lti-service/src/http/operator/accounts.ts:63-77`; contract delta §3 row `PATCH /operator/v1/accounts/:id`.
- **Problem:** `{status: "closed"}` cannot be undone. It revokes every key of the tenant at once, and the purge (LA-E5-20) later deletes its data. It goes through the same `PATCH` as a rename, with no confirmation. A script that copies a body or a value can end a tenant. The contract decided this form, so this is not an Author defect.
- **Suggested fix:** A2 can consider a confirm field (`{status: "closed", confirm: "<account id>"}`, else `400`) or a separate `POST …/close`. If A2 keeps the form, operability §8 can say "GET the account first and check the id".

### B-LA-E5-04-04 — NIT — Close looks up `sqlite_master` at run time to find LA-E5-07's future table, and the test builds a fake copy of that table

- **File:** `services/lti-service/src/store/accounts.ts:88-91`; `services/lti-service/src/http/auth.test.ts:39-80`.
- **Problem:** The code checks at run time whether a table from a later task exists. This line becomes dead code when LA-E5-07 lands. It is also a SQLite-only catalog query in runtime SQL (LA-ADR-06 D13 rule 2). The test makes a two-column `api_key` table by hand to reach the branch, so the test fixes a guess of LA-E5-07's schema. The same test checks five things (suspend, bad credentials, tenant isolation, resume, close with rollback).
- **Suggested fix:** Put "remove the `sqlite_master` check; revoke `api_key` rows with a plain UPDATE" into the LA-E5-07 scope (the Lead routes it). Split the auth test into named cases ("suspended account: 403 for every scheme", "close revokes every key in one transaction", …).

### B-LA-E5-04-05 — NIT — The CLI lost the account id from its error, and the first signing key logs no `signing_key_changed`

- **File:** `services/lti-service/src/cli/shared-platform.ts:21-29` (old text at `a00c090^1:…/shared-platform.ts:22`); `services/lti-service/src/http/operator/accounts.ts:53-58`; contract delta log table (`signing_key_changed`: "create, activate, retire, remove").
- **Problem:** The CLI used to print `Unknown tool account: <id>.`. It now prints the shared `Unknown tool account.`, which is less useful in a script that loops over accounts. Account create makes the first active signing key, and the audit event holds `details.kid`. But the log has no `signing_key_changed` line for it, so a log search for a tenant's key history starts at its second key.
- **Suggested fix:** Pass the id in the `NOT_FOUND` description (`Unknown tool account: ${id}.`) in `requireWritableAccount`, or in the CLI wrapper. Log `signing_key_changed {tool_account_id, kid, status: 'active'}` after the account create commits.

## Not checked

- K1-SIM ACs (AC-01..09) and the M1 `sim` phase (QA).
- Lens-A items: the races between the preflight reads (`getAccount` before `audited`) and the transaction, the URL host comparison, and the status-gate order for each scheme beyond the unit test.
