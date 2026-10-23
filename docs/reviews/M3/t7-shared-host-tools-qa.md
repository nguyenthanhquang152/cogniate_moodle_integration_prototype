# Independent QA Qualification Report — T7 Shared-Host Tool Candidate (`r2`)

- **Verdict**: **PASS** (`overallPass: true`, exit `0`, `0` candidate defects, `0` real Docker commands)
- **Role / Worker**: Independent QA-E2E (`Antigravity Gemini 4 Argon (High)`, model `gemini-4-argon-high`, effort `high`, no subworkers)
- **Task / Dispatch / Terminal**: `task_608e1c827365` / `ctx_ecf89d43aa55` / `term_3fd51366-4ec9-4a5c-994d-be6f04a4bcf1` (Run `run_ebe671ad72a9`)
- **Author Implementation Under Test**: Task `task_92a1807d669a`, Dispatch `ctx_980764b0c00c`, frozen `r2` manifest `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-5561e8f-c8R3Prep/notes/t7-shared-host-implementation/r2/MANIFEST-candidate-r2.sha256` (`8,577` B, mode `0600`, SHA-256 `e4f6030009ff02c2f15cd9a79b7eca1e76ff7088b8b9a81fdae12a3706ecb05c`, `42` entries)
- **Specification & Authority**: `docs/reviews/M3/t6-09-failure-plan.md` `§§15–17` (`106,065` B, SHA-256 `5253e839118a22e867457005c7735fe23c85a270e675dfb996adb6244a6c257f`) and Lead rulings `msg_abb4b1b966a4`, `msg_f78173521ab0`, `msg_bf59b1b47754`, `msg_f97f9fcb409a`, `msg_6b57b763f46a`, `msg_2c34c6c4dbcb`, `msg_3ffe2fcb22b7`, `msg_3a83be6d49c6`, `msg_5495291d227b`, `msg_ffbe9c827fe3`, `msg_27eb2ea69398`, `msg_d026e03efa3f`, `msg_73103c4f60aa`, `msg_6c678e4d6d11`, `msg_e931fb86738d`, `msg_831e7cf23065`, and `msg_0a0608ae7d15`.

---

## 1. Executive Summary & Scope Boundaries

1. **Tool Qualification Result**: The corrected `r2` shared-host T7 tool candidate (`tools/boundary-r2/*`, `tools/lane-watch-r5/*`, `notes/scripts/reconcile-32vol-v2.mjs`, `notes/scripts/run-t7-window-v3.sh`, and `r2/MANIFEST-candidate-r2.sha256`) **PASSES** all pre-frozen independent QA suites (`30/30` boundary/reconcile cases, `5/5` lane-watch adversarial scenarios, `6/6` `§17` controls, `2/2` `§17` Control-1 cases, `2/2` `CL-1`/pool interface cases, `10/10` consolidated correction batch test groups, and `4/4` direct `Q1–Q4` regression checks) with `0` real Docker invocations (`sentinelDockerHits: 0`).
2. **Preservation & Non-Interference**:
   - All `84` entries in `$R/notes/MANIFEST-host-ready.sha256` (`5561e8f72a83de36a68877c6b26ffc8288ade735` C8 source/tests, `4008afb92fe983d52db33442e060210b929966c8` C6 product) are verified unchanged.
   - All `6` entries in `$R/notes/MANIFEST-lane-watch-r4-v2.sha256` and all `42` entries in `$R/notes/t7-shared-host-implementation/v1-snapshot/SNAPSHOT-BINDINGS.sha256` are verified unchanged.
   - Protected review documents remain byte-identical: `docs/reviews/T7/qa.md` (`58,110` B, SHA-256 `714fd0a3ef15d4d85adbc5c40a4b3e51c4e8e4c931a60e6c5faf93ac27f7eb28`), `docs/reviews/M3/qa-e2e.md` (`65,430` B, SHA-256 `6be2952cb9ba006d9fe01b616cd4fcadf7f847a38e0fc3b6d0a2970c8bd914a1`), and `docs/reviews/M3/t6-09-failure-plan.md` (`106,065` B, SHA-256 `5253e839118a22e867457005c7735fe23c85a270e675dfb996adb6244a6c257f`).
   - All `15` fixed T7 runtime output paths and all `$R/t7-attempt-*` directories are verified absent before and after QA execution.
