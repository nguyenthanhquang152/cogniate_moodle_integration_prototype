# E-R8: T7 shared-host preparation

Date: 2026-10-23, 13:10 UTC. Owner: Lead. Status: preparation authorized; runtime acceptance and launch are not authorized.

## Decision and scope

The user's active goal is to complete all remaining tasks. The Lead selects the reversible shared-host tool preparation route from the Claude [plan, sections 15–16](../reviews/M3/t6-09-failure-plan.md). This continues work without changing Savoy's owner's no-pause instruction. The earlier scheduling question is no longer a prerequisite for this preparation; no Savoy pause is assumed.

The plan is 99,037 bytes, SHA-256 `4cf544579299fb657c9ed7c0fd12b739a3307ed9edcc396e492694d23bc99720`, committed at `6b03a240`. Section 16 supersedes section 15 where they differ.
This decision permits host-only implementation and independent qualification of copied QA tools. It does not approve the proposed evidence exception for runtime. E-R6 remains the runtime policy until the implementation, independent QA and focused Claude review pass and the Lead records a separate decision.

## Owners

- Retained Codex executor: `task_92a1807d669a` / `ctx_980764b0c00c`. One session owns all implementation and fixes. Its original launch receipt records effective `gpt-6-astra` and `xhigh`; the worker cannot observe the backend variant or effort in-session. The structured session is reused through a context-only Dispatch and orchestration preamble; no new process ownership is claimed.
- Retained independent Gemini QA: `task_608e1c827365` / `ctx_ecf89d43aa55`. The readiness response confirms Gemini 4 Argon High. Normal same-terminal `worker-start` observed turn start. QA derives and freezes its cases from the Claude requirements before reading the executor's candidate or notes.
- Independent Claude reviewer: `task_3957028cdfba` / `ctx_7f627c526127`, handle `structworker_36aaf9e5-74f3-4f30-83fe-5a1830138b66`. The launch receipt records effective `claude-opus-5-5`, `xhigh`, with turn start observed. This worker is not the Architect or executor. It reads requirements first, then reviews the frozen candidate alongside Gemini qualification. Its final verdict requires the independent QA evidence.

Codex owns new copies under the private C8 preparation root: `tools/boundary-r2/**`, `tools/lane-watch-r5/**`, `notes/scripts/reconcile-32vol-v2.mjs`, `notes/scripts/run-t7-window-v3.sh`, `notes/t7-shared-host-implementation/**` and `notes/MANIFEST-t7-shared-host-v1.sha256`.
Gemini owns `notes/t7-shared-host-independent-qa/**` and `docs/reviews/M3/t7-shared-host-tools-qa.md`. The Lead owns this decision and current task records. No repository product or test edit is authorized.

## Qualification checkpoint — 2026-10-23, 13:26 UTC

Gemini froze its requirements and test harness before reading the executor's implementation or notes (`msg_4bea30dc22b4`, `msg_e0d8a0f97c71`). The Lead checked the bytes, SHA-256 and modes of all six files below. They live under `notes/t7-shared-host-independent-qa/` in the private preparation root. This proves the test-first checkpoint, not that the candidate passed.

| File | Bytes | Mode | SHA-256 |
| --- | ---: | --- | --- |
| `frozen-checklist-and-test-plan.md` | 22099 | 0600 | `b8671bdd8fdd6a36e6868b0c3e01ec0c2e9aa2ef21f4788529a5a05aa97770d0` |
| `independent-qa-harness.mjs` | 15858 | 0700 | `7eb044dcf5b8ef3836259c5b360ca8500f7ea0324a678abe28f9268025d98a32` |
| `run-candidate-verification.mjs` | 6422 | 0700 | `7926d9998438d5d5bd8c2e2b99f989436a6738d0d299977bf246fa835eb9969a` |
| `frozen-cases-runner.mjs` | 35638 | 0700 | `b46e56d1c994276a0e62aaf343a8efc06e0f0239692724531f48f62514ef1c59` |
| `frozen-lanewatch-and-v3-runner.mjs` | 16789 | 0700 | `d5084419530f9841e1051ca26f2dcb1603803205fbdf3ca74460ee5e6ae9f444` |
| `pre-freeze-selfcheck.json` | 175 | 0600 | `5798dbcc354698275e1ec5b171175959fa014c8ab2277291e299aed6522ad811` |

