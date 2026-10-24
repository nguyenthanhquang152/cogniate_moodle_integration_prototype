Verdict: APPROVE (round 2: held candidate r2, manifest e4f60300, for preparation qualification only; not a runtime approval)
Round: 2

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

## Round 0 addendum: review of plan §17 (pre-freeze; the candidate was not read)

Dispatch `ctx_d41f3cb69570` (same task and session). Time: 2026-10-23, about 13:39–13:43 UTC.
Plan: 106,065 B, SHA-256 `5253e839118a22e867457005c7735fe23c85a270e675dfb996adb6244a6c257f`, at Lead commit `9aa4dcc7`. The first 99,037 B still have SHA-256 `4cf544579299fb657c9ed7c0fd12b739a3307ed9edcc396e492694d23bc99720`. I checked this.
This file was 10,735 B, SHA-256 `0b4b970dbe9fcd304725fd2e6406e5757050d7a99fdb804082cb3dc752b5aa12`, before this addendum. The sections above are unchanged. Only the two status lines at the top changed.

### A.1 RQ-1 status: settled by §17.1

§17.1 selects the full-record reading (section 3, reading 2) and answers all four follow-up points:
- (a) The "every capture" rule applies inside each pool only. The outer pool is {W3, W4}. The lane pool is {lane start, lane end} of one lane-watch process.
- (b) A vanish at lane start BLOCKs. A vanish at lane end is attributed only from a sufficient lane-start record of the same id. A vanish at W4 is attributed only from a sufficient W3 record.
- (c) A container record must keep the name, the complete labels, every mount type and volume name, and the network keys. The mounted volumes' full records must be in the same snapshot. Sanitizing may drop env, command, arguments and paths, but never a predicate field.
- (d) The Lead keeps the §15.5 byte-identical `lane-watch.mjs` constraint, unless a further explicit design ruling changes it.

I agree with the ruling. Each of my cases now has a defined result:
- Case (c) is classified from the lane-end record.
- Case (d) is classified from the lane-start record.
- A resource that exists only between two snapshots of a pool changes no compared record in that pool.
- No record crosses pools. Each pool must pass on its own. Both rules keep "no false attribution" first.

Residual risk (fail-closed, accepted under the §16.1 rule priority): a Savoy removal during the lane-start list-to-inspect interval BLOCKs. This happens after T4–T6, so it consumes the attempt.

### A.2 The §17.2 preflight chain and guard

I checked the chain against E-R6 (`r6-independent-verification-2026-10-23.md`, lines 45–48) and against `msg_172fc3cfd28e`. The chain is: `PREV_W4`, then the Lead-reconciled `PREFLIGHT_W3`, then the runtime W3 guard before T4, then the strict W3-to-W4 comparison and the sampler.
- The no-gap argument holds. A bridge replacement in any interval is either reconciled (allowed class, before `PREFLIGHT_W3`), stopped before T4, or failed at W4 or by the sampler.
- The two counterexamples are correct. The old reference would HOLD every time: `compare-vs-m2-w4-v2.json` has `bridgeIdentical` false. A post-run reconciliation would find a gap only after T7 ran.
- Control 1, the `PREFLIGHT_W3` SHA-256 named in the grant and the refusal of any other file, closes the stale or reused preflight path.

### A.3 Clarification sent to the Lead (`msg_cbcebe390121`; fail-closed, not blocking)

CL-1 is about the preflight capture tool:
- §17.2 control 2 requires extras in `PREFLIGHT_W3` to be classified under §16.1 inside the preflight capture. The guard also compares built-in full records between `PREFLIGHT_W3` and the runtime W3.
- §16.2 step 1 names the frozen original `live-boundary.mjs` capture and `reconcile-32vol.mjs`.
- The original capture records no mounts or network keys (`tools/boundary/live-boundary.mjs:97-98`). The original reconcile requires exactly 32 volumes.
- So an original-tool preflight beside any Savoy resource HOLDs every time. This is a false stop, never a false pass.

I asked the Lead to record, before runtime, that the E-R8 preflight uses the frozen `boundary-r2` capture (the same projection as runtime W3) and `reconcile-32vol-v2` against `PREV_W4`.

### A.4 Readings that I will apply to the frozen candidate

- **R-1.** The §17.2 control 3 admission ("identical to a resource reconciled in `PREFLIGHT_W3`") is a guard admission only. It never attributes an outer-pool or lane-pool difference. `reconcile-32vol-v2` and `judgeStart` stay authoritative at W3: an extra volume must be SV in the capture under test. If two admissions differ, the stricter one decides.
- **R-2.** The pre-T4 stop has its own exit code. It differs from the usage and refusal exit 2 and from the T3 `judgeStart` BLOCK, or the record shows the cause without doubt. No sampler, checkout, lane-watch or runner starts. The T0–T3 files stay.
- **R-3.** `PREV_W4` is pinned to the accepted M2 W4 (`544142a1…`, 19,913 B) and checked by hash. Line 18 of `run-t7-window-v2.sh` allows an environment override.
- **R-4.** The `PREFLIGHT_W3` SHA-256 is checked in T0, before T1 and before any Docker call.
- **R-5.** The lane pool's start and end files are bound by size and SHA-256 in B-TW-02, and they come from the same lane-watch process under the same `T7_ROOT`.

The verdict stays PENDING until the Lead sends the exact freeze bindings and I complete the candidate review with Gemini's independent result.

### A.5 Lead confirmation (`msg_2e865a3fab69`, 13:42 UTC)

