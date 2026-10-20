Verdict: CHANGES_REQUESTED
Round: 2

# Storage design review: ADR-012 (SQLite named volumes) — Reviewer-A

## Round 1 (2026-10-21)

| Item | Value |
| --- | --- |
| Verdict | **CHANGES_REQUESTED.** The direction is right, and most of the contract is precise. Three MAJOR design gaps break the stated recovery and integrity guarantees in concrete schedules. They need narrow amendments before an implementation starts. This review does not open the implementation gate. |
| Frozen candidate | **`6a5eb6a89b3ee6bb377f93244b00e6488e9e2314`** (architecture and Lead records only; product and tests stay `8138097889f87359d5055bb1d79766b5ed842f92`). Detached clone `/tmp/rva-6a5eb6a`. |
| Reviewed documents | `docs/architecture/adr/ADR-012-sqlite-volume-storage.md` (all of it), the amendments in `ADR-006-storage.md`, `ADR-011-multi-lms.md` §14 (L386–L411), `local-stack.md` §2, `tasks/M1.md` (ADR-012 infra line, AC-M1-23/30 step 0, AC-M1-38 (h1), **AC-M1-41** (a)–(j), supplemental list), `tasks/M3.md` (AC-M3-01 rerun rule, owners, independence rule), `docs/architecture/README.md` and `tasks/README.md` (index and role amendments). |
| Feasibility reads (source only, no run) | Candidate `8138097`: `infra/compose.yaml` (the `x-node-service` anchor L14–L22, `/data` binds L146/L183), `infra/scripts/stack-restart.sh`, `stack-data.mjs`, service `DATA_DIR` users. Old builds `b0b83a8` and `9f96f7b`: `infra/scripts/lib.sh` (`dc()` adds `-f .tmp/compose.knobs.yaml`: L94 / L107), `stack-up.sh`, `stack-reset.sh` (`down -v`, removes the knobs file and `infra/.data/<service>`), `qa-suite.sh` (two internal `stack-up.sh` calls), `compose.yaml` (`/data` binds), `.gitignore` (`.tmp/`). |
| Reviewer | Original independent Reviewer-A, Claude Code Opus 5.5, xhigh, session `604b28c1-156c-4266-84c3-e0f0089004da`. Task `task_e3cb869da7e7`, dispatch `ctx_148e1d3f008a`, run `run_ebe671ad72a9`. Lens: correctness, security, data integrity. |
| Independence | I did not read `storage-reviewer-b.md`, `storage-qa.md`, any other new storage review or worker draft, or the external diagnostic and proposal files. I did not use any working-tree file as evidence. No Docker, stack, product/test edit, commit or push. |

### What the design gets right

