Verdict: CHANGES_REQUESTED
Round: 1

## Round 1

Reviewer: Codex GPT-6-Astra, xhigh, 2026-10-23. Lens B: can a human team own it? Scope: merge `81d3a8f4`, including `13c20ad0`, and QA probe paths `b885fb95`; tested at `5c0911cf3726196fe5232a1db76edecf2f4b2240`. Read the task spec, BD-A2-96, LA-ADR-06 D4/D13, ownership matrix §5, and plan §6.1. No Reviewer-A file was opened.

One BLOCKER finding; no other findings.

### B-LA-E5-23-01 — BLOCKER — Complete the boundary guard for AC-01

**File:** `services/lti-service/src/store/port-boundary.test.ts:15` (also `:34`, `:45`, and `:77`).

**Problem:** AC-01 explicitly includes `afterCommit` among the calls that must stay inside `store/**` or `db/**`, but the scanner never recognizes it. Its import-alias set covers only `transaction`, and its member-call check covers only `prepare`, `transaction`, and `exec`. The negative test exercises snippets directly, so it does not establish that each prohibited call fails through the actual file walk. This leaves a required part of the boundary unenforced by `npm run check`.

**Evidence:** In the private clone, I planted this production file at `services/lti-service/src/http/reviewer-b-boundary-probe.ts`:

```ts
import { afterCommit as committed } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
export function probe(db: Db) { committed(db, () => undefined); }
```

All **four boundary tests passed**, exit 0. A control file with `db.prepare('SELECT 1').get()` failed the real scan and named the scratch path, so the problem is the missing call detection. A second probe using `import * as accounts from '../store/accounts.ts'` and `accounts.getAccount(db, 'unit')` also passed: `sqliteImports` handles named imports only, leaving a common way to bypass the intended private adapter. The current production scan is clean; these probes show that the regression guard permits forbidden access to return.

**Suggested fix:** Detect direct, aliased, and member access to `afterCommit`, and cover namespace imports of synchronous adapter functions. Add negative cases through the file-selection and scan path, with scratch production paths outside both allowed directories, so omissions in either detection or exclusions fail the suite. Keep the type-import, regex, test, and testkit controls. BLOCKER follows charter §5 because the specified AC-01 check is incomplete.

### Checks and scope

The port has a clear area map in `store/port.ts`, one SQLite composition point in `store/sqlite.ts`, and named compound operations in `store/audited-operations.ts`. `storeFor` accepts an injected `LtiStore`; the resolver test proves this without an open database handle. The index records all four LG process states. These give a future adapter author a concrete starting point and method surface.

Audited operations preserve the synchronous change, state-based action, audit insert, and commit callback boundary. Route error mapping remains outside those operations, so domain failures still become the existing API refusals. Existing tests cover the account action chosen under the write lock, refused events, audit rollback, registration caps, and key changes. The new port test checks account/first-key rollback and observation after commit. Moving those writes before `audit.change` in a private mutation made that test fail because the account remained stored; the mutation was restored.

An AST comparison of production `prepare`/`exec` arguments found the SQL text unchanged after whitespace normalization, with the duplicate job-lease query consolidated into `acceptJob`. Nine relocated job/sealed-column module bodies match after imports and whitespace are removed; shared-platform code only adds an exported input type. Audit deletion has its own store module, and the F5 allowance and QA probe paths follow it.

Verification used fresh private clone `/tmp/la-review-b-dc66d95c1d77` with its own `npm ci`; the Vitest cache was deleted before every run. **1,306 tests passed across all 96 LTI unit files**. LTI typecheck, ESLint on all 95 changed files, F1, and F5 passed. Five independent SQL-portability and audit-path controls passed, including rejection of `rowid` and deletion from the old job path. AC-02 and AC-03 have coverage; AC-01 needs the correction above. All scratch files and product mutations were removed, and the private clone is clean.

The changes respect the S2 B4 window and the named P/QA allowances. Applied migrations and the shared migration helper are unchanged; no production core LMS name was added. AC-04, frozen wire bytes, and full R2/R3 stack regressions remain with QA. No Docker, stack, or commit was used. Only this review file changed in integration.