The Lead confirmed CL-1 and readings R-1 to R-3 for the E-R8 runtime protocol:
- The separate fresh external preflight uses the qualified frozen `boundary-r2` capture and `reconcile-32vol-v2` against `PREV_W4`, with the same full sanitized projection as runtime W3. The original tools in §16.2 apply only to the zero-delta alternative.
- No preflight is authorized before qualification and a separate grant.
- §17.2 control 3 is a guard admission only. Runtime `judgeStart` and reconcile stay authoritative.
- `PREV_W4` must match 19,913 B and SHA-256 `544142a119dedc4c77279e5c0078ceac7c53dd7c520558aeb156a768c13638fd`.
- The pre-T4 hold has a distinct non-zero exit code, different from the usage and refusal exit 2.

## Round 1: frozen candidate v1 (manifest `c9062c36…`)

Verdict for this round: CHANGES_REQUESTED. The candidate has three open BLOCKERs. Gemini's independent QA verdict was not available at the time of this round. The final verdict still needs it.
Dispatch `ctx_d41f3cb69570`. Time: 2026-10-23, about 13:49–14:05 UTC. Lead freeze message: `msg_5b76938ede20` (from `msg_378d68de0ee8`).

### R1.1 Bindings checked

| Item | Result |
| --- | --- |
| `notes/MANIFEST-t7-shared-host-v1.sha256` | 8,624 B, mode 0600, SHA-256 `c9062c36c8a688f9b480961bc3300910037e7dcfe5dbb5ed93050c384f7ffac6`; 42/42 entries match SHA-256, size and mode |
| `notes/t7-shared-host-implementation/implementation-report.md` | 10,064 B, mode 0600, SHA-256 `3f5fd59822487ed67e5b1ba6bb3158326d835d504be24384b5dfcc19ed654c3d` |
| Original manifests | 84/84 and 6/6 entries still match; both manifest files are unchanged (`d7bbdb75…`, `1b6be474…`) |
| `run-t7-window-v2.sh`, M2 `w4-end.json` | unchanged (`1c884fdf…`, `544142a1…`) |
| Byte-identical copies | `boundary-r2/safe-docker.mjs` (`49516eac…`), `boundary-r2/docker-sampler.mjs` (`fcf1ce38…`), `lane-watch-r5/lane-watch.mjs` (`9090ce24…`), `lane-watch-r5/lane-watch-selftest.mjs` (`e7064c25…`) |
| Modes | No group or other permission bits in any candidate path |
| Runtime paths | No `R/t7`, `R/t7-clone` or `R/t7-attempt-*` exists |

The files under `notes/t7-shared-host-implementation/scratch/` (495 files, modes 0600/0700) are outside the manifest. The implementation report discloses this (see NIT N-6).

I read every new or changed file:
- `metadata.mjs`, `live-boundary-core.mjs` and `live-boundary.mjs`
- `reconcile-32vol-v2.mjs`
- the `lane-watch-core.mjs` diff from r4 to r5
- all of `run-t7-window-v3.sh`
- the output section of `lane-pool-selftest.mjs`
- the four final self-test logs

### R1.2 Findings

**F-01: BLOCKER. Real `host` and `none` networks make every capture UNKNOWN.**
- File: `tools/boundary-r2/metadata.mjs:19` together with `tools/boundary-r2/live-boundary-core.mjs:250-251`.
- Problem: on this engine, `docker network inspect` returns `IPAM.Config: null` for `host` and `none`. `networkMetadata` turns this into `ipam: null`. `metadataProblems` requires an array for every network, so every capture reports `UNKNOWN: incomplete network metadata: host` and `…: none`.
- Evidence:
  - The raw records are in `/Users/quangnguyen/cogniate-qa-runs/m3-preflight-ae130a3-20261020T1255Z/baseline-networks.json` (SHA-256 `cf847a0a…92ba`). The original tools hid the null with `IPAM.Config ?? []`.
  - My pure probe `p1-null-ipam.mjs` (output `1c68e3de…`, zero sentinel Docker calls) returns exactly these two problems.
  - The author mocks (`shared-host-selftest.mjs:21`, `lane-pool-selftest.mjs:23`) and Gemini's harness (`frozen-lanewatch-and-v3-runner.mjs:80-81`) all use `Config: []`, so no test finds it.
- Impact: `integrity()` adds these problems at `core:268`. So the preflight HOLDs, the runtime T3 and the guard stop, the W4 comparison fails, and lane-watch-r5 BLOCKs at start ("start boundary incomplete"). This fails closed and never gives a false pass, but no T7 can pass on the real engine.
- Action:
  - Accept an explicit null `Config` as an empty list for the built-in `host` and `none` networks only. Keep the strict built-in Id and record equality.
  - Keep IPAM sufficiency strict for SN, so a `sto-` network without IPAM stays UNKNOWN. The Lead confirmed this in `msg_7644c60496dc`.
  - Add a real-shape test case.

**F-02: BLOCKER (required control). A stop before T4 after the root exists still uses the refusal exit code 2.**
- Required outcome: §17.2 control 4 says "A stop before T4 … The exit code is distinct". `msg_2e865a3fab69` says "The pre-T4 hold has a distinct nonzero exit from usage/refusal exit 2".
- File `notes/scripts/run-t7-window-v3.sh`: exit 2 is the refusal code before any path or Docker call (lines 15, 19, 45, 51, 150, 154, 175). After line 179 creates `T7_ROOT`, these stops before T4 also exit 2:
  - the T1 wake BLOCK and the T2 liveness BLOCK (`live-boundary.mjs:130,138,157`, through `set -e`), after the wake container ran;
  - a T3 capture with any `BLOCKED:` problem (`live-boundary.mjs:166`);
  - the deadline check after the guard (lines 229–233);
  - the `BASELINE_EOF` refusals (lines 187 and 189).
