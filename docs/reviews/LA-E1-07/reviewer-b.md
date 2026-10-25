Verdict: APPROVE
Round: 2

# LA-E1-07 review, Reviewer-B2 (lens: "Can a human team own it?")

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22). Diff: `git diff 7ee6be4^1 7ee6be4`, with focus on the task commits `e2dafde`, `bdf8a8e`, `6abefb3`, `64b7a64`, `8ec9288` (the LA-E1-06 fixes and the prerequisites in this merge were reviewed separately). Spec: `docs/architecture/ltiaas/tasks/LA-E1-07.md`. Design: LA-ADR-01 D5, D6, D7; LA-ADR-04 D1 S5; BD-A1-16, -17, -20, -24, -25, -29, -35; BD-A2-11. I did not open any reviewer-a file. I did not run Docker.

Counts: **0 BLOCKER, 1 MAJOR, 3 MINOR, 3 NIT.**

The kernel part is clean. `kernel/authority/` has one strategy per stored authority, and `authorityFor` chooses only by `bindingAuthority`. `kernel/setup.ts` finds the adapters by discovery (`channels.appAdapter`), so `providers/` is gone. The frozen texts are in `legacy-wire.ts`, and BD-A1-35 keeps the two binding-body descriptions in core. The authority tests prove the claim that matters: the `self` case changes the stored authority of an `operatorGrant` test channel, and the stored value wins. My MAJOR is about the template that a new channel author copies: each channel `app.ts` holds its own copy of about 50 lines of shared setup helpers.

## How I checked

- Scratch clone of `7ee6be4` (private `/tmp` folder, `--no-hardlinks`, `node_modules` copied; deleted after the run).
- `vitest run services/cogniate-app packages/channel-kernel packages/channels`: **33 files, 449 passed, 2 skipped**. K0 `contract.test.ts`: **79 passed** (K-ADAPTER now runs on the three baseline channels, with no `todo`). F1: `PASS, 32 files with hits, 184 hits`. `eslint packages/channels services/cogniate-app/src/kernel`: exit 0. `services/cogniate-app/src/providers/` does not exist (AC-09).
- I compared the helper blocks of the four files that hold them (`diff` of the extracted blocks; B-LA-E1-07-01).

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | The task files are in the "May edit" list. `6abefb3` ("import moves") changes imports only in four files: two of them are on the "Must not edit" list, `worker/score-sync.test.ts` (R) and the LA-E1-08 extension files `app/canvas-configuration.ts`, `app/canvas-deployments.ts`, and `tool-pages/picker.ts` is on neither list. Removing `providers/` forces these edits. The Lead records them. The kernel edits (`registry.ts` `appAdapter`, `legacy-wire.ts` frozen texts) are lane K files. |
| Ownership | Lane K, B2. OK, with the note above. |
| No behaviour change outside the spec | The routes call the same parse, target and create logic through the port. The `422` texts are core-owned (BD-A1-35). In passing, `POST /connections` with a method that the channel does not offer now gives `invalid('method')` for a non-`dynamic` method. That closes NIT B-LA-E1-06-04 of LA-E1-06. |
| No LMS name in core | F1 passes. The new LMS words are frozen texts in `legacy-wire.ts` and channel data in `packages/channels/*`. |
| UNIT ACs | AC-04/05: `kernel/authority.test.ts` (an `operatorGrant` test channel: grant, two phases, fence-out, `add_deployment` refused; the same channel switched to stored `self`: `app:grant` exits 1 with no row, bind without a grant, disconnect with one unconditional PATCH). AC-06: `kernel/launch-router.test.ts`. AC-10: one test per channel `app.test.ts`. The old tree has no strategies, no router and no `profiles` map, so each test fails there. OK. |
| Can a newcomer write `app.ts` from `ports.ts`, the kit and the docs? | Partly. The K0 kit enforces the required members (BD-A1-20). But `ports.ts` gives little help (B-LA-E1-07-02), and copying a channel copies the shared helpers (B-LA-E1-07-01). |

## Findings

### B-LA-E1-07-01 — MAJOR — Every channel `app.ts` holds its own copy of the shared setup helpers, including the strict-body parser

