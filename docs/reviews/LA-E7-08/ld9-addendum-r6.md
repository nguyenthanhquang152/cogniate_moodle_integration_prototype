# LA-E7-08 LD-9 Addendum (r6): Docker Desktop 4.96.3 Client Identity Binding (`BOUND_IDENTITY`)

- **Task**: `LA-E7-08` (LD-9 interface-change addendum r6 — Docker client and Compose plugin identity binding after the `2026-10-24T09:19–09:20Z` Docker Desktop 4.96.3 update)
- **Date**: `2026-10-24`
- **Author**: QA-3
- **Base commit**: `la-final-test-1` (`85ddf97332063f75bdc5636cb410fc0d6ee25099` in `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1`)
- **Scratch clone**: `/Users/quangnguyen/cogniate-qa-runs/LA/ld9-addendum-r6/src-scratch` (`git clone --no-hardlinks` of `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1` at `la-final-test-1`; `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1` was not modified)
- **Patch artifact**: `/Users/quangnguyen/cogniate-qa-runs/LA/ld9-addendum-r6/ld9-addendum-r6.patch` (`SHA-256`: `051af77f1aa074e328d879a576435ba9848daaeffed222c6e7a39663f83eff2e`)
- **Item type**: `environment identity change; BD-A1-120; BD-A2-113; no LA-IC` (listed in `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` D8 `"Not LA changes"` note and `docs/architecture/adr/ADR-012-sqlite-volume-storage.md` §17 `"G-1 result 2"`)
- **Prior LD-9 records**: `docs/reviews/LA-E7-08/qa.md` §4, `docs/reviews/LA-E7-08/ld9-addendum.md` (r1), `docs/reviews/LA-E7-08/ld9-addendum-r2.md` (r2), `docs/reviews/LA-E7-08/ld9-addendum-r3.md` (r3), `docs/reviews/LA-E7-08/ld9-addendum-r4.md` (r4), and `docs/reviews/LA-E7-08/ld9-addendum-r5.md` (r5)

---

## 1. Item Type, Governance Classification, and Reason

### 1.1 Item Type and Governance Classification

| Field | Value |
|---|---|
| **Item type** | `environment identity change; BD-A1-120; BD-A2-113; no LA-IC` |
| **Build decisions** | `BD-A1-120` (`docs/architecture/ltiaas/build-decisions-A1.md`), `BD-A2-113` (`docs/architecture/ltiaas/build-decisions-A2.md`) |
| **LA-ADR-04 reference** | `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` §D8 `"Not LA changes"` note: host/client identity re-bindings under `ADR-012` §17 are environment identity changes, not `LA-IC` interface changes |
| **ADR-012 reference** | `docs/architecture/adr/ADR-012-sqlite-volume-storage.md` §17 `"G-1 result 2"` (client-group identity binding and G-1 diagnostic re-verification when the host OS, Docker CLI, or Docker Compose plugin binary changes) |
| **Files changed (relative to `la-final-test-1`)** | `tests/host/storage-docker.mjs` (`:173–177`, `BOUND_IDENTITY`) and `tests/host/storage-docker.selftest.mjs` (`:100–110`, `A-S-14` unit self-test constants) |

### 1.2 Reason for the Change

1. **Docker Desktop automatic update (`2026-10-24T09:19–09:20Z`)**:
   - Between `09:19Z` and `09:20Z` on `2026-10-24`, Docker Desktop on the QA host updated to **Docker Desktop 4.96.3**, replacing the two client binaries under `/Applications/Docker.app/Contents/Resources/`:
     - **Docker CLI (`/Applications/Docker.app/Contents/Resources/bin/docker`)**:
       - Previous bound identity (`la-final-test-1`): version `29.9.1`, `SHA-256` `678271184175b40dfc4bd6f4582be00ae1538b0d1e031181f52ceedfae9af5fb`
       - New host identity: version `29.9.2`, `SHA-256` `6bbc39e9f2950720216f64c22d6e38afdd86a4672eee0d4e4389263c40ebd3e3`
     - **Docker Compose CLI plugin (`/Applications/Docker.app/Contents/Resources/cli-plugins/docker-compose`)**:
       - Previous bound identity (`la-final-test-1`): version `5.6.0`, `SHA-256` `1ec06408b809655f1d60659000173edaa412eab5359035f87833065883bbf605`
       - New host identity: version `5.6.1`, `SHA-256` `31664b8ce83f3900ed3c52b8c2276706832793a0a379d9661defd6f88b386def`
   - The macOS version (`27.0.1`) and architecture (`arm64`) did not change.
