Verdict: CHANGES_REQUESTED
Round: 1

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
