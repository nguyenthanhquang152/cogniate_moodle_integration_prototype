Verdict: APPROVE
Round: 1

# M3 lane-monitor repair: focused independent tool review (§13 pre-runtime gate)

Reviewer: Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh effort.
Task `task_1416e3df768c`, dispatch `ctx_6d532ec82e2c`, run `run_ebe671ad72a9`.
Time: 2026-10-23, about 02:53–03:30 UTC.
I am independent of the Architect and of the QA author (Gemini `ctx_8449a3df3e54`). I did not write any reviewed file.

## 0. Summary

- I approve the repaired private lane monitor `R/tools/lane-watch-r4/` (3 files) and the two invocation scripts, M2 v5 and T7 v2, for the §13 pre-runtime tool gate.
- Stage 1 found one MAJOR issue in the repair rule (LW-R-01). The Lead accepted my bounded amendment. The pinned core implements it, and the selftest covers it.
- The pinned files have no open BLOCKER or MAJOR finding. Section 9 lists seven NITs and three launch preconditions. None blocks the gate.
- This review does not accept M2. M2 stays NOT ACCEPTED until a new successful runtime invocation passes every original check. AC-M4-06 stays PENDING. All 32 real-LMS rows stay UNVERIFIED. Local Canvas stays DEFERRED.
- This review does not replace the final conformance check or the two blind final prototype reviews.

## 1. Scope, method and limits

R = `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-5561e8f-c8R3Prep`.

In scope: the lane-watch-r4 diff, the selftest cases and their recorded result, the unchanged original tools and their dependencies, the M2 and T7 invocation changes, private output, scan and retention.

Out of scope: product code, C6/C8/C9 tests, `tests/host/storage-docker.mjs`, the M1 v5 launcher, legacy results, and Architect conformance.

Method: host-only reading, `diff -u`, SHA-256 checks, `bash -n` and `node --check` (parse only), and a two-line V8 `JSON.parse` message probe. I ran no Docker, test, selftest, build or install command. I did not edit any tool, test, script, product, guide or Architect file.

Limits:
- I did not rerun the selftest. The PASS result comes from QA's recorded stdout (see NIT N1).
- The cause of attempt 3 is still an inference. Docker stderr was not captured then (plan §13.2).
- My timing estimates in §3 come from the event-to-ledger delays of attempt 3. They are not per-call measurements.

Private review evidence (owner-only, outside every frozen run root): `/Users/quangnguyen/cogniate-qa-review-evidence/lane-monitor-r4-review-20261023/`. It holds the 84/84 manifest checks, a copy of the pinned r4 files, the final hash list and the extracted binder used for `node --check`.

## 2. Inputs and pins

| File | Bytes | SHA-256 | Status |
| --- | --- | --- | --- |
| `docs/reviews/M3/t6-09-failure-plan.md` at `5c8f2dc` | 73,541 | `0869e4631bc068bb8e8ca77f0e64055340e0f1828227a23c19ff1203add3e52b` | matches |
| `R/tools/lane-watch/lane-watch.mjs` (original) | 6,170 | `9090ce248251e430a4552ca2d3a4b85afe91be62ed905d844b3f0ace18ed33fb` | unchanged |
| `R/tools/lane-watch/lane-watch-core.mjs` (original) | 21,712 | `7bca56c5e5416646a63f0b70c03e91d9e2b846bf974729e8cc341dfeabae952e` | unchanged |
| `R/tools/lane-watch/lane-watch-selftest.mjs` (original) | 24,341 | `171b92b1af9556cb89c0ad36ae601ea3505591954f5c33a1d2899dce2b19ac82` | unchanged |
| `R/tools/lane-watch-r4/lane-watch.mjs` | 6,170 | `9090ce24…ed33fb` | byte-identical to the original (`cmp`) |
| `R/tools/lane-watch-r4/lane-watch-core.mjs` | 24,297 | `d7b962b6e6ebefc5eb6f2ac9212f0368c556c233cff56cbf7174937414847561` | reviewed |
| `R/tools/lane-watch-r4/lane-watch-selftest.mjs` | 45,940 | `e7064c25ad7e54557eb5c11377ca20982fa08b7cd699da3509c04f09a88dc40d` | reviewed |
| `R/notes/lane-watch-r4-selftest.stdout.json` | 9,143 | `031681396f997f0df695223724df5c8e2a64749ca13a3127921ddc4439d425af` | PASS, 39/39 checks |
| `R/notes/MANIFEST-lane-watch-r4-v2.sha256` | 1,071 | `1b6be474b5a972b5b028e064985486ea6a2f5e43767ce48f2ac63a676af27fef` | its 6 lines match the files |
| `R/notes/lane-watch-r4-v2.diff` | 30,241 | `139c9fb241def0954ef2c72bd4b1373554a206e638648a5ab8a15a881e2225fa` | QA's diff record |
| `R/notes/scripts/run-m2-window-attempt4-v5.sh` | 21,280 | `b8bda7964aad3e9aa7f1a130036238b0a396f3ca12cb034a8049dd77fc509689` | reviewed against v3 |
| `R/notes/scripts/run-m2-window-attempt3-v3.sh` (frozen) | 19,785 | `7a7614f5d1e71cd6cca4f803a70bb1f10dc3e79730a0a048f61be70530640731` | unchanged |
| `R/notes/scripts/run-t7-window-v2.sh` | 20,605 | `1c884fdfec60a849c6f57410f7b62b28bdd37fc0d29c89510c40e4910e73d48f` | reviewed against v1 |
| `R/notes/scripts/run-t7-window-v1.sh` (frozen) | 20,554 | `3d7f43b635f7b7549715db43211de775e19387a1a172bad359b941e682b7b560` | unchanged |