2. **Effect on `M1` (`G1-IDENTITY`)**:
   - `tests/host/storage-docker.mjs:173` defines `BOUND_IDENTITY` (`A-S-14`, `ADR-012` §17). Every `M1` storage runner executes `G1-IDENTITY` first and compares `readClientIdentity()` against `BOUND_IDENTITY`.
   - After the `09:19–09:20Z` update, `BOUND_IDENTITY` in `la-final-test-1` mismatched on `cli.version`, `cli.sha256`, `compose.version`, and `compose.sha256`, stopping every `M1` runner at `G1-IDENTITY` (`BLOCKED`) as designed by `ADR-012` §17 until the G-1 client-group diagnostic was re-run and `BOUND_IDENTITY` was updated.

---

## 2. G-1 Author Diagnostic Reports and SHA-256 Verification

Per `ADR-012` §17 (`"G-1 result 2"`), the G-1 client-group diagnostic and the 30-second orphan-hold diagnostic were run against the new Docker CLI `29.9.2` and Compose plugin `5.6.1` before re-binding `BOUND_IDENTITY`. Both diagnostic reports passed:

| Diagnostic Run | Public Report Path | Verified `SHA-256` | Result Summary |
|---|---|---|---|
| **G-1 client-group diagnostic (`10:37Z`)** | `/Users/quangnguyen/cogniate-author-diag/client-group-20261024T1037Z/public/AUTHOR-DIAGNOSTIC-client-group.md` | `38b98da6b576c0b3e63395c0d115143745193d5f19959be684192efdaf8aa283` | **G-1 Result 2 (`PASS`)**: `docker compose run --rm` and `docker run --rm` stay in the caller's process group (`pgid == Subshell PGID`) under both `/bin/sh` (`set +m`) and `/bin/bash` (`set +m`); after `kill -KILL` of the subshell leader, the orphaned client keeps the same `PGID` while the container runs; `LC_ALL=C ps -A -o pid= -o pgid=` detects it. |
| **G-1 30s orphan-hold diagnostic (`10:38Z`)** | `/Users/quangnguyen/cogniate-author-diag/client-group-30s-20261024T1038Z/public/AUTHOR-DIAGNOSTIC-client-group-30s.md` | `ebfbcd14c09f790979faacf947c553c77f53b132190340cb85b7501f8be2da48` | **G-1 Result 2 (`PASS`, 30s hold)**: `docker compose run --rm -T ... sh -c 'sleep 30'` keeps the subshell `PGID` for the full 30 seconds (`t+2s` and `t+15s` probes both show the orphaned client alive in the subshell `PGID`) after `kill -KILL` of the subshell leader. |

### Bound Identity Table (Before vs. After)

| Identity Field | `la-final-test-1` (`85ddf973`) | Addendum r6 (Docker Desktop 4.96.3) |
|---|---|---|
| `os.version` | `'27.0.1'` | `'27.0.1'` (unchanged) |
| `os.arch` | `'arm64'` | `'arm64'` (unchanged) |
| `cli.version` | `'29.9.1'` | `'29.9.2'` |
| `cli.sha256` | `'678271184175b40dfc4bd6f4582be00ae1538b0d1e031181f52ceedfae9af5fb'` | `'6bbc39e9f2950720216f64c22d6e38afdd86a4672eee0d4e4389263c40ebd3e3'` |
| `compose.version` | `'5.6.0'` | `'5.6.1'` |
| `compose.sha256` | `'1ec06408b809655f1d60659000173edaa412eab5359035f87833065883bbf605'` | `'31664b8ce83f3900ed3c52b8c2276706832793a0a379d9661defd6f88b386def'` |

---

## 3. Exact `git diff` Against `la-final-test-1` (`85ddf97332063f75bdc5636cb410fc0d6ee25099`)

