Verdict: APPROVE
Round: 1

# Storage repair — Reviewer-B: R1-A source and triage revision 3 design

Reviewer: Reviewer-B (lens: simplicity, operability, test quality, clear ownership). Claude Code Opus 5.5, xhigh, no subworkers. Task `task_3a8def196567`, dispatch `ctx_88c9755b5411`, run `run_ebe671ad72a9`. Date: 2026-10-21.

Blind review: I did not read `docs/reviews/M1/storage-repair-reviewer-a.md`, the output of its worker, its messages or a summary of it. I read only my exact worker inbox. The two older triage reviews (`a58b477`, `badde65`) were allowed input.

This is a bounded source and design review. It gives no acceptance credit and makes no runtime claim. It changes no product, test, architecture, team or evidence file.

| Decision | Target | Result |
| --- | --- | --- |
| **Target 1 — source** | R1-A at `01ce5bc` | **APPROVE.** No finding. |
| **Target 2 — design** | Triage revision 3, `M1.md` P-1a text, ADR-012 revision 3.6, at `ab28585` | **APPROVE.** No BLOCKER, no MAJOR. Two MINOR and one NIT. |

## 1. Reviewed objects

| Object | Identity (I computed or resolved each value) |
| --- | --- |
| Target 1 commit | `01ce5bc2d2d26e4fb1226c5f4f19528fb9ed576b`, parent `4410e85f2054a82c00466b4e19a474416140afea` |
| `infra/scripts/storage-oplock.sh` | `90d246792c41d63268411bdfec4e9e04764f89d57d51343a0f60c1b88969ca96` (at `4410e85` and `aaa823b`: `1d2be154e754b9f2c07451384b3c24e8ea483073d16d24f49b276f15d8956753`) |
| `infra/scripts/storage-oplock.test.mjs` | `e2b2224b257b45e5a249af744762c146bf0be0bf33662f5345c589f8ac7c2131` |
| `infra/compat/storage-compat.sha256` | `3337c5858f3d055e910d8002e139f3e7496ab17f2efc33cc39b46171f31d2747` |
| Target 2 commit | `ab285856c139ddd50be8c8482eec1a330b7055da` |
| `docs/architecture/tasks/storage-full-round-triage.md` | `70ba4f9b5a2e61ce79296b9d689618f9a56ddc3d5a8ea0f6189c8f0514241dba` (equal to the Lead's value) |
| `docs/architecture/tasks/M1.md` | `b648853cea837284020229a99db81b699066fa916876f90905eb374fdba61057` (equal) |
| `docs/architecture/adr/ADR-012-sqlite-volume-storage.md` | `57602ca4cf9dc82ea2fb874d2ef8618dad204ca7d1727bfa56ee3fa6746fa589` (equal) |
| Baseline product | `aaa823b25306c5e560f7c4050238b374dec4d4e3`. `git diff aaa823b 01ce5bc` outside `docs/` changes only the three Target 1 files. |
| QA tests tree | `4c7e067feedc644f955afee37806f06e7273dd04` at `aaa823b`, `4410e85` and `01ce5bc` (unchanged) |
| Prior triage reviews | A at `a58b477` (file `01b72886d41a4d03…`), B at `badde65` (file `3bdc6d231688bc98…`); prior triage revision 2 at `2b0081d` |

Normative text read: charter; phase checkpoints 12:29 UTC (`4410e85`) and 12:45 UTC (`d0769ed`); ADR-012 §7 and §12 at `4410e85`; prior A §4–§6.1 and prior B §3–§5.

## 2. Method

- Host-only reads with `git show` and `git diff`. No Docker or Compose command, no live service, no account, no product or QA suite run.
- Bounded probes in a new private root `/Users/quangnguyen/cogniate-review-runs/rb-r1a-01ce5bc-20261021T124746Z/` (mode `0700` from creation; evidence files `0600`). The runner child used umask `022`; a Docker stub that fails and logs was first on `PATH`. The stub recorded **zero** calls.
- Probe 1 (mutation check): the Target 1 test file against the Target 1 helper and six helper variants. Each variant has a full copy of `01ce5bc:infra/scripts/` with only `storage-oplock.sh` changed. Node `v24.21.0`.
- Probe 2: the inherited-export case of `STORAGE_LOCK_COMMAND`.
- Probe 3: whether `npm run` keeps the process group of a detached spawn (for Target 2, V1-12).
- Evidence manifest `ev/manifest.txt` (final): SHA-256 `62bef494728c7c89fd543ac754a1291e9492f65149f82a1e7c5f76cb8068fa6b`. Section 6 lists every evidence hash.
- I did not rerun the whole suite. The Author's claims (18 focused, 84 infrastructure, 1,123 root unit tests with 5 fixture skips) are Author claims. I reproduced only the 18 focused tests.

## 3. Target 1 — R1-A source (`01ce5bc`): APPROVE

### 3.1 What the diff does

- `storage-oplock.sh:369`: `storage_lock_acquire` keeps its own command in `STORAGE_LOCK_COMMAND`. It does not export it. The acquire call passes the same variable (`:370`).
- `storage-oplock.sh:387–388`: `storage_lock_release` passes `--command "$STORAGE_LOCK_COMMAND"`. `ctxOf` already reads `--command` (`:194`). So both `storage_lock_released` and `storage_lock_lost` carry the emitting process's own acquire command.
- The embedded JavaScript is unchanged. So the event shape, the locking algorithm (A1–A6, release steps 1–3) and the `owner` value of `storage_lock_lost` (`ownerView(k)` of the record that holds the lock now) are unchanged.
- `storage-compat.sha256` line 4 has the new helper hash. I recomputed all four lines from `01ce5bc` content: they match.

This is the exact scope of prior A §6.1 and prior B §5. The optional `storage_lock_add_container` change was not made. That function writes no event, so nothing is lost.

### 3.2 Exact values and paths

| Path | Event command | Evidence |
| --- | --- | --- |
| Normal `run --` | record = acquired = released = `storage-oplock run -- bash -c <cmd>`; released `runId` = acquired `runId` | test `:80–99`, exact string at `:95` |
| Lost (other record holds the lock) | `lost.command` = `test-lost` (own); `lost.runId`, `lost.pid` = own; `owner.runId` = `9999…`, `owner.command` = `other-owner`; the other record stays unchanged | test `:206–219` |
| Failing command (`exit 7`) and `TERM` (exit 143) | each released event has its own acquire command and `runId`, in order | test `:221–233` |
| Every event of every test in the lock suite | `command` is a non-empty string | suite-level `afterEach` at `:76–78` |

The suite-level `afterEach` runs before the file-level temp cleanup (`:16`). Probe 1 shows this: the check FAILs four tests that make no explicit command assertion (V1 and V5 below). So it is a real check, not a vacuous one.

### 3.3 Mutation results (probe 1)

| Variant | Change to the helper | Result | Caught by |
| --- | --- | --- | --- |
| V0 | none (`01ce5bc`) | 18/18 pass | — |
| V1 missing | the parent `4410e85` helper (release without `--command`) | 7 fail | run, lost and TERM value checks; `afterEach` in reentry, A6, A5, A4 |
| V2 wrong | release passes `--command "release"` | 3 fail | run, lost, TERM |
| V3 foreign | lost event takes the command of the other record | 1 fail | lost: `'other-owner'` ≠ `'test-lost'` |
| V4 exported | `export STORAGE_LOCK_COMMAND=…` | 1 fail | `commandVar=unset` (`:89`) |
| V5 null on another event | `storage_lock_wait` with `command: null` | 1 fail | `afterEach` in the A4 test |
| V6 owner overwritten | lost `owner.command` = own command | 1 fail | lost: `owner.command` ≠ `'other-owner'` |

So the tests catch a missing, a wrong and a foreign command, and a damaged foreign owner view.

### 3.4 Compatibility route

`storage-compat.sh` (`:125`, `:142`, `:166`) and the copy in `.tmp/storage-compat/` use the same two functions. The hash list binds the copy to the reviewed file (ADR-012 §12). `infra/scripts/storage-compat.test.mjs:145`, `:217` check event names only. A value check there was outside the Author scope (Lead). The oplock unit tests cover the shared functions, and the hash covers the copy. No finding.

### 3.5 Inherited export: evaluated, no finding

- Bash keeps the export flag of a name that came from the environment. Probe 2: with `STORAGE_LOCK_COMMAND=inherited` in the caller's environment, the child of `run --` sees the helper's command. Without it, the child sees `unset`.
- In both cases, all four lock events have the correct own command. No code reads this name from the environment: the JavaScript reads only `--command`.
- No supported caller sets or exports this name. `lib.sh:20–23` uses `set -a` only around `source "$ENV_FILE"`, and `.env` has no such name.
- The four older `STORAGE_LOCK_*` globals behave the same way. This is a stated limit (§8), not a requirement.

## 4. Target 2 — triage revision 3 design (`ab28585`): APPROVE

The revision makes the bounded corrections that both prior reviews asked for. It adds no new mechanism beyond them. P-1b, D-1 and R1-B stay rejected. A-SFT-08 stays an accepted MINOR for M4, outside R1-A (§7.6). Historical deferrals stay unchanged (§13).

### 4.1 Checks against the Lead's list

| Item | Where | Assessment |
| --- | --- | --- |
| P-1a keeps `P`; deletes the children (never renames); `a-fresh` asserts `ENOENT` for `P`, `P/packages`, `P/uploads` or is BLOCKED; states the manual-parent-move limit | `M1.md:230`, `:253–259`; triage §6 N-2 | Met. `P` identity is device, inode, owner, group and mode before and after. Setup checks block a deletion through a link. Source check: nothing before `a-fresh` makes `P` (`infra/.data/` is not tracked; `setupStorageClone` runs only `npm ci` and `gen-env`). So the precondition is reachable. |
| P-3 mandatory: every protected copy site at `0600` from creation; correct original or planted modes into volumes; exact scan roots; fixed-script exception | triage §7.2–§7.5 | Met. I checked every `copyFileSync`, `cpSync`, `mkdtempSync` and protected-class write in the storage and migration modules at `aaa823b`. Each is site #1–#16 or exception X1–X4, or it rewrites an existing file in place, which keeps the copy's `0600` mode. `bin/` is exactly one entry with `scriptSha` and mode `0555`. Site #14 (`configDiff`, `env -0` with `.env` values) is in private scratch with `0600` files made first. This meets the Lead's 12:45 note. |
| New-backup identity | §3.1 steps 1–4; V1-6, V1-7, V1-8 | Met: log offset, spawned `pgid`, exactly one acquire, no command fallback. See B-SR-01 for V1-12. |
| Exact command equality | §3.1 step 7; V1-1, V1-1b | Met: string equality with the acquire command `C`. |
| Clock uncertainty | §3.1 step 8; V1-10 | Met. Offset `o` and uncertainty `u` per sample; PASS only when `StartedAt ≥ R.ts + hi`; else FAIL on time or FAIL "clock uncertainty". The bracket is correct because the engine time is read between `h1` and `h2`. |
| Archived logs across resets | §8; V6-1, V6-2 | Met: a segment before each `stack:reset` and at the end; a missing segment makes an absence claim BLOCKED. |
| Cleanup failure attribution | §4.0 step 9; §4.3; V2-3 | Met: first cause kept; restore result is a separate note; body PASS + cleanup failure → FAIL with the cleanup cause. |
| All 70 results after abort | §4.3; V2-4, V2-8, V7-1 | Met: each remaining step BLOCKED with both causes; 70 ids, one result each; teardown runs. |
| Exact `Origin` | §5; V3-1, V3-2 | Met: exactly `PUBLIC_APP_URL` on `POST`, `PUT`, `PATCH`, `DELETE`; wrong, trailing-slash and other-port values fail. |
| Unchanged CSRF negatives | §5 | Met: the pre-authentication unit negative runs in the Author's `npm run check`; the T4a negative runs in the full gate. See B-SR-03 for one citation. |
| Diagnostic: fresh, same candidate, migration 12 then storage 70, one same-window handoff, before both 488-row rounds, all 12 legacy groups, fresh M2 and T7; no credit | §9 steps 6–8; V8-1 | Met. `wx` on the handoff fits the full mode, which writes one path per round (`run-m1.mjs:148`), and the migration child writes it once (`m1-migration.mjs:263`). See B-SR-02 for one missing decision rule. |
| O-1 only clarifies the existing root read-only inspection | ADR-012 `:17`, `:102` | Met. Source check: `sqlite-lock-probe.mjs` `work()` reads as root, then calls `dropPrivilege` before evaluation, output and the `mark-started` identity write; the read-error path also drops first. No new root write. |

### 4.2 Lens B notes (no finding)

- The controls state an observable result and one mutation each (§12 rules). V4-1 binds the creation hook to the same device and inode as the final file, so a helper cannot report on another file. V5-2 and V5-3 tell a deletion from a rename by inode. These are discriminators, not mirrors of an implementation.
- There are about 40 controls. Each maps to a prior finding (§14). Most are small table cases. A team can own this, because the helpers stay in one file (§7.3) and the oracle is one pure function (§3.1).
- "No scan exemption during implementation; an exemption returns to the Architect" (§7.4) is a good ownership rule.
- `copyCredentials` (#9) changes from copy-over to temporary-then-`rename`. That changes the inode of the secret files. It is safe here: the call runs after `stopped()` and `stack:reset` (`storage-rows.mjs:1024–1034`), so no container holds a file bind of the old inode.

## 5. Findings (Target 2)

No Target 1 finding.

### B-SR-01 — MINOR — V1-12 does not test the row's real spawn path

- File: `docs/architecture/tasks/storage-full-round-triage.md:423` (V1-12); related `:115–116` (§3.1 steps 3–4).
- Problem: V1-12 checks the `pgid` premise with `bash infra/scripts/storage-oplock.sh run -- true`. The row spawns `npm run stack:data-backup -- --out <out>` (`tests/host/storage-rows.mjs:397`), and `npm` then runs `bash infra/scripts/stack-data.sh backup` (`package.json:25`). The open part of the premise is the `npm` layer. A direct `bash` child is always in the spawned group, so V1-12 cannot fail and does not detect "an identity rule whose `pgid` premise is false".
- Evidence: source as cited. Probe 3 on this host: a detached `npm run` (npm `11.19.0`) printed the script's `pgid` = spawned pid (`ev/npm-pgid-probe.txt`). So the premise holds here. No defect is claimed.
- Effect: fail-closed. If a future `npm` or runner change put the script in another group, the row FAILs "backup run not identified". It never gives a false PASS. But the cost is a lost runtime window, which a host-only control can prevent.
- Fix: in V1-12, spawn the row's exact command through `spawnGroup` (`npm run stack:data-backup -- --out <scratch>`). Use a scratch copy of the candidate and the Docker stub first on `PATH`. The lock is acquired before the first Docker command, so the stub needs to answer only `docker ps` (empty). Assert that the acquire event's `pgid` equals the spawned `pgid` and its command is `stack:data-backup`. Record the `npm` version. The `bash … run -- true` case can stay as a second case.

### B-SR-02 — MINOR — The diagnostic does not say whether storage runs after a migration failure

- File: `docs/architecture/tasks/storage-full-round-triage.md:346–352` (§9 step 7).
- Problem: step 7 says "`--phase migration` … Then `--phase storage`" and "A failure returns to triage". It does not say whether QA starts the storage child when the migration phase has a FAIL row, a scan hit (§7.5 step 1) or a refused correction. One reading stops the window after migration. Then the 70 storage rows, the main purpose of the diagnostic, give no result.
- Evidence: text as cited. The storage side is already fail-closed: `@old-schema-setup` is BLOCKED without a valid handoff (`storage-rows.mjs:1024–1025`), and V8-1 blocks a stale one.
- Fix: one sentence in step 7. For example: "The storage child runs after the migration child ends, whatever its row results. Without a handoff file that this migration child wrote, `@old-schema-setup` and its dependent rows are BLOCKED by the existing rule. A §7.5 refused correction in the migration lane does not stop the storage child; it stays a migration FAIL." If the Lead prefers a stop rule, state it with its reason. Either rule is acceptable if it is written before the grant.

### B-SR-03 — NIT — One citation of the pre-authentication negative is off

- File: `docs/architecture/tasks/storage-full-round-triage.md:204`.
- Problem: it cites `services/cogniate-app/src/app/app.test.ts:122–124`. At `aaa823b`, the test starts at `:123`, and the login `403` request and assertion are at `:125–126`. Prior A cited `:123–126`.
- Fix: cite `:123–126`.

## 6. Evidence (private root, `0600` files)

| File | SHA-256 |
| --- | --- |
| `ev/V0.out` | `34a8c7b5caa06f30b536938ce556dcfb34e4674ea7b953cd30663708829f1b34` |
| `ev/V1-missing.out` | `447a5a80edf1fcbbb684e422b9637bc4923d14de0b5c5100064aa357c073f341` |
| `ev/V2-wrong.out` | `e2cf609f14abc379c687323fd81b85baa0188e243527aa660eea9057b7e2e53a` |
| `ev/V3-foreign-lost-command.out` | `11480a8e6d2cd72829b8ca1ebe951c7e163c4279b32aa8c52a04af9e269768d7` |
| `ev/V4-exported.out` | `3db4187efcf001e17589c733b5a9343f7b2f5e10bae3bd6626a01e6df450c15c` |
| `ev/V5-null-wait.out` | `fd2369ff70bc0e251cd7f3a6c5b2df07a3919ac579c4188b2dccc33c7faeaaea` |
| `ev/V6-owner-overwritten.out` | `506a40cddf675077db19c2279038184c02463605df4df257eb6cd6e18ee78ec4` |
| `ev/summary.txt` | `e8b925379f5e1fe646be485993f0e235deb4094f9eb972f955dc03f6f9782596` |
| `ev/export-probe.txt` | `15992d3295457e5d0c00dce3effcea298a846af8c8b7eec777e5aefcdcb4d2f5` |
| `ev/npm-pgid-probe.txt` | `69e575d7a0eb80b985777ae6c379d4fb32b8c44f0e7c44b30cf63720c50a0dcd` |
| `ev/manifest.txt` (final) | `62bef494728c7c89fd543ac754a1291e9492f65149f82a1e7c5f76cb8068fa6b` |

The variant helper hashes are in `ev/manifest.txt`. The output has no secret: the probes used no `.env`, no key and no live service.

## 7. Closure map of prior MAJOR conditions

"Met in text" means that the revision has the requested text. Closure is the Lead's decision. Runtime evidence is still pending for every item.

| Prior finding | Condition | Where | Status |
| --- | --- | --- | --- |
| B-SFT-01 / A-SFT-02 (scan scope) | full scan of private areas; exact `bin/` rule; markers `0600` `wx`; scan after every step and fixture; hit record and FAIL | §7.4, §7.5; V4-3, V4-5, V4-6, V4-7 | Met in text |
| B-SFT-08 / A-SFT-02 (sites) | one private helper and one into-volume helper; every site; source-inventory check; host scratch in scope | §7.2, §7.3; V4-1, V4-8, V4-9 | Met in text. My inventory check found no missing site. |
| A-SFT-02 (status) | P-3 mandatory before the next runtime window | §0, §7 | Met |
| B-SFT-09 | explicit modes; pinned umask; creation-time check; mode compare on return | §7.3; V4-1, V4-2 | Met in text |
| B-SFT-02 / A-SFT-01 | migration, then storage, same candidate, one window, one fresh handoff | §9 step 7; V8-1 | Met in text; B-SR-02 adds one decision rule |
| B-SFT-03 / A-SFT-04 | equality not non-null; `pgid` and offset identity; same rule in the wait; wait-owner check; V1-1b, V1-6, V1-7 | §3.1; V1-1b, V1-6 to V1-9, V1-12 | Met in text; B-SR-01 makes V1-12 discriminate |
| B-SFT-04 / A-SFT-03 | `a-fresh` `ENOENT` or BLOCKED; deletion, not rename; `P` identity kept; stated limit; criterion change reviewed before QA code | `M1.md:230`, `:253–259`; §6 N-2; §9 step 2; V5-1 to V5-4 | Met in text |

Prior MINOR conditions B-SFT-05 to B-SFT-07 and B-SFT-10 to B-SFT-12 are also met in text (§14 of the triage). B-SFT-10 is also met in source by Target 1.

## 8. Limits

- No runtime claim and no retrospective green. The full result at `aaa823b` stays FAIL: 438 PASS, 50 FAIL. Round 2 and the legacy groups did not run. The diagnostic, both full rounds, all 12 legacy groups and fresh M2 and T7 are pending on the frozen candidate.
- All 32 real-LMS rows stay UNVERIFIED. Local Canvas stays DEFERRED. No push or main merge is implied.
- Target 1 evidence is host-only unit evidence on Node `v24.21.0`. `j-migration` and `j-snapshot` need fresh runtime evidence with the new helper hash.
- Inherited export (§3.5): if a caller exports `STORAGE_LOCK_COMMAND`, children see the helper's command. Event values stay correct. No supported caller does this.
- Target 2 is a text review. QA testability is a separate check. There is no harness diff yet. The rename topologies of N-2 stay unmeasured.
- P-1a leaves both content children new and empty after `d-content-folder`, as the old harness did. The effect on later rows is unchanged and still unknown until a storage run (triage N-4).
- A-SFT-08 stays an accepted MINOR for M4. The historical deferrals B-BM-01, A-SOR-01/B-SOR-01, post-reset build-request coverage and A-T9-C01 stay unchanged.
- The untracked `pnpm-workspace.yaml` is unchanged.