- **File:** `packages/channels/canvas/app.ts:75-123`; `packages/channels/blackboard/app.ts:69-118`; `packages/channels/moodle/app.ts:87-106`; core original `services/cogniate-app/src/kernel/setup/common.ts:1-50`.
- **Problem:**
  - Four files hold the same `TOOL_ACCOUNT`, `toolName` (with its NFKD/ASCII rule from flows §6a) and `toolUrls`.
  - Three of them (Canvas, Blackboard, core) also hold the same `PRINTABLE_ID`, `GRANT_CODE` and `parseStrictBody`, which is the strict-body rule of app contract §4.4, the rule that refuses unknown, missing and malformed binding fields.
  - Each copy starts with the same comment: "Small pieces that every provider adapter and the connection routes share". A change to the grant-code form, the tool name rule or the strict-body rule must now be made in three or four files, in more than one lane. A missed copy makes channels drift apart without notice.
  - A new channel author copies a channel folder (the canary README says to), and so makes a fifth copy.
  - A channel-safe home already exists: `@cogniate/shared/channel` (BD-A2-11, "Pure helpers for channel server code"). `canvas/app.ts` and `blackboard/app.ts` already import `checkSiteUrl` and `fixedHostsOf` from it, and the F3 fence allows it.
- **Evidence:** The 51-line helper tails of `canvas/app.ts` and `blackboard/app.ts` are identical (`diff` gives no output). `toolName` and `parseStrictBody` in `canvas/app.ts` are identical to `kernel/setup/common.ts`. Core callers (`app/connections.ts`, `app/operator.ts`, `app/canvas-*.ts`) still import the core copy.
- **Suggested fix:** Move `TOOL_ACCOUNT`, `toolName`, `toolUrls`, `PRINTABLE_ID`, `GRANT_CODE`, `StrictBodyResult` and `parseStrictBody` into `@cogniate/shared/channel`. They are pure, so they fit its rule. The Lead routes an RQ to the owner of `packages/shared/src/channel.ts`. Import them in the three `app.ts` files and in `kernel/setup/common.ts` (or delete that file and import directly), and delete the copies. The channel `app.ts` files then hold only channel data and channel rules.

### B-LA-E1-07-02 — MINOR — `ports.ts` does not tell a channel author what to implement, and it mixes the channel contract with kernel-internal types

- **File:** `services/cogniate-app/src/kernel/ports.ts:1`, `:140-155` (`ConnectionSetup`, no member comments), `:206-233` (`RedemptionRequest`, `SetupRouteDeps` with `db: Db`, `lti: LtiClient`, `masterKey: Buffer`).
- **Problem:** The LA-ADR-01 D5 sketch has one comment per member, for example "`self` authority with typed values (Moodle six values): the platform create, no grant". `ports.ts` keeps none of them. It does not say:
  - which optional members are required for which authority (BD-A1-20: `selfCreate` for `manual` + `self`; `initialTarget` and `createRequest` for `operatorGrant`);
  - what `rule` in a `checkCreate` refusal means;
  - when `reason: 'origin'` applies (BD-A1-35).

  The header says "a channel receives capabilities through PortContext". But the same public file exports `SetupRouteDeps`, which hands a raw `Db`, the `LtiClient` and the master key to the core route modules. A newcomer cannot tell which types are the channel contract and which are core plumbing.
- **Suggested fix:** Copy the D5 member comments onto `ConnectionSetup`, and add the BD-A1-20 required rules and the BD-A1-35 `reason` rule. Split the file into two marked parts: "Channel contract (implement in app.ts; P5–P7 get PortContext)" and "Kernel-internal (core route modules only; never use in a channel)". Or move `SetupRouteDeps` and `RedemptionRequest` to a core-only module.

### B-LA-E1-07-03 — MINOR — The AC-10 invariant test is copied into each channel, so a new channel is not checked unless its author copies it too

- **File:** `packages/channels/blackboard/app.test.ts:6-18`; `packages/channels/canvas/app.test.ts:83-…`; `packages/channels/moodle/app.test.ts:12-…`.
- **Problem:** The same test ("offered profile data matches LTI traits and covers every registration profile") is written three times. The rule (BD-A1-29: the `profiles` map must equal the `lti-profiles.ts` traits and cover every registration profile) is a cross-channel invariant. A fourth channel without a copy has no check, and the K0 kit does not compare these two files.
- **Suggested fix:** Write one discovery-based unit test, for example in `services/cogniate-app/src/kernel/setup.test.ts`, that loads every channel of the product root (app side and LTI side) and checks the invariant for each one. Delete the three copies. Or ask QA to add it to K0 `K-PROFILE`, which already iterates every channel and the canary.

### B-LA-E1-07-04 — MINOR — The family-guard rule is a second implementation in a dense one-line condition