Other checks at 03:23:28 UTC: `R/notes/MANIFEST-host-ready.sha256` 84/84 entries OK (hash, bytes, mode), and `R/notes/tool-list-37.txt` 37/37 OK. `R/source` HEAD is `5561e8f7`. `tests/host/storage-docker.mjs` has blob `3a4fbc4bf64bf078a70a2a6450f409707bf87a7f`, the same as in plan §13. The r4 directory and its three scripts have mode 0700, as §13.4 requires.

## 3. Stage 1: LW-R-01 (MAJOR, resolved by an accepted amendment)

**Problem.** Plan §13.4(b) as written accepts only failed calls of the same kind before the final single inspect. `listLane` (`storage-docker.mjs:218-235`) calls Docker in this order: `ps`, `ps`, `network ls`, `volume ls`, container inspect, network inspect. A network vanish needs `network ls` before the removal and `network inspect` after it. The container inspect runs between those two calls. Compose removes the network just after the last container.

**Evidence from attempt 3.** The postgres destroy is at timeNano 41.0396. The `StorageBlocked` is at 41.097 (label `poll`). The network destroy is at 41.1273. Most event-to-ledger delays are 0.10–0.46 s (20 of 23; the other three were probably queued behind another listing). That suggests about 20–40 ms for each Docker call. So the failed listing probably listed postgres with `ps`, and its container inspect probably ran across the postgres removal. That gives a failed bulk `container inspect` plus single `container inspect` calls with "No such container". `listLane` already accepts those. The literal rule calls them "another kind", so the repaired tool could still fail closed on a likely form of the same race. T7 has more network removals because of its resets. This is a false FAIL, never a false pass.

**Bounded fix (accepted).** For a network vanish, also accept failed calls that come before the network calls and that `listLane` itself accepts: one container inspect, then one or more single container inspects whose stderr matches `/no such/i`. Every other failure stays fail-closed.

**Decision.** The Lead accepted this in `msg_30bbc088a7ab` and recorded it at `84e1462` (`docs/team/r6-independent-verification-2026-10-23.md`, "Monitor repair decision"). The Architect will include it at final conformance. The amendment changes no product rule, summary field or `isolationPass` term.

## 4. Stage 2: core review (`lane-watch-core.mjs`, r4)

The diff is only inside `observeSoon` (r4 lines 169–197). The rest of the file is byte-identical to the original. That includes the summary fields, the `isolationPass` formula (`:277-279` in r4), R1–R3, W1–W4, the poll interval, the event child and the teardown order.