The bound runners use the executor's published `mounts: [{type, volumeName}]` interface. The earlier checklist uses `name` for the same field. This is a schema mapping; the predicates and assertions stay unchanged. The pre-freeze self-check reports all 32 baseline volumes, seven protected originals and zero sentinel Docker calls.

Lead ruling `msg_32cbc886594d` permits a byte-identical observer copy and fresh C8 host-source checkout inside each fresh attempt root. Use the existing checkout helper. Keep the separate pristine runtime clone, B-TW-03, exact source hashes, runner arguments, phase order and deadlines. Bind all relocated paths. The focused reviewer must inspect this path-only change. It does not authorize creation of a runtime attempt during preparation.

Codex remains the sole implementation and fix owner. The initial candidate, its independent QA verdict and the focused review remain pending. No Docker runtime or acceptance exception is approved.

## Capture-rule clarification — 2026-10-23, 13:38 UTC

The focused reviewer found ambiguity RQ-1 before reading the candidate. Its [requirements checkpoint](../reviews/M3/t7-shared-host-focused-review.md) is PENDING. That attempt settled on the missing architectural ruling, with no candidate code failure. The same task and reviewer resumed under `ctx_d41f3cb69570` after the ruling. The full candidate review remains required.

The original Architect resolved RQ-1 in [plan section 17](../reviews/M3/t6-09-failure-plan.md), task `task_ed0712df4567` / `ctx_0781fcac0fba`. The Lead accepts this clarification for implementation and qualification. The file is 106,065 bytes, SHA-256 `5253e839118a22e867457005c7735fe23c85a270e675dfb996adb6244a6c257f`. Its first 99,037 bytes keep the earlier SHA-256 `4cf544579299fb657c9ed7c0fd12b739a3307ed9edcc396e492694d23bc99720`.

The outer boundary and lane monitor each use their own full start/end records. Neither may borrow attribution evidence from the other, another attempt or the preflight. Each comparison must pass independently. Missing predicate fields and unexplained changes still fail closed.

The runtime guard compares strict host identities and built-in networks with the new, explicitly reconciled preflight. All 32 baseline volume records must still equal the accepted M2 predecessor. Section 17 also requires the preflight hash in the grant, a hash mismatch refusal and no reconciliation after launch. Codex and Gemini received the ruling before candidate freeze. This remains preparation authority only; no runtime grant or T7 acceptance exists.

## Final pre-candidate checkpoint — 2026-10-23, 13:47 UTC

The Lead verified the two final Control 1 test files from Gemini message `msg_191489fa351a`. Both were frozen before QA read the candidate. The files are `frozen-section17-final-control1-addendum.md` (3,149 bytes, mode 0600, SHA-256 `d4a3a712a8700166606e95f7e451d4a62d1249a525e1b90ae63fd2efd81a168a`) and `frozen-section17-control1-runner.mjs` (6,200 bytes, mode 0700, SHA-256 `3c1deda55a9863d26e18d6496933f90a8ed94c261f615eaa2ee4dcb1d596c026`). Earlier frozen QA files remain preserved. This checkpoint does not claim a passing candidate.

Lead reply `msg_2e865a3fab69` resolves operational question CL-1. The separate external preflight will use the qualified new boundary and reconciliation tools, after qualification and a separate grant. The runtime guard must verify the expected preflight hash. It must also pin the accepted M2 predecessor to 19,913 bytes and SHA-256 `544142a119dedc4c77279e5c0078ceac7c53dd7c520558aeb156a768c13638fd`. Preflight admission cannot supply attribution evidence to either runtime capture pool. A pre-T4 stop must have a distinct nonzero exit from usage exit 2.

The initial held candidate remains pending. Codex reported 67 passing author mock checks at 13:38 UTC. Independent QA and focused review must assess the frozen files before any runtime decision. No Docker call or host window is authorized by this checkpoint.

## Initial candidate frozen — 2026-10-23, 13:49 UTC

