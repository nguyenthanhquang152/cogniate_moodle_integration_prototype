Verdict: APPROVE
Round: 1

# LA-E1-06 review, Reviewer-B (lens: "Can a human team own it?")

Diff: `git diff dc67c14^1 dc67c14` (lane K commits `c330b38`, `df0b927`, merged as `dc67c14`). Spec: `docs/architecture/ltiaas/tasks/LA-E1-06.md`. Design: LA-ADR-04 D4 rules 1–6, LA-ADR-01 D7 and D11, app API delta §1–§2, BD-A1-11, -12, -17. I did not open the other reviewer's file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 1 MINOR, 6 NIT.**

A newcomer can follow the new model from the code. Each connection has a `channel` (who it is) and a `bindingAuthority` (how it binds: `self` or `operatorGrant`). Each binding attempt stores its `target_kind`. The old `lms` column is only a frozen class, written in one place (`connectionBehaviourClass` in `legacy-wire.ts`) and fenced by the F5 rule `connection-lms`.
- The routing, the disabled rule, cleanup and DTO code now read these fields instead of LMS names. `routeLaunch` reads well (`self`, not `moodle`).
- The tests prove the important claim well: both AC-06 tests set a *mismatched* `lms` value first and still get the right routing and send decision.

My findings are about two inputs that can disagree, a few comments that still describe the old model, and wiring that works by order only.

## How I checked

- Scratch clone of `dc67c14` in a private `/tmp` folder (`--no-hardlinks`, `node_modules` copied). The shared LA worktree did not change.
- `vitest run services/cogniate-app packages/channel-kernel`: **25 files, 402 passed, 2 skipped**. `tsc --noEmit -p services/cogniate-app/tsconfig.json`: exit 0. `eslint` on `services/cogniate-app/src`, `packages/channel-kernel/src` and the new rule: exit 0. `node --test infra/scripts/fitness/fitness.test.mjs`: 29 of 29 passed.
- `node infra/scripts/fitness/rules.mjs`: `F5 PASS: 3 rules …, 0 hits` on the tree. A probe `SELECT c.lms FROM connection c …` as `services/cogniate-app/src/app/probe.ts` gives one hit with a clear message ("use channel or binding_authority (LA-ADR-04 D4)").

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | No change in `services/lti-service/**`, `apps/**` or `packages/channels/*/lti-profiles.ts`. Everything else is in the "May edit" list or its BD-A1-11 additions. Three small edits are outside both lists: `cli/{binding,grant,operator-runtime}.ts` (2–6 lines each, for the new parameters). Lane K owns them in B1 (epics §5 K app row), so I only note it. The three adapter files `providers/{moodle,canvas,blackboard}.ts` get one `sharingOf` line each, which BD-A1-12 requires. |
| Ownership | All files are K's in B1, plus K's F5 rule file. OK. |
| No behaviour change outside the spec | Mostly a 1:1 swap of `lms` reads. Three spots need a second look: (1) the tool-configuration route now goes through the adapter for Moodle too; (2) the error precedence of `POST /connections` changed (B-LA-E1-06-04); (3) `fenceRecords` drops the explicit committed platform and Blackboard reservation (B-LA-E1-06-02). The existing cleanup and route tests pass. QA's golden run (AC-05, AC-07) is the real check. |
| No LMS name in core | The new code reads authority and sharing, not names. `moodleOwned` and `LmsType` are older names (F1 ratchet, AC-09 is K0). New HTML text escapes the now-open name (`escapeHtml(lmsName)` in the picker and the content host). Good. |
| Registry wiring (BD-A1-11, -17) | One registry from `main.ts` to both listeners and the worker; `testkit.ts` has one product registry (`TEST_CHANNELS`); `providerOf(channel)` is the only adapter map; the binding helpers take the adapter as a parameter. OK, with B-LA-E1-06-05. |
| UNIT ACs fail on the old behaviour | AC-01, -02: `migration-013.test.ts` seeds 010, 011 and 012 fixtures with old SQL and asserts the backfill, the unchanged old values and the 012 refusal. Without `013` there is no `channel` column, so it fails. AC-03: `domain/connections.test.ts` runs a six-row writer table (baseline and `zz-test`, self/exclusive/shared). AC-06: the routing and the worker tests, with the stored `lms` swapped. The old code reads `lms`, so both tests would fail. |

## Findings

### B-LA-E1-06-01 — MINOR — `createConnection` takes `sharing` apart from the profile it resolves, so the two can disagree silently

- **File:** `services/cogniate-app/src/domain/connections.ts:125-148`; callers `app/connections.ts:205-215`, `:238-240`; fixture `worker/score-sync.test.ts:49`.
- **Problem:**
  - `createConnection` picks the profile itself (`input.profile ?? registration.defaultProfile`), but the caller passes `sharing` as a separate last argument, computed for the caller's own profile choice. Nothing checks that the two belong together. For a new channel, a wrong `sharing` writes the wrong frozen class (`canvas` instead of `blackboard`), and LA-ADR-04 D4 rule 2 needs that class to stay fail-equivalent. For a baseline channel the value has no effect, so the mistake stays hidden.
  - The profile default is also worked out twice: once at the HTTP edge and once in the domain.
  - The two domain refusals are plain `Error`s with no values ("channel registration method is not offered").