| §13.4 rule | Code (r4) | Result |
| --- | --- | --- |
| Step 1: a fresh recording wrapper for each listing; it keeps argv, exit code and stderr of each non-zero call | `:169-170`, `:172` | Met. No stdout is kept. |
| (a) `StorageBlocked` with the exact `:234` text, kind `network` or `container` | `:174-175` | Met. Anchored regex; any other error gives `a = false`. |
| (b) The last failed call is `[kind,'inspect',id]` with stderr that does not match `/no such/i`. Each middle call is a unique single inspect of the same kind, inside the bulk, with "no such" stderr. | `:181-185` | Met. One network with the same bulk and single argv passes (`tail.length >= 2`). |
| LW-R-01 amendment: for a network only, a prefix of one container inspect plus at least one unique container single with "no such" stderr | `:177-180` | Met. A container vanish uses `kIdx = 0`, so no other-kind prefix is accepted. Any `ls`, volume or unrelated failure fails (b). |
| (c) The ledger has a record of that kind and Id, and no record of that Id was ever `madeByRun: false` | `:186` | Met. The second test is stricter: it checks any kind. |
| (d) Exactly one confirm listing with its own wrapper, observed into the ledger as `<label>-confirm`; the id is absent | `:187-192` | Met. A throw gives `d = false`. There is no loop and no second confirm. |
| Step 2: a private record for every listing error | `:194-195` | Met. `private/listing-errors.jsonl` is created with mode 0600 inside the 0700 `private/`. It holds the label, name, message, failed calls, conditions and the confirm calls. |
| Step 3: public `listing_vanish` with label, kind and id only | `:196` | Met. No stderr goes to a public file. |
| Step 4: every other case calls `err(label, e.name)` exactly as before | `:197` | Met. |

Adversarial checks:
- **No false pass.** A `listing_vanish` needs a known own record (R1 is unchanged) and a confirm listing that is observed and that lacks the id. Any resource in the confirm listing enters the ledger as usual. The only resources the tool cannot see are those that appear and vanish inside the failed listing. That gap already exists between any two listings, so the repair adds no new blind spot.
- **No unbounded retry.** At most one extra listing runs for each listing error. A persistent error fails the confirm and then records the normal ownership error.
- **No weaker isolation formula.** `ownershipErrors` still counts every other listing error. `isolationPass` is byte-identical.
- **Teardown mode (T7).** A vanish adds no entry to `errors`, so `stack:down` and the ledger plan run as before. Any other listing error still keeps every lane resource.
- **Ordering.** The private record is written before the public event or error. So each `listing_vanish` has its private record, as §13.5 requires.

## 5. Selftest coverage and results

The selftest uses the real frozen `storage-docker.mjs` (`listLane`, `OwnershipLedger`) with a scripted Docker fake. So it drives the true call order of `listLane`.

| Case | §13.4 class | Key assertions |
| --- | --- | --- |
| `s13-vanish-own-network-positive` (observe) | positive; one network with the same bulk and single argv; planted bulk stdout | exit 0; `isolationPass` true; `ownershipErrors` 0; exactly 2 listings; 1 `listing_vanish`; the confirm container is recorded with `event:network-destroy-confirm`; private file 0600; failed calls keep only argv, code and stderr; no planted stdout or env in any file |
| `s13-vanish-mixed-kind-positive` (observe) | LW-R-01: container bulk and two no-such singles, then network bulk and single | 5 failed calls in the exact order; conditions a–d true; no stdout kept |
| `s13-vanish-own-container-sibling-nosuch-positive` (teardown) | container vanish with a no-such sibling | exit 0; `keepVerified` true; 1 `listing_vanish` |
| `s13-neg-failure-confirm-throws`, `…-confirm-still-present` | failure | exit 1; 1 ownership error; exactly 2 listings (no retry); conditions a–c true and d false |
| `s13-neg-foreign-unrecorded`, `…-not-made-by-run` | foreign | 1 ownership error; no confirm; c false |
| `s13-neg-multi-container-non-nosuch-before-network`, `…-second-non-nosuch` | multi (the stdout-only "no such" trick) | 1 ownership error; no confirm; b false |
| `s13-neg-other-volume-inspect-msg`, `…-non-storage-blocked` | other | 1 ownership error; a false; volume stderr only in the private file |

Recorded result (`031681396f99…`): `selftest: PASS`. It has 54 scenarios (the 43 original plus 11 new) and 39 checks (the 32 original plus 7 new), and all are true. The 43 original scenario outcomes are identical to the original `selftest-output.json`. The scenario names in the stdout are exactly those in the pinned source.