3. **Runtime & Milestone Status**:
   - This report qualifies the host-only `r2` tool candidate only. No runtime grant is active.
   - Live T7 (`AC-M4-06`) remains **PENDING** until Lead coordinates external preflight, host hold, and a runtime grant.
   - All `32` real-LMS acceptance rows remain **UNVERIFIED**, local Canvas remains **DEFERRED**, and C8 `allContainers` false-FAIL (`t6-08`) remains **FAIL**.

---

## 2. Candidate Source & Selftest Bindings (`r2`)

All `42` entries in `$R/notes/t7-shared-host-implementation/r2/MANIFEST-candidate-r2.sha256` (`e4f6030009ff02c2f15cd9a79b7eca1e76ff7088b8b9a81fdae12a3706ecb05c`) and all `16` source/selftest entries in `$R/notes/t7-shared-host-implementation/r2/candidate-bindings-r2.json` (`e2b02e047ce834cc0c22a4b4f1a09c115d1861207fefe2c977189201712503c7`) were independently verified by path, byte count, octal mode, and SHA-256:

| Path (under `$R = /Users/quangnguyen/cogniate-canvas-qa-runs/verification-5561e8f-c8R3Prep`) | Bytes | Mode | SHA-256 |
| --- | ---: | :---: | --- |
| `tools/boundary-r2/live-boundary-core.mjs` | `26,644` | `0700` | `6205ea96392ddfea0e32513caa7351029e58cefa74923d5bb88dfa2548372a31` |
| `tools/boundary-r2/live-boundary.mjs` | `14,442` | `0700` | `68f1a17281024b061dcaf0969b57158008f59942821f71e8cb40940d15e26576` |
| `tools/boundary-r2/metadata.mjs` | `6,807` | `0700` | `c5185044cbb126b2214e691043b9d5fc71283c68cb92c0418609bf926a3dd44c` |
| `tools/boundary-r2/safe-docker.mjs` | `2,612` | `0700` | `49516eac1779dcd67fdc52b235371373f0a7af215950edf4a9279f06dfdc4a32` |
| `tools/boundary-r2/docker-sampler.mjs` | `4,181` | `0700` | `fcf1ce38fc8265957b607062ca06bd5233135f9472c45967f4c9330b36f0ebcd` |
| `tools/boundary-r2/shared-host-selftest.mjs` | `14,772` | `0700` | `5f371d26747639982ed158cc4053883d7d6ad3efa73d765f2c1da545399b88b2` |
| `tools/lane-watch-r5/lane-watch-core.mjs` | `26,381` | `0700` | `cb3136fb469ddf89fb88a40c51391b3c27fe7ec8786b1168ba4286c560765afb` |
| `tools/lane-watch-r5/lane-watch.mjs` | `6,170` | `0700` | `9090ce248251e430a4552ca2d3a4b85afe91be62ed905d844b3f0ace18ed33fb` |
| `tools/lane-watch-r5/lane-pool-selftest.mjs` | `14,902` | `0700` | `c546ec8b8150f5e207f1cd41712c1614d73374b00ce9a49e1cc6695fd36d6e80` |
| `tools/lane-watch-r5/lane-watch-selftest.mjs` (byte-identical to `r4`) | `45,940` | `0700` | `e7064c25ad7e54557eb5c11377ca20982fa08b7cd699da3509c04f09a88dc40d` |
| `notes/scripts/reconcile-32vol-v2.mjs` | `4,827` | `0700` | `c4f1961603a41cf0f1d7ff5438113a6e33dc4b176d85a62c929640973c483c16` |
| `notes/scripts/run-t7-window-v3.sh` | `27,362` | `0700` | `70d3363406d1eece764646afc72bec821be34f2aa5e4b051004ac92ab7bda71f` |
| `notes/t7-shared-host-implementation/wiring-selftest.mjs` | `7,654` | `0700` | `c44b64a910c783aa30efef6aef95d35af49e17391e6d72ff5be57d5bedf30da1` |
| `notes/t7-shared-host-implementation/wiring-selftest-r2.mjs` | `7,952` | `0700` | `7aca7b7bcae807ee0c718072d0b41028946fbad4a9583460036aee46510f6876` |
| `notes/t7-shared-host-implementation/r2/qa-batch-author-regression.mjs` | `4,064` | `0700` | `bb22e04a416545d9a42f5a688ad976775c8c479ffc96b3887b6d7b11e0848601` |
| `notes/t7-shared-host-implementation/r2/focused-author-regression.mjs` | `9,649` | `0700` | `3034ff7b51bf1dddac83a48a21afa1d579519fb454b10ef095937cde4e034243` |
| `notes/t7-shared-host-implementation/r2/implementation-report-r2.md` | `5,102` | `0600` | `952ba5e0ad7b1fb47c6c99836e2a467949d44b088db2bc9acde044d720bc8c70` |

