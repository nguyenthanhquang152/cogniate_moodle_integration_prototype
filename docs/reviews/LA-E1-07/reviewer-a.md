Verdict: APPROVE
Round: 2

# LA-E1-07 review, lens A ("Is it right and is it safe?")

Reviewer: Reviewer-A2 (Claude Code Opus 5.5 xhigh, plan LD-22). Date: 2026-10-22.
Spec: `docs/architecture/ltiaas/tasks/LA-E1-07.md`. Design: LA-ADR-01 D5 (P2–P4, "Contract surface for K0"), D6 (guard levels), D7; LA-ADR-04 D1 S5; app API delta §1, §5; BD-A1-17, -18, -24, -25, -29, -35.

Diff: `git diff 7ee6be4^1 7ee6be4`. As the dispatch asks, I focused on `e2dafde`, `bdf8a8e`, `6abefb3`, `64b7a64` and `8ec9288`; the LA-E1-06 fixes in the merge were reviewed in round 2 of LA-E1-06.

Method: a throwaway `git archive 7ee6be4` copy under `/private/tmp`, with clones of both `node_modules` folders. I ran the unit tests, the K0 contract file (`tests/ltiaas/k0/contract.test.ts`) and 10 mutants in that copy only, and I compared the old `providers/*.ts` and `app/connections.ts` code with the new adapters and strategies. I used no Docker and no network. I did not change the integration worktree, except for this file.

## Summary

| Id | Severity | Topic |
| --- | --- | --- |
| A-LA-E1-07-01 | MINOR | Moodle `PUT …/platform` now refuses unknown body keys (before: ignored). AC-01 requires it, but no `LA-IC` records it. Route to A1. |
| A-LA-E1-07-02 | NIT | `authorityFor` throws a plain `Error` for a stored `verifiedAdminLaunch` |

There is no BLOCKER and no MAJOR finding. The four lens-A points pass: the change is behaviour-neutral for the baseline channels (except -01), there is no confusion between `self` and `operatorGrant`, no channel can bypass the core strategies, and the wire texts are byte-equal.

## Findings

### A-LA-E1-07-01 — MINOR — the Moodle binding body became strict, with no change id

- **File:** `packages/channels/moodle/app.ts` (`parseBindingBody`: `const bad = Object.keys(obj).filter((key) => !PLATFORM_FIELDS.includes(key))`).
- **Problem:** before this task, the Moodle `PUT …/platform` used `z.object(...)`, which ignores unknown keys. Now an unknown key gives `422 INVALID_PLATFORM_VALUES` with that key. App contract §4.4 says "Moodle (`profile: standard`): unchanged (§4)", and its strict-body rule names only Canvas and Blackboard. LA-ADR-04 D8 has no `LA-IC` for this change. The change is forced: AC-01 asks that "the strict binding body refuses one unknown and one missing field" for each baseline channel, and K-ADAPTER checks it (mutant L6, a non-strict Moodle parser, fails `K-ADAPTER.moodle`).
- **Risk today:** low. The portal (`ManifestWizard`) sends exactly the six manual `bindingFields` of the Moodle manifest, and the frozen T4b1 bodies are the six keys. So I expect no golden or frozen-test change. A client that sends one more key (for example a label) gets `422` now.
- **Suggested fix (A1):** either record it (one `LA-IC` row and one line in app API delta §4.4: "Moodle: unknown keys → `422`"), or keep Moodle non-strict and exempt a `self` + `manual` channel from the K-ADAPTER unknown-key case.

### A-LA-E1-07-02 — NIT — an unbuilt authority throws a plain `Error`

- **File:** `services/cogniate-app/src/kernel/authority/index.ts` (`throw new Error('binding authority is not implemented')`).
- **Problem:** the column CHECK allows `verifiedAdminLaunch`, and no LA task writes it yet. If such a row ever existed, `DELETE`, `PUT …/platform`, `app:binding suspend` and `release` would give a `500` or a CLI stack trace.
- **Suggested fix:** throw `ApiError('CAPABILITY_NOT_SUPPORTED')`, and fail the CLI with one line.

## Checks that pass