- Other stops before T4 exit 1 or 3. Only the guard (lines 225–228) exits 4. The observer hash refusal at line 273 also exits 2, but it runs after T5 and T6 started.
- Effect: the launcher's exit file cannot separate "refused before any path or Docker call" from "root consumed after a wake and captures". This is not a false pass, because the existing root still blocks reuse.
- Action:
  - After line 179, map every non-zero result before T4 to one documented distinct code, and record the step and its raw code in a private file.
  - Keep exit 2 only for refusals before path creation.
  - Give the observer refusal a code other than 2.
  - Add CLI cases for a T1 stop, a T3 stop and a deadline stop.

**F-03: BLOCKER (required control). Two self-test outputs do not bind the bytes they tested.**
- Required outcome (§15.5): "The self-test outputs print the SHA-256 of the core and the self-test (review N1)."
- Evidence:
  - `logs/lane-pool-selftest-final.json` (`abae9215…`) has only the keys `checks`, `failed`, `passed`, `results`, `scratch` and `selftest` (`lane-pool-selftest.mjs:121`).
  - `logs/lane-regression-final.json` (`abb043dd…`) has only `checks`, `results`, `scratch` and `selftest`.
  - Both files, and `live-boundary-core.mjs`, have the modification time 20:45:55 local. So the content cannot show which core bytes ran.
- Action:
  - Print source bindings for `lane-watch-core.mjs`, `lane-pool-selftest.mjs` and the boundary-r2 `metadata.mjs` and core in the lane-pool output.
  - For the byte-identical r4 self-test, write a binding record beside its output; do not edit the copy.
  - Run all four self-tests again after the F-01 and F-02 fixes.

**M-1: MINOR. A W4 capture failure aborts before the T13 comparison.**
- The T12 capture now exits 1 when a vanish is not attributed or a read fails. Under `set -e`, the script then stops before the T13 compare and the W4 anon and reconcile steps, so the W3-to-W4 raw problems are not produced.
- This is fail-closed. v2 also stopped there, but only on a liveness BLOCK.
- Suggestion: record the exit code, finish T13, then exit non-zero.

**M-2: MINOR. Optional reuse hardening.**
- v3 meets §17.2 control 1 as written: the grant names the hash, and v3 refuses any other file.
- It does not refuse a `PREFLIGHT_W3_SHA256`, `GRANT_MSG` or `GRANT_DELIVERY` that an earlier `t7-attempt-*/t7/window/t0-grant.txt` already recorded.
- This is beyond the frozen text.

**NITs:**
- N-1: line 179 `mkdir -p` claims the root non-atomically. The atomic claim is `mkdir "$W"` at line 183. Prefer `mkdir "$R"` first.
- N-2: the lane-pool SN uses a hard-coded subnet `172.31.0.0/16` in `lane-watch-core.mjs`.
- N-3: the reconcile output field `expectedCount32` is always true.
- N-4: the capture adds "BLOCKED: end liveness not proven" also at `formal-start`.
- N-5: the header and usage text of `lane-pool-selftest.mjs` is copied from the r4 self-test.
- N-6: `scratch/` is outside the manifest. Bind it or exclude it explicitly.

### R1.3 Verified without a finding

- **§16.1 predicates.** E, AV, SC, SV and SN are as specified (`core:188-206`). Some checks are stricter than required: valid label maps, and `org.cogniate.*` lane labels on volumes through `resourceLane`. The "every capture that holds it" rule applies by pool (`core:288-323`). SV refuses an incomplete possible co-mounter.
- **Vanish and pools.** A W3 vanish or a lane-start vanish BLOCKs. A W4 vanish uses only a sufficient W3 record of the same id. A lane-end vanish uses only the lane-start record. The pool and invocation must match, and the start must be earlier (`core:208-243`). The vanish counts must agree with the details. Read errors are UNKNOWN. Raw `rawProblems`, `vanished`, `vanishedDetail` and `readFailures` stay beside `attributedForeign`.
- **Strict checks.** Identity, dockerInfo, settings, the built-in Ids and records, the sampler, baseline32 at every capture, the 7 originals and the 2 preserved records stay strict.
- **Reconcile and judgeStart.** `reconcile-32vol-v2` takes the 32 names from `PREV_W4` at W3, and from the W3 `baseline32` names at W4. Extra volumes need SV in the capture under test. `judgeStart` refuses an unlinked extra volume.
- **Sanitized projection.** It has no env, command, arguments or mount source and destination paths. Complete labels stay, as §17.1 requires.
- **lane-watch-r5.** R1, R2, the keep proof, the teardown and the `isolationPass` formula are unchanged. Only the two equality terms use pool attribution. Raw differences stay in the summary.
- **Preflight guard.** It is a guard admission only (reading R-1). `PREV_W4` is pinned to 19,913 B and `544142a1…` before any path is created and again at BASE32 (R-3). The `PREFLIGHT_W3` hash is checked before any path is created and again in the guard (R-4). B-TW-02 binds the guard record, the host checkout, the relocated observer and the lane start and end snapshots (R-5).
- **Unchanged parts.** There is no new events collector. The C8 runner and its argument structure are unchanged. The T0–T14 order is unchanged.
- **Path-only relocation** (`msg_32cbc886594d`). I ran a private probe with a sentinel `docker` on PATH; it recorded zero Docker calls.
  - The unchanged `prepare-checkout.mjs` ran with v3's arguments: frozen `source` → `clonechain/source` → `clonechain/t7-clone/<dest>`.
  - Both checkouts are pristine at `5561e8f7`, and `preready-btw03.mjs` passes (root and `t7-clone` both 0700).
  - The relocated `tests/host/lib.mjs`, `storage-docker.mjs` and `run-t7.mjs` are byte-identical to the frozen source.
  - The frozen source status is unchanged.
  - The v3 observer stop file, the needles, the capture-watch root, the lane-watch `--source` with the expected argv, the artifact path and the secret-scan targets all resolve under `T7_ROOT`.
  - Probe records (all mode 0600): `clonechain/t7/host-checkout.json` `b2ca75f0…`, `checkout.json` `fba924aa…`, `checkout-preready.json` `1fa42c37…`, and an empty sentinel log.
  - The two checkouts (about 125 MB) were made with v3's umask 022. I restricted them to owner-only after the records were written.