The planted bulk stdout (`SECRET=planted-secret-value` in `Config.Env`) proves that no stdout reaches any file, private files included. `leakedEnv` (selftest `:82`) reads every output file, and `noEnvLeak` stays true.

## 6. Unchanged originals and dependencies

- The three original lane-watch files and the original `selftest-output.json` match their pins. The 84-entry and 37-tool manifests pass in full (§2).
- The r4 wrapper is byte-identical, so the CLI, the arguments, the project regex `^qa-e2e-(sim|m3)-r\d+$`, the event filter and the poll stay the same.
- The repaired core imports nothing new. It still uses only the frozen `sd` helpers.
- `storage-docker.mjs`, C8, C9 and the product are unchanged. M1 and legacy have no dependency on this tool (plan §13.5).

## 7. Invocation review

### 7.1 M2 v5 against frozen v3

Every change falls into one of the classes the Lead authorized:
1. **Tool path:** the launch (`:220`) and both pid needles (`:74`, `:249`) use `tools/lane-watch-r4/lane-watch.mjs`.
2. **Fresh lane and paths (Lead `msg_48091c7d1efe`):** project `qa-e2e-sim-r7` everywhere (19 uses): boundary flags, sampler prefix, lane-watch, the READY pattern, observe2, `COMPOSE_PROJECT_NAME` (`:273`), the stop file, the artifact glob (`:295`), the scan targets and the evidence record. Port 8643 and subnet `172.27.0.0/16` are unchanged. All outputs move to `m2/window-attempt4`, `m2/attempt4/*`, `m2-stack-attempt4`, `private/m2-attempt4-*` and `scan/m2-attempt4-scan.json`. No `sim-r6` or attempt-3 output path remains.
3. **Absence guards:** `must_not_exist` (`:121`) adds `$BASE32` and `$R/m2/attempt4`. A new pre-run guard (`:147`) requires zero `qa-e2e-sim-r7-5561e8f7-*` artifact folders. The post-run glob then requires exactly one. I confirmed that every listed path is absent now.
4. **PREV_W4 (authorized in `msg_48091c7d1efe`):** an environment override with an existence check. The grant names the preceding operational W4. The default (attempt-3 W4) is only preparation. Its 32 volume records are identical to the former C6-r2 default (I compared them).
5. **Approved B-TW-02 schema fixes:** `r.environment === 'SIM'` (`:431`), and `w4Compare.problems` empty plus `protectedIdenticalAtEnd` true (`:438-439`). These match the real fields: attempt-3 case rows have `environment` and no `label`; `live-boundary.mjs compare` writes `problems` and `protectedIdenticalAtEnd` and no `pass`, and it exits 1 on any problem.

No check is removed or weakened. `bash -n` passes, and the embedded binder passes `node --check`.

### 7.2 T7 v2 against frozen v1

T7 v2 changes only the launch path (`:224`) and both needles (`:77`, `:254`) to `lane-watch-r4`, and the default `PREV_W4` to `m2/window-attempt4/w4-end.json` (`:18`). All T7 output paths are absent now. `bash -n` passes.

## 8. Private output, scan and retention

- The new `private/listing-errors.jsonl` is born 0600 inside the 0700 lane `private/`. It follows the existing `private/removal-failures.json` and `private/teardown-*.log` pattern and E-R6 ("Raw traces and stderr remain private").
- `secret-scan.mjs:42` skips `private` folders in shared scans. The M2/T7 evidence walk also skips `private` (M2 v5 binder `walk`, `:377`). So the new private file is never published, scanned as shared or hashed into `run-evidence.json`. This is consistent with the earlier private files.
- Public `watch.jsonl` holds only `listing_vanish` with label, kind and id. The Docker ids are already public in `events.jsonl` and `ledger.jsonl`.
- For each `listing_vanish`, the judge must read the private record directly. It must show (a)–(d) true, and the judge finds the destroy event of that id in `events.jsonl` as corroboration only (§13.5). See N7.

## 9. Findings