| Item | Result |
| --- | --- |
| Moodle bind (lens focus) | `selfAuthority.bind` keeps the old order and texts. The order: the `manual` check, the six-value parse (missing or malformed keys give the generic text), the origin rule (`reason: 'origin'` gives "The URLs must be https and on the Moodle site of this connection." through `textName`, BD-A1-35), the repeat or `CONNECTION_NOT_PENDING`, then the same `POST /api/platforms` body (`url`, `clientId`, `name: toolName(library)`, the endpoints, `JWK_SET`, `deploymentIds`). The collision and reserved-issuer texts are frozen in `legacy-wire.ts` and are byte-equal to the old literals. The `422` mapping of `PLATFORM_URL_NOT_ON_ISSUER_ORIGIN` and `INVALID_REQUEST` and the orphan switch-off are unchanged. A non-object body still gives field `body` (`64b7a64`). |
| Disconnect, suspend, release (lens focus) | `self` disconnect: `active: false`, unconditional, then disable (mutant L8 is killed). `operatorGrant` disconnect: one transaction (disable, revoke reason `disconnect`), fence-out, and the same `LTI_SERVICE_ERROR` text on a failed line (mutant L9 is killed). Operator suspend: disable and revoke `suspend`, the same `binding_suspended` line, then the fence-out, with the `binding_fenced` lines for `self` as before. Release goes to the same cleanup engine. |
| Canvas and Blackboard adapters | The diff of the old `providers/{canvas,blackboard}.ts` and the new `app.ts` changes no data, label, parser, target or staged create. The port shape changed: `profiles` (BD-A1-29) replaces `profileLabel`, `acceptsServiceUrl` and `siteRuleSuffixes`. The create route runs the full site rules first, then the adapter's `checkCreate`, which is a subset of the same rules. The AC-10 parity test is killed by a changed `serviceUrl` (L7). |
| No authority confusion (lens focus) | `authorityFor` reads only the stored `binding_authority` (mutant L1, a choice by channel id, is killed by the `zz-test` cases). `PUT …/platform`, `DELETE`, suspend and release all go through it. `app:grant issue` refuses a `self` connection and needs `deployments.multiple` for `add_deployment` (mutant L5 is killed). Routing still reads `binding_authority` (LA-E1-06). |
| No bypass of the core (lens focus) | Adapters are pure data and functions. Under the F3 fence, `app.ts` imports only port types and `@cogniate/shared/channel` values (BD-A1-18). The core picks the strategy. The `self` path takes only a `kind: 'platform'` body with `authConfig`. The `operatorGrant` path needs a `profile` body and the two-phase redemption. `manual` + `self` is limited to Moodle by load check 6. For the `standard` profile, the LTI service refuses endpoints off the issuer origin (`PLATFORM_URL_NOT_ON_ISSUER_ORIGIN`), so the Moodle parser is not the only guard. |
| Launch guard levels (AC-06) | `checkLaunchConnection` moved to `kernel/launch-router.ts` unchanged for the baseline channels (Canvas and Blackboard guard at `launch`, Moodle guards nothing). The new `registration` rule refuses only on a `MANUAL_SELF_LEGACY_CHANNELS` profile channel and otherwise logs `family_guard_mismatch` (info). Mutants L2 (no refusal) and L3 (refused everywhere) are each killed. |
| Wire texts and DTO | The generic and origin `422` texts are pinned by the BD-A1-35 test (mutant L4 is killed). The 16 Moodle tool rows moved unchanged (a line diff of the old `providers/moodle.ts` and the new `app.ts` rows is empty). QA-3's `tests/ltiaas/tasks-core/LA-E1-07/setup.k0.test.ts` compares the rows of each baseline channel with G1 (line 263) and asserts that only Moodle has `selfCreate` (line 285). My mutant L10 (a `selfCreate` on Canvas) ran against the contract file only, so I do not count it as a gap. The connection DTO adds `bindingAuthority` (BD-A1-24, LA-IC-01). The manifest gets `texts.registered` (default "Registered"; Moodle "Registered — activate in {LMS}", BD-A1-25). |
| Ports and the removed folder | `kernel/ports.ts` holds only `import type` lines and type declarations (AC-03). `services/cogniate-app/src/providers/` is gone. The registry carries each `app.ts` export (`appAdapter`, BD-A1-17). |
| Build and tests | On the `7ee6be4` tree: the app, channel and kernel unit tests give 449 passed and 2 skipped. The K0 contract file gives 79 of 79 (K-ADAPTER is on for the three baseline channels). |
| Ownership | Outside the "May edit" list, with import-path changes only that the removal of `providers/` forces: `app/canvas-configuration.ts` and `app/canvas-deployments.ts` (the LA-E1-08 extension files, on the "Must not edit" list), `worker/score-sync.test.ts` (R's `worker/**`, a test import), and `tool-pages/picker.ts`. Kernel files `registry.ts` and `legacy-wire.ts` are lane K's. The Lead may record these. |


## Round 2

Verdict: APPROVE
Round: 2

Reviewer: Reviewer-A (Codex GPT-6-Astra xhigh). Date: 2026-10-23.
Scope: the eleven LA-E1-07 commits `75f9130` through `e549fbe` listed by `git log --oneline 6270d43^1..6270d43^2 --no-merges`. I read each task commit, then checked the combined merge diff. References: the task spec, LA-ADR-01 D5–D7, BD-A1-39/40/54/55 and plan §6.1. I did not open Reviewer-B's files.

**Counts: 0 BLOCKER, 0 MAJOR, 1 new MINOR, 0 NIT.** Both Round 1 findings are closed. The new MINOR belongs to QA, not the Author.

### Round 1 closure

| Finding | Result |
| --- | --- |
| A-LA-E1-07-01 | Closed. LA-ADR-04 D8 records LA-IC-17, and app API delta §3.4 records the strict Moodle body. The LD-9 lens-A review accepts the empty frozen-test change list. Commit `0f5d15c` pins `422 INVALID_PLATFORM_VALUES`, `fields: ['label']` and no LTI call. |
| A-LA-E1-07-02 | Closed. `authorityFor` throws `ApiError('CAPABILITY_NOT_SUPPORTED')`. Bind and disconnect return 409; suspend and release return exit 1 with one line. The connection stays pending. Replacing the error with the old plain `Error` makes the new test fail. |

### Correctness and safety checks

- **Pure helpers and contexts:** `@cogniate/channel-kernel/setup` has exactly four runtime exports: `GRANT_CODE`, `PRINTABLE_ID`, `parseStrictBody`, `toolName`. It has no imports, configuration or I/O. The export test pins the list. The parsers and ASCII formatting preserve the old functions. Channel adapters use kernel-supplied `toolAccountId` and `toolUrls`; the context reaches tool rows, self-create, staged redemption and the P5 Canvas artifact. The injected-URL tests pass.
- **Profile parity (AC-10):** one test discovers both sides of every channel folder. It checks profile presence, registration coverage, sharing, service URL and refused suffixes. Its negative controls reject each changed trait and missing profiles. There is no hard-coded three-channel list in this invariant.
- **Authority (AC-04/05):** the strategy still uses stored authority. Both suspension paths share one transaction, revoke open grants, log once and fence the reloaded disabled connection. Self disconnect stays unconditional; operator-grant disconnect stays fenced. The missing redemption engine is a wiring error. An unavailable adapter is now modelled by the registry lookup, without deleting a required method from a shared adapter.
- **Family verdict (AC-06):** the 26 table cases cover both phases, both guard levels, absent/empty/unclaimed families, own channel and the manual-self exception. A mutation that ignores registration phase fails three cases. In a private probe, I compared `checkLaunchConnection` with its exact pre-`e549fbe` implementation across 1,080 combinations of connection channel, profile, family and site. Serialized results and logger arguments were byte-equal, including original-case refusal fields and lower-case mismatch logs. The app passes `'launch'`; it adds no registration-phase call or input (BD-A1-55).
- **Contract and ownership:** `ports.ts` remains types-only, with documented contexts and views. The task commits do not edit `tests/**`, `docs/**`, R files, the LTI service or portal apps. The shared helpers and lint changes are lane K files; extension-context changes are explicitly covered by this combined LA-E1-07/08 dispatch. `f30aae4` contains the RQ-2 URL wiring and import updates. No new core LMS-name branch was added; F1 passes.

### A-LA-E1-07-03 — MINOR — the task-specific QA fixture lacks the new P2 context fields

- **File:** `tests/ltiaas/tasks-core/LA-E1-07/setup.k0.test.ts:165` (`buildPortContext`).
- **Problem:** this older fixture still supplies only `urls`; it does not supply required `toolAccountId` and `toolUrls`. AC-01 and AC-02 call each adapter's `toolConfiguration` with that object.
- **Evidence:** in the private clone at `6270d43`, I extracted and executed the two fixture functions without changing the QA source. All three adapters throw `Cannot read properties of undefined` when they read `toolUrls`. The shared K0 kit has the new fields and passes 121 tests, so this is a stale QA caller, not a product fallback to add. The task's current QA report is Round 1 and predates the context change.
- **Suggested fix (QA-3):** supply the BD-A1-40 fields in this fixture, retain the golden rows and throwing I/O stubs, then rerun the task suite. Do not weaken the required context or the golden assertions.

### Verification and limits

All execution used a private `git clone --no-hardlinks`, detached at `6270d43`, under `/tmp/la-review-a-r2.Y9zbMj/repo`, with a private copy of `node_modules`. No Docker, stack, host runner, external network call or commit was used.

- Focused app, channel, kernel and import-fence unit run: **890 passed, 2 skipped**. The separate launch-router and review probes: **20 passed**, including the 1,080-case comparison and extension isolation checks.
- Shared K0: **121 passed**. SQL-rule unit tests: **9 passed**. F1 and F5 pass; root `npm run typecheck` and changed-file ESLint pass.
- The scratch probes and all mutations were removed or restored; the private clone was clean after verification. Logs and probe sources are in `/tmp/la-review-a-r2.Y9zbMj/`.
- UNIT ACs retain focused assertions: AC-04/05 in `authority.test.ts`, AC-06 in `launch-router.test.ts`, AC-10 in `setup.test.ts`. These reject the wrong strategy, guard decision or profile data. The Round 1 mutation evidence still applies to unchanged assertions.
- I did not rerun the task-specific QA wrapper or `npm run check`. QA must update the fixture above and refresh its task evidence. R1 and R2-lite remain pending under the Docker hold; this review does not claim runtime acceptance.