Residual risk (fail-closed): vanish detection matches exact Docker "not found" texts. I found no real Docker 29 stderr sample on this host. If the wording differs, a real vanish becomes a read error and the run FAILs. It is never attributed.

I asked the Lead to have Gemini add three cases: a real-shape null `Config` for `host` and `none`, the distinct exit codes, and a lane-start vanish BLOCK through `watchLane`.

### R1.4 Lead disposition (`msg_d263887ca760`, 14:04 UTC)

- **Required closure** (the same Codex executor fixes; I review the fixed delta):
  - F-01, F-02 and F-03.
  - M-1, now required: record the W4 capture's exit code, stop the sampler, try T13 compare, anon and reconcile, then exit non-zero. A capture, read or vanish failure must never become PASS, and owned cleanup must never be skipped.
  - The four author checks run again after the final patch.
- **Accepted deferral (MINOR):** M-2. The Lead checks grant and preflight freshness explicitly for each attempt. No reuse is authorized.
- **Accepted NITs** (non-blocking for this T7-only route; no code change): N-1 to N-6. N-1 relies on fresh unique granted paths plus the `W` claim. N-6 is disclosed outside the deployable manifest.

## Round 2 (part A): prepared correction delta (not yet applied)

Time: 2026-10-23, about 14:12–14:15 UTC. Lead message: `msg_25d589c69725`. Executor message: `msg_bfbc16d9338b`.
`notes/t7-shared-host-implementation/prepared-r2/MANIFEST-prepared-consolidated.sha256` is 2,798 B, mode 0600, SHA-256 `c579547fd7155bb90c83edb20386a7f721b8c3dce8dc0373831399beefb18a71`. All 12 entries match. `CONSOLIDATED-READINESS.md` is 2,426 B, `87a1e3db…`. The v1 candidate paths are unchanged.

Method:
- I applied the consolidated v3 patch to a private copy of v1. The result equals the prepared `run-t7-window-v3.sh` (`00eff893…`), and `bash -n` passes.
- The prepared `metadata.mjs` (`c5185044…`), `live-boundary-core.mjs` (`260df82f…`) and `lane-pool-selftest.mjs` (`de06c8a4…`) equal their patches.
- The author's 28 focused controls pass in `selftest-consolidated-2.json` (`68c22507…`). That is author evidence, not independent QA.

| Finding | Status at source level | Evidence |
| --- | --- | --- |
| F-01 | Closed | An explicit null `Config` stays null. An absent `Config` becomes undefined, so the key is dropped and the record is UNKNOWN. Null is accepted only for `host`/`host` and `none`/`null`. Built-in Id and record equality is unchanged. SN still requires an array. The author test uses the saved real records. |
| F-02 | Closed | The EXIT trap maps any non-zero result to 4 while `PRE_T4=true` and the root exists. It writes `W/private/pre-t4-stop.json` with the step and the raw exit code. The guard no longer sits inside `if`. `PRE_T4=false` comes after the deadline check and before T4. Refusals before the root exists stay 2. The post-T4 observer refusal is now 1. |
| M-1 | Closed | The W4 capture exit code is kept. The sampler stops first. Compare, anon and reconcile each run once. `W/private/t13-status.json` records all exit codes. Any non-zero result exits 1 before T14. |
| F-03 | Partly closed | The lane-pool output now has `sourceBindings` (core, self-test, metadata and boundary core). The sibling binding record for the byte-identical r4 self-test comes only with the final execution. |

**F-04: MINOR (new; a regression from the F-02 fix that widens the accepted N-1 race).** Sent to the Lead in `msg_0ccf56f8d888`.
- The trap condition `-d "$R"` does not prove that this process owns the root.
- In a duplicate concurrent launch on the same `T7_ROOT`, the losing process fails at the overlap loop or at `mkdir "$W"`. Its trap then runs `mkdir -p "$W/private"` and writes `pre-t4-stop.json` with `>`. That can create or overwrite a record in the winning attempt's `W/private`, or create `W` so that the winner fails.
- The record is private, there is no false pass, and the case needs an out-of-protocol duplicate launch.
- Suggested fix: claim the root with `mkdir "$R"` (no `-p`), set a flag only on success, and map the exit code or write the record only when the flag is set, with noclobber.

