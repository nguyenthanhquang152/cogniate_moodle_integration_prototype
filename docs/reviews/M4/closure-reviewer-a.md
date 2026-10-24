Verdict: APPROVE (conditional, closure text only)
Round: 1 (final closure addendum)

# M4 closure addendum: Reviewer-A

Reviewer-A, lens "Is it right and is it safe?". Model: `claude-opus-5-5` (Claude Opus 5.5), as the session reports it; the dispatch names xhigh effort. No subworkers.
Task `task_3a2494d1724f`, dispatch `ctx_c99a67ed6e42`. Time: 2026-10-23, about 17:28–17:40 UTC.

Scope: only the exact closure delta that the Lead proposed on frozen guide revision `911219b04ba0c8195e935955094155deac0e9fbb`. This is not a new source, runtime or full guide review. My final verdict on `911219b0` (`docs/reviews/M4/reviewer-a-final.md`, 15,601 B, SHA-256 `1c3c9c706639bd96c5474fd0de93c749572757bb3222bfdebf65cedda69f2f57`) stands unchanged.

I read Reviewer-B's final report only after both blind verdicts were submitted, as the Lead permits (`docs/reviews/M4/reviewer-b-final.md`, 16,552 B, SHA-256 `738b20b61e7d292ca15012384f271705990691f434e21449d44b3f0c014ba201`). I made no guide edit and no commit. I ran no Docker, browser, install or network call.

## 1. The plan that I checked

1. **17 status substitutions.** These are the first eight keys of the original map. The ninth key, "Independent document closure is pending." (the A-SI-05/B-SI-09 cell, `deferred.md:257`), stays unchanged.
2. **Four "draft" label changes** (Reviewer-B §6, condition 2):
   - `README.md:87`: remove "draft; " from the Canvas admin guide label;
   - `README.md:88`: remove "draft; " from the Blackboard admin guide label;
   - `README.md:89`: "upgrade and rollback (draft)" → "upgrade and rollback";
   - `canvas-blackboard.html:82`: `<span class="badge">Draft</span>` → `<span class="badge">Prototype</span>`.
3. **One MINOR register block** in `deferred.md`, "### Final guide review follow-ups", with rows B-M4F-01 and B-M4F-02. It goes directly before `### Not open deferrals (for clarity)`.

No other byte may change. `infra/README.md` stays untouched.

## 2. In-memory simulation on `911219b0`

I applied the 12 map entries and the block to the nine candidate files in memory, with no file written.

- **Occurrences.** There are 21 substitutions: 17 status and 4 label changes. Every key matches the expected number of times. No key is part of another key. The result is the same in either order.
- **Block position.** The block is the eight given lines, then one blank line. It sits directly before the line `### Not open deferrals (for clarity)`. The existing blank line after "For `operation_lock_invalid`, stop and escalate; …" stays above it.
- **Changed lines:** `README.md` 5, `canvas-admin.md` 1, `blackboard-admin.md` 1, `operator.md` 1, `teacher.md` 2, `troubleshooting.md` 1, `START-HERE.md` 2, `canvas-blackboard.html` 4 and `deferred.md` 4 (plus 9 inserted lines).

Expected result bytes for the Lead's exact-byte check (with the block bytes exactly as in the dispatch, then one blank line):

| File | Bytes `911219b0` → closure | Expected SHA-256 after closure |
| --- | --- | --- |
| `README.md` | 11,271 → 11,249 | `045eee6e0e3afbd076ccd9947ef526685e592c75b17c98f47242fd232d7c5caa` |
| `docs/guides/canvas-admin.md` | 11,757 → 11,755 | `a7d2f6838784e933e8a5ab9fc8cb19a12dc575208aab24e14665eb80b4fc6741` |
| `docs/guides/blackboard-admin.md` | 7,486 → 7,484 | `73577ba6db9a6f75e9673511ae54b46f3d4e8d5c6703d0d1e24b2174b74a5410` |
| `docs/guides/operator.md` | 20,306 → 20,304 | `36ba709d7eb7a192b01de27562377ee9012c96edcb3e004fb01f700020363b47` |
| `docs/guides/teacher.md` | 10,992 → 10,988 | `94a6ec2b3380c1a8cee2e70ac60dfc9b764b34437a9b8fd8419d39450de8f7bb` |
| `docs/guides/troubleshooting.md` | 15,041 → 15,039 | `0534118354b27b070f8e7ff258a4ebad99e6b224fe9977787733adc671eb6012` |
| `docs/human_review/START-HERE.md` | 7,384 → 7,394 | `c4bc804df7588da6eee9e13d025b1c4249b7b9bae7dcee1a80dc6258e12c8107` |
| `docs/human_review/canvas-blackboard.html` | 24,366 → 24,372 | `2d7c9741ed47c6b85541f36192151dd8df60918754b524355347320d97f7b60b` |
| `docs/human_review/deferred.md` | 30,694 → 31,343 | `37a505e748115db675cc00b002d76c3a4536e525b357087821417ce8cf005c94` |

