Verdict: APPROVE
Round: 1

# M1 content-refusal repair (QA-RP-01): combined design and implementation review (Reviewer-B)

Reviewer-B, 2026-10-21. Lens B: "Can a human team own it?" — simplicity, naming, test quality (do the tests prove the claim?), logs and refusal text, cleanup that fails closed, operability, and scope.
This is a **source and design review only**. **It gives no acceptance credit**, and it does not replace a runtime result. Required and still pending: the §7 Q1 and Q2 retry on the same SHA, two full 488-row rounds, the legacy suites, the fresh M2 rows, three T7 runs and G-1. All 32 real-LMS rows stay UNVERIFIED. No row, assertion, label or count changes because of this review.

## 1. Identity and scope

| Item | Value |
| --- | --- |
| Role | Fresh independent Reviewer-B. Blind: I did not read Reviewer-A's file or messages. I also did not read the QA report `docs/reviews/M1/content-refusal-qa.md` (it appeared at HEAD during this review). I read the Author report only after my own reading of the design, the code and the tests. |
| Model | Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh effort. No subworkers. |
| Lifecycle | Run `run_ebe671ad72a9`, task `task_e1077b5c48d9`, dispatch `ctx_6a05801a6e0e`. Session `orca_session_id:9dc67a71-a62d-4489-9331-08939de9635a`. |
| Candidate | `aaa823b25306c5e560f7c4050238b374dec4d4e3`, parent `e9156905dde652ffca0b2348a3f17323c93c0b4b`. Tests tree `4c7e067feedc644f955afee37806f06e7273dd04` at the parent, the candidate and HEAD (unchanged). |
| Design | `2323361f91846a1fa21018d36694639d33ab2648`: ADR-012 revision 3.5 (§6, §8, §11 item 5, §16), the M1 `FRESH` clarification, the reset-brief cross-links, and `docs/architecture/tasks/storage-content-refusal-repair.md` (SHA-256 `e7bcf8e0848c56c977a1c5dddd0281e0c194f6834c245542d45accc979ac8f47`, checked). `git diff 2323361 aaa823b -- docs/architecture` is empty. |
| Files reviewed | `infra/scripts/stack-data.mjs` (`5c3fde5c…7c258`), `services/lti-service/src/cli/stack-data.test.ts` (`4b761ab7…50b5`), `infra/README.md` (`9b9523f9…d61c`). All three hashes match the Author report. The diff has exactly these three files (+324 −33). |
| HEAD at review | `18aa600` (later team and QA records). `git diff aaa823b HEAD` is empty for `infra`, `services`, `tests`, `apps`, `packages`, `package.json` and `docs/architecture`. |
| Read-only context | Charter; research inputs; plan checkpoint 09:52 UTC; implementation brief; board row M1; `stack-data.sh` restore/import branch; `lib.sh` `storage_run` (`compose run --rm`, line 375); `tests/host/storage-oracle.mjs` `assertRefuses`; `tests/host/storage-rows.mjs` `e-content-missing` and `e-old-schema` content halves (lines 1048–1076). |
| Author evidence | `report.md` SHA-256 `63296712bc1ba714bd0fa2b66232fec5342b1c7a6070bb8c662a2215dc9d3cf7` (checked). `evidence-manifest.sha256` SHA-256 `965c2d19cae4179ac2aaa19323ad5d14992e56545569af2314d95d312f9b0f7a` (checked); `shasum -c` gives 256 of 256 entries OK. |

## 2. Evidence classes

I keep four classes apart. Only class E is my own execution.

| Class | Meaning |
| --- | --- |
| **R** (read) | My reading of the design, the code and the tests. No execution. |
| **E** (executed by me) | Focused host checks in my private root, on a `git archive` copy of the candidate. No Docker daemon call, no Compose, no stack, no broad `npm run check`. |
| **A** (Author) | The Author's own results. I checked the report and manifest hashes. I re-ran only the focused file, the old-test control and my own mutants; the other Author results are not re-run by me. |
| **P** (pending, or a separate gate) | Pending runtime: §7 Q1/Q2, both 488-row rounds, legacy, M2, T7, G-1. Separate gate: the independent QA host-only checks H1–H7 (no Docker, so not runtime). The Lead states that they passed at `18aa600`. I did not read that report and did not verify it. This review gives none of them credit. |