---

## 3. Suite-by-Suite Independent Qualification Results (`v1` vs `r2`)

| Suite / Check Group | Initial `v1` (`14:16:38.444Z`, `v1-initial-candidate-results.json`) | Final `r2` (`14:57:03.123Z`, `r2-candidate-results-final.json`) | Key Verified Controls |
| --- | --- | --- | --- |
| `frozen-cases-runner.mjs` (`30` cases) | `29/30` (`TC-VOL-07` failed) | **`30/30 PASS`** | `SC`/`SV`/`SN` positive & negative matrix (`TC-CTR-01..06`, `TC-VOL-01..08`, `TC-NET-01..05`), `32`-volume set & `7` named volume drift (`TC-32V-01..05`), `W3`/`W4` vanish & `C8` false-FAIL invariance (`TC-VAN-01..05`), CLI `capture`/`compare` + `reconcile-32vol-v2` + secret-free stderr (`TC-SAFE-01-02`). |
| `frozen-lanewatch-and-v3-runner.mjs` (`5` scenarios) | `5/5 PASS` (`ok: true`) | **`5/5 PASS` (`ok: true`)** | `LW-POS-01` (full 3-cycle lane run + concurrent `SC`/`SV`/`SN` foreign activity -> exit `0`, `isolationPass: true`), `LW-NEG-TROJAN-MOUNT`, `LW-NEG-TROJAN-BIND`, `LW-NEG-W3-VANISH` (exit `3`), `LW-NEG-W4-POSTW3-VANISH` (exit `1`). |
| `frozen-section17-runner.mjs` (`6` cases) | `6/6 PASS` | **`6/6 PASS`** | `TC-S17-01..06`: `metadataProblems` fail-closed on null/incomplete fields, `W3` vs `W4` vanish asymmetry, internal pre-launch guard (`preW3 -> runW3`), fresh `$T7_ROOT` enforcement, and `0` public stderr leaks. |
| `frozen-section17-control1-runner.mjs` (`2` cases) | `2/2 PASS` | **`2/2 PASS`** | `TC-S17-C1-POS-01` and `TC-S17-C1-NEG-02`: `W3-full/vanished-mounter` fallback requires prior `W3` full-record `SV(v)` proof + vanished `SC` mounter in `W4` `vanishedDetail` with `reason === 'not_found'`. |
| `frozen-cl1-and-pool-interface-runner.mjs` (`2` cases) | `2/2 PASS` | **`2/2 PASS`** | `TC-CL1-PREV-W4-COMPAT` (legacy `PREV_W4` `m2/window-attempt4/w4-end.json` compatibility + `--expected-start-sha256` tampering refusal) and `TC-POOL-AND-V3-ATTEMPT-ROOT` (`outer` vs `lane` pool separation + consumed stop exit `4`). |
| `frozen-v2-correction-runner.mjs` (`10` groups) | N/A (created pre-`r2`) | **`10/10 PASS`** | `TC-CORR-F01-POS`, `TC-CORR-F01-NEG`, `TC-CORR-Q1-VOL07`, `TC-CORR-Q2-UNATTRIBUTED`, `TC-CORR-Q3-VANISHED-MOUNTER`, `TC-CORR-Q4-RECONCILE-POOL`, `TC-CORR-LW-START-VANISH`, `TC-CORR-LANE-PARITY-Q1-Q2` (with full lifecycle proof), `TC-CORR-F03-BINDINGS`, `TC-CORR-F02-F04-M1-V3-SCRIPT`. |
| Direct Regression Checks (`REG-01..04`) | `0/4` (expected `v1` failures) | **`4/4 PASS`** | `REG-01-TC-VOL-07`, `REG-02-UNATTRIBUTED-CTR-NET`, `REG-03-VANISHED-MOUNTER-REASON`, `REG-04-RECONCILE32-PREV-LANE-POOL`. |

