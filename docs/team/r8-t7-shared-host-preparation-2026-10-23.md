# E-R8: T7 shared-host preparation

Date: 2026-10-23, 13:10 UTC. Owner: Lead. Status: preparation authorized; runtime acceptance and launch are not authorized.

## Decision and scope

The user's active goal is to complete all remaining tasks. The Lead selects the reversible shared-host tool preparation route from the Claude [plan, sections 15–16](../reviews/M3/t6-09-failure-plan.md). This continues work without changing Savoy's owner's no-pause instruction. The earlier scheduling question is no longer a prerequisite for this preparation; no Savoy pause is assumed.

The plan is 99,037 bytes, SHA-256 `4cf544579299fb657c9ed7c0fd12b739a3307ed9edcc396e492694d23bc99720`, committed at `6b03a240`. Section 16 supersedes section 15 where they differ.
This decision permits host-only implementation and independent qualification of copied QA tools. It does not approve the proposed evidence exception for runtime. E-R6 remains the runtime policy until the implementation, independent QA and focused Claude review pass and the Lead records a separate decision.

## Owners

- Retained Codex executor: `task_92a1807d669a` / `ctx_980764b0c00c`. One session owns all implementation and fixes. Its original launch receipt records effective `gpt-6-astra` and `xhigh`; the worker cannot observe the backend variant or effort in-session. The structured session is reused through a context-only Dispatch and orchestration preamble; no new process ownership is claimed.
- Retained independent Gemini QA: `task_608e1c827365` / `ctx_ecf89d43aa55`. The readiness response confirms Gemini 4 Argon High. Normal same-terminal `worker-start` observed turn start. QA derives and freezes its cases from the Claude requirements before reading the executor's candidate or notes.
- A separate Claude reviewer follows the frozen candidate. The reviewer must not be the Architect or executor.

Codex owns new copies under the private C8 preparation root: `tools/boundary-r2/**`, `tools/lane-watch-r5/**`, `notes/scripts/reconcile-32vol-v2.mjs`, `notes/scripts/run-t7-window-v3.sh`, `notes/t7-shared-host-implementation/**` and `notes/MANIFEST-t7-shared-host-v1.sha256`.
Gemini owns `notes/t7-shared-host-independent-qa/**` and `docs/reviews/M3/t7-shared-host-tools-qa.md`. The Lead owns this decision and current task records. No repository product or test edit is authorized.

## Required result

1. Positive attribution uses sufficient captured metadata and the section 16 joint predicates. Names or anonymous-volume labels alone are insufficient. Unexplained activity fails closed.
2. Protected volumes, lane ownership, engine identity, built-in networks, cleanup, secret handling, functional assertions and deadlines retain their strict checks. Raw errors remain visible beside any attributed foreign change.
3. Preflight and runtime use fresh paths. The external hold precedes runtime; an internal failure consumes that attempt's paths. No automatic retry, overwritten evidence or reused attempt root is permitted.
4. All original tools and both manifests remain unchanged. Copies of unchanged helpers remain byte-identical. New files and validation outputs have complete size/hash bindings and approved private permissions.
5. Independent mock and CLI safety tests cover every required positive and negative, including leaked anonymous volumes, protected/lane mounts, missing metadata, engine/network changes and list/inspect races. No real Docker command runs during preparation.
6. A focused independent Claude review checks the complete held diff and evidence. Resolve findings in the same executor session. Only then may the Lead decide on runtime acceptance rules and coordinate an LA window.

T7 has not run. M1, M2 and legacy acceptance remains unchanged. Final conformance, guide evidence updates, independent Docs QA, two blind final reviews and Lead closure remain after T7. All 32 real-LMS rows remain UNVERIFIED; local Canvas remains DEFERRED. No push or main merge is authorized.