Generated in `/Users/quangnguyen/cogniate-qa-runs/LA/ld9-addendum-r6/src-scratch` via `git diff la-final-test-1` and saved to `/Users/quangnguyen/cogniate-qa-runs/LA/ld9-addendum-r6/ld9-addendum-r6.patch` (`SHA-256`: `051af77f1aa074e328d879a576435ba9848daaeffed222c6e7a39663f83eff2e`):

```diff
diff --git a/tests/host/storage-docker.mjs b/tests/host/storage-docker.mjs
index 01483460..e2a15d86 100644
--- a/tests/host/storage-docker.mjs
+++ b/tests/host/storage-docker.mjs
@@ -172,8 +172,8 @@ export async function qaContainers(docker, project) {
 
 export const BOUND_IDENTITY = {
   os: { version: '27.0.1', arch: 'arm64' },
-  cli: { version: '29.9.1', sha256: '678271184175b40dfc4bd6f4582be00ae1538b0d1e031181f52ceedfae9af5fb' },
-  compose: { version: '5.6.0', sha256: '1ec06408b809655f1d60659000173edaa412eab5359035f87833065883bbf605' },
+  cli: { version: '29.9.2', sha256: '6bbc39e9f2950720216f64c22d6e38afdd86a4672eee0d4e4389263c40ebd3e3' },
+  compose: { version: '5.6.1', sha256: '31664b8ce83f3900ed3c52b8c2276706832793a0a379d9661defd6f88b386def' },
 };
 const sha256OfFile = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 /** Reads the three bound identities the §17 way. `exec(cmd, args)` resolves { code, stdout }. */
diff --git a/tests/host/storage-docker.selftest.mjs b/tests/host/storage-docker.selftest.mjs
index 0398590c..d9977b53 100644
--- a/tests/host/storage-docker.selftest.mjs
+++ b/tests/host/storage-docker.selftest.mjs
@@ -97,17 +97,17 @@ test('HARNESS ONLY: QA container arguments follow the §11 table exactly', () =>
 });
 
 test('HARNESS ONLY: A-S-14 identity binding — the bound table matches; any one difference blocks', async () => {
-  const observed = { os: { version: '27.0.1', arch: 'arm64' }, cli: { version: '29.9.1', sha256: BOUND_IDENTITY.cli.sha256 },
-    compose: { version: 'v5.6.0', sha256: BOUND_IDENTITY.compose.sha256 } };
+  const observed = { os: { version: '27.0.1', arch: 'arm64' }, cli: { version: '29.9.2', sha256: BOUND_IDENTITY.cli.sha256 },
+    compose: { version: 'v5.6.1', sha256: BOUND_IDENTITY.compose.sha256 } };
   assert.deepEqual(compareIdentity(observed), { match: true, differences: [] }, 'A leading v of the Compose version is not significant');
   for (const [path, value] of [['os.version', '27.0.2'], ['os.arch', 'x86_64'], ['cli.version', '29.8.2'], ['cli.sha256', '0'.repeat(64)],
-    ['compose.version', '5.6.1'], ['compose.sha256', '1'.repeat(64)]]) {
+    ['compose.version', '5.6.0'], ['compose.sha256', '1'.repeat(64)]]) {
     const copy = JSON.parse(JSON.stringify(observed)); const [a, b] = path.split('.'); copy[a][b] = value;
     const result = compareIdentity(copy);
     assert.equal(result.match, false, path); assert.equal(result.differences.length, 1);
   }
-  const answers = { 'sw_vers -productVersion': '27.0.1', 'uname -m': 'arm64', "docker version --format {{.Client.Version}}": '29.9.1',
-    'docker compose version --short': '5.6.0', 'docker info --format {{json .ClientInfo.Plugins}}': JSON.stringify([{ Name: 'compose', Path: '/plug' }]) };
+  const answers = { 'sw_vers -productVersion': '27.0.1', 'uname -m': 'arm64', "docker version --format {{.Client.Version}}": '29.9.2',
+    'docker compose version --short': '5.6.1', 'docker info --format {{json .ClientInfo.Plugins}}': JSON.stringify([{ Name: 'compose', Path: '/plug' }]) };
   const exec = async (cmd, args) => ({ code: 0, stdout: answers[[cmd, ...args].join(' ')] ?? '' });
   const read = await readClientIdentity(exec, { which: async () => '/usr/local/bin/docker', realpath: (p) => p + '.real',
     hash: (p) => (p === '/usr/local/bin/docker.real' ? BOUND_IDENTITY.cli.sha256 : BOUND_IDENTITY.compose.sha256) });
```