### Closure Summary for Consolidated Repair Batch (`F-01..F-04`, `M-1`, `Q1..Q4`, Both-Pool Parity)

- **`F-01` (Built-in `host`/`none` `IPAM.Config: null` normalization)**: `tools/boundary-r2/metadata.mjs` preserves `null` (`ipam: null`) versus missing (`ipam: undefined`), and `live-boundary-core.mjs` `metadataProblems` accepts `ipam === null` only for built-in `host` (`driver === 'host'`) and `none` (`driver === 'null'`), while rejecting any `sto-*` or non-built-in network with `ipam: null`, missing `ipam`, or `subnet: null`. Verified against the saved real-host baseline `/Users/quangnguyen/cogniate-qa-runs/m3-preflight-ae130a3-20261020T1255Z/baseline-networks.json`.
- **`F-02` & `F-04` (`run-t7-window-v3.sh` atomic root claim & pre-T4 exit `4`)**: Pre-path validation errors exit `2` without creating `$T7_ROOT`. `$T7_ROOT` is claimed atomically via `mkdir "$R"` (`ROOT_CLAIMED=true`); a losing duplicate launch exits `2` without touching or clobbering any file inside the existing root. Every nonzero stop after `ROOT_CLAIMED=true` and while `PRE_T4=true` (`T0-baseline`, `T1-wake`, `T2-liveness`, `T3-capture`, `T3-anonymous-and-reconcile`, `T3-guard`, `T3-deadline`) writes no-clobber `$W/private/pre-t4-stop.json`, exits `4`, and performs zero T4+ work. Post-T4 `OBSERVER_EOF` hash mismatch exits `1` (not `2`).
- **`F-03` (`lane-pool-selftest` & legacy selftest hash bindings)**: `r2/lane-pool-author-1.json` binds all 4 source files (`lane-watch-core.mjs`, `lane-pool-selftest.mjs`, `boundary-r2/metadata.mjs`, `boundary-r2/live-boundary-core.mjs`), and `r2/legacy-author-1.bindings.json` binds byte-identical `lane-watch-selftest.mjs` (`e7064c25...`), `lane-watch-core.mjs`, and `r2/legacy-author-1.json`.
- **`M-1` (`T12 -> T13` continuation on `W4` failure)**: A nonzero `W4` capture (`W4_CAPTURE_RC`) still stops the sampler and attempts `compare` (`W4_COMPARE_RC`), `anon-check` (`W4_ANON_RC`), and `reconcile-32vol-v2` (`W4_RECONCILE_RC`), records `$W/private/t13-status.json`, and exits `1` before `T14`.
- **`Q1` (`TC-VOL-07` orphan `SV` volume at `W4`) & `Q2` (Unattributed present container/network) across `outer` and `lane` pools (`msg_73103c4f60aa`)**:
  - `requireAttributedPresent(rec, opts, classification)` in `live-boundary-core.mjs` is enforced in `judgeStartDetailed` (`outer` `W3`), `compareBoundariesDetailed` (`outer` `W4`), and `lane-watch-core.mjs` (`lane` `start` and `end` when `base.length === 32`, with `volumeMode: 'all'` so unmounted extra volumes are listed by `docker volume ls -q`).
  - *Severity & Composed-Gate Precision (`msg_73103c4f60aa`)*: `Q1` was a boundary-function (`compareBoundariesDetailed`) and `watchLane` false pass; existing final `reconcile-32vol-v2` already rejected it at `T13`, so `Q1` was not a whole-T7 composed-gate false pass. `Q2` was the required-control mechanical gap across both pools.
  - In `TC-CORR-LANE-PARITY-Q1-Q2` (with full independent lifecycle proof), unchanged unattributed containers/networks at `start` BLOCK with `exit === 3` (`start boundary incomplete`); an `SV` volume linked at `start` and orphaned at `end` fails with `exit === 1`, `isolationPass === false`, `keepVerified === true`, `cloneBound === true`, `teardownOk === true`, and exact `'UNKNOWN: current volume lacks positive attribution: <name>'` in `summary.endErrors` and `boundary-end.json`; and valid `SC`+`SV` concurrent foreign resources pass with `exit === 0`, `isolationPass === true`, `keepVerified === true`, `cloneBound === true`, `teardownOk === true`, and `endErrors: []`.