This part does not close the round. These items are still required:
- the applied r2 sources with a new manifest;
- the final author outputs, including the F-03 companion record;
- Gemini's independent verdict.

Lead disposition of F-04 (`msg_dab185c2e6ff`, 14:16 UTC): F-04 is to be corrected in this same batch, not deferred. The fix is an atomic root claim, an explicit flag that this process owns the root before it writes the stop record, and no-clobber output. This replaces only the earlier N-1 deferral. M-2 and the other NITs stay deferred.

## Round 2 (part B): independent trace of Gemini Q1–Q4 on the v1 snapshot

Time: 2026-10-23, about 14:17–14:20 UTC. Lead messages: `msg_1699a2b8b5f5` and `msg_64b9a119b341`. Gemini batch: `msg_504525b08f74`.
Gemini's v1 results:
- File: `notes/t7-shared-host-independent-qa/v1-initial-candidate-results.json`, 15,997 B, mode 0600, SHA-256 `6d327bbb73c5daef15e776b627451a44ceae2a536e2be587fc6caacbe60a1616`. It was run at 14:16:38.444Z with runner `execute-all-frozen-checks-v1.mjs` (`bd6ab21a…`).
- Result: `overallPass` false, 0 sentinel Docker calls, and the candidate manifest `c9062c36…` (42 entries) verified.
- Frozen cases 29/30 pass; TC-VOL-07 fails. The §17, §17 control 1 and CL-1 suites pass. The four regression checks REG-01 to REG-04 fail.

My probe `scripts/p3-q1-q2.mjs` (`9d8e1293…`, output `out/p3-q1-q2.json` `48413523…`, zero sentinel Docker calls) builds its records from the real preflight `w3-start.json` and the M2 W4 baseline32. It runs the frozen v1 code.

**Q1 (= TC-VOL-07 and REG-01): confirmed at function level. It is not a T7 false pass.**
- Case: a linked volume whose `sto-` container is removed (not vanished) by W4, and which stays unchanged and unlinked.
- `judgeStart` returns `[]`, and `compareBoundaries` returns `[]`, because §16.1 judges differences only.
- `reconcile32(W4, W3)` returns `ok: false` with `UNKNOWN: unlinked extra volume`. v3 gates on that result.
- Compare also lists the W3 SV entry in `attributedForeign` for a volume that is unlinked at W4, which can mislead a reader.
- Required closure, folded into r2.

**Q2 (= REG-02): confirmed. This is a real gap in a required control, so it is a BLOCKER.**
- Case: an unclassified container that is not `sto-` and has a bind mount, present and unchanged in the preflight, W3 and W4.
- It passes `judgeStart` at W3, the preflight-to-W3 guard, `compare` and both reconciles. Only the Lead's manual preflight reconciliation would find it.
- §17.2 control 3 admits only a resource "reconciled in `PREFLIGHT_W3`". Control 2 limits reconciliation to `PREV_W4`, E-R6 or §16.1 classification. So "identical to any preflight resource" is wider than the control.
- Correction to my Round 1 reading R-1: I checked that the guard admission does not attribute, but I missed the "reconciled" qualifier.
- If every present non-lane container, non-built-in network and extra volume must be classified at runtime W3 and at W4, the effect is the same in practice. An identical classified record stays classified, and reconcile already gates volume links.
- Parity question sent to the Lead: lane start and lane end have the same blind spot. A container created after W3 and removed before W4, but unchanged between lane start and lane end, is never judged. Either apply the same rule there, or record it as the §17.1 "between captures" limit.

**Q3 (= REG-03): confirmed as an inconsistency, with no false-pass path.**
- `core:221-223` does not check `reason`.
- But the vanish loop (`core:228-237`) turns any detail without `not_found` into a problem, and `metadata.mjs` writes only `not_found`.
- MINOR, folded into r2.

**Q4 (= REG-04): confirmed as input hardening, not reachable in v3.**
- v3 passes only `PREV_W4` (no `capturePool`) or the W3 outer capture as the previous record.
- MINOR, folded into r2.

Summary of my message to the Lead (`msg_db6f229da541`): Q1–Q4 and F-04 belong in the applied r2. I review that delta at the r2 freeze.

### R2.C Lead decision on parity (`msg_8fb649558e42`, 14:20 UTC) and the severity record

Lead decision: the present-resource rule applies to both pools, the outer pool {W3, W4} and the lane pool {lane start, lane end}.
- Every present non-lane container, non-built-in network and extra volume needs positive §16.1 attribution in each capture of its own pool.
- Lane-owned exceptions and the lane R1/R2/keep checks stay.
- No record crosses pools.
- A resource visible in a lane snapshot is observed evidence. It is not the documented limit, which covers only resources created and removed entirely between captures.

Correction to Round 1 (R1.3 and reading R-1): my statement "Preflight guard. It is a guard admission only (reading R-1)" stays true for attribution. But that round missed the gap in the "reconciled in `PREFLIGHT_W3`" qualifier. That gap is Q2.

