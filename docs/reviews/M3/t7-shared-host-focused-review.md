Verdict: PENDING (no candidate verdict; an Architect clarification is required first)
Round: 0 (requirements preparation only; the candidate was not read)

# E-R8 shared-host T7 QA tools: focused independent review (pending checkpoint)

Reviewer: Claude Code Opus 5.5. The session shows the model `claude-opus-5-5`. The Lead's launch receipt records xhigh effort. The effort is not visible in the session.
Task `task_3957028cdfba`, dispatch `ctx_7f627c526127`, run `run_ebe671ad72a9`. Branch `nguyenthanhquang152/lti-multi-lms`, Lead HEAD `a21163a7` at dispatch. At settlement HEAD is `765cade5`; the two new commits (`bf7b39e5`, `765cade5`) change only Lead and human-review documents, and the plan is unchanged.
Time: 2026-10-23, about 13:25–13:35 UTC.
I am not the Architect, the Codex executor (`task_92a1807d669a` / `ctx_980764b0c00c`) or the Gemini QA (`task_608e1c827365` / `ctx_ecf89d43aa55`). I wrote no reviewed file. I used no subworker.

## 0. Summary

- This is a checkpoint. It is not a candidate review. It gives no APPROVE or CHANGES_REQUESTED verdict.
- Before the freeze, I found one requirement ambiguity in plan §16.1 (RQ-1, section 3). It decides how `lane-watch-r5` may attribute foreign changes. The Lead confirmed it is a real architectural ambiguity (`msg_a0907c1727aa`). The original Architect will settle it.
- The Lead confirmed the prelaunch bridge chain (`msg_172fc3cfd28e`, section 4).
- Lead instruction: settle this attempt as `failed` only because an Architect clarification is required. This is not a candidate code failure. The Lead keeps this reviewer session and will resume it. The full focused review stays open.
- T7 has not run. This checkpoint grants no runtime and no host access, and it does not show that T7 passed. All 32 real-LMS rows stay UNVERIFIED. Local Canvas stays DEFERRED.

## 1. Scope, method and limits

R = `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-5561e8f-c8R3Prep`.

I read these requirement inputs:
- `docs/team/charter.md`
- `docs/team/multi-lms-plan.md` (current directive, 13:10 UTC)
- `docs/team/r8-t7-shared-host-preparation-2026-10-23.md`, including the 13:26 UTC qualification checkpoint
- `docs/reviews/M3/t6-09-failure-plan.md` §§15–16 (§16 supersedes §15)
- the relevant parts of `docs/team/r6-independent-verification-2026-10-23.md`

I read these preserved originals under R. None of them is a candidate file.
- `tools/boundary/{live-boundary,live-boundary-core,safe-docker,docker-sampler}.mjs`
- `tools/lane-watch-r4/{lane-watch,lane-watch-core}.mjs`
- `notes/scripts/{run-t7-window-v2.sh,reconcile-32vol.mjs,anon-check.mjs,preready-btw03.mjs,detached-launch.py}`
- `tools/t7/{prepare-checkout,t7-gate}.mjs`, `tools/t7-capture-watch.mjs`, `observe2.mjs`
- `tools/secret-scan/secret-scan.mjs` (arguments only), `notes/runner-import-closure.json`
- `t7-external-preflight/{w3-start,compare-vs-m2-w4-v2}.json`
- C8 `source/tests/e2e/host/run-t7.mjs` (path logic) and `source/tests/host/storage-docker.mjs` (`listLane`)

I also read Gemini's Lead-bound frozen checklist. It is a QA requirement file, not a candidate file and not a focused review.

I did not read any candidate content:
- `tools/boundary-r2/**`, `tools/lane-watch-r5/**`
- `notes/scripts/reconcile-32vol-v2.mjs`, `notes/scripts/run-t7-window-v3.sh`
- `notes/t7-shared-host-implementation/**`, `notes/MANIFEST-t7-shared-host-v1.sha256`
- Gemini's `interface-schema-mapping.json`

