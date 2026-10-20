Verdict: CHANGES_REQUESTED
Round: 1

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