- **Evidence:** The worker fixture already creates a Blackboard connection with `'exclusive'` (`score-sync.test.ts:49`), and every test still passes.
- **Suggested fix:** Pass the adapter's `sharingOf` (BD-A1-17 already lets helpers take the adapter, or `sharingOf`, as a parameter) instead of a ready `sharing` value. Make `profile` required in the domain input, because the edge always resolves it. `createConnection` then calls `sharingOf(profile)` once, and throws when the answer is `null`. Put the channel id, method and profile into the error text: `createConnection: channel "zz-test" offers no method "manual"`. Fix the Blackboard fixture to `'shared'`.

### B-LA-E1-06-02 — NIT — `attemptRecord(a, fence)` hides two rules behind a boolean, and `fenceRecords` no longer says what it covers

- **File:** `services/cogniate-app/src/app/binding-cleanup.ts:51-63`, `:146`.
- **Problem:**
  - `attemptRecord(a, true)` (fence-out) maps a `platform_deployment` attempt to its **platform**, while `attemptRecord(a)` (revoke) maps it to its **deployment**. The doc comment above it still says "Canvas → the platform; Blackboard → its deployment".
  - `fenceRecords` used to add the committed platform (`c.ltiPlatformId`) and the Blackboard reservation by name. Now it reads only the attempts. A reader cannot tell whether that is the same set or an intended change.
- **Suggested fix:** Use two named functions, `fenceRecordOf(a)` and `revokeRecordOf(a)`, each with one line on why add-deployment fences the platform but revokes the deployment. Above `fenceRecords`, add one sentence such as "the committed platform and the reservation are attempt targets, so the attempt list covers them", and name the test that proves it.

### B-LA-E1-06-03 — NIT — The comments still describe the old model where a newcomer looks first

- **File:** `services/cogniate-app/src/domain/connections.ts:47-49` (the doc line above `channel` and `bindingAuthority` still says "LMS type, LTI profile and …"), `:99` (`toConnection`, with no rule comment), `:141` (the rule comment sits above the INSERT).
- **Problem:** LA-ADR-04 D4 rule 3 asks for the comment rule "above the mapping". It is above the insert, so a reader of `toConnection` does not see it. The two new fields have no own doc lines either.
- **Suggested fix:** Move the rule comment to `toConnection`. Give each field one doc line: `channel`, the channel id, which never changes; `bindingAuthority`, how a binding is approved (`self`: the LMS administrator registers the tool; `operatorGrant`: an operator approval code). Also add a short header comment to `013_channel_kernel.sql` with the same two meanings and "core never reads `connection.lms`".

### B-LA-E1-06-04 — NIT — A missing method always reads "no dynamic registration", and the error order changed

- **File:** `services/cogniate-app/src/app/connections.ts:201-204`.
- **Problem:** Two changes:
  - Any method that the channel does not offer now gives `422 CAPABILITY_NOT_SUPPORTED` with "This LMS has no dynamic registration." and `capability: dynamicRegistration`. That text is also used for a missing `manual` method (possible for a new channel).
  - The check now runs before the profile check and before the `GET /api/providers` call. So Canvas `method: dynamic` with a bad profile now gives 422 instead of 400. M1 keeps the frozen text and capability for `dynamic` (LA-ADR-01 D3).
- **Suggested fix:** Keep the frozen text only for `method === 'dynamic'`; for another method use `invalid('method')`. Ask QA to confirm the new order against the M1 golden (AC-05, AC-07), or restore the old order.

### B-LA-E1-06-05 — NIT — The content listener uses a registry that only the app listener's build sets

- **File:** `services/cogniate-app/src/main.ts:27`, `:37`, `:65`.
- **Problem:** `let channels` is assigned inside the app listener's `build` and read by the content listener's `build`. This works only because `startService` builds the listeners in list order. If someone reorders the list, the content host gets `undefined` and fails at its first runtime request. The `worker` variable next to it is guarded (`worker?.kick()`); `channels` is not.
- **Suggested fix:** Load the registry once before `startService`, with a logger for the `channel_registry_invalid` line. Or add one comment ("the app listener must stay first: it loads the registry") and a guard that throws a clear error when `channels` is unset.

### B-LA-E1-06-06 — NIT — A type re-export passes the content-host fence without saying so

- **File:** `services/cogniate-app/src/domain/attempts.ts:300` (`export type { ChannelRegistry } from '@cogniate/channel-kernel';`), used by `content-host/server.ts`.
- **Problem:** The ADR-008 fence lets the content host import only `domain/attempts*`, `packages/tracking` and `packages/shared`. The new last line of `attempts.ts` passes a kernel type through that fence. Nothing explains why it is there, so the next person may remove it or copy the trick for a value import.
- **Suggested fix:** Add a one-line comment ("type only: the content host may import only domain/attempts*, ADR-008"). Or ask A1 to allow `import type` from `@cogniate/channel-kernel` in the fence.

### B-LA-E1-06-07 — NIT — The `lms-providers` rule for simulation-only channels is one dense expression with no comment

- **File:** `services/cogniate-app/src/app/connections.ts:177-189`.
- **Problem:** The filter `m.availability !== 'simulation-only' || rows.some(…)` is the app API delta §2 rule ("listed only when the LTI service reports simulations on"). It sits inside a 13-line nested `filter`/`map` expression with no comment. The default channel at `:198` also uses the literal `'standard'`, while the kernel exports `STANDARD_PROFILE_ID`.
- **Suggested fix:** Extract a named helper `listedChannels(rows)` with that one-line rule as its comment, and use `STANDARD_PROFILE_ID`.

## Not checked

- K1-SIM AC-05, AC-07, AC-08 and K0 AC-04, AC-09 (QA). The F1 count delta of AC-09; the BD-A1-19 F1 exception for `013` is lane P's.
- Lens-A depth of the cleanup record sets (B-LA-E1-06-02 asks only for clarity).