If a file differs from its value, compare the diff with the plan before commit. A different blank-line layout around the block changes only the `deferred.md` hash. That is acceptable only if the visible text and table stay exactly the same.

## 3. Checks of the resulting text

- **No stale draft labels.** After closure, no "draft" label is left in the nine files. Only two "pending" texts stay, and both are intended:
  - `canvas-blackboard.html:138` "It is pending." is a connection state, not a review status;
  - the A-SI-05/B-SI-09 cell (`deferred.md:266` after the insertion).
- **Grammar.** Each replacement reads correctly in its sentence. `README.md:9` and `:19` end with the same sentence; Reviewer-B notes this, and it is harmless. The "Prototype" badge agrees with "Signed simulation only" and "All 32 live checks UNVERIFIED" beside it.
- **Block format.** The new `###` heading is under "## Canvas and Blackboard phase (M4)", the same level as its neighbors. Its anchor `#final-guide-review-follow-ups` is new in `deferred.md`. The table has the same column style as the other deferral tables.
- **Block link.** The link `../reviews/M4/reviewer-b-final.md` resolves to the existing Reviewer-B file. That file is untracked now. It must be committed no later than the closure commit.
- **STE.** Every block sentence has 16 words or fewer. "C10 T7 guide claims" is a four-word noun cluster. That fits "about 80%" STE; it is an optional style point only.
- **Faithful rows.** Both rows match Reviewer-B §4 in id, MINOR severity, problem and deferred fix:
  - B-M4F-01: the C10 T7 claims link only to the Lead record E-R8;
  - B-M4F-02: undefined commit labels and QA process terms.

  "Safe to defer" matches Reviewer-B's text. "They do not change the verified prototype scope" is true: neither finding questions a result.

## 4. MINOR register (charter §5)

- Reviewer-B's final report has exactly two MINOR findings, B-M4F-01 and B-M4F-02. The block registers both.
- My final report has no MINOR (four NITs).
- In the current working copy of `docs/reviews/M4/docs.md` (SHA-256 `57e1c4b3…f06bb`, still under correction), the final Docs QA section reports 0 MINOR. I did not judge that report.
- The C10 MINOR A-T7C10-01 and the earlier MINOR deferrals are already in `deferred.md`.

So the plan registers every MINOR of this gate that I know of. If the corrected Docs QA report adds a MINOR, it needs a row as well.

## 5. Dispositions

| Item | Disposition |
| --- | --- |
| A-M4F-02 (draft labels) | Closed by the four label changes, when they are applied as simulated. |
| A-M4F-01 (`infra/README.md:156` wording) | Stays a deferred NIT. NITs need no `deferred.md` row (charter §5). It links to A-SI-05/B-SI-09. |
| A-M4F-03 (conformance file header) | Stays a deferred NIT for the Architect. |
| A-M4F-04 (double evidence-table link) | Stays a deferred NIT. |
| A-SI-05 / B-SI-09 | Stays pending. Reviewer-B judged it covered. I keep my view: the old-build wrapper branches at `storage-compat.sh:161,167,171,178` have no captured output, and A-M4F-01 is open. The Lead's plan keeps the cell pending, which is the conservative, truthful status. |
| B-M4F-01, B-M4F-02 | Registered by the new block. |

## 6. Verdict and conditions

**APPROVE** this exact closure plan, on these conditions:

1. The corrected final Docs QA report gives PASS on exactly `911219b0`, with no new MINOR. A new MINOR needs its own row first.
2. The Lead checks every byte of the closure commit. The nine files must equal the results in §2, or differ only as §2 allows. `git diff 911219b0 <closure>` may change no other guide byte, and `infra/README.md` stays unchanged.
3. `docs/reviews/M4/reviewer-b-final.md` is committed no later than the closure commit, so that the new link resolves.
4. The closure adds no runtime, live-LMS, certification, production or enterprise claim.

This addendum gives no human approval and no push or merge authority. The Lead commits this file by path.
