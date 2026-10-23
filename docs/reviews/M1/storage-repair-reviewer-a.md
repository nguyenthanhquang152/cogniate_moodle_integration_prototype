Verdict: APPROVE
Round: 2 (triage revision 4 design only, fresh Reviewer-A instance; see "Round 2" at the end. The Round 1 text below is unchanged, including its CHANGES_REQUESTED decision for revision 3.)

# Reviewer-A: R1-A source repair and storage triage revision 3

Role: independent Reviewer-A (lens: right and safe — correctness, security, data integrity, required field values, process identity, privilege and evidence boundaries). Task `task_b2f7b073d30f`, dispatch `ctx_4dd7233e0ddd`, run `run_ebe671ad72a9`. Model: Claude Code Opus 5.5, xhigh. No subworker. Date: 2026-10-21.

| Target | Decision |
| --- | --- |
| **Target 1 — source**, R1-A at `01ce5bc` | **APPROVE.** No BLOCKER, MAJOR or MINOR. One NIT (A-SRR-01). |
| **Target 2 — design**, triage revision 3, `M1.md` P-1a text and ADR-012 revision 3.6 at `ab28585` | **CHANGES_REQUESTED.** One MAJOR (A-SRR-02), two MINOR (A-SRR-03, A-SRR-04), two NIT (A-SRR-05, A-SRR-06). |

The file verdict is CHANGES_REQUESTED only because of Target 2. The Target 1 approval stands alone. It does not depend on the Target 2 corrections.

Status: bounded source and design review. It gives no runtime or acceptance credit. It authorizes no implementation, criterion change or runtime action. The latest full result stays FAIL at `aaa823b` (438 PASS, 50 FAIL). All 32 real-LMS rows stay UNVERIFIED. Local Canvas stays DEFERRED.

## 1. Reviewed objects