Codex froze the candidate in `msg_378d68de0ee8`. The Lead verified all 42 manifest entries by size, hash and mode. `notes/MANIFEST-t7-shared-host-v1.sha256` is 8,624 bytes, mode 0600, SHA-256 `c9062c36c8a688f9b480961bc3300910037e7dcfe5dbb5ed93050c384f7ffac6`. The implementation report is 10,064 bytes, mode 0600, SHA-256 `3f5fd59822487ed67e5b1ba6bb3158326d835d504be24384b5dfcc19ed654c3d`.

Author checks report PASS: 68 core controls, 13 full-baseline lane scenarios, 29 wiring/CLI controls and the unchanged 54-scenario lane regression. These are author checks only. Gemini and the separate Claude reviewer received the held candidate in `msg_2c34c6c4dbcb` and `msg_5b76938ede20`. They qualify it in parallel. Codex keeps sole ownership of any fixes. T7 and runtime approval remain pending.

## Initial review findings — 2026-10-23, 14:00 UTC

The independent Claude review found two required tool corrections. F-01 rejects the valid `IPAM.Config: null` value on built-in `host` and `none` networks. F-02 uses usage exit 2 for some stops after the attempt creates paths and calls Docker. Messages `msg_c6416aba7c4c` and `msg_29e536c22062` contain the reproductions and affected paths. Neither finding establishes an LTI product failure.

The Lead checked the saved real-host network records and F-01's pure probe without calling Docker. Codex prepares both fixes and regressions in a separate private copy while the 42 frozen candidate bindings remain unchanged. This allows QA and review to finish against stable input. The complete findings batch and independent verdicts remain pending; no runtime grant exists.

## Consolidated source review — 2026-10-23, 14:05 UTC

Claude completed its initial source review in `msg_d8f69572efe4`: CHANGES_REQUESTED. F-01 and F-02 remain required. F-03 also requires source hashes inside lane test evidence, with a separate binding record for the unchanged legacy self-test. The Lead includes MINOR M-1 in the same fix batch: a failed W4 capture must retain its raw failure, stop the sampler and attempt the remaining comparison reports before exiting unsuccessfully. This does not allow a failed capture to pass.

The Lead defers optional M-2: automatic scanning of previous grant and preflight identifiers. The Lead must instead verify fresh identifiers and a fresh preflight explicitly for each authorized attempt. No reuse is authorized.

The six NITs are accepted as nonblocking for this T7-only route: non-atomic root creation before the window-directory claim, the fixed T7 subnet, the `expectedCount32` output label, the start-capture error wording, the copied self-test header and the disclosed scratch files outside the deployable manifest. Use unique absent attempt paths. Keep scratch evidence separate from qualified runtime files. These deferrals do not waive functional or isolation checks.

Codex reported 24 passing author checks for the prepared F-01/F-02 fixes in `msg_b3435514e5c2`. It now extends that separate copy for F-03 and M-1. The initial candidate remains frozen while independent QA finishes. All fixes stay in the same executor session. Independent QA and focused review of the corrected candidate remain required.

## Required result

1. Positive attribution uses sufficient captured metadata and the section 16 joint predicates. Names or anonymous-volume labels alone are insufficient. Unexplained activity fails closed.
2. Protected volumes, lane ownership, engine identity, built-in networks, cleanup, secret handling, functional assertions and deadlines retain their strict checks. Raw errors remain visible beside any attributed foreign change.
3. Preflight and runtime use fresh paths. The external hold precedes runtime; an internal failure consumes that attempt's paths. No automatic retry, overwritten evidence or reused attempt root is permitted.
4. All original tools and both manifests remain unchanged. Copies of unchanged helpers remain byte-identical. New files and validation outputs have complete size/hash bindings and approved private permissions.
5. Independent mock and CLI safety tests cover every required positive and negative, including leaked anonymous volumes, protected/lane mounts, missing metadata, engine/network changes and list/inspect races. No real Docker command runs during preparation.
6. A focused independent Claude review checks the complete held diff and evidence. Resolve findings in the same executor session. Only then may the Lead decide on runtime acceptance rules and coordinate an LA window.

T7 has not run. M1, M2 and legacy acceptance remains unchanged. Final conformance, guide evidence updates, independent Docs QA, two blind final reviews and Lead closure remain after T7. All 32 real-LMS rows remain UNVERIFIED; local Canvas remains DEFERRED. No push or main merge is authorized.