- **File:** `services/cogniate-app/src/kernel/launch-router.ts:34-42`; the LTI service version `services/lti-service/src/lti/checks.ts:248` (`check14ProductFamily`).
- **Problem:** The app LMS check repeats the guard-level rule of check 14:
  - a `launch` guard refuses;
  - a `registration` guard refuses only on a channel of `MANUAL_SELF_LEGACY_CHANNELS`, and is otherwise logged.

  In the app it sits in one condition with five sub-terms (`:39`). The two services are owned by different lanes (K and L). When A1 changes the rule (a new level, a new legacy channel), both files must change in the same way, and nothing ties them together. Line `:34` also uses the literal `'standard'`, while the kernel exports `STANDARD_PROFILE_ID`.
- **Suggested fix:** Add one pure kernel function, for example `familyGuardVerdict(registry, family, profileChannel): 'pass' | 'log' | 'refuse'`. Lane K uses it here; lane L switches `check14ProductFamily` in its next commit (the Lead routes it). Split `:39` into the profile-channel check and the guard verdict, and use `STANDARD_PROFILE_ID`.

### B-LA-E1-07-05 — NIT — `suspend` is the same code in both strategies

- **File:** `services/cogniate-app/src/kernel/authority/self.ts:61-65`; `services/cogniate-app/src/kernel/authority/operator-grant.ts:10-14`.
- **Problem:** Both disable the connection, revoke open grants, log `binding_suspended` and fence out. The only difference is that one passes the reloaded connection to `fenceOut` and the other passes the stale one. A reader cannot tell whether that difference is intended.
- **Suggested fix:** Use one `suspendBinding(deps, c, traceId)` in `authority/common.ts` that always passes the reloaded connection.

### B-LA-E1-07-06 — NIT — Import aliases and re-exports keep the old vocabulary alive

- **File:** `services/cogniate-app/src/app/canvas-deployments.ts:6` (`SetupRouteDeps as ProviderRouteDeps`); `services/cogniate-app/src/tool-pages/picker.ts:19` (`ChannelText as LmsName`); `services/cogniate-app/src/worker/score-sync.test.ts` (`testSetupOf as providerOf`, `ChannelId as LmsType`); `services/cogniate-app/src/app/connections.ts:24` (re-exports `deactivateOrphan`, `platformInfo` from the kernel).
- **Problem:** These aliases kept the import edits in other lanes' files small. But the code now has two names for each concept, and the old name ("provider", "LMS type") is the one a reader sees at the call site.
- **Suggested fix:** Each owner renames to the new names in its next commit to these files (R for `worker/**`, the LA-E1-08 extension files, the picker owner). Remove the `app/connections.ts` re-exports when the callers import from the kernel. The Lead lists this in the routing notes.

### B-LA-E1-07-07 — NIT — A dead check in the `operatorGrant` bind

- **File:** `services/cogniate-app/src/kernel/authority/operator-grant.ts:17`.
- **Problem:** `!adapter.parseBindingBody` can never be true, because `parseBindingBody` is a required member of `ConnectionSetup`, and the K0 kit enforces it. The real condition is `!deps.engine`. The error text "This connection has no operator approval" fits neither case.
- **Suggested fix:** Check only `deps.engine`, and use a plain `Error` ("operatorGrant bind needs the redemption engine"), because a missing engine is wiring, not a client error.

## Not checked

- K1-SIM AC-07 and MOODLE-LIVE AC-08 (QA). K0 AC-01..03 and AC-09 ran in my clone as part of the K0 contract file and F1, but the QA record is QA's.
- Lens-A items: the two-phase redemption and cleanup paths beyond the authority tests, and the guard decision table beyond `launch-router.test.ts`.

## Round 2

Verdict: APPROVE
Round: 2

Reviewer: Codex, Reviewer-B. The round 1 record above is unchanged apart from the file's current verdict header. Reviewed the eleven LA-E1-07 commits `75f9130` through `e549fbe` named in merge `6270d43`, including RQ-2 `f30aae4`. Source and test candidate: `6270d43`. Applied LA-ADR-01 D5–D7, BD-A1-38/40/41/43/54/55, the task spec, and plan §6.1. No Reviewer-A file was opened.

**Open counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT.** No new finding. The remaining nit belongs to lane R.

### Round 1 findings