- **Data stays in one place.** DS1 moves only the SQLite files. The nested content binds keep the Build Runner path and the single-mount upload rename.
- **The lock oracle is real.** §4 steps 4–6 use a live holder (`HELD`, `PONG inTransaction=1`), a negative oracle (`BEGIN IMMEDIATE` with `busy_timeout = 0` → `SQLITE_BUSY`), and a release-positive control (the parent then commits and sees the child's row). These are the right controls for the observed bind/WAL fault. The preflight runs in the same kind of kernel/volume context as the in-container CLI that caused it.
- **No automatic legacy selection.** §6 is fail-closed and needs an explicit import into empty volumes.
- **Bounded old-build exception.** §8 checks the old SHA, the override hashes against the candidate, and the effective-config difference (a)–(d). It forbids old `stack:restart` and `stack:reset`, and runs per-step mount checks. The override uses the old `dc()` knob hook, which both old builds have (L94 / L107). `.tmp/` is ignored in both old trees.
- **Grant, tenant and protocol assurances are not weakened.** There is no product change. The pair restore keeps the LTI and app databases consistent with each other, which is stronger than two independent copies. Backups and `.previous-*` stay at `0700`/`0600`, outside shared evidence.
- **Honest limits.** §1 and §4 state the limits: no claim about Docker-version causation or about all bind mounts; hand-typed compose and dockerd restarts are unguarded.

### Required fixes

#### A-S-01 — MAJOR — Docker-created mountpoint folders fail the ownership rule after the first app start

- **Where:** ADR-012 §4 step 1 (L78: "If any existing file or folder inside has another owner: FAIL `owner_mismatch` (no automatic fix)"); §3 allowed entries (L54–L59: "for `appdb` only, the mountpoint folders `packages` and `uploads`"); §10 assumption 1 (L256).
- **Schedule:**
  1. Fresh lane, `stack:up`. The preflight passes on empty volumes and writes the identities as `HOST_UID`.
  2. `cogniate-app` starts. Docker must create `/data/packages` and `/data/uploads` inside `appdb` as bind mountpoints (assumption 1). Docker's mountpoint creation is done by the daemon, so these folders are `root:root` in the volume. The app runs as `HOST_UID` (`x-node-service` anchor), but it never sees them: the binds cover them.
  3. The next guarded start (`stack:restart -- lti-service` in AC-M1-35, the second `stack:up`, any restore) runs the preflight. That container mounts only the volumes, so it sees the two root-owned folders → `owner_mismatch`, and **no guarded start succeeds again**.
- **Consequence:** this is fail-closed, but every lane breaks after its first app start. The AC-M1-41 (a)/(d) positive cases would pass, while every restart-based M1 row fails.
- **Narrow fix:** at `FRESH`, step 1 (as root) creates `packages` and `uploads` in the `appdb` root, owned `HOST_UID:HOST_GID`, mode `0700`, before any service start, so Docker reuses them. In addition, accept these two folders only as **empty** directories (their content lives in the binds), with owner `HOST_UID` or `root`, and never recurse. Add an AC-M1-41 (d) case: a second guarded start after the app has run → pass.

#### A-S-02 — MAJOR — The start-state and recovery tables are not total; real interruptions reach unclassified states

- **Where:** §5 start-state table (L122–L129), §7 restore states (L179–L191), the commit rule (L193–L197), the recovery table (L201–L207), L214 ("there is no permanent refusal"), §6 import (L151: "only when both volumes are `FRESH`").
- **Counterexamples:**
  1. **The first start fails before any database exists.** For example a port conflict in a parallel lane, an image pull failure or a certificate error. The preflight already wrote both identities (FRESH → generation 0), and `dc up` then fails. The next `stack:up` sees two valid identities and **zero databases**. That is not `FRESH` (identities exist), not `OK` (both databases required), not `HALF_PAIR` (exactly one) and not `IDENTITY_*` → no row matches.
  2. **An import or FRESH-target restore rolls back.** `before = []` and `identityBefore = null`. A verified `rolled_back` leaves no databases, no identities, two terminal journals and an empty `.previous-<opId>/`. That is not `FRESH` (the journals and `.previous-` folder exist) and not `OK` → unclassified. A retry of the import refuses (L151, not `FRESH`). The only remaining tool is `stack:reset`. It also deletes `infra/.data/lti-service`, `infra/.data/cogniate-app` and the content folders, that is, **the legacy databases and packages that the import was protecting**. So "recover from every interruption boundary" (DS3) and L214 are false on the import path.
  3. **A crash at the first journal write.** The lti journal says `prepared` (opId B), and the app journal is absent, or is the previous terminal journal of opId A. The recovery rows assume both journals exist with one opId. "One `prepared`, one absent" and "B `prepared`, A `committed`" are not listed.
  4. **`--recover` on `rollback_failed`.** It is not a row of the "Observed" column, so a second `--recover` could retry, overwrite evidence, or report something other than exit 2.
  5. **Row precedence is not stated.** During `swapped`, the in-place identity has moved to `.previous-`, so `IDENTITY_*` ("a database exists without an identity", "no automatic repair") matches together with `JOURNAL_OPEN`. Without an order, the refusal can send the operator away from `--recover`.
- **Narrow fix:**
  - Make both tables total, with an explicit precedence: `UNKNOWN_ENTRY` → `JOURNAL_OPEN` (including a journal with a differing opId) → `IDENTITY_*` → `HALF_PAIR` → `OK`/`FRESH`.
  - Add a state "both identities valid, `kind: fresh`, generation 0, no database, no journal" → start. The services create the databases.
  - Define the end of a FRESH-target rollback: after verification, remove both journals, the empty `.previous-` and `.restore-` folders and any identity, so the pair is exactly `FRESH`. Or classify that terminal state as `FRESH`.
  - Define first-write recovery: a missing journal, or a terminal journal with another opId, next to a `prepared` journal means "no target changed" → cancel.
  - Define `--recover` on `rollback_failed`: change nothing, exit 2.
  - State that `stack:reset` is **never** a recovery step on a lane with legacy files or content.
  - Add `--stop-after` drills for an import (`prepared-lti`, an import `swapped`) and one FRESH-target restore to AC-M1-41 (e)/(g).

#### A-S-03 — MAJOR — A backup can capture a mixed or incomplete pair, and a later restore commits it

- **Where:** §7 Backup (L160–L173: the only guard is "Both services were positively stopped"); §4 coverage (L101: `stack:data-backup` "not needed"); §6 legacy set (L133 includes `<db>-journal`) against the backup copy rule (L162: "every present `-wal`/`-shm`"); restore validation (ADR-011 §14 rollback step 2: manifest form, ids, file hashes only).
- **Schedule (mixed pair):**
  1. A restore stops in `swapping`/`swapped`. The in-place lti files are new and the app files are old (or the reverse).
  2. The operator takes a safety backup before running `--recover`, which is a natural step. Both services are stopped, so the backup succeeds.
  3. The manifest hashes match the mixed files.
  4. A later `stack:data-restore` of that backup validates and **commits** an LTI database and an app database from different generations: grants, approvals, platforms and bindings that do not match. This is exactly the cross-service inconsistency that DS3 forbids.
- **Schedule (legacy hot journal):** a legacy set that holds `lti.db-journal` is backed up without it (the copy rule names only `-wal`/`-shm`). Then it is imported. A hot rollback journal that is dropped can leave a torn database. If the backup copied it instead, the import would create `UNKNOWN_ENTRY` in the volume.
- **Narrow fix:**
  - **Volume source:** the backup runs the §5 state check (`report`) inside its maintenance container and refuses unless the state is `OK` with no open journal. It records `pairId`/`generation` from the identities it read.
  - **Legacy source:** refuse when any `<db>-journal` or other unknown legacy entry is present (`legacy_hot_journal`). Never drop it.
  - **Restore:** refuse a backup whose manifest says `source: volume` but has no `pairId`/`generation` (an incomplete backup).
  - Add the AC-M1-41 (h) refusals: a backup during `JOURNAL_OPEN` → refused; a legacy `-journal` → refused.

### Further required fixes (MINOR)

#### A-S-04 — MINOR — The restart path runs the preflight while services run; its claim is false and concurrent preflights collide

- **Where:** §4 L89 ("It runs before any service opens a database, so no CLI can be active and there is no startup race") and the coverage row for `stack:restart` (L96); step 3, scratch cleanup (L80).
- **Facts:**
  - `stack-restart.sh` runs the preflight before `up --force-recreate`. So the target service, the other service and possibly a `dc exec` CLI are **running**, and the preflight mounts both volumes read-write next to them.
  - This is safe in substance: the probe never opens the service databases, and scratch files are allowed entries. But the stated reason is wrong.
  - Two preflights at the same time (for example two restarts) delete each other's live `.lock-probe-*` files in step 3. That gives spurious `lock_not_enforced` or `probe_error`. It is fail-closed, never a false pass, as I traced: a deleted scratch inode makes the parent open a new file with no holder.
- **Narrow fix:** correct the statement (running services are tolerated, and why). Serialize preflights with an exclusive lock that is not a probe file, for example an `flock` on a fixed `.preflight.lock` that is an allowed entry. Delete only scratch files older than the bound (60 s).

#### A-S-05 — MINOR — Old-route preflight rule contradicts the allowed old `test:acceptance`

- **Where:** §8 L235 (allowed: old `npm run test:acceptance`, "its two `stack:up` calls keep the knobs file") against L237 ("before each old `stack:up`: … preflight must exit 0"); AC-M1-23 step 0, AC-M1-41 (j) ("the preflight result before each old `stack:up` … A missing record fails that row").
- **Facts:** old `qa-suite.sh` calls `stack-up.sh` twice inside one command: acceptance first, then the default restore after the suite. The harness cannot run the preflight before the second internal call. So the row rule is either unsatisfiable or silently weakened. In addition, `docker compose config` leaves out profiled services unless the profile is active, so item (d) (`storage-preflight`) needs `--profile storage` in the C0/C1 comparison.
- **Narrow fix:** define the preflight point as "before each **harness-invoked** old start command". Either forbid old `test:acceptance` (no route needs it, as far as I can see) or state that its internal restart is covered by the preflight before the command plus the mount checks after it. Compute C0/C1 with every profile the step uses **and** `--profile storage`.

#### A-S-06 — MINOR — The operator rollback has no positive mount check

- **Where:** ADR-011 §14 rollback step 3 (L408), ADR-012 §8 Rollback (L238).
- **Schedule:** the operator skips `stack:storage-compat -- enable` or runs the old `stack:reset`, which removes `.tmp/compose.knobs.yaml`. Then the old build bind-mounts `infra/.data/<service>`. It creates **new empty** databases on the unsafe bind, and possibly seeds them, while the real data waits in the volumes. QA routes catch this with the §8 mount checks. The operator procedure has no such check.
  - The documented preflight step does fail without the override, because the old compose has no `storage-preflight` service. But the procedure does not say that this failure means "stop".
- **Narrow fix:** in ADR-011 §14 rollback step 3 and the M4 guide, say: "if the preflight command fails, or reports an unknown service, do not start". After the old start, add `docker inspect` of both services: `/data` must be the project volume, else stop at once. Never run the old `stack:reset` while the data is in the volumes; with the override active, its `down -v` deletes them.

#### A-S-07 — MINOR — The content check covers import only

- **Where:** §6 import step 4 (L153: "A database is never paired with the wrong content folder") against §7 restore, which has no such check.
- **Facts:** a restore can take a `source: legacy` backup, or an old volume backup whose packages were removed later. It then pairs `cogniate.db` with a content folder that lacks referenced packages, so the guarantee in L153 does not hold for restore.
- **Narrow fix:** run the same read-only `content_missing` check on the staged app database in every restore before `swapping`, or state that restore does not check content. My preference is the check. It is cheap and read-only.

### NIT

- **A-S-08 — NIT — Precision items.**
  1. Step 5 (L82), "errcode **5** exactly": specify the **extended** result code `SQLITE_BUSY` (5). `SQLITE_BUSY_RECOVERY` and `SQLITE_BUSY_SNAPSHOT` share primary code 5 and must be a FAIL.
  2. §4 fields: name them all. The service must use `user: "0:0"` for step 1 and must not reuse the `x-node-service` anchor (`compose.yaml` L14–L22): that anchor brings `user: HOST_UID`, `restart: unless-stopped` and `depends_on: proxy`, and `run` would then start the proxy. Also `restart: "no"`. Item (d) of §8 depends on this full list.
  3. Extend the candidate guard (L239) from `stack-up.sh` to `stack-restart.sh`. The candidate restart rewrites `services.<svc>` in the knobs file and would remove the override's `lti-service` volume entry before an old route.
  4. QA's own AC-M1-41 (b) oracle files in `/data` must use the `.lock-probe-*` names or be removed before the next start. Otherwise they become `UNKNOWN_ENTRY`.

### Optional design preferences (not required)

- **O-1:** a read-only state gate in each service's compose `command` (infrastructure only, no product change), run as the service user before `node`. It refuses `JOURNAL_OPEN`, `HALF_PAIR` and `IDENTITY_*`. This would close the journal part of the hand-typed `docker compose up` and dockerd-restart gaps (L102–L103). The lock part stays a preflight concern. With the current `unless-stopped` policy, dockerd restarts only containers that were running, so the residual risk is mainly hand-typed starts.
- **O-2:** carry `legacySources` forward when a restore re-installs an import generation. Today a routine backup/restore cycle on an imported lane changes the provenance to `restore`, and the next start refuses (§6 row 4) until the operator moves the legacy files out. That is fail-closed but surprising.
- **O-3:** ADR-011 §14 warning. Rollback also **undoes revocations and suspensions** made after the backup: a revoked (for example leaked) approval code becomes valid again until it expires, and a suspended binding is active again. Tell the operator to revoke or suspend again after a rollback. This is not new in ADR-012, but it is in the amended text.

### Requested checks

| Topic | Result |
| --- | --- |
| Partially completed two-volume restore, journal and identity updates | Traced every `--stop-after` boundary on `OK` volumes: covered, including `identity-lti` and `identity-app` (both journals `swapped` → roll back) and `committed-lti` (forward commit after both verify). Gaps: first journal write, FRESH-target and import rollback, `rollback_failed` re-run, precedence (A-S-02); backups during an open journal (A-S-03). |
| Fail-closed startup and auto-restart limits | Script paths are fail-closed. The unguarded paths are stated honestly (L102–L103). With `restart: unless-stopped`, manually stopped services stay stopped across a VM reboot, so an interrupted restore is not auto-started. The residual risk is hand-typed compose (O-1). The first-start failure dead end is part of A-S-02. |
| Legacy-sidecar conflicts and accidental overwrite | §6 never selects or overwrites automatically, and import goes only into `FRESH`. Gaps: a legacy hot `-journal` (A-S-03) and `stack:reset` as a destructive recovery (A-S-02). |
| Source and effective-config identity, old routes, safe rollback | Hashes, a clean old SHA, an allow-list difference and per-step mounts are sound and feasible through the old `dc()` hook. Gaps: the `test:acceptance` preflight contradiction, and the `--profile storage` needed for item (d) (A-S-05); no operator mount check (A-S-06). |
| Real lock holder and release controls | Sound (steps 4–6; AC-M1-41 (b)/(c), including the `NOT APPLICABLE` rule for a host where locks work). Precision: the extended error code (A-S-08). Restart-time concurrency (A-S-04). |
| Grant, tenant and protocol assurances | Not weakened: no product change, and the pair restore keeps both services consistent. Pre-existing rollback effect on revocations: O-3. |
| Evidence labels and runtime boundaries | M1/M3 keep the old labels with the §8 qualifier. Every stack-level row, both old routes, legacy, M2 and three T7 runs run again. Earlier evidence stays at its true SHAs. The live matrix stays 32 UNVERIFIED. Consistent. |
| Architecture README and tasks/README | The index lists ADR-012 as **proposed**. The role amendment records the owner's Claude-only direction and keeps earlier model attribution; M3 changes the cross-model rule into an independence rule. Consistent with the amendment; not judged further from my lens. |

### What closes this gate

- A-S-01, A-S-02 and A-S-03 (MAJOR) are amended in ADR-012 and AC-M1-41.
- A-S-04 to A-S-07 (MINOR) are amended, or the Lead records them as accepted with their stated limits.
- A-S-08 and O-1 to O-3 are optional.
- I re-check the amended frozen text before any implementation. This review is a design verdict only; it gives no implementation or runtime approval.

## Round 2 (2026-10-21)

| Item | Value |
| --- | --- |
| Verdict | **CHANGES_REQUESTED.** Revision 2 resolves all three Round 1 MAJOR findings and all four MINOR findings. The ordered start-state table and the recovery table now cover every reachable journal pair that I traced. But the new **operation lock** has one MAJOR gap: a lock is reclaimed by host process id while the maintenance container that writes the volumes can still run. One narrow amendment closes it. One new MINOR and one NIT are listed. This review gives no implementation or acceptance authorization. |
| Frozen candidate | **`7a6374460dd02c3544b6dbf043086b0facefceb2`** (design revision 2; product and tests stay `8138097889f87359d5055bb1d79766b5ed842f92`). Detached clone `/tmp/rva-7a63744`. |
| Inputs read | My Round 1 above (SHA-256 `f5ceeebacb98146ffc85ecfcf00ad1d9d47ee5332494d86495d0c4b455150a13` at `2bb918f`); `docs/architecture/review-response-storage.md`; ADR-012 revision 2 (all 541 lines); ADR-011 §14 (storage, upgrade, rollback, rollback mode, warning); M1 AC-M1-23 step 0 and the AC-M1-41 row oracles; the M3 and README amendments. The Author feasibility report was not needed; I used only the facts M1–M8 that ADR-012 §17 quotes, as AUTHOR-DIAGNOSTIC. |
| Feasibility reads | Old `b0b83a8`/`9f96f7b` `lib.sh` `dc()`, `stack-up.sh`, `stack-reset.sh`, `qa-suite.sh` (Round 1); candidate `tests/host/m1-control.mjs` (host restart and profile actions run `npm run stack:restart` in the clone). |
| Reviewer | Original independent Reviewer-A, Claude Code Opus 5.5, xhigh, session `604b28c1-156c-4266-84c3-e0f0089004da`. Task `task_b9571fcd7912`, dispatch `ctx_de1c69e93c96`, run `run_ebe671ad72a9`. |
| Independence | I did not read `storage-reviewer-b.md`, `storage-qa.md` (Round 1 or Round 2), or any other worker's draft. I read the Architect response and the Lead synthesis, as allowed. No Docker, stack, edit, commit or push. |

### Status of the Round 1 findings

| Id | Sev. | Status | Normative evidence at `7a63744` |
| --- | --- | --- | --- |
| A-S-01 | MAJOR | **Closed** | §4 volume side (L80–L89): the preflight, as root, creates `packages`/`uploads` as `HOST_UID:HOST_GID 0700` before the first app start. It fixes only an **empty** root-owned mountpoint, and `mountpoint_unsafe` covers a non-empty or linked one; never recursive. §3 (L70) allows the two only as empty directories. §17 M2/M3 measure the root-owned mountpoint and keeping it after precreation (AUTHOR-DIAGNOSTIC). **UID after the second start:** the identities and probe scratch are written after the privilege drop (§5 step 2), and the services write their databases as `HOST_UID`. A later volume-only container sees `HOST_UID 0700` (M3). Rows `a-second-start`, `a-restart`, `d-mountpoint` test it. See A-S-11 (1) for `mark-started`. |
| A-S-02 | MAJOR | **Closed** | §6 (L172–L195) is ordered and total (row 18 `state_unclassified`). (1) A first start that fails before any database → `FIRST_START` (row 14), and `mark-started` follows only after a healthy start. (2) An empty-`before` rollback removes the new identities, `.restore-X/` and an empty `.previous-X/` (R3, L285; `rolled_back`, L269). `FRESH` accepts `rolled_back` journals of any opId (row 13), so an import can run again. (3) R1 (L283). (4) R5 changes nothing, exit 2 (L287). (5) The journal rows come first (rows 1–3). `stack:reset` is never a recovery step (§9 L333, ADR-011 §14). The non-destructive exit is quarantine (§9). |
| A-S-03 | MAJOR | **Closed** | §8 Backup step 2 (L228): a volume source must be `OK` with no open journal (`backup_source_not_ok:<code>`). A legacy source refuses `legacy_hot_journal`/`legacy_unknown_entry`. `manifest_incomplete` (L240). The pair rule (L246–L250) refuses `pair_mismatch` into an `OK` target. Backup holds the operation lock (§7 table). The `stack:up` legacy scan refuses a hot journal in any pair state (§10). Rows `h-open-journal`, `e-hot-journal`. |
| A-S-04 | MINOR | **Closed, with a new gap** | The running-services statement is corrected (§7 L217–L220). Serialization is the host operation lock (L199–L203). Probe cleanup runs under the lock with no cap (§5 step 3). The lock itself has a stale-reclaim gap: **A-S-09**. |
| A-S-05 | MINOR | **Closed** | §12 (L425–L428): one preflight before each harness- or operator-invoked old start command and `status` after it. Old `test:acceptance` is covered by the preflight before it and the mount check after it. C0/C1 through the old `dc()` with `--profile storage` and the step profiles, keyed by `target` (L401–L405). |
| A-S-06 | MINOR | **Closed** | ADR-011 §14 rollback step 4 (copied `preflight`, old `stack:up`, then `status`; "stop now" on failure); temporary rollback mode with the forbidden commands and the only supported restart. |
| A-S-07 | MINOR | **Closed** | §8 L252: the read-only content check runs on every restore and import before the swap. Its limit is stated (folders exist; files are not compared). Row `e-content-missing`. |
| A-S-08 | NIT | **Closed** | (1) extended code `5` only; 261/517/6 → `probe_error` (§5 step 6). (2) full service table without the anchor, `user "0:0"`, `restart "no"`, no `depends_on` (L108–L122). (3) The candidate guard covers every start and data command (L430). (4) QA scratch `.qa-scratch-<16 hex>` (§3, §11). |
| O-1 | optional | Not adopted; accepted | Hand-typed compose stays a stated limit (§7). Note: the reason "the old-build allowed differences forbid it" binds only the override, not the candidate `compose.yaml`. The decision stays acceptable as optional. |
| O-2 | optional | Done | §8 pair rule: a same-pair restore keeps `legacySources`; §10 L354. Row `e-provenance-restore`. |
| O-3 | optional | Done | ADR-011 §14 warning: revocations and suspensions after the backup are undone; revoke and suspend again. |

### Partial-pair journal transitions (my trace)

Each state change is written lti first, then app, and the swap is done per volume (drill points `swap-lti-mid`, `swapped-lti`, `swap-app-mid`). So these are the reachable journal pairs and their recovery:
- `(prepared, —)` and `(prepared, older terminal)` → R1;
- `(prepared|staged|rolled_back, prepared|staged)` → R2;
- `(swapping|swapped, staged)`, `(swapped, swapping|swapped)`, `(rolling_back, *)` and `(rolled_back, rolling_back)` → R3;
- `(committed, swapped)` → R4, or R3 when one verification fails;
- `(committed, committed)`, `(rolled_back, rolled_back)` and terminal pairs with different opIds → R0;
- any `rollback_failed` → R5; every other pair → R6 and quarantine.

In a single-writer world, I found no reachable pair that leads to R6. Recovery is idempotent, because every move first finds the file by name and SHA-256. Commit needs both volumes verified, and `committed` is written only after both identities. The rows `g-*`, `e-import-recover` and `g-fresh-target` exercise these transitions, including the FRESH-target and import paths. The single-writer premise is the gap in A-S-09.

### New findings

#### A-S-09 — MAJOR — A stale-lock reclaim by host pid can start a second writer while the first maintenance container still runs

- **Where:** ADR-012 §7 operation lock (L199–L202: "keeps it until it ends"; "A lock whose `pid` no longer runs on this host is stale. The next command removes it … and goes on"); §8 (L256: "One maintenance process restores or imports both volumes … the operation lock held"); §17 assumption 5 (`kill -0`).
- **Problem:** the lock records the **host** command's pid. The writer is the maintenance **container**, and a container keeps running when its client dies. A `docker compose run` client killed by SIGKILL, a crashed terminal or a dropped session does not stop the container: Ctrl-C is forwarded, but SIGKILL is not.
- **Schedule:**
  1. The operator runs `stack:data-restore -- --from B`. The container reaches `swapping` on lti.
  2. The host script is killed (`kill -9`, the terminal app is force-quit). Its pid is gone, but the container keeps moving files.
  3. The operator sees `journal_open` and runs `stack:data-restore -- --recover`. The lock is "stale" by pid, so it is reclaimed. A second container now runs R3 on the same files.
  4. The two processes interleave. The original verifies both volumes against `after` and then writes the identities and `committed`. Meanwhile, recovery has already moved the lti `before` files back. The result is journals `committed`, new identities, an lti database from `before` and an app database from `after`. That is a **mixed pair that `stack:up` accepts as `OK`**, exactly the state that DS3 forbids. The same window lets a `stack:up` or a backup run next to a live import or quarantine.
- **Narrow fix:**
  - The lock stays live while its maintenance or preflight container exists. Record the container name in `owner.json`. The staleness test is then "pid gone **and** no container with this project's storage label (`docker ps -a --filter label=com.docker.compose.project=<project> --filter label=org.cogniate.storage`) exists". Otherwise refuse `operation_in_progress` and name the container.
  - Optionally add defense in depth: the maintenance program holds a kernel lock (for example `flock`) on a fixed allowed entry in each volume root for its whole life. The volume is `ext4`, where locks work, so a second writer can never start.
  - Add a unit case and an AC-M1-41 row: kill the host client during a drill pause, then `--recover` → `operation_in_progress` while the container lives.

#### A-S-10 — MINOR — Rollback move order can overwrite an in-place file that matches neither `before` nor `after`

- **Where:** R3 (L285): "move every `before` file … into place …; move every `after` file that is in place back into `.restore-X/`". Also R4 → R3 when a verification fails (L286), and the in-live-restore R3 (L292).
- **Problem:** read in order, a `rename` from `.previous-X/lti.db` onto an in-place `lti.db` replaces the file atomically. If that in-place file matches neither `before` nor `after`, the rollback destroys it silently and then reports a verified `rolled_back`. That can happen when a service was started by hand (a stated unguarded path) while the journal was open, so the database got new writes. The "keep every file" rule of `rollback_failed` does not apply, because no step "fails".
- **Narrow fix:** state the order and the rule. First move each in-place `after` file to `.restore-X/`. A `rename` never replaces an existing file (check first; refuse on a collision). An in-place file whose SHA-256 matches neither `before` nor `after` → `rollback_failed`, keep everything. Add a unit case.

#### A-S-11 — NIT — Precision items

1. **Privilege in every probe mode.** The note to §5 `user "0:0"` (L114) implies, but does not state for `mark-started` (L105) and the log append to `./.logs`, that the program drops to `HOST_UID:HOST_GID` before **every** write that is not a §4 step. A root-written identity would cause `owner_mismatch` on the next start, the A-S-01 class again. `a-second-start` would catch it; one sentence prevents it.
2. **Pair rule targets.** L246–L250 define only `OK` and `FRESH` targets. Name the result for any other state, for example `FIRST_START`: `restore_target_state:<code>`, no change.
3. **Quarantine and stopped containers.** `docker volume rm` fails while a stopped container still references the volume, so §9 step 2 must remove the two stopped service containers first. Otherwise it exits 1 with nothing removed. That is fail-closed, but the documented exit would never succeed after a plain `stop`.
4. **The operation lock in old checkouts.** `infra/scripts/storage-oplock.sh` (L203) does not exist after `git checkout <old>`, while §12 L428 says "the harness holds the operation lock for the whole command". Copy the helper with `enable` (and hash it), or give `storage-compat.sh` a `run --` subcommand.
5. **Host-control actions in old steps.** The candidate `tests/host/m1-control.mjs` runs `npm run stack:restart` in the clone for `m1-restart` and `m1-profile`. In an old step that is the forbidden old `stack:restart`, which rewrites `services.<svc>` in the knobs file. The `status` check after the command would report `BLOCKED`, but only after a service may have run on the bind. Let the host control refuse these actions while the `x-cogniate-storage-compat` marker is present.

### Requested checks (Round 2)

| Topic | Result |
| --- | --- |
| Partial-pair journal transitions | Total for a single writer (trace above). The concurrency premise: A-S-09. |
| Backup admissibility | Closed (`OK` and no open journal; legacy hot journal and unknown entries refused; `manifest_incomplete`; pair rule). |
| Interrupted rollback | Idempotent R3 with drills `rollback-mid` and `g-tamper` (any failure → `rollback_failed`, exit 2, nothing deleted). Overwrite order: A-S-10. |
| UID ownership after the second start | Closed by §4 precreation and the privilege drop. Precision: A-S-11 (1). |
| Fail-closed start and auto-restart | Unchanged honest limits (§7); a failed restart preflight exits before `--force-recreate`. |
| Legacy sidecars and accidental overwrite | Closed (§10: every `<db>-*` entry; import only into `FRESH`; same-pair restore only; quarantine is non-destructive; `stack:reset` never a recovery step). |
| Old-route identity and safe rollback | Closed (exact tree rule, C0/C1 with (a)–(e), command rule, rollback mode, preflight and `status`). Precision: A-S-11 (4), (5). |
| Real lock holder and release controls | Closed (§5 steps 5–7 and the self-test; `c-host-negative` is the only conditional row and never counts as PASS). |
| Grant, tenant and protocol assurances | Not weakened; the warning now names the undone revocations. |

### What closes this gate

- A-S-09 (MAJOR) is amended, with its unit case and AC row.
- A-S-10 (MINOR) is amended, or the Lead records it as accepted with its stated limit.
- A-S-11 is optional.
- I re-check the next frozen revision. Every runtime gate, every stack-level rerun and the 32 `UNVERIFIED` live rows stay as stated.