| Id | Severity | Basis | Status |
| --- | --- | --- | --- |
| F-01 | BLOCKER | Wrong result: every real capture is UNKNOWN | Required closure |
| F-02 | BLOCKER | Required control: §17.2 control 4 and `msg_2e865a3fab69` | Required closure |
| F-03 | BLOCKER | Required §15.5 N1 output binding | Required closure |
| Q2 | BLOCKER | Required control: §17.2 controls 2 and 3; mechanical gap | Required closure (both pools) |
| Q1 | MAJOR | False pass at boundary-function level; the final reconcile rejects it, so it is not a false pass of the whole T7 | Required closure |
| M-1 | MINOR | Diagnostic completeness | Lead made it required |
| F-04 | MINOR | Regression from the F-02 fix; widens the N-1 race | Lead made it required; replaces the N-1 deferral |
| Q3 | MINOR | Inconsistency; the vanish loop already rejects other reasons | Folded into r2 |
| Q4 | MINOR | Input hardening; not reachable in v3 | Folded into r2 |
| M-2 | MINOR | Optional replay scan | Accepted deferral (the Lead checks freshness for each attempt) |
| N-2 to N-6 | NIT | See R1.2 | Accepted deferrals |

## Round 2 (part C): applied candidate r2 (held bytes)

Time: 2026-10-23, about 14:34–14:37 UTC. Lead message: `msg_6b249a1d0c56`. My source verdict: `msg_766c99080ff3`.

### R2.D Bindings

| Item | Value |
| --- | --- |
| `notes/t7-shared-host-implementation/r2/MANIFEST-candidate-r2.sha256` | 8,577 B, mode 0600, SHA-256 `e4f6030009ff02c2f15cd9a79b7eca1e76ff7088b8b9a81fdae12a3706ecb05c`; 42/42 entries match SHA-256, size and mode |
| `r2/implementation-report-r2.md` | `952ba5e0ad7b1fb47c6c99836e2a467949d44b088db2bc9acde044d720bc8c70` |
| `r2/candidate-bindings-r2.json` | `e2b02e047ce834cc0c22a4b4f1a09c115d1861207fefe2c977189201712503c7` |
| Changed sources | `live-boundary-core.mjs` `6205ea96…`, `live-boundary.mjs` `68f1a172…`, `metadata.mjs` `c5185044…`, `lane-watch-core.mjs` `cb3136fb…`, `lane-pool-selftest.mjs` `c546ec8b…`, `reconcile-32vol-v2.mjs` `c4f19616…`, `run-t7-window-v3.sh` `70d33634…` |
| Unchanged copies | `safe-docker.mjs` `49516eac…`, `docker-sampler.mjs` `fcf1ce38…`, `lane-watch.mjs` `9090ce24…`, `lane-watch-selftest.mjs` `e7064c25…` |
| Originals | 84/84 and 6/6 entries still match. The v1 manifest `c9062c36…`, v2 `1c884fdf…`, M2 W4 `544142a1…` and `observe2.mjs` `d60dc920…` are unchanged. The v1 snapshot matches the v1 manifest (6/6 changed files). |
| Runtime paths | `R/t7`, `R/t7-clone`, `R/t7-attempt-*` and the BASE32 files are absent |

### R2.E Closure check (diff from the v1 snapshot to r2, read in full)

| Id | Result | Where |
| --- | --- | --- |
| F-01 | Closed | `metadata.mjs:19`; `core:250-252`. Only an explicit null is accepted, and only for `host`/`host` and `none`/`null`. |
| F-02 | Closed | v3 trap and `PRELAUNCH_STEP`. Exit 4 plus `W/private/pre-t4-stop.json`. Refusals stay 2. The observer refusal is 1. |
| F-04 | Closed | `mkdir "$R"` and `ROOT_CLAIMED`. A failed claim exits 2 and writes nothing. The record is written with `set -C`. N-1 is therefore also resolved. |
| M-1 | Closed | v3 T12–T13 exit codes, `W/private/t13-status.json`, exit 1 before T14 |
| Q1, Q2 | Closed in both pools | `requireAttributedPresent` (`core:279-288`) accepts only same-capture entries (`a.capture === rec.stage`). It skips lane resources, built-in networks and baseline32 volumes. It runs in `judgeStartDetailed` (W3 and the preflight), `compareBoundariesDetailed` (end), the end capture, the guard, and lane start and end. Lane volumes now use `all` mode. |
| Q3 | Closed | `core:223` requires `reason === 'not_found'` |
| Q4 | Closed | `reconcile-32vol-v2.mjs:17`. A previous `capturePool`, if present, must be `outer`. |
| F-03 | Closed | `r2/lane-pool-author-1.json` (`7152d976…`) binds the r2 core, self-test, metadata and boundary core. `r2/legacy-author-1.bindings.json` (`ac3f9d13…`) binds the r2 cores, the unchanged self-test, the output, stderr and the record taken before the run, and sets `sourcesStableBeforeAndAfter` to true. |

Author suites (author evidence only; all PASS and bound to the r2 hashes):
- core: 68/68 (`704b2675…`)
- lane-pool: 17/17 (`7152d976…`), including unchanged unknown container, unchanged unknown network, orphan at start and orphan at end
- wiring: 30/30 (`0a244334…`)
- legacy: 54 scenarios / 39 checks (`cb9cf737…`)
- focused: 32/32 (`7b41f2c0…`), including four F-04 cases

My probes on the held bytes (zero sentinel Docker calls):

| Probe | Result |
| --- | --- |
| `p1` real `host` and `none` (`out/p1-null-ipam-r2-held.json`, `de944b64…`) | No problems |
| `p4` A: real built-ins, no foreign resource (`out/p4-r2-held.json`, `8b6a7bd4…`; script `b5d4e8b5…`) | Passes judgeStart, compare, both reconciles and the guard |
| `p4` B: Savoy linked container and volume plus `sto-net`, present and unchanged | Passes the same five checks |
| `p4` C: Q1 | Compare fails and the W4 reconcile fails |
| `p4` D: Q2 | judgeStart at W3, compare and the guard fail |
| `p4` E: `sto-net` with null IPAM | Fails |
| `p4` on the v1 snapshot (`out/p4-v1-snapshot.json`, `aa50542f…`) | Every case shows the F-01 problems |

