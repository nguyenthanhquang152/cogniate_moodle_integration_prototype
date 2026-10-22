Verdict: APPROVE
Round: 1

## Round 1

Reviewer-A: Codex GPT-6-Astra, xhigh. Date: 2026-10-23 (+07).

Reviewed `70c279c`, the four RQ-2 route log changes in `2336df0`, and tests in `d10ce87` (merge `1e65040`). Test snapshot: `1207ed962c853a14a2f3501d976023613abf29c4`. No earlier Reviewer-A file existed. Review was blind.

Basis: LA-E5-18; LA-ADR-06 D10; operability §4.1; the dispatch's stored-row rule, including suspended and closed accounts; plan §6.1 and ownership matrix §5.

### Findings

None. No open BLOCKER, MAJOR, MINOR or NIT.

### Checks

- The account resolver validates the account id and reads its stored row before `tenantLogIds` is set. An unknown account gives no id field. Suspended and closed accounts keep their stored id, as the dispatch requires, and fail before platform work.
- Login platform lookup includes the account. Launch state and storage-check consumption also include the account; the later platform lookup uses that same account. No call site builds log ids from token claims or raw path values.
- The failure result exposes only optional account and platform ids in `logIds`. The route copies those fields explicitly with the existing safe error fields. Accepted results carry the resolved account id; both browser bindings use the same completion path and route logger.
- Accepted, failed and minimized-claim lines keep their old fields and add the intended ids. Unknown-account lines retain the exact old field set. Existing `binding` values remain intact. The family-guard line names the same account as its platform.
- The named changes stay in L2 files and the explicitly granted four lines of L's `http/routes/protocol.ts`. They do not edit `http/app.ts`, `http/auth.ts`, `store/**`, `tests/**` or frozen assertions. They add no LMS name to core paths and change no protocol decision or response.

### Verification

All commands ran in `/tmp/la-review-a-e518-b8df98892d77`, made with `git clone --no-hardlinks`, after `npm ci --ignore-scripts --no-audit --no-fund`.

| Check | Result |
| --- | --- |
| `vitest run` for `lti/login.test.ts`, `lti/launch.test.ts`, `lti/storage-check.test.ts`, `http/routes/protocol.test.ts` under `services/lti-service/src/` | 44 passed; no failures or skips |
| Three private cross-account probes plus `profiles/channel-registry.test.ts`, with its family-log assertion extended to require `tool_account_id` | 37 passed; no failures or skips |
| `tsc --noEmit -p services/lti-service/tsconfig.json` | PASS |

The three independent probes verify that another account's issuer/client pair, state, or storage-check token cannot add that account's platform id to a log. The state and storage-check probes also confirm that the owner's record remains unused. Their failure logs contain neither the supplied token nor the state/check value.

Negative controls, only in the private clone:

- Restore `protocol.ts` from `2336df0^`: 18 tests fail on the missing tenant fields; 14 pass.
- Add the raw account path as a fallback to `login_rejected`: both UNIT AC-04 cases fail on the extra field. AC-04 preserves old behaviour, so its exact-field assertions should pass the old logger; this mutant proves they reject the unsafe fallback.

Both mutations were removed. Logs: `/tmp/la-review-a-e518-baseline.log`, `/tmp/la-review-a-e518-probes-final.log`, `/tmp/la-review-a-e518-typecheck.log`, `/tmp/la-review-a-e518-before-route.log`, and `/tmp/la-review-a-e518-raw-path-mutant.log`. Extra probe code remains only in the private clone.

### Boundary

K1-SIM AC-01/02/03/05, the service-log hygiene scan and full regressions remain with QA. This approval covers the source change and host tests; it does not close those runtime gates. `http_request` privacy belongs to LA-E5-17 and is outside this task.

No Docker, stack or host stack runner was used. Only this review file was written in the integration worktree. No commit or push was made.