| ID | Severity | File:line | Problem | Evidence | Suggested fix | Status |
| --- | --- | --- | --- | --- | --- | --- |
| LW-R-01 | MAJOR | plan §13.4(b); `storage-docker.mjs:218-235` | The same-kind-only rule fails closed on a likely form of the attempt-3 race. | §3 | Accept the container bulk and no-such singles that `listLane` already accepts, before a network vanish | **Resolved.** Accepted in `msg_30bbc088a7ab`; implemented at r4 `:177-180`; covered by `s13-vanish-mixed-kind-positive` |
| N1 | NIT | `R/notes/lane-watch-r4-selftest.stdout.json` | The stdout does not bind the selftest or core hash. | Selftest and stdout mtimes are both 10:10:06 +0700. This fits the pinned bytes but does not prove them. QA reports that the intermediate bytes were not kept. | Next time, print the SHA-256 of the core and the selftest in the selftest output | Accepted for disclosure |
| N2 | NIT | `R/private/tmp/qae2e-lanewatch-{lxaY2w,cxfZLY,jN3aEB}` | Three scratch folders from intermediate selftest runs were not removed. | 09:56–09:58 +0700. They hold only synthetic `planted-stderr-secret` tokens (51) and no planted env value. | QA discloses them in its retention record | Accepted for disclosure |
| N3 | NIT | r4 core `:194` | For a non-`StorageBlocked` error, the `e.message` that §13.4 requires can carry about 10 characters of stdout from a V8 JSON `SyntaxError`. | The probe on node v24.21.0 printed `Unexpected token 'S', "SECRET=pla"... is not valid JSON`. This needs exit-0 non-JSON Docker output, so it is practically unreachable, and it stays private (0600). | None needed. Optionally store only `e.name` for errors that are not `StorageBlocked`, at a later permitted change | Accepted for disclosure |
| N4 | NIT | T7 v2 `:18-19`, `:150` | T7 v2 does not have the M2 v5 `PREV_W4` existence check or the `BASE32` absence guard. | If `PREV_W4` is missing, `jq` fails after `$R/t7` and `$W` exist, so a new attempt needs fresh paths. `BASE32` is absent now. | Fail-closed, so no change is needed. Confirm both paths at grant time | Open, nonblocking |
| N5 | NIT | M2 v5 `:21-22` | If the grant overrides `PREV_W4` with an M1 W4 but keeps the default `BASE32`, the file name says "from-m2-attempt3-w4". | `m0-grant.txt` records both paths, so the provenance stays clear. | Set a matching `BASE32` name in the grant | Open, nonblocking |
| N6 | NIT | `infra/compose.yaml:443`; `run-m2.mjs:132` | The new lane creates a new image tag `qa-e2e-sim-r7-e2e:1.56.0`. | `run-m2` builds `e2e` with `--build`. Attempt 3 shows a CACHED build that re-tags `qa-e2e-sim-r6-e2e:1.56.0`. W4 `dockerInfo` has no image count, and no check reads images. The tag stays after cleanup, like each earlier lane's tag. | Disclose it as owned host footprint. No check change | Open, nonblocking |
| N7 | NIT | M2 v5 binder; plan §13.5 | `run-evidence.json` does not bind `private/listing-errors.jsonl`. | The binder walk skips `private`. | If any `listing_vanish` occurs, the judge records that file's bytes and SHA-256 (not its content) with the (a)–(d) and destroy-event check | Judge step |

Launch preconditions (Lead actions, not findings):
1. Record the lane change from `qa-e2e-sim-r6` to `qa-e2e-sim-r7` in a Lead-owned E-R6 amendment. `docs/team/r6-independent-verification-2026-10-23.md` still says "M2 uses `qa-e2e-sim-r6`".
2. Just before launch, verify `MANIFEST-lane-watch-r4-v2.sha256` and the 84-entry manifest again.
3. Name `GRANT_MSG`, `GRANT_DELIVERY` and `PREV_W4` explicitly in each grant.

## 10. Verdict

APPROVE. The repair implements §13.4 and the accepted LW-R-01 amendment. It keeps every negative fail-closed, keeps stdout out of all files, keeps stderr private, adds no retry loop, collector or weaker formula, and leaves the originals and dependencies unchanged. The M2 v5 and T7 v2 changes stay within the authorized classes and use fresh paths.

M2 stays NOT ACCEPTED until one new M2 invocation under a new grant passes every original check as written, and the judge confirms each `listing_vanish` (if any) by §13.5. T7 then uses the same tool. AC-M4-06 stays PENDING. All 32 real-LMS rows stay UNVERIFIED, and local Canvas stays DEFERRED.
