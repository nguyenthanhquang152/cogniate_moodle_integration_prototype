Verdict: CHANGES_REQUESTED
Round: 1

# LA-E1-06 review, lens A ("Is it right and is it safe?")

Reviewer: Reviewer-A2 (Claude Code Opus 5.5 xhigh, plan LD-22). Date: 2026-10-22.
Spec: `docs/architecture/ltiaas/tasks/LA-E1-06.md`. Design: LA-ADR-04 D4 (rules 1–6), D6, D8; data-model §2; LA-ADR-01 D7; BD-A1-11, BD-A1-12, BD-A1-17 (BD-A1-19 is not part of this diff).

Diff: `git diff dc67c14^1 dc67c14` (lane K commits `c330b38`, `df0b927`; 47 files).

Method: a throwaway `git archive dc67c14` copy under `/private/tmp`, with a clone of the integration `node_modules`. I ran the app, kernel and tracking unit tests, `eslint`, `tsc`, probes of the F5 rule and 12 mutants in that copy only. I used no Docker and no network. I did not change the integration worktree, except for this file.

## Summary

| Id | Severity | Topic |
| --- | --- | --- |
| A-LA-E1-06-01 | BLOCKER | The score-sync 409 text of Canvas and Blackboard rows changes from "Moodle" to the channel name. The G3 golden records "Moodle", and no `LA-IC` id covers the change. |
| A-LA-E1-06-02 | MINOR | No test pins the cleanup record kinds of a Canvas `add_deployment` attempt (2 mutants survive) |
| A-LA-E1-06-03 | NIT | The operator CLI binding line of a pending Blackboard connection with no attempt changes |
| A-LA-E1-06-04 | NIT | The learner label fallback changes from "Moodle" to the channel name |
| A-LA-E1-06-05 | NIT | The F5 rule `connection-lms` misses a comma join |

The four lens-A focus points pass: the backfill is complete, no read of `connection.lms` is left, cleanup cannot delete a target that is in use, and the migration is safe on a populated database (see "Checks that pass"). The BLOCKER is a one-token fix.

## Findings

### A-LA-E1-06-01 — BLOCKER — a golden text changes with no `LA-IC` id

- **File:** `services/cogniate-app/src/worker/score-sync.ts:81`.
- **Problem:** before the change, the 409 `lastError` text was `… (Moodle has a grade with a newer time)` for every row. Now it is `textName(row.channel)`, so a Canvas row says "Canvas" and a Blackboard row says "Blackboard". The results API shows this text (`scoreSyncs[].lastError`).
- **Evidence:** the golden `tests/ltiaas/golden/1b17261…/G3.json` has `(Moodle has a grade with a newer time)` at `canvas/publications/B-conflict/results/0/scoreSyncs/0/lastError` and at `blackboard/publications/B-conflict/results/0/scoreSyncs/0/lastError`. `lastError` is not on the golden drop list (`tests/ltiaas/golden/lib/normalize.mjs`, `DROP`). No `LA-IC` row in LA-ADR-04 D8 names this text. Mutant K10 (`textName(null)`, which keeps the old text for every row) passes all 367 app tests, so no Author test needs the new text.
- **Required outcome:** LA-ADR-04 D6: "The only allowed differences are the additive fields (`channel`, `channelName`, `channelCapabilities`) and the D8 items", and "A golden difference or a frozen-test failure without an id is a FAIL". So the G3 compare of this step's QA run will FAIL on two paths.
- **Suggested fix:** use `deps.channels.textName(null)`, the same neutral default that this diff already uses for the error pages. It keeps the old text with no LMS literal in core. The per-channel text belongs to LA-E4-03 (AC-01: "{LMS} has a grade with a newer time"), which needs its own change id. The other option: A1 adds an `LA-IC` for the text, and QA changes G3 by the LD-9 list.

### A-LA-E1-06-02 — MINOR — the cleanup kinds of a Canvas `add_deployment` attempt are not tested

- **File:** `services/cogniate-app/src/app/binding-cleanup.ts:52-62` (`attemptRecord(a, fence)`, `fenceRecords`), `:146` (revoke).
- **Problem:** the `fence` flag keeps today's record sets. Fence-out turns a Canvas `platform_deployment` attempt into the platform record, so one platform record remains after `dedupe`. Revoke cleanup turns it into the deployment record of that grant. No unit test pins either rule.
- **Evidence:** mutant K8 (fence-out without the flag, so extra deployment records) and mutant K11 (revoke treats `platform_deployment` as the platform) each pass all 367 tests. With K11, the ownership guard (`byThisGrant`) still protects the platform. But the revoked `add_deployment` grant's own staged deployment no longer gets its switch-off.
- **Suggested fix:** two unit cases: (1) suspend of a Canvas connection with an `initial` attempt and an `add_deployment` attempt fences one platform record; (2) revoke of an `add_deployment` grant switches off only its deployment.

### A-LA-E1-06-03 — NIT — the operator binding line of a pending Blackboard connection