Disclosure: three directory listings showed some of these names. `ls -la R/notes/scripts` also showed two sizes and modification times: `reconcile-32vol-v2.mjs` 4,084 B and `run-t7-window-v3.sh` 24,511 B, at 13:25–13:26 UTC. These were changing files, so they are not freeze values.

I ran no Docker command, test, selftest, build, install or runtime step. I created no attempt root. I edited no tool, source, test, architecture, guide or Lead file.

My private notes are in `R/notes/t7-shared-host-focused-review/` (new, mode 0700). It holds one file: `00-requirements-matrix.md`, 5,165 B, mode 0600, SHA-256 `0b5480245c1078cf12f97685c78bde6ebcb40f54308f66063af914f1e802c5d2`. It is my requirement matrix, written before I read Gemini's checklist.

## 2. Bindings verified before the freeze (about 13:27–13:31 UTC)

| Input | Result |
| --- | --- |
| Plan `t6-09-failure-plan.md` | 99,037 B, SHA-256 `4cf544579299fb657c9ed7c0fd12b739a3307ed9edcc396e492694d23bc99720`: match |
| `notes/MANIFEST-host-ready.sha256` | 9,120 B, `d7bbdb75d084bfa20324806b473b49e7273e43c02f44ffd0ebb9ae54f806dc60`; 84/84 entries match SHA-256, size and mode |
| `notes/MANIFEST-lane-watch-r4-v2.sha256` | 1,071 B, `1b6be474b5a972b5b028e064985486ea6a2f5e43767ce48f2ac63a676af27fef`; 6/6 entries match |
| `notes/scripts/run-t7-window-v2.sh` | 20,605 B, `1c884fdfec60a849c6f57410f7b62b28bdd37fc0d29c89510c40e4910e73d48f`: match |
| `m2/window-attempt4/w4-end.json` | 19,913 B, `544142a119dedc4c77279e5c0078ceac7c53dd7c520558aeb156a768c13638fd`: match |
| Gemini frozen files (six) | bytes, modes and SHA-256 equal the Lead's 13:26 UTC table |

At the freeze, I will check these bindings again.

## 3. RQ-1: lane-watch-r5 attribution source and timing (open; the Architect decides)

**Sources:**
- §15.5 (lane-watch-r5): `nonLaneContainersUnchanged` and `networksUnchanged` are computed over non-lane resources that are not classified. Classified resources go to `attributedForeign`. The `isolationPass` formula is otherwise unchanged.
- §15.6, positive 1: a `sto-` container appears or disappears between W3 and W4. The expected result is no problem.
- §16.1 has three relevant statements:
  - The sufficient record is a full `inspect` record from a W3 or W4 capture of the same invocation.
  - "Lane-watch snapshots hold names only, so they attribute nothing."
  - Limit: resources created and removed between W3 and W4 "need no attribution, because no compared record changes".
- `run-t7-window-v2.sh` order: T3 boundary W3, then T7 lane-watch start, then T11 lane-watch end and `summary.json`, then T12 boundary W4.
- `lane-watch-r4` compares its own start and end snapshots (`lane-watch-core.mjs:269-271`).
- The frozen `t7-gate.mjs:32` requires `isolationPass === true`.

**Problem.** lane-watch reaches its verdict at T11. At that time only the boundary W3 exists.
- Case (c): a Savoy container or network is created after W3 and is in the lane-watch end snapshot. It has no sufficient record at T11.
- Case (d): a Savoy container or network is created after W3 and removed before W4, and a lane-watch snapshot saw it. It never has a sufficient record.

Under the literal §16.1 text, both cases are UNKNOWN. Then `isolationPass` is false, and t7-gate FAILs.