- **`Q3` (`MINOR` `W3-full/vanished-mounter` reason guard)**: `classifyForeign` requires `d.reason === 'not_found'` on the vanished container row.
- **`Q4` (`MINOR` `reconcile32` predecessor pool hardening)**: `reconcile32(cap, previous)` rejects any `previous` where `previous?.capturePool !== undefined && previous.capturePool !== 'outer'` while preserving compatibility with legacy `PREV_W4` (`capturePool === undefined`).

---

## 4. Bound Independent QA Artifacts & Chronology / Adapter Disclosure

All independent QA artifacts reside under `$R/notes/t7-shared-host-independent-qa/` (directory mode `0700`):

| Category | Filename | Bytes | Mode | SHA-256 |
| --- | --- | ---: | :---: | --- |
| Pre-Candidate Frozen (12) | `frozen-checklist-and-test-plan.md` | `22,099` | `0600` | `b8671bdd8fdd6a36e6868b0c3e01ec0c2e9aa2ef21f4788529a5a05aa97770d0` |
| Pre-Candidate Frozen (12) | `independent-qa-harness.mjs` | `15,858` | `0700` | `7eb044dcf5b8ef3836259c5b360ca8500f7ea0324a678abe28f9268025d98a32` |
| Pre-Candidate Frozen (12) | `run-candidate-verification.mjs` | `6,422` | `0700` | `7926d9998438d5d5bd8c2e2b99f989436a6738d0d299977bf246fa835eb9969a` |
| Pre-Candidate Frozen (12) | `pre-freeze-selfcheck.json` | `175` | `0600` | `5798dbcc354698275e1ec5b171175959fa014c8ab2277291e299aed6522ad811` |
| Pre-Candidate Frozen (12) | `frozen-cases-runner.mjs` | `35,638` | `0700` | `b46e56d1c994276a0e62aaf343a8efc06e0f0239692724531f48f62514ef1c59` |
| Pre-Candidate Frozen (12) | `frozen-lanewatch-and-v3-runner.mjs` | `16,789` | `0700` | `d5084419530f9841e1051ca26f2dcb1603803205fbdf3ca74460ee5e6ae9f444` |
| Pre-Candidate Frozen (12) | `interface-schema-mapping.json` | `2,300` | `0600` | `9426306e1f23272338241b64fbb96ba2a5e26bf47276273c2beecfcf206c0928` |
| Pre-Candidate Frozen (12) | `frozen-section17-addendum-and-cases.md` | `12,976` | `0600` | `a405d2f887bb7da0360fcc7237f839d0ffd9b7f681662a6e33779389170e4d21` |
| Pre-Candidate Frozen (12) | `frozen-section17-runner.mjs` | `18,956` | `0700` | `5a17f97e97ca15e3095b471d532083e0095c67f774c6baa6b2475b22661ec5bc` |
| Pre-Candidate Frozen (12) | `frozen-section17-final-control1-addendum.md` | `3,149` | `0600` | `d4a3a712a8700166606e95f7e451d4a62d1249a525e1b90ae63fd2efd81a168a` |
| Pre-Candidate Frozen (12) | `frozen-section17-control1-runner.mjs` | `6,200` | `0700` | `3c1deda55a9863d26e18d6496933f90a8ed94c261f615eaa2ee4dcb1d596c026` |
| Pre-Candidate Frozen (12) | `frozen-cl1-and-pool-interface-runner.mjs` | `10,655` | `0700` | `d0b970a076d2975ca1372d71841930087f2448132be67361ccc0e14e3a0c5093` |
| Historical `v1` (3) | `execute-all-frozen-checks-v1.mjs` | `21,179` | `0700` | `bd6ab21adf2d752eaa84533ebb526208311a4fc25b4a9d3da74aaa28b81b3749` |
| Historical `v1` (3) | `v1-initial-candidate-results.json` (`14:16:38.444Z`) | `15,997` | `0600` | `6d327bbb73c5daef15e776b627451a44ceae2a536e2be587fc6caacbe60a1616` |
| Historical `v1` (3) | `v1-historical-execution-summary.json` | `6,964` | `0600` | `ecb330f3ea068547e6602d25181afff3eda550c199a48e34b0fbe8b9686bd881` |
| Pre-`r2` Frozen (2) | `frozen-v2-correction-addendum.md` | `12,465` | `0600` | `392a25b6c8b0267df649d30bdc5abb17b3189b21bfb02de7c903b874a8e1c6ac` |
| Pre-`r2` Frozen (2) | `frozen-v2-correction-runner.mjs` | `37,574` | `0700` | `78082cd6bc15626952c41e232159a18bcecaf1c5f94fbb9241808e3a18e0bd5e` |
| Intermediate `r2` (8) | `execute-all-frozen-checks-r2-attempt1.mjs` (reconstructed from `task-2719`) | `25,179` | `0700` | `392791a63994340746451dcb23821f7e84c1e0a8ed8d50ef46051d20570c7d7a` |
| Intermediate `r2` (8) | `r2-candidate-results-attempt1-record.json` (reconstructed from `task-2719`) | `3,715` | `0600` | `65cd96b1148764c94d19db89da9321f0515835c2b4e255b188eb5d114bc1274e` |
| Intermediate `r2` (8) | `execute-all-frozen-checks-r2-attempt2.mjs` | `26,204` | `0700` | `0f4fa1267d6fb31a6adc67f7fec6c9dcc6ae8378f51de56d6fbf5970f4c45f1b` |
| Intermediate `r2` (8) | `r2-candidate-results-attempt2.json` (`14:41:26.961Z`) | `20,721` | `0600` | `8e893c6dfb21386f818b633964678e1165d8bb7070a2c5779fa32b5898d8a001` |
| Intermediate `r2` (8) | `execute-all-frozen-checks-r2-attempt3.mjs` | `42,117` | `0700` | `610075076cc9dbe469ed1686e332100bffc2ca7204c968eac08b4287b3108751` |
| Intermediate `r2` (8) | `r2-candidate-results-attempt3.json` (`14:52:12.620Z`) | `20,747` | `0600` | `ceba27b2952faacd495882ceaabe27e20290d441fbcff3db521c5224019fa5f1` |
| Intermediate `r2` (8) | `execute-all-frozen-checks-r2-attempt4.mjs` | `41,437` | `0700` | `b1d3907f1847a47828e6848808ed9974fa26cb400cc949f58650e55af22c32ff` |
| Intermediate `r2` (8) | `r2-candidate-results-attempt4.json` (`14:54:17.662Z`) | `20,702` | `0600` | `cd62351a8a97852e256aa876847df8b4776281deffa0c2829ae8077df7c248f2` |
| Final `r2` & Disclosure (3) | `execute-all-frozen-checks-r2-final.mjs` | `41,592` | `0700` | `ab1e17d9430c760583924dcc098c8c0bda6268b27d8285b019f6778f798832aa` |
| Final `r2` & Disclosure (3) | `r2-candidate-results-final.json` (`14:57:03.123Z`) | `20,238` | `0600` | `02e03e920aa6238d450e055332b32887316f55c476d894661c4a725393d43a52` |
| Final `r2` & Disclosure (3) | `r2-qa-adapter-disclosure.md` | `10,307` | `0600` | `dae71162bc2536e8a65b1e3f936ad3f0cac847f7503ddc6f7cc7ee8c29c348de` |

