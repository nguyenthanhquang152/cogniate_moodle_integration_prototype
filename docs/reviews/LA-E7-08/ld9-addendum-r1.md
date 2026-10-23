# LD-9 & Wave-End Test SHA Proposed Addendum R1 (`8ad12926` + `BD-A2-108`)

- **Author:** Lead QA (`task_6aae0ea0cac1` / `ctx_d1f5887e528a`), 2026-10-23
- **Base Frozen Gate Test SHA (`la-gate-test-8ad12926`):** `8ad1292687431b05bad6b5c070ab722e67714526` (active in `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end`)
- **Historical Unreviewed Amend Tag (`la-proposed-addendum-r1`):** `9e78fe3f87bd4672a9e37ace9efdacfd96f28474` (**NOT APPLIED**; `src-wave-end` is checked out at `8ad1292687431b05bad6b5c070ab722e67714526` with empty `git status --short`)
- **A2 Contract Decision (`BD-A2-108`, integration `1e8e1075`):**
  - `WE-F3` (`11-canvas-platforms.test.ts:247`): `?ref=` is always present (`32` random bytes base64url = `43` chars) for a Canvas dynamic create; the `LA-IC-14` addendum regex must **require** `?ref=[A-Za-z0-9_-]{43}$` (do not use `9e78fe3f`'s optional group as is).
  - `WE-F2` (`99-logs.test.ts:33`): `tool_account_id` stays on `launch_claims_minimized` (option b: every `launch_*` log line includes `tool_account_id`). Added below as Part 2 under **`LA-IC-22`** (`LA-ADR-04 D8`, integration `571ef1a7`).
  - `WE-F5` (`m1-migration.mjs:332`): Keep the runner path fix (`services/lti-service/src/store/migrations` → `services/lti-service/src/db/migrations`), keeping the ledger comparison exact.
  - `WE-F1`: Product fix in lane S1 (`admin` default `1200/min`, burst `600`, merged in `ecc19bbc`); the 9 rows rerun in the re-gate slot; no test change.

---

## 1. Part 1 — Historical Diff (`git diff 8ad1292687431b05bad6b5c070ab722e67714526 9e78fe3f87bd4672a9e37ace9efdacfd96f28474`) and `BD-A2-108` Required Form (`WE-F3`, `WE-F5`)

### 1.1 Historical `git diff 8ad12926 9e78fe3f` (for audit disclosure; Hunk 1 superseded by §1.2)

```diff
diff --git a/tests/acceptance/M1/canvas/11-canvas-platforms.test.ts b/tests/acceptance/M1/canvas/11-canvas-platforms.test.ts
index ef09c8f7..b3309c44 100644
--- a/tests/acceptance/M1/canvas/11-canvas-platforms.test.ts
+++ b/tests/acceptance/M1/canvas/11-canvas-platforms.test.ts
@@ -244,7 +244,7 @@ m1Test('M1-15.canvas.dynamic-refused', 'Canvas connection create accepts dynamic
   expectStatus(r, 201);
   assert.equal(r.json.status, 'pending');
   assert.equal(r.json.method, 'dynamic');
-  assert.match(String(r.json.registrationUrl ?? ''), /\/lti\/register\/cogniate$/);
+  assert.match(String(r.json.registrationUrl ?? ''), /\/lti\/register\/cogniate(\?ref=[A-Za-z0-9_-]+)?$/);
 });
 for (const [variant, body, status, code, detail] of [
   ['profile-mismatch', { profile: 'blackboard' }, 400, 'INVALID_REQUEST', ['field', 'profile']],
diff --git a/tests/host/m1-migration.mjs b/tests/host/m1-migration.mjs
index 2bc8e6b5..ddc459fc 100644
--- a/tests/host/m1-migration.mjs
+++ b/tests/host/m1-migration.mjs
@@ -329,7 +329,7 @@ export async function snapshotMigrationRun(r, { installTests, setup, probe, iden
   await stopServices(r);
   const newLedger = await volumeLedger(candidateLane);
   assertSnapshotBoundary(newLedger['cogniate-app/cogniate.db'], 'after');
-  const ltiMigDir = path.join(r.CLONE, 'services/lti-service/src/store/migrations');
+  const ltiMigDir = path.join(r.CLONE, 'services/lti-service/src/db/migrations');
   const appMigDir = path.join(r.CLONE, 'services/cogniate-app/src/domain/migrations');
   const expectedLtiLedger = fs.existsSync(ltiMigDir)
     ? fs.readdirSync(ltiMigDir).filter((n) => n.endsWith('.sql')).sort()
```

### 1.2 Proposed Addendum Diff for Part 1 (`WE-F3` per `BD-A2-108` + `WE-F5` Runner Fix)

Per `BD-A2-108`, `?ref=` is always present on a Canvas `dynamic` connection create (`32` random bytes base64url = `43` chars), so Hunk 1 must **require** `?ref=[A-Za-z0-9_-]{43}$` rather than `9e78fe3f`'s optional group:

```diff
diff --git a/tests/acceptance/M1/canvas/11-canvas-platforms.test.ts b/tests/acceptance/M1/canvas/11-canvas-platforms.test.ts
--- a/tests/acceptance/M1/canvas/11-canvas-platforms.test.ts
+++ b/tests/acceptance/M1/canvas/11-canvas-platforms.test.ts
@@ -244,7 +244,7 @@ m1Test('M1-15.canvas.dynamic-refused', 'Canvas connection create accepts dynamic
   expectStatus(r, 201);
   assert.equal(r.json.status, 'pending');
   assert.equal(r.json.method, 'dynamic');
-  assert.match(String(r.json.registrationUrl ?? ''), /\/lti\/register\/cogniate$/);
+  assert.match(String(r.json.registrationUrl ?? ''), /\/lti\/register\/cogniate\?ref=[A-Za-z0-9_-]{43}$/);
 });
 for (const [variant, body, status, code, detail] of [
   ['profile-mismatch', { profile: 'blackboard' }, 400, 'INVALID_REQUEST', ['field', 'profile']],
diff --git a/tests/host/m1-migration.mjs b/tests/host/m1-migration.mjs
--- a/tests/host/m1-migration.mjs
+++ b/tests/host/m1-migration.mjs
@@ -329,7 +329,7 @@ export async function snapshotMigrationRun(r, { installTests, setup, probe, iden
   await stopServices(r);
   const newLedger = await volumeLedger(candidateLane);
   assertSnapshotBoundary(newLedger['cogniate-app/cogniate.db'], 'after');
-  const ltiMigDir = path.join(r.CLONE, 'services/lti-service/src/store/migrations');
+  const ltiMigDir = path.join(r.CLONE, 'services/lti-service/src/db/migrations');
   const appMigDir = path.join(r.CLONE, 'services/cogniate-app/src/domain/migrations');
   const expectedLtiLedger = fs.existsSync(ltiMigDir)
     ? fs.readdirSync(ltiMigDir).filter((n) => n.endsWith('.sql')).sort()
```

---

## 2. Part 2 — `WE-F2`: `99-logs.test.ts` Test-Change List under `LA-IC-22` (`LA-ADR-04 D8`, integration `571ef1a7`)

Per `BD-A2-108` (`1e8e1075`) and `LA-IC-22` (`LA-ADR-04 D8`, integration `571ef1a7`), `tool_account_id` stays on `launch_claims_minimized` (option b: every `launch_*` event log line carries `tool_account_id`). Under **`LA-IC-22`** (plus `Reviewer-A` and `Reviewer-B` sign-off before a new gate test SHA is cut):

### 2.1 Proposed Test-Change List Entry (`LA-IC-22`)

- **Change ID:** `LA-IC-22` (`LA-ADR-04 D8`, integration `571ef1a7`)
- **Affected Frozen File:** `tests/acceptance/M1/common/99-logs.test.ts` (line 33)
- **Affected Manifest Case ID:** `M1-24.common.event-shapes` (base keys plus `platform_id`, `claims`, `tool_account_id`)
- **Contract Rule (`BD-A2-108`, `LA-ADR-04 D8`):** Every `launch_*` structured log line in `lti-service` (`launch_ok`, `launch_rejected`, `launch_claims_minimized`, `launch_unknown_claims_dropped`) includes `tool_account_id` so multi-account launch telemetry can be partitioned by tool account.

### 2.2 Proposed Diff for Part 2 (`WE-F2` under `LA-IC-22`)

```diff
diff --git a/tests/acceptance/M1/common/99-logs.test.ts b/tests/acceptance/M1/common/99-logs.test.ts
--- a/tests/acceptance/M1/common/99-logs.test.ts
+++ b/tests/acceptance/M1/common/99-logs.test.ts
@@ -30,7 +30,7 @@ m1Test('M1-24.common.event-shapes', 'new app and deployment events have exactly
       platform_created: ['info', ['platform_id', 'profile']],
       deployment_added: ['info', ['platform_id', 'deployment_id']],
       deployment_updated: ['info', ['platform_id', 'deployment_id', 'active', 'binding_generation']],
-      launch_claims_minimized: ['info', ['platform_id', 'claims']],
+      launch_claims_minimized: ['info', ['platform_id', 'claims', 'tool_account_id']],
     }],
     ['cogniate-app', {
       lti_app_launch_received: ['info', ['platform_id', 'deployment_id', 'user_sub', 'roles_count', 'context_id']],
```

---

## 3. Summary Table of All Addendum Items (`WE-F2`, `WE-F3`, `WE-F5`) and Non-Test Fix (`WE-F1`)

| Item | File & Line | Classification (`AC-LA-E7-08-05`) | Approval Gate | Reason & `BD-A2-108` Rule | Wave-End Evidence (Slot 3B on `8ad12926`) |
| --- | --- | --- | --- | --- | --- |
| **Part 1, Hunk 1 (`WE-F3`)** | `tests/acceptance/M1/canvas/11-canvas-platforms.test.ts:247` | **`LA-IC-14` test-change list item** (`tests/ltiaas/golden/expected/LA-IC-14.json` case `M1-15.canvas.dynamic-refused`) | **A2** confirmed (`BD-A2-108`); requires **Reviewer-A** and **Reviewer-B** approval before cutting new gate test SHA. | `POST /app-api/connections` with `lms: 'canvas', method: 'dynamic'` always generates a 43-char base64url `ref` token and returns `registrationUrl` ending with `/lti/register/cogniate?ref=<43-char-token>`. Regex must require `?ref=[A-Za-z0-9_-]{43}$`. | In `qalead-la-14`, `M1-15.canvas.dynamic-refused` returned HTTP `201` with `registrationUrl: 'https://lti.cogniate.test:9473/lti/register/cogniate?ref=oxrIscTpWfn3IswEx4JlHeH3kPzC_FuZL1lwYrNABeU'`, failing `/\/lti\/register\/cogniate$/`. |
| **Part 1, Hunk 2 (`WE-F5`)** | `tests/host/m1-migration.mjs:332` | **Runner change with no frozen assertion change** (`AC-LA-E7-08-05`: open-world candidate migration-ledger directory lookup in `snapshotMigrationRun`) | Confirmed by **A2** (`BD-A2-108`); requires **Reviewer-A** and **Reviewer-B** approval before cutting new gate test SHA. | `8ad12926` checked non-existent `services/lti-service/src/store/migrations` instead of `services/lti-service/src/db/migrations`, causing `expectedLtiLedger` to fall back to `oldLedger` (`001..004`) and fail exact ledger equality at line 340 before `M1-41.common.j-snapshot` at line 344. | In `qalead-la-12`, `M1-38.common.h1..h5` passed (`5/5 PASS`), `newLedger['lti-service/lti.db']` had all 21 SQL migrations (`001..021`), and line 340 threw `AssertionError` against the 4-item fallback `expectedLtiLedger`, leaving `M1-41.common.j-snapshot` not run. |
| **Part 2 (`WE-F2`)** | `tests/acceptance/M1/common/99-logs.test.ts:33` | **`LA-IC-22` test-change list item** (`M1-24.common.event-shapes`, `LA-ADR-04 D8`, integration `571ef1a7`) | **A2** (`BD-A2-108`) + **A1** (`LA-IC-22`, `571ef1a7`) confirmed; requires **Reviewer-A** and **Reviewer-B** approval before cutting new gate test SHA. | Every `launch_*` event log line in `lti-service` carries `tool_account_id`, so `launch_claims_minimized` has required fields `['platform_id', 'claims', 'tool_account_id']`. | In `qalead-la-14`, `M1-24.common.event-shapes` failed with `['claims', 'event', 'level', 'platform_id', 'service', 'tool_account_id', 'trace_id', 'ts']` vs expected without `'tool_account_id'`. |
| **No Test Change (`WE-F1`)** | None (product fix in lane **S1**) | **No test change** | Product fix in lane **S1** (`admin` default `1200/min`, burst `600`, merged in `ecc19bbc`); rerun in re-gate slot. | The 9 `HTTP 429 RATE_LIMITED` rows in `M1 sim` hit `lti-service` `class: "admin"` (`LA-E5-03`) default rate limit (`300/min`, burst `60`). | In `qalead-la-14`, `lti-service.jsonl` logged `event: "rate_limited", class: "admin", key_kind: "api_key", tool_account_id: "cogniate"` at `17:17:13.114Z`. |

---

## Round 2

- **Author:** Lead QA (`task_f58735a7596f` / `ctx_27248ee34e63`), 2026-10-23
- **Reviews Addressed:**
  - **Reviewer-A (`docs/reviews/LA-E7-08/ld9-addendum-r1-reviewer-a.md`, `CHANGES_REQUESTED`):**
    - **`A-LA-E7-08-01` (MAJOR):** Regenerated every hunk below using `git diff 8ad1292687431b05bad6b5c070ab722e67714526` in a private scratch clone of `src-wave-end` (`/Users/quangnguyen/cogniate-qa-runs/LA/GATE/scratch-addendum-r2`; `src-wave-end` itself was not touched and remains at `8ad1292687431b05bad6b5c070ab722e67714526` with empty `git status --short`). Verified that each individual hunk block and the combined 3-file diff block pass `git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end apply --check` with exit code `0`.
    - **`A-LA-E7-08-02` (MINOR):** Replaced the nonexistent event names in the `LA-IC-22` prose with the exact event names and `"when it is known"` qualification from `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` §6 (`:399`): `launch_check_failed`, `launch_accepted`, and `launch_claims_minimized` get `tool_account_id` when it is known (`LA-ADR-06 D10`; `BD-A2-108`). Kept `LA-IC-22`'s frozen-test change scope limited to the single `launch_claims_minimized` field addition at `tests/acceptance/M1/common/99-logs.test.ts:33`.
  - **Reviewer-B (`docs/reviews/LA-E7-08/ld9-addendum-r1-reviewer-b.md`, `APPROVE`):**
    - **`B-LA-E7-08-LD9-01` (MINOR):** Added the **Re-Gate Evidence Required (Slot 3C)** column to the Round 2 summary table (§R2.3), naming the exact complete suite run, required passing row IDs, candidate SHA, test SHA, and artifact records required to close each hunk (`WE-F3`, `WE-F5`, `WE-F2`) alongside the product fixes (`WE-F1`, `WE-F4`).

### R2.1 Regenerated Hunks Against `8ad1292687431b05bad6b5c070ab722e67714526` (Verified with `git apply --check`)

#### Hunk 1 — `WE-F3` (`LA-IC-14`, `tests/acceptance/M1/canvas/11-canvas-platforms.test.ts:247`)

```diff
diff --git a/tests/acceptance/M1/canvas/11-canvas-platforms.test.ts b/tests/acceptance/M1/canvas/11-canvas-platforms.test.ts
index ef09c8f7..22f05527 100644
--- a/tests/acceptance/M1/canvas/11-canvas-platforms.test.ts
+++ b/tests/acceptance/M1/canvas/11-canvas-platforms.test.ts
@@ -244,7 +244,7 @@ m1Test('M1-15.canvas.dynamic-refused', 'Canvas connection create accepts dynamic
   expectStatus(r, 201);
   assert.equal(r.json.status, 'pending');
   assert.equal(r.json.method, 'dynamic');
-  assert.match(String(r.json.registrationUrl ?? ''), /\/lti\/register\/cogniate$/);
+  assert.match(String(r.json.registrationUrl ?? ''), /\/lti\/register\/cogniate\?ref=[A-Za-z0-9_-]{43}$/);
 });
 for (const [variant, body, status, code, detail] of [
   ['profile-mismatch', { profile: 'blackboard' }, 400, 'INVALID_REQUEST', ['field', 'profile']],
```

#### Hunk 2 — `WE-F5` (`AC-LA-E7-08-05` Runner Path Fix, `tests/host/m1-migration.mjs:332`)

```diff
diff --git a/tests/host/m1-migration.mjs b/tests/host/m1-migration.mjs
index 2bc8e6b5..ddc459fc 100644
--- a/tests/host/m1-migration.mjs
+++ b/tests/host/m1-migration.mjs
@@ -329,7 +329,7 @@ export async function snapshotMigrationRun(r, { installTests, setup, probe, iden
   await stopServices(r);
   const newLedger = await volumeLedger(candidateLane);
   assertSnapshotBoundary(newLedger['cogniate-app/cogniate.db'], 'after');
-  const ltiMigDir = path.join(r.CLONE, 'services/lti-service/src/store/migrations');
+  const ltiMigDir = path.join(r.CLONE, 'services/lti-service/src/db/migrations');
   const appMigDir = path.join(r.CLONE, 'services/cogniate-app/src/domain/migrations');
   const expectedLtiLedger = fs.existsSync(ltiMigDir)
     ? fs.readdirSync(ltiMigDir).filter((n) => n.endsWith('.sql')).sort()
```

#### Hunk 3 — `WE-F2` (`LA-IC-22`, `tests/acceptance/M1/common/99-logs.test.ts:33`)

- **Change ID:** `LA-IC-22` (`LA-ADR-04 D8`, integration `571ef1a7`)
- **Affected Frozen File:** `tests/acceptance/M1/common/99-logs.test.ts` (line 33)
- **Affected Manifest Case ID:** `M1-24.common.event-shapes` (base keys plus `platform_id`, `claims`, `tool_account_id`)
- **Contract Rule (`docs/architecture/ltiaas/contracts/lti-service-api-delta.md` §6, `:399`; `LA-ADR-06 D10`; `BD-A2-108`):** `http_request`, `api_auth_failed` (when the path names the account), `login_rejected`, `launch_check_failed`, `launch_accepted`, and `launch_claims_minimized` get `tool_account_id` **when it is known** (every `launch_*` line). `LA-IC-22`'s frozen-test change scope is limited to adding `'tool_account_id'` to `launch_claims_minimized` at `tests/acceptance/M1/common/99-logs.test.ts:33`.

```diff
diff --git a/tests/acceptance/M1/common/99-logs.test.ts b/tests/acceptance/M1/common/99-logs.test.ts
index 3c49d0b1..955fc549 100644
--- a/tests/acceptance/M1/common/99-logs.test.ts
+++ b/tests/acceptance/M1/common/99-logs.test.ts
@@ -30,7 +30,7 @@ m1Test('M1-24.common.event-shapes', 'new app and deployment events have exactly
       platform_created: ['info', ['platform_id', 'profile']],
       deployment_added: ['info', ['platform_id', 'deployment_id']],
       deployment_updated: ['info', ['platform_id', 'deployment_id', 'active', 'binding_generation']],
-      launch_claims_minimized: ['info', ['platform_id', 'claims']],
+      launch_claims_minimized: ['info', ['platform_id', 'claims', 'tool_account_id']],
     }],
   ] as [string, Record<string, [string, string[]]>][]) {
     const log = readLog(service); assert.deepEqual(log.badLines, []);
```

### R2.2 Combined 3-File Addendum Patch (`git diff 8ad1292687431b05bad6b5c070ab722e67714526`)

```diff
diff --git a/tests/acceptance/M1/canvas/11-canvas-platforms.test.ts b/tests/acceptance/M1/canvas/11-canvas-platforms.test.ts
index ef09c8f7..22f05527 100644
--- a/tests/acceptance/M1/canvas/11-canvas-platforms.test.ts
+++ b/tests/acceptance/M1/canvas/11-canvas-platforms.test.ts
@@ -244,7 +244,7 @@ m1Test('M1-15.canvas.dynamic-refused', 'Canvas connection create accepts dynamic
   expectStatus(r, 201);
   assert.equal(r.json.status, 'pending');
   assert.equal(r.json.method, 'dynamic');
-  assert.match(String(r.json.registrationUrl ?? ''), /\/lti\/register\/cogniate$/);
+  assert.match(String(r.json.registrationUrl ?? ''), /\/lti\/register\/cogniate\?ref=[A-Za-z0-9_-]{43}$/);
 });
 for (const [variant, body, status, code, detail] of [
   ['profile-mismatch', { profile: 'blackboard' }, 400, 'INVALID_REQUEST', ['field', 'profile']],
diff --git a/tests/acceptance/M1/common/99-logs.test.ts b/tests/acceptance/M1/common/99-logs.test.ts
index 3c49d0b1..955fc549 100644
--- a/tests/acceptance/M1/common/99-logs.test.ts
+++ b/tests/acceptance/M1/common/99-logs.test.ts
@@ -30,7 +30,7 @@ m1Test('M1-24.common.event-shapes', 'new app and deployment events have exactly
       platform_created: ['info', ['platform_id', 'profile']],
       deployment_added: ['info', ['platform_id', 'deployment_id']],
       deployment_updated: ['info', ['platform_id', 'deployment_id', 'active', 'binding_generation']],
-      launch_claims_minimized: ['info', ['platform_id', 'claims']],
+      launch_claims_minimized: ['info', ['platform_id', 'claims', 'tool_account_id']],
     }],
   ] as [string, Record<string, [string, string[]]>][]) {
     const log = readLog(service); assert.deepEqual(log.badLines, []);
diff --git a/tests/host/m1-migration.mjs b/tests/host/m1-migration.mjs
index 2bc8e6b5..ddc459fc 100644
--- a/tests/host/m1-migration.mjs
+++ b/tests/host/m1-migration.mjs
@@ -329,7 +329,7 @@ export async function snapshotMigrationRun(r, { installTests, setup, probe, iden
   await stopServices(r);
   const newLedger = await volumeLedger(candidateLane);
   assertSnapshotBoundary(newLedger['cogniate-app/cogniate.db'], 'after');
-  const ltiMigDir = path.join(r.CLONE, 'services/lti-service/src/store/migrations');
+  const ltiMigDir = path.join(r.CLONE, 'services/lti-service/src/db/migrations');
   const appMigDir = path.join(r.CLONE, 'services/cogniate-app/src/domain/migrations');
   const expectedLtiLedger = fs.existsSync(ltiMigDir)
     ? fs.readdirSync(ltiMigDir).filter((n) => n.endsWith('.sql')).sort()
```

### R2.3 Round 2 Summary Table & Re-Gate Evidence Per Hunk (`B-LA-E7-08-LD9-01`)

| Item | File & Line | Classification (`AC-LA-E7-08-05`) | Contract / Runner Rule | Re-Gate Evidence Required in Slot 3C (`src-wave-end-2`, Recording Candidate SHA, Test SHA & Artifact Path) |
| --- | --- | --- | --- | --- |
| **Hunk 1 (`WE-F3`)** | `tests/acceptance/M1/canvas/11-canvas-platforms.test.ts:247` | **`LA-IC-14` test-change list item** (`M1-15.canvas.dynamic-refused`) | `POST /app-api/connections` (`lms: 'canvas', method: 'dynamic'`) always returns `registrationUrl` ending with `/lti/register/cogniate?ref=<43-char-base64url>` (`BD-A2-108`). | Complete `M1 --phase sim --provider all` run (`qalead-la-40`, `394/394` manifest rows `PASS`), proving **`M1-15.canvas.dynamic-refused` = `PASS`** in `m1-case-results.json` and `summary.json`. |
| **Hunk 2 (`WE-F5`)** | `tests/host/m1-migration.mjs:332` | **Runner change with no frozen assertion change** (`AC-LA-E7-08-05`: candidate migration-ledger lookup in `snapshotMigrationRun`) | Reads `services/lti-service/src/db/migrations` (`21` SQL files `001_init.sql`..`021_registration_token_kind.sql`) and keeps `assert.deepEqual(newLedger['lti-service/lti.db'], expectedLtiLedger)` exact (`BD-A2-108`). | Complete `M1 --phase snapshot-upgrade --provider all` run (`qalead-la-41`), proving **all `6/6` manifest rows `PASS`** (`M1-38.common.h1..h5` and host qualification row **`M1-41.common.j-snapshot`** in `m1-case-results.json`, `0` `ERROR` rows in `summary.json`) and exact candidate migration-ledger equality. |
| **Hunk 3 (`WE-F2`)** | `tests/acceptance/M1/common/99-logs.test.ts:33` | **`LA-IC-22` test-change list item** (`M1-24.common.event-shapes`, `LA-ADR-04 D8`, `571ef1a7`) | Per `contracts/lti-service-api-delta.md` §6 (`:399`), `launch_check_failed`, `launch_accepted`, and `launch_claims_minimized` get `tool_account_id` when it is known (`LA-ADR-06 D10`, `BD-A2-108`). | Complete `M1 --phase sim --provider all` run (`qalead-la-40`, `394/394` manifest rows `PASS`), proving **`M1-24.common.event-shapes` = `PASS`** in `m1-case-results.json` and `summary.json` (and `0` `ERROR` rows). |
| **Product Fix (`WE-F1`)** | No test change (lane **S1** `ecc19bbc`) | **No test change** | `lti-service` `class: "admin"` default raised to `1200/min`, burst `600` (`BD-A2-108`, `ecc19bbc`). | Complete `M1 --phase sim --provider all` run (`qalead-la-40`, `394/394` `PASS`), proving all **9 `WE-F1` rows `PASS`** (`M1-13.blackboard.inactive`, `M1-25.blackboard.site-metadata`, `M1-14.blackboard.claims`, `M1-36.blackboard.{origin,path,query,encoded-dot,encoded-slash}`, `M1-08.canvas.login-redirect`). |
| **Product Fix (`WE-F4`)** | No test change (lanes **R** and **S1**, `BD-A2-109`) | **No test change** | Stop-order fix in `cogniate-app` / `lti-service` (`BD-A2-109`) so `m1-restart cogniate-app` during an in-flight dead-handler lease does not stall `76.4 s` (Slot 7 baseline on `1b17261` was `8.2–8.4 s`, `7/7 PASS`). | Complete `M1 --phase sim --provider all` run (`qalead-la-40`, `394/394` `PASS`), proving all **7 `WE-F4` rows `PASS`** (`M1-37.blackboard.{d,o,v5}`, `M1-37.canvas.{d,s-dead,v4,v6}`) with `m1-restart cogniate-app` wall times recorded from `host-actions/*.json`. |