This fails closed. It cannot give a false pass. But it has three effects:
- It contradicts the §16.1 Limit sentence, because lane-watch is a compared record.
- It makes §15.6 positive 1 unreachable end to end when the change falls in the lane-watch interval.
- Savoy is continuously active, so this false FAIL is likely, and a FAIL consumes the attempt.

**Two readings:**
1. **Strict.** lane-watch-r5 attributes only by the same id in a boundary W3 full record. Cases (c) and (d) FAIL. The false-FAIL risk is accepted under the §16.1 rule priority.
2. **Full-record lane snapshots.** lane-watch-r5 takes full sanitized `inspect` records in its own start and end snapshots, and they count as sufficient records under the same §16.1 predicates. Gemini's frozen checklist (`b8671bdd…`) assumes this reading: TC-POS-02 expects `isolationPass` true for a new `sto-` container at W4, and TC-SAFE-03 expects full-record inspection in lane-watch-r5.

**If the Architect selects reading 2, these points also need an exact answer:**
- (a) Does "its predicate holds in every capture that holds it" apply over the lane-watch start and end snapshots, over the boundary W3 and W4, or over all four?
- (b) For a vanish at the lane-watch start or end, which earlier full record counts: the boundary W3 only, or also the lane-watch start?
- (c) Does the lane-watch projection use exactly the boundary projection (`id`, `name`, `labels`, `mounts {type, volumeName}`, `networkKeys`; never env, cmd, args or host paths)?
- (d) May `lane-watch.mjs`, which §15.5 requires to be byte-identical, change to carry any new input?

I add no requirement. The candidate review will use the reading that the Architect and the Lead record.

## 4. Lead ruling recorded: the prelaunch bridge chain (`msg_172fc3cfd28e`)

- The formal runtime W3 must match the newly held, explicitly Lead-reconciled `PREFLIGHT_W3`. This covers the built-in network records and the other strict host identities.
- `PREV_W4` (the accepted M2 W4, `544142a1…`) stays the predecessor for the full baseline32 and for the external preflight reconciliation.
- No bridge change after launch can be reconciled.

Background: the earlier external preflight already shows a new default bridge after M2 W4 (`R/t7-external-preflight/compare-vs-m2-w4-v2.json`: `bridgeIdentical` false).

Alignment note for QA coverage (not a candidate finding): Gemini TC-ENG-01 also mentions a v3 prelaunch check "between `PREV_W4` and W3". Under this ruling, the in-v3 built-in check compares formal W3 with `PREFLIGHT_W3`.

## 5. Candidate review checklist (prepared; it runs after the freeze)

At the Lead's exact freeze hashes, I will do these steps:
- Read the candidate and the immutable originals.
- Check again all bindings in section 2, the byte-identical helper copies and the new manifest.
- Review the §16.1 AV/SC/SV/SN predicates, E, the "every capture" rule, the W3/W4 vanish rules, raw problems kept beside `attributedForeign`, fail-closed listing and inspect errors, and the sanitized projection.
- Review the strict checks: identity, dockerInfo, settings, built-in networks, sampler, baseline32, protected and preserved records, and lane R1/R2/keep/cleanup.
- Review `reconcile-32vol-v2`: the 32 names come from `PREV_W4`, not from the W3 list, and W4 reconcile uses the W3 file as `prev`.
- Review the v3 path-only relocation under `msg_32cbc886594d`. The `observe2.mjs` copy derives its source import, observation output, stop file and `source` HEAD from its own directory. `run-t7.mjs` derives `ART` from its own path. Check `preready-btw03.mjs` root and `t7-clone` modes, the lane-watch `--source` and expected argv, the stop and needle paths, the capture-watch root and the secret-scan targets.
- Review the explicit `PREFLIGHT_W3` → formal-W3 hold before T4, the refusal and cleanup paths, and the stale or reused attempt guard.
- Review Gemini's independent evidence and verdict before my final verdict.

My verdict will cover only the reading that the Architect and the Lead record for RQ-1.