### `git apply --check -v` Verification on `la-final-test-1`

Verified read-only against `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1` at `la-final-test-1` (`85ddf97332063f75bdc5636cb410fc0d6ee25099`):

```text
$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1 apply --check -v /Users/quangnguyen/cogniate-qa-runs/LA/ld9-addendum-r6/ld9-addendum-r6.patch
Checking patch tests/host/storage-docker.mjs...
Checking patch tests/host/storage-docker.selftest.mjs...
# exit code: 0
```

`/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1` remains clean (`git status --short` empty, `HEAD` = `85ddf97332063f75bdc5636cb410fc0d6ee25099`).

---

## 4. Rows That Prove the Change

| Proof Target | Rows / Suites | What It Proves |
|---|---|---|
| **Host self-tests (this addendum)** | `tests/host/storage-docker.selftest.mjs` (`A-S-14 identity binding — the bound table matches; any one difference blocks`), `infra/scripts/storage-oplock.sh selftest`, `infra/scripts/sqlite-lock-probe.mjs selftest`, `infra/scripts/storage-oplock.test.mjs`, and all `tests/host/*.selftest.mjs` | `BOUND_IDENTITY` in `tests/host/storage-docker.mjs` matches the host OS (`27.0.1` / `arm64`), Docker CLI (`29.9.2` / `6bbc39e9f2950720216f64c22d6e38afdd86a4672eee0d4e4389263c40ebd3e3`), and Docker Compose plugin (`5.6.1` / `31664b8ce83f3900ed3c52b8c2276706832793a0a379d9661defd6f88b386def`); any single-field deviation is rejected (`match: false`); host operation-lock and SQLite lock-probe self-tests pass on this host. |
| **Live milestone-end runs (`D1` and `D2`)** | `M1` row `G1-IDENTITY` (`PASS`), followed by `M1 sim` (`tests/host/m1-storage-sim.mjs`) and `M2` (`tests/host/m2-storage-compose.mjs`) in milestone-end runs `D1` and `D2` | `G1-IDENTITY` passes against the live Docker CLI and Compose plugin on the host, unblocking `M1 sim` and `M2` in both independent milestone-end runs (`D1` and `D2`). |

---

## 5. Storage Self-Test Results in the Scratch Clone

All storage self-tests were executed in `/Users/quangnguyen/cogniate-qa-runs/LA/ld9-addendum-r6/src-scratch` on the host using only their own local scratch directories (zero Docker containers, volumes, or networks touched).

### 5.1 Host Binary and OS Identity Check (No Docker CLI Invocation)

```text
$ sw_vers -productVersion && uname -m
27.0.1
arm64

$ shasum -a 256 /Applications/Docker.app/Contents/Resources/bin/docker /Applications/Docker.app/Contents/Resources/cli-plugins/docker-compose
6bbc39e9f2950720216f64c22d6e38afdd86a4672eee0d4e4389263c40ebd3e3  /Applications/Docker.app/Contents/Resources/bin/docker
31664b8ce83f3900ed3c52b8c2276706832793a0a379d9661defd6f88b386def  /Applications/Docker.app/Contents/Resources/cli-plugins/docker-compose
```

### 5.2 Storage-Docker Self-Test (`node --test tests/host/storage-docker.selftest.mjs`)

```text
$ node --test tests/host/storage-docker.selftest.mjs
✔ HARNESS ONLY: Docker times are whole seconds on the engine clock; a same-second creation counts as after the start (0.5805ms)
✔ HARNESS ONLY: exact-name presence — absent, labeled, unsafe; unsafe never mounts and is BLOCKED before the first start (0.407708ms)
✔ HARNESS ONLY: QA container arguments follow the §11 table exactly (1.3655ms)
✔ HARNESS ONLY: A-S-14 identity binding — the bound table matches; any one difference blocks (0.286834ms)
✔ HARNESS ONLY: G1-QA-01 ownership record — only resources that appeared during the run, with labels, are removed (1.453792ms)
✔ HARNESS ONLY: a lane that is not fresh is reported with every present resource, labeled or not (0.111291ms)
ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 50.757
```