The output I discarded earlier (`out/p4-UNFROZEN-inprogress-DISCARD-not-evidence.json`) happens to be byte-identical to the held-byte result. It is still not used as evidence.

Source-level result: no open BLOCKER or MAJOR. Accepted deferrals: M-2 (MINOR) and N-2 to N-6 (NIT). Final APPROVE depends on Gemini's independent r2 PASS.

## Round 2 (part D): Gemini r2 partial failures, diagnosed

Time: 2026-10-23, about 14:41–14:49 UTC. Lead messages: `msg_5c9cf63b6171`, `msg_80368410fa61` and `msg_84f3f3f387a3`. My messages: `msg_ee5194a10926` and `msg_69187a1cfdd4`.
Gemini's `r2-candidate-results-attempt2.json` (20,721 B) was executed at 14:41:26.961Z:
- original 30/30, §17 6/6, control 1 2/2 and CL-1 2/2 pass;
- corrections 9/10, and `TC-CORR-LANE-PARITY-Q1-Q2` fails.
The earlier TC-SAFE `invalid_listing_record` failure and the legacy hash typo do not appear in attempt 2. The bound legacy value is `e7064c25…c04f09a88dc40d` (45,940 B), equal in both manifests.

The remaining lane failure comes from the QA fixture, not the candidate. My probes ran against the held r2 bytes, with zero sentinel Docker calls:
- `p5-lane-valid.mjs` (`0653b1a1…`, output `dd54ce1c…`) copies Gemini's fixture logic.
  - Its `volume ls -q` returns JSON lines, so in r5 `all` mode every scenario BLOCKs at start with exit 3. The "orphan exit 3" result therefore came from the mock.
  - With a realistic `-q` rendering, the valid case exits 1 only because `waitStop` gives no clone `.env`, summary, run log or keep step. The strict keep and clone-binding checks fail, stack-down is skipped, and the mock never switches to its end data. This agrees with `msg_220f5b4d8367`.
- `p6-lane-complete.mjs` (`37a8eb79…`, output `8f3c86bd…`) uses a realistic `-q` and a complete keep proof:

| Case | Result |
| --- | --- |
| Valid SC+SV, unchanged | Exit 0, `isolationPass` true |
| Orphan volume at end | Exit 1, `isolationPass` false. `keepVerified`, `cloneBound` and `teardownOk` are true. `endErrors` has "current volume lacks positive attribution". |
| SC+SV removed together | Exit 0 |
| SC+SV added at end | Exit 0 |
| Unchanged unattributed container | Exit 3, "start boundary incomplete" |

Conditions for an acceptable QA correction:
- The fixture uses the realistic `-q` output and a complete lifecycle proof.
- The valid case asserts exit 0 and `isolationPass` true.
- The orphan case asserts exit 1, `isolationPass` false, `keepVerified` and `teardownOk` true, and that exact `endErrors` entry.
- The unchanged unknown container and network cases assert exit 3 with "start boundary incomplete".
- An assertion that accepts "1 or 3" is a weakening and cannot be final.

The private probe scratch is in `notes/t7-shared-host-focused-review/p5-scratch/` (0700).

## Final result (round 2): APPROVE for preparation qualification of candidate r2

Time: 2026-10-23, about 14:57–15:02 UTC. Lead messages: `msg_27d8bf3a5cd4` (Gemini final) and `msg_4cb3676ff2b3`.

**Verdict: APPROVE.** This covers only the held r2 copied QA tools and the v3 wrapper. They meet §§15–17, CL-1 and the Lead rulings. Gemini's independent qualification passes. No BLOCKER or MAJOR is open.

This approval does not do any of these things:
- approve runtime or any acceptance exception;
- grant host access, a preflight or a T7 launch;
- show that T7 passed.

T7 has not run. The runtime still needs a separate Lead decision, a fresh preflight that uses the qualified `boundary-r2` capture and `reconcile-32vol-v2` (CL-1), a grant that names the `PREFLIGHT_W3` hash, and an LA window. All accepted M1, M2 and legacy evidence stays as it is. AC-M4-06 stays PENDING. All 32 real-LMS rows stay UNVERIFIED, and local Canvas stays DEFERRED.

### F.1 Final bindings (checked again at 15:00 UTC)

- **Candidate:** `notes/t7-shared-host-implementation/r2/MANIFEST-candidate-r2.sha256`, SHA-256 `e4f6030009ff02c2f15cd9a79b7eca1e76ff7088b8b9a81fdae12a3706ecb05c`. All 42 entries match SHA-256, size and mode.
- **Originals:**
  - `MANIFEST-host-ready.sha256` (`d7bbdb75…`) 84/84 and `MANIFEST-lane-watch-r4-v2.sha256` (`1b6be474…`) 6/6 match.
  - v2 (`1c884fdf…`), M2 W4 (`544142a1…`) and `observe2.mjs` (`d60dc920…`) are unchanged.
  - The v1 manifest `c9062c36…` and the v1 snapshot are preserved.