Private root (made new, mode 0700, umask 077): `/Users/quangnguyen/cogniate-reviewer-b-content-refusal-20261021T1021Z`. Host: macOS 27.0.1 (Darwin 27.0.0), Node v24.21.0. The test children ran under umask 022, inside the 0700 root, each with its own private `TMPDIR`. Scripts: `scripts/mutate.mjs` (`a402ca2d…acc4`), `scripts/probe.mjs` (`8e9532e4…0169`). I keep every result file and every left folder in that root.

## 3. My executed checks (class E)

| Id | Check | Result | Evidence (private root) |
| --- | --- | --- | --- |
| E1 | Focused file `stack-data.test.ts` on the candidate copy, private `TMPDIR` | 105 passed, 0 failed. Afterwards the `TMPDIR` holds no `cogniate-content-*` and no `stack-data-*` entry (only Node's `node-compile-cache`). | `results/baseline.txt` (`7742a016…1630`) |
| E2 | The parent test file (`e915690`, `feacd960…e659`) with the candidate code | 88 tests: 87 passed, 1 failed. The only failure is `stack-data.test.ts:356`: `expected [ null, null ] to deeply equal [ 'rolled_back', 'rolled_back' ]`. This is the one named assertion. | `results/B1-old-test-candidate-code.json` (`17ccc911…1b44c`) |
| E3 | Removed lines of the test diff | Exactly one removed `expect(` line: `:356`. The other removed lines are the `node:fs` import, the old title, `const data = makeVolumes();` (now with a comment) and the one-line `Io` interface. No other assertion is removed or relaxed. | `git diff e915690 aaa823b` |
| E4 | `eslint` of the two code files; `node --check stack-data.mjs` | exit 0; exit 0 | console |
| E5 | Fail-closed and text probes (library and CLI) | See §6 table P1–P4. | `results/probe.json` (`2b2fcab7…cccd`) |
| E6 | Fixture sizes of U5(a) "other bytes" | `lti.db` 12288 bytes, the app `cogniate.db` with `p1` 20480 bytes: the two differ in size. | `scripts/size-probe.mjs`, console |
| E7 | My own 16 mutants (exact-text edits; each anchor exactly once; the pristine file is restored after each) | See §5. | `results/mutations-all.log`, `results/M*.json`, `results/mutations-all.json` |

Side effect (disclosed): each Vitest run updates Vitest's own results cache `node_modules/.vite/vitest/<hash>/results.json` in the shared, git-ignored `node_modules` (through the symlink of my copy). It is not a fixture, not evidence and not tracked. `git status` stays as at the start (only the untracked `pnpm-workspace.yaml`, untouched).

## 4. Lens B assessment

### Design (ADR-012 revision 3.5 and the brief)

- **Simple and bounded.** The repair moves one check and adds one diagnostic code. It keeps every state, journal format, recovery row, drill point and exit code. The "Not chosen" table rejects the heavier options for stated reasons. I agree with the choice: a refusal stays a plain step-1 refusal, so the existing strict oracles apply without change.
- **Two meanings of `FRESH`.** The ADR §6 note, §11 item 5 and the M1 clarification state the difference once and in the same words. A new reader can find it. The recovery rows keep their own condition.
- **Honest limits.** The brief and §8 "Limits" state what the check does not prove (no snapshot of the content folders; a left scratch folder after a failed cleanup). The `--rm` claim for the product scratch matches `lib.sh:375` (class R).
- **One brief wording point** (see B-CRR-01): the brief's U5(a) example "for example a partial copy" cannot prove the verification by itself, because a half SQLite file also fails to read. The Author found and recorded this limit.

### Code (`stack-data.mjs`)

- `volumeRestore()` reads in the order of the brief: validation, target state, source kind, pair rule, `contentCheck()`, then the `.tmp` removal, then `engine.run()`. The comment at the call names the rule. The engine lost its check, its line and the `contentMissing` branch; no dead code is left.
- `contentCheck()` is short and has one cleanup path after the `try`. A `step` label gives a precise human message. The success line is written only after the removal. Every failure (scratch folder, copy, verification, open, query, removal) becomes `Refused('content_check_failed')`, so `main()` maps it to exit 1 and one `storage_refused` line. It is never exit 2, a pass or `content_missing` (E7 M05a–c).
- Only manifest-listed `cogniate-app/` files are copied (`files = filesByRole.app`; `validate()` allows only the database and its two sidecars). The copy is opened `readOnly`; no backup or target file is opened (class R; U5(c) also asserts the copied set).
- `REAL_IO` has two new hooks. They are separate from `copyFile`, so the existing staging fault tests keep their meaning. The names are a NIT (B-CRR-04).
- The human texts are clear: "`content_missing`: 1 of 1 package folders … Nothing was changed." and "`content_check_failed`: the content check could not read the app database (ERR_SQLITE_ERROR). Nothing was changed in the volumes." One double-fault text overstates (B-CRR-03).

### README sentence

Line 141 now says: "Before the first journal write, a content check makes sure … (else the command exits 1 with `content_missing`, writes no journal and changes nothing)." This is exactly the sentence that brief §4 asks for, and it matches the code. It does not name `content_check_failed`, and line 139 still lists the order without the content check. Both are outside the one-sentence scope (B-CRR-06).

### Tests: U1–U8 coverage

| Case | Covered by | Assessment |
| --- | --- | --- |
| U1 | `U1 import into an empty FRESH pair …` | Full: exit 1; exactly one check line with the six keys, `checked: 1`, `missing: ["packages/p1"]`, 32-hex `opId`; one `storage_refused` `content_missing` with `command: import`; the check line before the refusal line; no cancel, rollback, unresolved or drill line; "Nothing was changed."; listing of target, backup and content equal; no journal; state `FRESH`; empty private `TMPDIR`. |
| U2 (a), (b) | `U2 … prepared-lti (R1)`, `U2 … staged (R2)` | Full: R1 `['rolled_back', null]` and R2 states set up by drill and `recover`; listing and journal bytes equal; the check `opId` is in no journal. |
| U3 | the changed existing test, plus `U3 … committed` and `U3 … rolled_back` | Full, and more than the brief: also an `OK` target with `rolled_back` journals (the H3(b) shape). With `p1` back: exit 0, exactly one pass line, its `opId` = the new journal `opId`. |
| U4 (a), (b) | `U4 boundary (import …)`, `U4 boundary (restore …)` | Full for both operations: (a) no drill line, listing equal, no journal; (b) exit 3, exact order `[check pass, drill_stop prepared-lti]`, journals `['prepared', null]`, `recover` → 1, then → 0. |
| U5 (a) | partial copy; other bytes | Present. The partial copy also fails at read, so only "other bytes" catches "no verification" (E7 M06, Author M6). The SHA-256 half is not proven (B-CRR-01). |
| U5 (b) | failed copy (EIO); app database that does not open (library and CLI) | Full. The CLI case also proves exit 1, one `storage_refused` line and an empty `TMPDIR` after a read failure. |
| U5 (c) | failed removal, `p1` present and absent | Full: no line, `content_check_failed`, listing equal, no journal; the left folder is in `os.tmpdir()` and holds only `cogniate.db` (an unlisted `-shm` is not copied); the text names it. Cleanup after a copy or verification failure is not asserted (B-CRR-02). |
| U6 | `U6 .tmp leftovers …` | Full: both `.tmp` files in both volumes stay byte-equal after the refusal and go after a later successful restore. The existing `.tmp` test is unchanged and passes (E1). |
| U7 | `U7 precedence …` | Full and wider than the brief: three `backup_damaged` variants, `restore_target_state`, `import_target_not_fresh`, `import_needs_legacy_backup`, `restore_needs_volume_backup`, `pair_mismatch`. Each: exactly one `storage_refused` with that code, no check line, listing equal. |
| U8 | `U8 control …` | Full: exit 0, no refusal line, `committed` journals, exactly one pass line, `opId` = journal `opId`. |

Test helpers are small and named for their job (`listing`, `dataCmd`, `expectContentMissing`, `expectOnePass`, `journalBytes`, `preparedFresh`, `okP1`, `legacyP1`). `listing()` adds mode, size and link target to the existing `tree()`; the Author kept `tree()` unchanged, so no other assertion changes its meaning. No new framework.

### The replaced assertion

The old `expect(journalStates(data)).toEqual(['rolled_back', 'rolled_back'])` is replaced by `expect([listing(data), journalStates(data)]).toEqual([snapshot, [null, null]])` with `snapshot` taken before the command on a prepared `makeVolumes()` target. This is strictly stronger: names, types, modes, sizes and SHA-256 of every entry, also identities, journals and `.tmp` files, plus "no journal". E2 shows that the old assertion is the only one that the new code contradicts. Owner and group are not in `listing()`; the brief does not ask for them, and a non-root test cannot change them to another user. QA's own listing covers them.

## 5. Mutation evidence

The brief requires that each listed mutation makes at least one case fail. The Author reports this for all required variants (class A). I made my own 16 mutants (class E), independent of the Author's tools.

| Id | Mutation | Failed / 105 | Failed cases | Brief row | Caught |
| --- | --- | --- | --- | --- | --- |
| M01 | the old order: the check after both `prepared` writes; a refusal → cancel | 16 | old content check (U3), U1, U2 ×2, U3 ×2, U4 ×2, U5 a ×2, U5 b ×2, U5 c ×2, U5 b CLI, U6 | U1, U2, U3, U4(a) | yes |
| M02 | the check before the target state and the pair rule (after the validation) | 1 | U7 | U7 | yes |
| M03 | the `.tmp` removal before the check | 1 | U6 | U6 | yes |
| M04 | a second check line in the engine (after `prepared`) | 3 | U3 ×2, U8 | U8 | yes |
| M05a | a check failure → a pass (`checked: 0`) | 7 | U5 a ×2, U5 b ×2, U5 c ×2, U5 b CLI | U5(b) | yes |
| M05b | a check failure → `content_missing` | 7 | the same 7 | U5(b) | yes |
| M05c | a check failure → a plain `Error` (exit 2) | 7 | the same 7 | U5(b) | yes |
| M06 | no verification of the scratch copy | 1 | U5 a "other bytes" only | U5(a) | yes |
| M07 | size-only verification (the SHA-256 comparison removed) | 0 | — | extra | **no** (B-CRR-01) |
| M08 | the line written before the cleanup | 2 | U5 c ×2 | U5(c) | yes |
| M09 | a failed cleanup ignored | 2 | U5 c ×2 | U5(c) | yes |
| M10 | a `storage_restore_cancelled` line for a content refusal | 8 | U1, U2 ×2, U3 ×2, U4 ×2, U6 | U1 | yes |
| M11 | no removal after any check failure | 1 | U5 b CLI only (4 leftovers) | extra | yes |
| M12 | no removal after a copy or verification failure | 0 | — (3 leftovers) | extra | **no** (B-CRR-02) |
| M13 | unlisted `cogniate-app/` backup files also copied to the scratch folder | 2 | U5 c ×2 | extra (brief: a reading check) | yes |
| M14 | the check line with another `opId` | 5 | U3 ×2, U4 ×2, U8 | extra | yes |

My result agrees with the Author's table for every required row. Two of my extra mutants survive; they are the evidence for B-CRR-01 and B-CRR-02. "Leftovers" are `cogniate-content-*` folders that the mutant run left in its private `TMPDIR`: from a U5(c) test that failed before its own removal, or (M11, M12) from library U5 cases without a removal. All are kept.

## 6. Probes (class E)

| Id | Probe | Result |
| --- | --- | --- |
| P1 | Library: `checkCopy` throws EIO, then `checkRemove` throws EIO | `content_check_failed`; text "could not copy cogniate-app/cogniate.db (EIO). A copy of the app database stays in cogniate-content-pZnJ5H in the temp folder. Nothing was changed in the volumes."; the left folder is **empty**; target listing equal (B-CRR-03). |
| P2 | CLI restore, `TMPDIR` points to an absent folder | exit 1; one line `{"event":"storage_refused",…,"command":"restore","code":"content_check_failed"}`; text "could not make its scratch folder (ENOENT)"; target listing equal. |
| P3 | CLI restore, `TMPDIR` is a 0500 folder | exit 1; `content_check_failed`; "could not make its scratch folder (EACCES)"; target listing equal; the folder stays empty. |
| P4 | Control: the same restore with a writable `TMPDIR` | exit 0; exactly one pass line (`checked: 1`); "restore: committed"; `TMPDIR` empty afterwards. |

## 7. Findings

No BLOCKER. No MAJOR.

### B-CRR-01 — MINOR — the SHA-256 half of the scratch-copy verification is not proven

- **Location:** `services/lti-service/src/cli/stack-data.test.ts:1429–1434` (the `U5` table); product check at `infra/scripts/stack-data.mjs:598`.
- **Problem:** No case gives the content check a scratch copy with the manifest size but other bytes. So a regression that drops the SHA-256 comparison passes the whole file.
- **Trigger:** mutant M07: `if (!s || s.size !== f.size || s.sha256 !== f.sha256)` → `if (!s || s.size !== f.size)`.
- **Expected:** at least one U5(a) case fails (brief §4 property 2, ADR-012 §8 "Bytes": size **and** SHA-256).
- **Actual:** 105 of 105 pass (E7). The "other bytes" case copies `lti.db` (12288 bytes) for `cogniate.db` (20480 bytes), and the partial copy is also shorter (E6). So the size check alone catches both. The partial-copy case also passes for another reason under M06: a half SQLite file fails at read.
- **Impact:** the product code is correct by reading (class R). The gap is test strength only. A future regression could let the check read other same-size bytes and give a wrong pass or `content_missing`.
- **Recommended fix (bounded, test only):** add one U5(a) sub-case with a same-size copy that differs (for example `checkCopy` copies, then flips one byte inside the file), with `p1` absent; and assert the failing step in each U5 library case, for example `toContain('could not verify the copy of cogniate-app/cogniate.db')`. The step assertion is needed: a changed byte can also make the file fail at read, and then only the step text shows that the verification found it. With both parts, M06 and M07 fail. Optional later brief wording: "a copy with the manifest size and other bytes" instead of "for example a partial copy".

### B-CRR-02 — MINOR — cleanup after a copy or verification failure is not asserted

- **Location:** `stack-data.test.ts:1435–1451` (library U5 a/b cases); product `stack-data.mjs:612–614`.
- **Problem:** The library U5 cases run in the shared process temp folder and do not check that the scratch folder is gone. Only the CLI U5(b) case (a read failure) checks an empty `TMPDIR`.
- **Trigger:** mutant M12: skip the removal when the failure is in the copy or verification step.
- **Expected:** a case fails (brief §4 property 3 "Remove the scratch folder after the query, also after a failure"; brief §9: a copy of the app database holds secrets).
- **Actual:** 105 of 105 pass. The mutant left 3 `cogniate-content-*` folders (each a database copy) in its private `TMPDIR`, and no test saw them. Mutant M11 (no removal after any failure) is caught only by the one CLI U5(b) case (E7).
- **Impact:** the product code has one cleanup path for every failure, so it is correct by reading and by P4/E1. A later refactor that moves the removal could leave a database copy after a copy failure, and no unit test would see it.
- **Recommended fix (test only):** in the library U5 cases, wrap `checkRemove` with a spy that calls the real removal and records the folder; then assert `existsSync(folder) === false`. Or set `process.env.TMPDIR` to a `temp()` folder for the call and assert that it is empty.

### B-CRR-03 — NIT — the double-fault text says a copy stays when the folder can be empty

- **Location:** `infra/scripts/stack-data.mjs:617`.
- **Trigger:** the copy fails and the removal also fails (P1).
- **Expected:** a true text. **Actual:** "A copy of the app database stays in cogniate-content-pZnJ5H …", but the folder is empty. It overstates in the safe direction, and it needs two faults.
- **Fix:** "The scratch folder <name> stays in the temp folder; it can hold a copy of the app database."

### B-CRR-04 — NIT — hook names `checkCopy` and `checkRemove` read as "verify"

- **Location:** `stack-data.mjs:209–210`; `stack-data.test.ts:472`.
- **Problem:** "check" can mean "verify a copy". The doc comment explains them, but the names do not say "content check scratch".
- **Fix:** `contentCheckCopy` / `contentCheckRemove` (or `scratchCopy` / `scratchRemove`). Rename only; no behavior change.

### B-CRR-05 — NIT — a failing U5(c) leaves a database copy in the system temp folder

- **Location:** `stack-data.test.ts:1453–1474`.
- **Problem:** The left folder is removed only on the success path (`REAL_IO.checkRemove(scratch)` after the assertions). When an assertion fails, the folder stays in `os.tmpdir()`. The Author's mutant batch left 14 such folders in the system temp folder and had to identify and remove them (Author report §6). My mutants left them only in private `TMPDIR`s.
- **Fix:** push the folder into `temps` when `checkRemove` records it, so `afterEach` removes it; or run the library U5 calls with `TMPDIR` set to a `temp()` folder.

### B-CRR-06 — NIT — operator text for `content_check_failed` (later docs)

- **Location:** `infra/README.md:139` and `:141`.
- **Problem:** The README does not name the new code `content_check_failed` or a next step, and line 139 lists the step-1 order without the content check. The brief allows only the one sentence, so the Author is correct to stop there.
- **Fix:** a later Lead-authorized docs line: "`content_check_failed`: the content check could not finish; nothing changed. Check the backup folder and the temp space, then run the command again." Add "then the content check" to line 139.

## 8. Severity counts

| Severity | Count | Ids |
| --- | --- | --- |
| BLOCKER | 0 | — |
| MAJOR | 0 | — |
| MINOR | 2 | B-CRR-01, B-CRR-02 |
| NIT | 4 | B-CRR-03, B-CRR-04, B-CRR-05, B-CRR-06 |

Verdict APPROVE for the source and the design text only. The MINOR items are test-strength gaps beyond the brief's required mutation list; every required mutation is caught (Author and E7). They are safe to defer, or the Author can fix them in a test-only follow-up without a product change.

## 9. Recorded evidence limits (not mine to resolve)

I state these as the Author and the Lead recorded them. I make no retrospective claim about them.
- The Author's first focused run, the batch C0, N0, M1–M8 and the root `npm run check` used the 0700 system `TMPDIR`. 14 matched unit-fixture `cogniate-content-*` folders were identified and then removed there. There is no complete inventory of other suites' entries in the system `TMPDIR`.
- The optional M7c private scratch folder was removed before the preserve note; its result and log are kept.
- The other private evidence of the Author is kept; 256 of 256 manifest entries verify (§1).
- The Author's root check (1123 passed, 5 existing fixture skips; infra 84/84) is class A. I did not repeat it; I had no concrete concern that needs it.
- My own limits: one host, one Node, one attempt per mutant; non-root, so the root branches of `main()` (`prepareFolder` with `chown`, the privilege drop) run only in their non-root form.

## 10. Other gates (not this review)

- Independent QA H1–H7 is a separate, host-only gate (no Docker; not a runtime check). According to the Lead, it passed at `18aa600` (14 subcases, 656 assertions). This is the Lead's status, not my verification: I did not read the QA report, and this review gives it no weight.
- Pending and required: §7 Q1 and Q2 on the same SHA, in one Lead-granted Docker window, with the same text and assertions.
- Pending and required: two full 488-row rounds with equal per-row results (also the exact `content_missing` assertions of `e-content-missing` and `e-old-schema`), the legacy suites, fresh M2 browser rows, three T7 runs and G-1.
- Existing recorded failures stay as recorded (for example round 1 at `9cdd768`: 419 PASS, 69 FAIL; the QA-RP-01 report at `faa77a2`). This review closes none of them.
- All 32 real-LMS rows stay UNVERIFIED. No push, no main merge.