- **File:** `services/cogniate-app/src/app/operator.ts:151`.
- **Problem:** `bindingOf` picks the Blackboard text only when a stored `shared_deployment` attempt exists. A Blackboard connection with a grant but no attempt now prints `Binding: blackboard: no platform id` in the `app:binding suspend` head. Before, it printed `Binding: Blackboard: no reservation`. No golden or test reads this line.
- **Suggested fix:** when no attempt exists, use the adapter's `sharingOf(c.profile)` (BD-A1-12: a binding that does not exist yet takes its kind from the adapter).

### A-LA-E1-06-04 — NIT — the learner label fallback

- **File:** `services/cogniate-app/src/domain/results.ts:56`.
- **Problem:** when the issuer is null or not a URL, the label is now `Learner … @ Canvas` or `@ Blackboard`, not `@ Moodle`. No golden or test has `@ Moodle` (I checked with `grep` over `tests/`), so this is not a failing compare today. If you want strict neutrality, use the fix of A-LA-E1-06-01 here too.

### A-LA-E1-06-05 — NIT — the F5 rule misses a comma join

- **File:** `infra/scripts/fitness/rules/connection-lms.mjs:46`.
- **Problem:** the table pattern needs `FROM`, `JOIN`, `UPDATE` or `INTO` directly before `connection`. Probe: `SELECT con.lms FROM resource_link rl, connection con WHERE …` at an app path gives 0 hits. `SELECT c.lms FROM connection c` gives 1 hit, and `g.lms` of `binding_grant` gives 0, as intended.
- **Suggested fix:** also accept `,` before `connection` in the table pattern.

## Checks that pass

| Item | Result |
| --- | --- |
| Migration 013 (lens focus) | Equal to the data-model §2 sketch, line for line. The backfill is complete: since `011`, `connection.lms` is `NOT NULL DEFAULT 'moodle'` with a CHECK on the three values, so `channel` is never NULL and `binding_authority` is always set. Native (T8) rows are `moodle` rows. `binding_attempt.connection_id` is a foreign key, so the subquery never gives NULL. Canvas `initial` → `exclusive_platform`, `add_deployment` → `platform_deployment`, Blackboard → `shared_deployment`. `bound_values` is NULL. |
| Populated database | `applyMigrations` runs each file and its ledger row in one transaction, so a failure rolls back. The unit test seeds 010, 011 and 012 schemas with old SQL (each LMS × 4 statuses, Canvas `initial` + `add_deployment`, Blackboard, the 5 attempt states). It checks that old values stay, the backfill values, the ledger, a second open with no change, that the source copy stays unchanged, and that a 012 build refuses the 013 ledger (AC-02). Mutants K6 (wrong `add_deployment` kind) and K7 (Blackboard `self`) are each killed. |
| No `connection.lms` reads (lens focus) | `git grep -w lms` over the app finds no product SQL that reads `connection.lms` outside the repository. Only the repository insert writes it. Routing (`findLaunchConnection`, `routeLaunch`) and the disabled rule use `binding_authority`. The tests set `lms` to the wrong class on purpose. Mutants K1, K2 (routing by channel) and K3 (disabled rule by channel) are killed. Writer rule 2: K4 and K5 are killed. A grant stores the channel id (rule 4). |
| Cleanup cannot delete a target in use (lens focus) | Release deletes only an owned exclusive platform (`owned` = the read ref is in this connection's history). Deployment records stay `kept_inactive` (mutant K9 is killed). Revoke cleanup still needs "ref written by this grant and no approval". `fenceRecords` from the attempts covers the old set: a grant connection gets `lti_platform_id` only at the commit of an exclusive attempt with the same platform id (`redemption.ts:392`, `setAttemptPlatform`), and a reservation is written together with its attempt (`redemption.ts:137`). |
| Other reads | The capability swaps equal the old LMS tests: `deployments.multiple` is Canvas only, `publish.createCourse` and `siteApi.token` are Moodle only, `launch.windowHint` is Canvas and Blackboard, and `launch.topLevelContinue` is Canvas only. App check 14 uses the `launch`-level guards (the same set as today). The text names on pages equal today's values. `escapeHtml` on names is added hardening. The `dueSyncs` inner join is safe: `resource_link.connection_id` is a `NOT NULL` foreign key, `foreign_keys = ON`, and no code deletes a connection. |
| Registry wiring (BD-A1-11) | One registry is loaded in `main.ts` and passed to the app listener, the worker and the content listener. `startService` builds the listeners in order, so `channels` is set before the content listener uses it. The operator CLI loads it once. |
| Ownership and "Must not edit" | `services/lti-service/**`, `apps/**`, `lti-profiles.ts` and the files of LA-E1-07 are untouched. `cli/{grant,binding,operator-runtime}.ts` are not in this task's "May edit" list, but they are lane K's files (epics §5 app row), and the new operator deps force the change. The Lead may note this. |
| Build and tests | On the `dc67c14` tree: the app, kernel and tracking unit tests give 457 passed and 2 skipped. `eslint` exits 0, and `tsc` for the app exits 0. |