- **Runtime paths:** no `t7`, `t7-clone` or `t7-attempt-*` path and no BASE32 file exists.
- **Independent QA** (Gemini, `notes/t7-shared-host-independent-qa/`):
  - `execute-all-frozen-checks-r2-final.mjs`: 41,592 B, mode 0700, `ab1e17d9430c760583924dcc098c8c0bda6268b27d8285b019f6778f798832aa`
  - `r2-candidate-results-final.json`: 20,238 B, mode 0600, `02e03e920aa6238d450e055332b32887316f55c476d894661c4a725393d43a52`, run at 14:57:03.123Z
  - `r2-qa-adapter-disclosure.md`: 10,307 B, mode 0600, `dae71162bc2536e8a65b1e3f936ad3f0cac847f7503ddc6f7cc7ee8c29c348de`
- **QA results:** `overallPass` true and 0 sentinel Docker calls. Frozen cases 30/30, lane-watch 5/5, §17 6/6, control 1 2/2, CL-1 2/2, corrections 10/10 and regression checks REG-01 to REG-04 all pass.

### F.2 Review of the QA adapters and assertions

I checked the final runner against the conditions I set (`msg_ee5194a10926`, `msg_69187a1cfdd4`). The 17 frozen QA files stay byte-identical. The corrections are made in memory by the runner.

| Adapter | Assessment |
| --- | --- |
| A1: the fake Docker renders `{{json (.Label …)}}` | Accepted. It only adapts the mock to real Docker template output, and it uses the same escaping as the v1 runner. The TC-SAFE assertions are unchanged. |
| A2: legacy self-test hash typo (`c84f` → `c04f`) and r2 output paths | Accepted. The new value equals both bound manifests (`e7064c25…c04f09a88dc40d`, 45,940 B). |
| A3: end-of-lane orphan volume asserts exit 1 instead of 3 | Accepted, and stricter than before. It matches the frozen lane-watch exit contract (`lane-watch.mjs:9`, core `:148`, `:308`). It also asserts `isolationPass` false, `keepVerified`, `cloneBound` and `teardownOk` true, and the exact "current volume lacks positive attribution" entry in both the summary and `boundary-end.json`. |
| A4: complete lifecycle in the lane fixture | Accepted. The fixture now has a real `-q` volume listing, `.env`, the runner summary with the keep step, the run log with the exact argument list and `exit 0`, and three stack cycles. Valid case: exit 0, `isolationPass` true, no end errors, SC and SV attributed at `end`. Unchanged unknown container and network: exit 3, "start boundary incomplete". |
| A5: attribution by capture | Accepted. End attribution must come from the `end` capture. |

My own probes (`p5`, `p6`) give the same results on the held bytes.

The independent results also cover:
- real `host` and `none` records with null IPAM in every function, including lane-watch (TC-CORR-F01-POS) and the matching negatives;
- the F-02, F-04 and M-1 wrapper contract;
- a vanish at lane start that BLOCKs;
- the present-resource rule in both pools;
- the 30 original positive and negative cases.

### F.3 Findings at closure

| Status | Findings |
| --- | --- |
| Closed in r2 | F-01, F-02, F-03 and Q2 (BLOCKER); Q1 (MAJOR); M-1, F-04, Q3 and Q4 (MINOR). N-1 is closed by the F-04 fix. |
| Accepted deferrals (Lead `msg_d263887ca760`) | M-2 (MINOR): no replay scan of earlier grants or preflights; the Lead checks freshness for each attempt. N-2 to N-6 (NIT): fixed T7 subnet in the lane pool, the `expectedCount32` label, the end-liveness wording, the copied self-test header, and implementation scratch outside the deployable manifest. |
| New NITs (QA documents, Gemini-owned; not blocking) | (a) `r2-qa-adapter-disclosure.md` A2 says `MANIFEST-lane-watch-r4-v2.sha256` is `99b7d011…`; the bound value is `1b6be474…`. (b) The unsuffixed `r2-candidate-results.json` is a copy of attempt 2, not the final result. Always cite the `-final` file. |

### F.4 Residual risks and evidence limits

- All of these fail closed. None can give a false pass. Any of them can stop or consume an attempt.
  - The exact Docker "not found" texts: if the wording differs, a real vanish becomes a read error.
  - An idle-VM bridge replacement before runtime W3: the guard stops the run.
  - A Savoy race at a capture or a lane snapshot: UNKNOWN, then BLOCK or FAIL.
- The route does not prove an exclusive window. A resource created and removed entirely between two captures of a pool is not seen.
- Gemini's first r2 output was overwritten. Its attempt-1 runner and record were reconstructed from the run's stdout (disclosed; `392791a6…` and `65cd96b1…`). Attempts 2–4 and the final run are preserved. The final verdict depends only on the final bound run.
- My one unfrozen probe output is excluded from all evidence (see R2.D, note `msg_a6585ac1f22f`).

### F.5 My actions and evidence

- I ran no Docker, runtime, install or product test.
- I edited no candidate, tool, source, test, architecture, guide or Lead file. My only repository file is this report.
- My private notes are under `R/notes/t7-shared-host-focused-review/`:
  - layout: directories 0700 and files 0600; a sentinel `docker` recorded 0 calls;
  - requirement matrix: `00-requirements-matrix.md`;
  - probes `p1` to `p6` with their outputs;
  - `clonechain/`: the two-stage checkout probe;
  - `patchcheck/`: the applied v3 patch;
  - `p5-scratch/`: the lane fixtures.
- Model: the session shows `claude-opus-5-5`. The launch receipt records xhigh effort. The runtime effort is not visible in the session.