### 5.3 Storage Operation-Lock Self-Test (`bash infra/scripts/storage-oplock.sh selftest`)

Runs the five host process-group and lock-directory scenarios (`rename-held`, `locale`, `orphan-client`, `dead-owner`, `own-group`) in scratch `.tmp/storage-op-selftest-<id>/` and cleans up its scratch directory on exit:

```json
{"event":"storage_lock_selftest","ts":"2026-10-24T10:47:50.488Z","runId":"0106997bb2764e55","scenario":"rename-held","expected":"both renames refused","observed":"both renames refused","ok":true,"psCommand":"LC_ALL=C ps -A -o pid= -o pgid="}
{"event":"storage_lock_selftest","ts":"2026-10-24T10:47:50.525Z","runId":"0106997bb2764e55","scenario":"locale","expected":"live","observed":"live","ok":true,"psCommand":"LC_ALL=C ps -A -o pid= -o pgid="}
{"event":"storage_lock_selftest","ts":"2026-10-24T10:47:53.619Z","runId":"0106997bb2764e55","scenario":"orphan-client","expected":"operation_in_progress then reclaimed","observed":"operation_in_progress then reclaimed","ok":true,"psCommand":"LC_ALL=C ps -A -o pid= -o pgid="}
{"event":"storage_lock_selftest","ts":"2026-10-24T10:47:53.863Z","runId":"0106997bb2764e55","scenario":"dead-owner","expected":"reclaimed","observed":"reclaimed","ok":true,"psCommand":"LC_ALL=C ps -A -o pid= -o pgid="}
{"event":"storage_lock_selftest","ts":"2026-10-24T10:47:54.186Z","runId":"0106997bb2764e55","scenario":"own-group","expected":"other group","observed":"other group","ok":true,"psCommand":"LC_ALL=C ps -A -o pid= -o pgid="}
```

### 5.4 SQLite Lock-Probe Self-Test (`node infra/scripts/sqlite-lock-probe.mjs selftest`)

Runs the three SQLite WAL lock-enforcement scenarios (`normal`, `no-hold`, `holder-dies`) in an isolated scratch folder (`/Users/quangnguyen/cogniate-qa-runs/LA/ld9-addendum-r6/probe-selftest`, removed immediately after):

```json
{"event":"storage_selftest","ts":"2026-10-24T10:47:54.268Z","runId":"0123456789abcdef","scenario":"normal","expected":"pass","observed":"pass","ok":true}
{"event":"storage_selftest","ts":"2026-10-24T10:47:54.301Z","runId":"0123456789abcdef","scenario":"no-hold","expected":"lock_not_enforced","observed":"lock_not_enforced","ok":true}
{"event":"storage_selftest","ts":"2026-10-24T10:47:54.332Z","runId":"0123456789abcdef","scenario":"holder-dies","expected":"probe_error","observed":"probe_error","ok":true}
```

### 5.5 Full Storage Script and Host Harness Self-Test Suites

| Suite Command | Tests | Pass | Fail | Duration |
|---|---:|---:|---:|---:|
| `node --test tests/host/storage-docker.selftest.mjs` | `6` | `6` | `0` | `50.8 ms` |
| `bash infra/scripts/storage-oplock.sh selftest` | `5` scenarios | `5` (`ok: true`) | `0` | `3.7 s` |
| `node infra/scripts/sqlite-lock-probe.mjs selftest --run-id 0123456789abcdef --folder self=...` | `3` scenarios | `3` (`ok: true`) | `0` | `0.1 s` |
| `node --test infra/scripts/storage-oplock.test.mjs infra/scripts/sqlite-lock-probe.test.mjs infra/scripts/storage-compat.test.mjs infra/scripts/stack-reset.test.mjs` | `111` (`14` suites) | `111` | `0` | `27.2 s` |
| `node --test tests/host/*.selftest.mjs` (all host harness self-tests: `storage-docker`, `storage-ops`, `storage-raw-sql`, `storage-Clock`, `m1-storage-sim`, `m1-control`, `m1-backup-oracle`) | `154` | `154` | `0` | `704.4 s` |