| Finding | Result and evidence |
| --- | --- |
| B-LA-E1-07-01 — MAJOR | **Closed.** The four pure values have one definition in `packages/channel-kernel/src/setup.ts`. The package exports `./setup`; `setup.test.ts` pins its value names and parser grammar. The channel copies are gone. P2 and P5 receive the account and all five URL fields from `kernel/setup/common.ts`. This follows BD-A1-40, which replaces the earlier suggested shared-package location. |
| B-LA-E1-07-02 — MINOR | **Closed.** `kernel/ports.ts` describes each operation, context and public view. It states the required authority methods, site-rule number, and closed `origin` refusal reason. It imports types only. Raw database, LTI client and master key dependencies are in `kernel/setup/deps.ts`, outside the channel import fence. |
| B-LA-E1-07-03 — MINOR | **Closed.** `kernel/setup.test.ts` discovers both app and LTI channel folders and checks every adapter. It checks registration coverage and all three profile traits. Changed traits, removed app entries and missing LTI profiles are negative controls. The three channel copies are removed. |
| B-LA-E1-07-04 — MINOR | **Closed for this task.** `familyGuardVerdict` reads the guard level from the registry and takes the call phase separately. Its 26 cases cover both phases, both levels, absent/unclaimed/own families and legacy manual-self channels. The launch router uses it and `STANDARD_PROFILE_ID`, retaining the refusal and log fields. BD-A1-43 assigns the LTI service callers to LA-E2-02; BD-A1-55 confirms there is no app registration-phase caller. |
| B-LA-E1-07-05 — NIT | **Closed.** Both strategies call `suspendBinding`. Its test checks the disabled, reloaded connection, revoked grant, one fence call and one log event for each authority. |
| B-LA-E1-07-06 — NIT | **Partly closed; lane R remainder.** K's aliases and the `app/connections.ts` helper re-exports are gone. The former worker test moved to `drivers/lti-ags/connection-state.test.ts`; it still aliases `ChannelId` and `testSetupOf`. See the residual below. |
| B-LA-E1-07-07 — NIT | **Closed.** Operator bind checks only the redemption engine and reports a precise wiring error. The unavailable-adapter test now stubs registry discovery instead of deleting a required parser method. |

### Checks and evidence

- Used a private `git clone --no-hardlinks` at `6270d43`, with copied dependencies. No Docker, stack or host runner ran. No product or test file changed in the integration worktree.
- `vitest run services/cogniate-app packages/channel-kernel packages/channels eslint.config.test.ts`: **50 files, 1,130 passed, 2 skipped**. The skips are the HTML and SCORM archive upload fixtures absent from the clone.
- K0: **3 files, 121 passed, no skips**. `npm run typecheck` and lint of the app kernel, app routes, channel packages and changed SQL rule files passed.
- F1: **PASS, 20 files with hits, 74 hits**. F5: **6 rules, 0 hits**. The task diff adds no LMS-name branch in core.
- Private negative controls: removing the registration-phase clause caused **3 family-guard test failures**; restoring URL construction in the Canvas channel caused **1 injected-context test failure**. All temporary mutations were restored; the private clone's tracked tree is clean.
- UNIT AC-04/05 remain covered by the `zz-test` authority tests: stored self overrides an operator-grant manifest, grant refusal stores nothing, operator binding stages then activates, and disconnect uses the correct fence. AC-06 has the launch-router table and log assertions. AC-10 has the discovery test and its drift probes. These assertions detect the contrary behavior, rather than only checking method presence.
- The LA-IC-17 route test pins `422 INVALID_PLATFORM_VALUES`, the unknown field and zero LTI calls. Unsupported stored authority gives the typed API refusal and one CLI line. These checks passed.
- The task commits stay in lane K's B2 ownership, including the named RQ-2 caller wiring. They change no `tests/**`, `docs/**`, `apps/**`, LTI-service or R-owned file. The public setup contract and example channel now give a newcomer the required implementation rules.

### Residual B-LA-E1-07-06 — NIT — R-owned aliases remain

- **File:** `services/cogniate-app/src/drivers/lti-ags/connection-state.test.ts:15` and `:16`.
- **Problem:** The moved test still uses `ChannelId as LmsType` and `testSetupOf as providerOf`.
- **Evidence:** Both imports remain at the reviewed candidate; the rest of K's named aliases are removed.
- **Suggested fix:** Lane R uses the public names when it next edits this test. No lane K change is required for approval.

### Verification boundary

K1-SIM AC-07 and MOODLE-LIVE AC-08 remain QA work pending the permitted stack window. This review gives no runtime regression credit. The LTI-service adoption of the shared guard remains the explicit LA-E2-02 dependency.