| Object | Identity |
| --- | --- |
| Target 1 commit | `01ce5bc2d2d26e4fb1226c5f4f19528fb9ed576b`, parent `4410e85`. Diff: `infra/scripts/storage-oplock.sh`, `infra/scripts/storage-oplock.test.mjs`, `infra/compat/storage-compat.sha256` only. `git diff aaa823b 01ce5bc -- . ':(exclude)docs'` shows the same three files. |
| Target 1 file hashes | `storage-oplock.sh` `90d246792c41d63268411bdfec4e9e04764f89d57d51343a0f60c1b88969ca96` (equal in the commit, the work tree and line 4 of `storage-compat.sha256`). The other three hash-list lines equal their files. |
| Tests tree | `4c7e067feedc644f955afee37806f06e7273dd04` at `aaa823b`, `4410e85`, `01ce5bc` and `ab28585` (unchanged). |
| Target 2 commit | `ab285856c139ddd50be8c8482eec1a330b7055da`. `git diff 01ce5bc ab28585` changes the three Target 2 files plus `docs/team/**` only. |
| Target 2 file hashes (equal to the Lead's message) | `storage-full-round-triage.md` `70ba4f9b5a2e61ce79296b9d689618f9a56ddc3d5a8ea0f6189c8f0514241dba`; `M1.md` `b648853cea837284020229a99db81b699066fa916876f90905eb374fdba61057`; `ADR-012-sqlite-volume-storage.md` `57602ca4cf9dc82ea2fb874d2ef8618dad204ca7d1727bfa56ee3fa6746fa589` |
| Baselines | Normative baseline `4410e85` (ADR-012 §7, §12). Prior proposal `2b0081d`. Prior blind reports: Reviewer-A `a58b477`, Reviewer-B `badde65` (inputs, not verdicts on this target). |
| Author evidence (input) | `/Users/quangnguyen/cogniate-author-diagnostics/storage-command-repair-task_9568f8506827-20261021T1230Z`: `report.md` `52be8edb800a73f4901756648d4a7df49239c3db62c83ab52273a4ce35699889`, `MANIFEST.sha256` `8c26129bfe248f992e929e1e827647651ae38535e3046d8fcc30da85d8d10b28`. All 36 manifest entries match. Every file is now `0600`, every folder `0700`. `mode-deviation.txt` discloses three files created at `0644` under a `0700` parent and corrected later. It claims no compliance from creation. I accept that record as stated. |

Normative text read: `docs/team/charter.md`; the phase plan checkpoints of 12:29 and 12:45 UTC; ADR-012 §4, §7, §11, §12, §15 at `4410e85` and `ab28585`; `M1.md` AC-M1-41 rows `a-fresh`, `a-serialize`, `d-mountpoint`, `d-content-folder`.

## 2. Method and independence

- Host only. No Docker or Compose command, no product stack, no live service, no account, no tunnel, no settings change, no evidence mutation.
- Scratch: `/Users/quangnguyen/cogniate-review-runs/storage-repair-reviewer-a-task_b2f7b073d30f-20261021`, mode `0700` from creation, umask `077`. Every file is `0600`; no file or folder has a group or other bit. Evidence manifest `MANIFEST.sha256` (`fd053f9bfae501b866f594af38d7345a86212b4bc57adba913772348dff9e0fc`) lists 16 files in `ev/` and `probes/`.
- A Docker stub was first on `PATH` for every run. It records any call and exits 97. It recorded zero calls.
- I ran only the 18 focused lock tests, nine mutants of them, five extra probes and one value variant of `storage-compat.test.mjs`. I did not rerun `npm run test:infra` or the root `npm run check`. The Author's 84 infrastructure tests and 1,123 root tests stay Author claims.
- Blind review: I did not read the other storage-repair reviewer's report, output, messages or summary. I read only my own worker inbox: one Lead message (`msg_2c8ddbab4906`, Target 2 frozen). I did not read the Target 2 work-tree files while the Architect wrote them; I read them only through `git show ab28585`.
- No secret value is in this report.

## 3. Target 1 — source decision: APPROVE

### 3.1 The change

- `storage_lock_acquire` keeps its own command in `STORAGE_LOCK_COMMAND` (`infra/scripts/storage-oplock.sh:369`), next to `STORAGE_LOCK_RUN_ID`, not exported. Acquire passes that same value (`:370`).
- `storage_lock_release` passes `--command "$STORAGE_LOCK_COMMAND"` (`:388`). The embedded JavaScript is byte-identical: `ctxOf` already reads `--command` (`:194`), and `release()` writes `ctx.command` on both `storage_lock_released` and `storage_lock_lost` (`:170–181`).
- No change to the lock algorithm (A1–A6, release steps 1–3), the record, the event shape, `ownerView`, `addContainer` or the self-check.
- The unit tests now assert values (`storage-oplock.test.mjs:76–79`, `:82–98`, `:206–219`, `:221–233`). The compatibility hash is updated in the same commit (ADR-012 §12).

### 3.2 Acceptance checks

| Check | Result | Evidence |
| --- | --- | --- |
| Normal release names the own command | Yes. Record, acquired event and released event have the identical string; same `runId`. | Test `:93–97`; baseline 18/18 PASS (`ev/t1-baseline-01ce5bc.txt`) |
| `storage_lock_lost` names the own command; `owner` names the other record | Yes. `lost.command` = `test-lost`, `lost.runId` = own; `owner.command` = `other-owner`, `owner.runId` = the foreign id; the foreign record stays. | Test `:206–219` |
| `TERM` and failing-command paths | Yes: `exit 7` → 7 and `TERM` → 143, each released with its own command and `runId`. | Test `:221–233` |
| `INT` path (extra probe) | Yes: exit 130; `storage_lock_released` with `test-int` and the same `runId`. | `ev/t1-extra-probes.txt` P1 |
| Odd command strings (extra probe) | A value that starts with `--run-id`, has a newline, quotes and `$HOME` round-trips unchanged; the pairwise option parser takes values by position. An empty argument becomes `unknown` (`:365`). A caller with `set -euo pipefail` releases normally. | P3, P4, P5 |
| Old-build route (optional value check, outside the Author scope) | All 21 released events of the compatibility `enable`, `disable`, `run -- npm run stack:up`, `run -- npm run test:acceptance …` and `status` paths equal their acquire command. 14/15 tests pass; the one failure is my relocation artifact (`HERE`-relative read of `stack-up.sh`), not a product effect. | `ev/t1-compat-value-variant.txt`, `ev/t1-compat-events.json` |
| Hash scope | Line 4 equals the new file. The other three lines are unchanged and equal their files. No other file pins the old hash, except the triage §1 input table, which correctly identifies the `aaa823b` input. | `shasum`, `git grep` |
| Tests catch missing, wrong, empty and foreign commands | Yes. See §3.3. | `ev/t1-M*.txt` |

### 3.3 Mutation results (each against the unchanged 01ce5bc test file)

| Mutant | Tests that fail |
| --- | --- |
| M1 release without `--command` (the `aaa823b` behavior) | 7 (run, lost, `TERM`, and four through the per-test `afterEach`) |
| M2 release with a constant wrong command | 3 (run, lost, `TERM`) |
| M3 `storage_lock_lost` takes the foreign record's command | 1 (lost) |
| M4 `export STORAGE_LOCK_COMMAND` | 1 (run, `commandVar=unset`) |
| M5 release with an empty command | 7 |
| M6 `null` command only on `storage_container_removed` | 2 (only the `afterEach` check sees it) |
| M7 `null` command only on `storage_lock_reclaimed` | 4 (only the `afterEach` check sees it) |
| M8 the trap path alone uses a wrong command | 1 (`TERM`) |
| M9 `storage_lock_lost` takes the foreign record's `pid` | 0 (equivalent in this fixture; A-SRR-01) |

M6 and M7 prove that the describe-level `afterEach` runs before the file-level temp removal on Node 24.21.0. So the "every event names a command" check is not vacuous.

### 3.4 Inherited export limitation (disclosed by the Author)

Probe P2: when the caller's environment already exports `STORAGE_LOCK_COMMAND`, the assignment keeps the export attribute. The guarded child then sees the **current** command string, not the inherited value. Both events stay correct.

Assessment, proportionate to the supported callers: no finding.
- ADR-012 §7 does not require the variable to be unexported. The test's `commandVar=unset` check is an Author choice, valid for a clean environment.
- The value is not secret. The same string is already in `owner.json`, on stdout and in `infra/.logs/storage-lock.jsonl`.
- No supported caller (the npm scripts, the QA harness, the compatibility wrapper) exports this name. A nested guarded command reassigns it before use, and re-entry is refused by `COGNIATE_STORAGE_LOCK_RUN`.

### 3.5 Target 1 findings

#### A-SRR-01 — NIT — the lost test cannot tell the own `pid` from the foreign `pid`

- File: `infra/scripts/storage-oplock.test.mjs:209`, `:215`.
- Problem: the fixture changes only `runId` and `command` of the planted record. Its `pid` stays the own `$$`. So `lost.pid === acquired.pid` also holds when the event takes the foreign `pid` (mutant M9 survives).
- Evidence: `ev/t1-M9-own-runid-on-lost-but-foreign-pid.txt` (18/18 PASS).
- Fix (optional, outside the R1-A command scope): also set `k.pid` (for example to `1`) in the planted record, and assert `lost.owner.pid` ≠ `lost.pid`. No product change.

Not a finding: Reviewer-A's optional "same variable in `storage_lock_add_container`" (prior §6.1) is not done. `add-container` writes no event, so it has no observable effect.

## 4. Target 2 — design decision: CHANGES_REQUESTED

### 4.1 Lead conditions

| Lead condition | Result | Where |
| --- | --- | --- |
| R1-A required; R1-B / P-2a rejected | Met. The §10.1 scope matches `01ce5bc` exactly; V1-5 matches the Author tests. | triage §0, §3, §10.1 |
| P-1a: keep `P`, delete the children, fresh-lane `ENOENT` precondition → `BLOCKED`, hand move of `P` unsupported | Met. Exact text below (§4.3). | `M1.md:230`, `:253–259`; triage §6 N-2 |
| P-3 mandatory: every protected copy `0600` at creation; the recorded or planted mode into a volume | Met in design, **except the source-inventory scope** (A-SRR-02). | triage §7.2–§7.5, V4 |
| Log, clock and oracle binding controls | Met. | §3.1, §8, V1, V6 |
| Scoped cleanup failure → abort with all 70 results | Met. | §4.3, V2-4, V2-8 |
| Exact `Origin`; unchanged CSRF negatives | Met. Both negatives are named and kept on the same candidate. | §5, V3-1, V3-2 |
| Same-candidate migration (12) + storage (70) diagnostic with a fresh handoff, before two 488-row rounds, 12 legacy groups, M2 and T7; zero credit | Met. One precision item (A-SRR-04). | §9 steps 6–8, V8-1 |
| Copy inventory includes compatibility captures of exported environment values | Met: site #14 (`configDiff` `env -0`) is in private scratch, scanned at removal, and V4-8 checks `0600` at creation. | §7.2 #14, §7.4, V4-8 |
| Exact QA ownership; unambiguous copy inventory, root and scan-exception definitions | **Not met** for the V4-9 scope (A-SRR-02). Root closure is a MINOR (A-SRR-03). | §7.2, §7.4, §10.2, V4-9 |
| O-1: root read-only precision, no expanded writes | Met. I checked the product: `sqlite-lock-probe.mjs:567` reads as root; `:573` drops privilege before evaluation, output and the `mark-started` identity write; the deadline path drops before output (`:647`). | ADR-012 `:102` |
| A-SFT-08 MINOR to M4, outside R1-A; older deferrals unchanged | Met. | §7.6, §13 |

### 4.2 Closure map of the prior MAJOR findings

| Prior finding | Condition | Status at `ab28585` |
| --- | --- | --- |
| A-SFT-01 / B-SFT-02 — diagnostic cannot run all 70 rows | Migration then storage, same candidate, one window, one handoff that this migration run writes; zero credit; both lanes under G1, W1–W4, §15, cleanup, scans | **Closed in text.** §9 step 7 (new `0700` folder, absent path, exclusive create, no `aaa823b` reuse); V8-1 host-only feasibility before the grant. Precision: A-SRR-04 (MINOR). |
| A-SFT-02 — P-3 sites and scan scope | One private helper and one into-volume helper; named protected classes; scan every QA-made root; `TMPDIR` in the private root; V4-1 per site with a `0644` source; V4-3 negatives; a source-inventory check; P-3 mandatory | **Closed except the source-inventory scope.** Sites #1–#16 and X1–X4 match every copy and temp call in the runtime modules (I listed them all). The V4-9 scope also matches files and calls that the text does not classify: **A-SRR-02 (MAJOR)**. |
| A-SFT-03 / B-SFT-04 — P-1a deletion; coverage | Delete, never rename; keep `P` with identity checks; `a-fresh` asserts `ENOENT` → `BLOCKED`; stated §15 limit; reason for the move; criterion before QA | **Closed.** See §4.3. |
| B-SFT-01 — scan conflicts with QA's own files | Full scan of `out/`, `backups/`, `quarantine/`; exact `bin/` rule; markers `0600` + `wx`; scan after every step; hit record; correction by Lead decision | **Closed.** §7.4 `bin/` rule (one entry, `scriptSha`, `0555`); #15; §7.5 hit and bounded `O_NOFOLLOW` correction; V4-5, V4-6, V4-7. |
| B-SFT-03 — weaker `a-serialize` oracles | Equality with the acquire command; `pgid` identity after an offset; wait rule; wait-owner check; V1-1b, V1-6, V1-7 | **Closed.** §3.1 steps 1–9; V1-1b, V1-6 to V1-9, V1-11. V1-12 precision: A-SRR-05 (NIT). |

The prior MINOR and NIT items (A-SFT-04 to A-SFT-07, B-SFT-05 to B-SFT-12) are mapped in triage §14. I checked each mapping against the text. I found no conflict, except the citation precision in A-SRR-06. The control-id split (Reviewer-A V2-5 → V2-5; Reviewer-B V2-5 → V2-6) is unambiguous.

### 4.3 P-1a criterion text (`M1.md:230`, `:253–259`)

I confirm the exact text as correct, bounded and testable:
- `a-fresh`: `lstat` of `P`, `P/packages`, `P/uploads` → `ENOENT` before `stack:up`; any other result → `BLOCKED` (setup), never PASS. A file at `P` gives `ENOTDIR` for the children, so it is also `BLOCKED`. The storage clone setup (`run-m1.mjs:244–249`: install, `npm ci`, `gen-env`) does not call `prepare_content_folders`, so the precondition can hold.
- `d-content-folder`: both services stopped; host user, no container; `lstat` safety checks before any deletion; deletion of the two children only, never a rename, never a link follow; `P` device, inode, owner, group and mode equal before and after; children `0700` of the host user after `stack:up`; a failed cleanup stops the phase.
- The limit and the revision note say why the case moves (the old case was a hand move of `P`, outside ADR-012 §15). No row id or count changes.

### 4.4 Target 2 findings

#### A-SRR-02 — MAJOR — the V4-9 source-inventory scope matches calls that the text does not classify

- File: `docs/architecture/tasks/storage-full-round-triage.md:443` (V4-9), `:283–287` (X1–X4), `:269` (site #4), `:384` (recommended self-test files).
- Problem: V4-9 checks `tests/host/storage-*.mjs`, `m1-migration.mjs` and `run-m1.mjs`. It FAILs on any `copyFileSync`, `copyFile`, `cpSync`, `cp` or `mkdtempSync` under `os.tmpdir()` outside the helpers and X1–X4. As written, this check fails on the unchanged harness and on the controls that the triage itself recommends:
  1. The glob `storage-*.mjs` also matches four existing self-test files. They have eight `mkdtempSync(os.tmpdir())` calls: `storage-fixture-script.selftest.mjs:16`, `:65`; `storage-inventory.selftest.mjs:37`; `storage-oracle.selftest.mjs:14`; `storage-rows.selftest.mjs:42`, `:135`, `:173`, `:194`. None is X1–X4.
  2. The recommended new files `storage-private-copy.selftest.mjs` and `storage-source-inventory.selftest.mjs` (`:384`) also match the glob. V4-1 needs `0644` sources in a temp root, and the V4-9 file must hold the forbidden call names and its own mutation input.
  3. Site #4 keeps `logicalRead`'s scratch in the fixture container's own writable layer (the recovery oracle requires it, `M1.md` AC-M1-41). Its default is `mkdtempSync(path.join(os.tmpdir(), …))` (`storage-fixture-script.mjs:107`, `:111`). Site #4 changes only the host `scratchBase`. So the in-container call stays, and it is neither a helper nor X1–X4.
- Why MAJOR: this is the same class as A-SFT-02 problem 2 and B-SFT-01, now in the control that enforces P-3. §7.4 (`:312`) correctly forbids an exemption during implementation. So QA must either stop for a new Architect round, or choose a scope while coding. P-3 is mandatory before the next runtime window, so this blocks QA step 3 of §9. The Lead requires the exception definitions to be unambiguous before QA edits.
- Evidence: `git show ab28585:<file> | grep -n -E 'copyFileSync|copyFile\(|cpSync|mkdtempSync|tmpdir\('` over every file in the V4-9 scope. The runtime modules match #1–#16 and X1–X4 exactly; the extra matches are the three groups above.
- Fix (text only; no design change):
  - State the V4-9 scope as the runtime modules: `tests/host/storage-*.mjs` **without** `*.selftest.mjs`, plus `m1-migration.mjs` and `run-m1.mjs`.
  - State that `*.selftest.mjs` files are outside V4-9 because they use only synthetic data in their own temp roots, which they remove. If the Architect wants them inside, add them as named exceptions instead.
  - Add one named exception for site #4: the `logicalRead` scratch inside the fixture container (the container's `os.tmpdir()`, never a host path). Every host call must pass a `privateScratch` path as `scratchBase`. V4-9 then FAILs on a host call without it.
  - Keep "no other exception during implementation".

#### A-SRR-03 — MINOR — the scan does not close the private root

- File: triage `:304–305` (§7.4).
- Problem: §7.4 scans `out/`, `backups/`, `quarantine/`, `scratch/` and `bin/` of each lane private root. It says nothing about other entries of that root. A protected copy at the root itself, or in another subfolder, is outside every scan area. V4-9 sees only copy calls, not `writeFileSync`. So V4-R ("zero scan hits") cannot see such a file.
- Evidence: today the failed run's root `P8` has exactly `backups/`, `bin/`, `out/` and `quarantine/` (`ls -la`, metadata only). So the gap is latent, not observed.
- Fix: one sentence in §7.4: the lane private root holds exactly `bin/`, `out/`, `backups/`, `quarantine/` and `scratch/`, each a `0700` folder of the host user; any other entry FAILs the scan. Add it to V4-5 as one more case.

#### A-SRR-04 — MINOR — "this window's migration clone and backup" has no operational definition

- File: triage `:349` (§9 step 7), `:451` (V8-1).
- Problem: the storage child must accept the handoff only when `m123Clone` and `m123Backup` are "this window's" clone and backup. V8-1 expects `BLOCKED` for "a clone or backup outside the window's folders". The text does not say how the child knows those folders. Two separate `--phase` children share only `QA_M1_HANDOFF_FILE`. QA must invent the binding.
- The main guarantee already holds: a new `0700` folder, an absent path and an exclusive create (#16) bind the file to this window. This item is defense in depth, so it is MINOR.
- Fix: name the binding. For example: QA records the migration clone path (`r.CLONE` of that child) in the window folder before the storage child starts; the storage child requires `m123Clone` to equal it, and `m123Backup` to be inside a `qa-m1-private-backup-*` folder that is a sibling of that clone and was created after the window folder. Else → `BLOCKED`. V8-1 then tests a clone of another base and a backup of another window.

#### A-SRR-05 — NIT — V1-12 does not cover the `npm run` hop of the real row

- File: triage `:423` (V1-12); `tests/host/storage-rows.mjs:397`.
- Problem: the row spawns `npm run stack:data-backup` (npm, then a shell, then `stack-data.sh`). V1-12 spawns `bash infra/scripts/storage-oplock.sh run -- true` directly. So V1-12 does not show that npm keeps the guarded script in the spawned group.
- Not a safety gap: the oracle fails closed ("backup run not identified"), and V1-R checks the `pgid` at runtime.
- Fix (optional): run V1-12 through `npm run` of a temp package script that calls the lock helper, with the Docker stub first on `PATH`.

#### A-SRR-06 — NIT — citation and helper precision

- `storage-full-round-triage.md:204` cites `app.test.ts:122–124` for the pre-authentication negative. The assertion is at `:125` (`expect(login.statusCode).toBe(403)`). Cite `:122–125`.
- Site #14 (`:279`) asks for "the private helper (empty, `0600`)". §7.3 defines the private helper as a copy with a source hash check. Define the empty-create variant (exclusive `0600` create with no link follow, `fstat` check, close) so that V4-8 has an exact target.

## 5. Remaining limitations

- No runtime claim. I give no retrospective green and no acceptance credit. The full `aaa823b` result stays FAIL (438 PASS, 50 FAIL). The migration-plus-storage diagnostic, both full rounds, 12 legacy groups, strict W4, cleanup, scans, fresh M2 and T7, conformance and guides stay pending. All 32 real-LMS rows stay UNVERIFIED; local Canvas stays DEFERRED.
- The new lock-helper hash reaches `j-migration` and `j-snapshot` through the old-build route. Those rows need fresh runtime evidence on the frozen candidate.
- I did not run `npm run test:infra` or the root `npm run check`. The 84 infrastructure tests, 1,123 root tests and five fixture skips stay Author claims.
- The P-1a deletion uses measured topology R3. A rename or hand move of `P` stays unmeasured and outside the ADR-012 §15 guarantee, as the text states.
- The Author evidence mode deviation (three files at `0644` under a `0700` parent, later `0600`) is recorded, not repaired by this review. Product copy-then-`chmod` (A-SFT-08) stays a MINOR for M4.
- No push or main merge is implied.

## Round 2 (2026-10-21) — bounded design confirmation of triage revision 4

Round 2 decision: **APPROVE** (revision 4 design only). No BLOCKER and no MAJOR finding. One MINOR (A-SRR-07) and one NIT (A-SRR-08). Neither blocks QA step 3.

Reviewer: a **fresh** Reviewer-A instance (lens: right and safe). Claude Code Opus 5.5, xhigh, no subworker. Task `task_0bf223a0ef67`, dispatch `ctx_5f33a90989cb`, run `run_ebe671ad72a9`. I did not write Round 1. Round 1 (§1–§5 above) and its probes belong to the earlier Reviewer-A instance. I used them as input only. Every Round 2 result below comes from my own reads and probes.

Status: design confirmation only. It gives no runtime or acceptance credit. It authorizes no implementation, criterion change or runtime action. The full result at `aaa823b` stays FAIL (438 PASS, 50 FAIL). All 32 real-LMS rows stay UNVERIFIED. Local Canvas stays DEFERRED.

### R2.1 Reviewed objects

| Object | Identity (I computed each value) |
| --- | --- |
| Target | `docs/architecture/tasks/storage-full-round-triage.md`, revision 4 at `2d763fec502f6b7758b7ed56f51613183e5021ce`. SHA-256 `ade4e8a0f9e54823040828758b7683d5c9b230587747f3ef3c89ef8e99f9a032` (commit and work tree are equal). |
| Baseline | Revision 3 at `ab285856`. SHA-256 `70ba4f9b5a2e61ce79296b9d689618f9a56ddc3d5a8ea0f6189c8f0514241dba`. |
| Diff scope | `git diff --stat ab28585 2d763fe -- docs/architecture tests infra services packages apps package.json` changes only the target file (182 lines added, 48 removed). The product is equal to `01ce5bc` outside `docs/`. The tests tree stays `4c7e067feedc644f955afee37806f06e7273dd04`. |
| Unchanged, not reviewed again | `M1.md` P-1a: `b648853cea837284020229a99db81b699066fa916876f90905eb374fdba61057`. ADR-012 O-1: `57602ca4cf9dc82ea2fb874d2ef8618dad204ca7d1727bfa56ee3fa6746fa589`. I recomputed both at `2d763fe`; they are equal. The R1-A (`01ce5bc`) source approvals stay. I did not repeat that review or its tests. |
| Inputs (historical, read with `git show`) | Reviewer-A Round 1 at `7fbf7c8` (`9b21a285faf78521b3060c454779f9503f87dbac303f1f383d5637c66c136748`; this file before Round 2, unchanged at `2d763fe`). Reviewer-B at `0a97fe9` (`28cf870e126f3f52cf9e3b5a4fefa81b2b1c1db8e8f43876e17501cca29d4cc7`). QA testability Round 1 at `0468b19` (`de4116bf4f30dc019fdf76a9d18bf6c35fa7f0737b4e0ae6434d8cd653e91af3`). All values equal the Lead's values. |

Blind review: I did not read the current work-tree `storage-repair-reviewer-b.md`, a QA Round 2 addendum or output, or a message of another reviewer. My inbox had no message for this dispatch.

### R2.2 Method

- Host only. I read source with `git show` at `2d763fe` (tests tree `4c7e067`, product `01ce5bc`). I listed only metadata (names, types, modes, owners) under `/Users/quangnguyen/cogniate-qa-runs`.
- Probes ran in a new private root: `/Users/quangnguyen/cogniate-review-runs/storage-repair-r2-reviewer-a-task_0bf223a0ef67-20261021T133941Z` (mode `0700` from creation, umask `077`). Every file is `0600`, except the Docker stub (R2.6). Evidence manifest `ev/MANIFEST.sha256`: `8cc25171205d16b7929e0199a9c8067418c8414125a1fbcb6a2a5344626911bf`.
- A fail-closed Docker stub was first on `PATH` for the one probe that could reach Docker. It records each call and exits `97`. It recorded one call (`docker ps`), which it refused. No real Docker or Compose command ran.
- No test suite, no product stack, no `.env`, no secret, no settings change and no shared-evidence change.

### R2.3 Closure map

"Closed" means: the revision 4 text meets the condition, and the pinned source makes it feasible. The Lead decides closure.

| Finding | Condition | Revision 4 text | Status |
| --- | --- | --- | --- |
| A-SRR-02 (MAJOR) = QA-SRT-01 (MAJOR) | Runtime-module scope; self-tests outside; a named in-container scratch; every host call passes `privateScratch`; no exception during implementation | §7.2 source inventory (`:311–335`), X1–X8, #4 without a default (`:297`), V4-1 (`:522`), V4-9 (`:530`) | **Closed** (R2.4.1) |
| A-SRR-03 (MINOR) | The root holds exactly five folders; any other entry FAILs; one more control case | §7.4 closure row (`:355`), V4-10 (`:531`) | **Closed** (R2.4.2) |
| A-SRR-04 (MINOR) = QA-SRT-04 (MINOR) | Name the binding; a host-only V8 unit without a real migration child | §9.1 (`:410–434`), V8-1 to V8-5 (`:539–543`) | **Closed**, with one control precision: A-SRR-07 (MINOR) (R2.4.6) |
| A-SRR-05 (NIT) = B-SR-01 (MINOR) | V1-12 through the `npm` hop | V1-12 (`:505`) | **Closed.** My probe gives every expected value (R2.4.5). |
| A-SRR-06 (NIT) = B-SR-03 (NIT) | The `app.test.ts` citation; a defined empty-create helper | §5 `:123–126`; §7.3 private empty file (`:343`); V4-8 | **Closed.** At `2d763fe` the test starts at `:123`, the request is at `:125` and the assertion is at `:126`. So Round 1's `:122–125` was wrong, and revision 4 is right. |
| B-SR-02 (MINOR) | A written run-or-stop rule before the grant | §0; §9 step 7 (`:402`); V8-6 | **Closed** (R2.4.7) |
| QA-SRT-02 (MINOR) | One final mode for each site | V4-1 (`:522`) | **Closed** (R2.4.4) |
| QA-SRT-03 (MINOR) | Trigger "step 3 started" | §4.0 step 8 (`:152`), V2-10 | **Closed** (R2.4.3) |
| QA-SRT-05 (MINOR) | "QA plant" defined; an exact site list | §4.3 (`:187–211`), V2-8 (`:517`) | **Closed** (R2.4.3) |

Accepted deferrals stay unchanged in the text: A-SRR-01 (NIT, outside R1-A, §0); A-SFT-08 (MINOR, product copy-then-`chmod`, M4, §7.6); B-BM-01, A-SOR-01/B-SOR-01, post-reset build-request coverage and A-T9-C01 (§13). The QA items SD-3 to SD-6 stay as recorded (§13). IR-1 to IR-6 stay implementation notes.

### R2.4 Checks of the changed controls

#### R2.4.1 Token rule and exceptions X1–X8 (V4-9)

- I ran the exact pattern `/\b(copyFileSync|copyFile|cpSync|cp|mkdtempSync|mkdtemp|tmpdir)\s*\(/g` with Node over the nine runtime modules at `2d763fe` (`ev/v4-9-tokens.json`). Counts today: `storage-lane` `copyFileSync` 2, `mkdtempSync` 1, `tmpdir` 1; `storage-rows` `cpSync` 5, `copyFileSync` 2, `mkdtempSync` 1, `tmpdir` 1; `storage-compat-route` `mkdtempSync` 2, `tmpdir` 2; `storage-fixture-script` `copyFileSync` 5, `mkdtempSync` 1 (`:111`), `tmpdir` 1 (`:107`); `storage-oracle` `copyFileSync` 1; `m1-migration` `mkdtempSync` 2, `cpSync` 1; `run-m1` `mkdtempSync` 1, `tmpdir` 1; `storage-docker` and `storage-inventory` 0.
- Each match is at a site #1–#5 or #7–#14 (#1 and #2 share `:190`), or at X1–X4, X7 or X8. The triage statement at `:333` is correct.
- The target counts are reachable without an exemption. QA removes the calls of sites #1–#5 and #7–#14. X1–X4, X7 and X8 stay. The one `tmpdir` moves from the `logicalRead` default (`:107`) to `main()`, operation `logical` (X6). The helpers need only `open`, `mkdir`, `readdir` and `lstat`.
- X6 is sound. The only host call of `logicalRead` is `storage-lane.mjs:225` (#10). Every other logical read runs `main()` in a `storage-fixture` container. That container uses `--rm`, the pinned image `node:24.22.0-alpine3.24`, no `--env`, and only the two lane volumes, `/qa/bin` and `/qa/out` (`storage-docker.mjs:12`, `:16`, `:130–131`). So its `os.tmpdir()` is in the container layer.
- The scope removes the eight self-test `mkdtempSync` calls (four storage self-tests). This weakens no site check: the V4-9 mutation "default `scratchBase` put back" and the V4-1 "throws without `scratchBase`" check both cover the one real bypass of #4.
- Note (no finding): the diagnostic folder `D` and the §8 log segments must add no token to `run-m1.mjs` or `storage-rows.mjs`. `mkdirSync` with random hex (as in `privateScratch`), a reuse of the X4 call, and `saveText` all fit. V4-9 enforces this.
- One residual limit is not stated: A-SRR-08 (NIT).

#### R2.4.2 Private root closure (V4-10)

- `StorageLane.boot()` makes the root and `bin/`, `out/`, `backups/` and `quarantine/`, each with `mkdirSync` and `chmodSync 0700` (`storage-lane.mjs:41–44`). No host module writes another entry into the root (`git grep` of `.private` and `storage-private`). Product output goes into folders under `backups/` and `quarantine/` (`newFolder`). QA holds go under `out/`.
- `migrationRun` and `snapshotMigrationRun` each make two `StorageLane` objects with one runner. They share one root, and only `candidateLane.boot()` runs (`m1-migration.mjs:180`, `:280`). The closure row covers that root.
- The verified set is correct. I listed nine roots. Each root is `0700` and has exactly `backups/`, `bin/`, `out/` and `quarantine/`, each a `0700` folder of the host user (metadata only).
- The V4-10 variants (a)–(f) fail a scan of the named areas only, and a name check without type, owner and mode.

#### R2.4.3 Partial plant, QA plant, 21 sites and 27 injections

- The root plant is one fixture container with two `lchown` operations in order (`storage-rows.mjs:532`). "Step 3 started" covers a failure after the first operation. On a timeout, QA removes the container by name before it throws (`storage-lane.mjs:95–98`). So the restore does not race a live plant container. If that removal fails, the lock or listing step of the restore fails, and §4.3 stops the phase (fail closed).
- I checked all 21 line references at `4c7e067`: `:282`, `:351`, `:472`, `:488`, `:496`, `:506–516`, `:527`, `:532`, `:549`, `:552`, `:570`, `:651`, `:803`, `:874`, `:885`, `:976`, `:983`, `:1051`, `:1221`, `:1254` and `:1119–1128`. Each is the stated restore. `identityCase` has seven calls in five rows (`:583`, `:588`, `:592`, `:597` with `:601`, `:607` with `:611`). 20 sites + 7 calls = 27 injections.
- The QA-plant definition keeps the in-volume `.qa-scratch-*` of `b-oracle-*` with its existing check. It drops no restore site.

#### R2.4.4 Creation mode and restored mode

- V4-1 checks the creation hook (`0600`, size 0, the same device and inode) at every copy site #1–#13. The final mode `0600` applies only to the private-helper sites. Sites #2, #5 and #6 end at the V4-2 mode. The two controls now agree.
- The into-volume helper sets the target mode with `fchmod` before it closes the file, so the creation hook and the final mode do not conflict. For `identityCase`, the return mode must come from the `copyout` record, because the held copy is now `0600` (IR-2). V4-2 already compares the result with QA's listing before the row.

#### R2.4.5 Exact `npm` path (V1-12)

- Source: `stack-data.sh` sources `lib.sh` (no Docker; `.env` is optional and defaults apply), runs `storage_compat_guard` (a file check), then `storage_lock_acquire "stack:data-backup"`, before any Docker call. A6 logs `storage_lock_acquired` at `storage-oplock.sh:142`, before the lister at `:144`. A lister failure takes the quiet release (no lock folder remains) and exits 1.
- Probe (`ev/v1-12-npm-path.json`): the row's spawn shape, `detached` `npm run stack:data-backup -- --out <ev>/backup-out`. Its `cwd` is a scratch copy of `package.json` and four `infra/scripts` files of `2d763fe`; no `.env`, no `npm_*` variable, project `qa-r2a-probe`, the stub first on `PATH`. Result: exit 1; exactly one `storage_lock_acquired` event; `command` = `stack:data-backup`; `pgid` = the spawned pid; the stub's only call (`docker ps`) came after the acquire line was written; no `storage-op.*` folder remains; no output folder was made. Node `v24.21.0`, npm `11.19.0`.
- So V1-12 can pass as written on this host, and its stated mutations change the result.

#### R2.4.6 Window binding (§9.1), diagnostic and `full` rounds

- The check uses facts that do not come from the handoff. The parent gives `w`. The storage child knows its run root, project, candidate SHA, `s` and uid. Both children use `core.mjs:84–85`, so the clone name is `<project>-<first 8 hex>-<ISO time with ':' and '.' replaced by '-'>`, and item 3's pattern matches it. The real backup roots under `~/cogniate-qa-runs` match item 4's pattern.
- The `full` mode is feasible without a phase change. `FULL_PHASES` is `sim`, `snapshot-isolated`, `snapshot-upgrade`, `migration`, `storage` (`m1-phases.mjs:4`), one child each (`run-m1.mjs:139–158`). A new `w` before each migration child rejects the clones of the earlier phases. The accounting folder is `0700`. `writeHandoff` is the last write of `H`. The product manifest has `composeProject` and is written `0600` (`stack-data.mjs:72–78`, `:703`).
- Birth times work on this host (macOS, APFS). `os.tmpdir()` is under a link (`/var` → `/private/var`), so the `realpath` note of V8-1 is right. The home folder has no link.
- One precision gap: A-SRR-07 (MINOR).

#### R2.4.7 Run-or-stop rule, mock outcomes, keep-after-hit, empty files

- Run-or-stop: the parent can observe each of (a)–(f) (exit code, result file, scan record, cleanup result, ownership record, grant). Any doubt gives "storage NOT RUN", then teardown and strict W4. This is stricter than revision 3 and drops no requirement. The diagnostic has no credit.
- V7-1: a row FAIL that a fake answer causes is allowed only when the dry run declares it first, with its row id and cause. Any other FAIL still FAILs the dry run, and "each §4.3 restore runs" stays. So a declared FAIL cannot hide a missing hook, restore, row or exception. The fake must bring each restore-site row to its plant. This is QA work, not a conflict.
- Keep-after-hit (§7.3): a kept scratch stays in the `0700` root, inside the scanned `scratch/` area. A safe correction leaves `0600`, so later scans do not hit again. A refused correction stops the phase. This agrees with §7.5 "no deletion".
- Private empty file (#14): the capture shell writes only the two files that QA made first, with `>` (`storage-compat-route.mjs:204–206`). `>` keeps the inode and the mode. So the `lstat` checks before and after the shell can pass on a correct tree.

### R2.5 Findings

#### A-SRR-07 — MINOR — §9.1 compares whole-millisecond host times with sub-millisecond file times

- File: `docs/architecture/tasks/storage-full-round-triage.md:416` (form of `w`), `:424–430` (items 1–4), `:539–540` (V8-1, V8-2).
- Problem: `w` and `s` have millisecond resolution (`toISOString`). `H.mtimeMs` and `birthtimeMs` have sub-millisecond resolution. The text does not state the unit of the compare, or how a control separates two ordered events. So two V8 cases do not pass reliably on a correct check:
  - V8-1, positive case: when the control writes `H` and takes `s` in the same millisecond, raw `H.mtimeMs ≤ Date.parse(s)` is false, so the check gives BLOCKED.
  - V8-2, "the clone made before `w`": when the clone and `w` are in the same millisecond, `w ≤ birthtime` is true, so the check does not give BLOCKED. This is true for raw and for floored times.
- Evidence (500 samples each): `ev/ms-window.json`: raw `H.mtimeMs > Date.parse(s)` in 496 of 500; floored, 0 of 500. `ev/ms-window-stale.json`: the stale clone is accepted in 500 of 500 (raw and floored), and in 0 of 500 when the control waits for the next millisecond.
- Effect: no runtime verdict changes. In real runs, `s` comes seconds after `H`, and the clones of earlier phases are minutes older. The risk is a mandatory host control that fails on a correct implementation, so QA must choose the unit while it writes the control. It is not a safety gap.
- Fix (text only; no rule change): (1) "The check compares whole milliseconds: `Math.floor` of each file time against `Date.parse(w)` and `Date.parse(s)`." (2) "In V8-1 to V8-5, the control waits until `Date.now()` changes between two ordered events. It still never sets a time."

#### A-SRR-08 — NIT — the V4-9 limit does not name aliased or computed access

- File: `docs/architecture/tasks/storage-full-round-triage.md:335`, `:553` (limits); `:596` ("fails closed").
- Problem: the text pattern needs the name directly before `(`. These forms give no match: an aliased import (`import { copyFileSync as c }`), a renamed destructure (`const { cpSync: c } = fs`), and computed access (`fs['cpSync'](…)`, `fs.cpSync.call(…)`). "Fails closed" is true for extra matches, but not for these forms.
- Evidence: my search found none of these forms in the nine runtime modules at `2d763fe`. So the gap is latent. V4-1 and the §7.4 scans find a wrong mode at run time, and the §9 step 5 source reviews read the QA diff.
- Fix: add one limit sentence, for example "An aliased or computed access is not matched; the lens-A source review of §9 step 5 checks for it." Optional, still without a parser: also FAIL on `\b(copyFileSync|copyFile|cpSync|mkdtempSync|mkdtemp|tmpdir)\b(?!\s*\()` in the runtime modules. That count is zero today.

### R2.6 Probe limits and deviations

- The V1-12 probe used a copy of `package.json` and four `infra/scripts` files, not the full `infra/` archive that V1-12 names. The lock path reads no other file, so the result applies. QA's control must still use the archive.
- I made the Docker stub with mode `0600` and then set `0700`, because a `PATH` lookup needs the owner execute bit. It never had a group or other bit.
- npm wrote its default debug log `~/.npm/_logs/2026-10-21T13_39_56_252Z-debug-0.log` (`0600`, outside my private root; command line and paths only; no secret). I left it in place.
- During setup, one helper file in `/tmp` (`0600`; it held only the private-root path) existed for some seconds. I deleted it. It is absent now.
- The timing results are for this host only (macOS, APFS, Node `v24.21.0`). I did not test another file system.
- I did not review `M1.md` P-1a, ADR-012 O-1 or R1-A again, and I ran no test suite. Round 1 §5 stays as stated.

### R2.7 Round 2 decision

**APPROVE** for the revision 4 design (`ade4e8a0f9e54823040828758b7683d5c9b230587747f3ef3c89ef8e99f9a032`). Each listed finding is closed in the text. The changed controls are feasible on the pinned source, with no weaker requirement and no new exemption. A-SRR-07 (MINOR) and A-SRR-08 (NIT) do not block QA step 3. The Lead can apply both as text precisions or defer them. No runtime or acceptance credit. No push or main merge is implied.