- **Chronology & Attempt-1 Overwrite Disclosure (`msg_d026e03efa3f` / `msg_83bbefd30c42`)**:
  - For `v1`, pre-report executions at `13:52:30Z–14:12:22Z` were unrecorded stdout/tmp runs that identified `Q1–Q4` reported in `msg_504525b08f74` (`14:14:58Z`), followed by the durable `execute-all-frozen-checks-v1.mjs` execution at `14:16:38.444Z` (`v1-initial-candidate-results.json`).
  - For `r2`, Attempt 1 (`14:38:58.624Z`, `task-2719`) was not archived before `task-2729` overwrote `r2-candidate-results.json` at `14:41:25Z` (`3` seconds after `msg_6c678e4d6d11` arrived); `execute-all-frozen-checks-r2-attempt1.mjs` and `r2-candidate-results-attempt1-record.json` are explicitly disclosed as reconstructed from the `task-2719` stdout log, while Attempts 2–4 and the Final Pass (`14:57:03.123Z`) are preserved as original files under distinct names. Full contract justifications for all 5 runner-side in-memory adapters (`A1`–`A5`) are bound in `r2-qa-adapter-disclosure.md` (`dae71162...`).

---

## 5. Disclosed Bounded Deferrals & Nonblocking Limits (`msg_5495291d227b` / `msg_ffbe9c827fe3`)

1. **Deferred `M-2` (Cross-attempt replay scanning)**: Lead explicitly verifies grant and preflight freshness per attempt; no attempt or grant reuse is authorized.
2. **Accepted NITs (`N-1` atomic root claim superseded and fixed under `F-04`)**:
   - Fixed T7 compose subnet (`172.31.0.0/16`) for this T7-only route.
   - `expectedCount32` boolean property label in `reconcile-32vol-v2.mjs` output.
   - End-liveness wording in `live-boundary.mjs`.
   - Copied selftest header comment in `tools/lane-watch-r5/`.
   - Disclosed synthetic scratch directories under `$R/notes/t7-shared-host-implementation/scratch/` excluded from the deployable manifest.
3. **Architectural & Operational Boundaries**:
   - Separate `outer` and `lane` capture pools verify positive attribution at each snapshot and bounded vanish rules (`§§15–17`), not an exclusive host window.
   - Unknown or incomplete metadata records fail closed (`UNKNOWN`).
