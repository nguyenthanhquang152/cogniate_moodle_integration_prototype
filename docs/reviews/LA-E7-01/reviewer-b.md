Verdict: APPROVE
Round: 2

# LA-E7-01 review, Reviewer-B2 (lens: "Can a human team own it?")

## Round 2

Diff: `git diff 2c1b1e0 3efa55a -- tests/ltiaas/k0 tests/ltiaas/canary docs/reviews/LA-E7-01/qa.md` (the lead QA's round-2 kit, with A1's BD-A1-20 and BD-A1-21). I did not open any reviewer-a file. I did not run Docker.

Counts (this round): **0 BLOCKER, 0 MAJOR, 1 MINOR, 1 NIT.** Both round-1 MAJOR findings and all MINOR and NIT findings are **closed**.

How I checked: a scratch clone of `3efa55a` (private `/tmp` folder, deleted after the run). `vitest run --config tests/ltiaas/k0/vitest.config.mts tests/ltiaas/k0/contract.test.ts`: **76 passed, 3 todo**, 1.8 s, including the child K0 run of AC-06. I repeated my round-1 mutant M1, which changes every documented status to 418 and every `CAPABILITY_NOT_SUPPORTED` to another code: **26 tests now fail** (round 1: 0). Renaming the canary's `checkCreate` fails `K-ADAPTER.zz-canary`. I also reworded one guard cell of LA-ADR-01 D3 in the clone (docs only; see B-LA-E7-01-07).

### Round-1 findings

| Finding | Status |
| --- | --- |
| B-LA-E7-01-01 (MAJOR) | **Closed.** The self-comparison is gone. Each `K-CAP` case now computes the capability with product code in the off state and in an enabled copy (`computeCapabilities`, `legacyProjection`, `contract.test.ts:696-719`). It checks the documented status, code and `details.capability` against the D3 table (`:721-744`). qa.md row AC-04 now says that the HTTP answer is K1 (LA-E7-02), so it no longer claims more than the test checks. |
| B-LA-E7-01-02 (MAJOR) | **Closed.** `K-ADAPTER` uses the D5 names (BD-A1-20). A missing required member fails, with no `typeof` skip (`:953-970`). Every required method runs with throwing `db`, `sql`, `lti` and `outbound` stubs (`:995-1097`). The baseline channels are an explicit `it.todo` "pending LA-E1-07" (`:917-921`), so the report shows the gap. The canary `app.ts` implements the D5 surface. qa.md marks AC-07 "pending: LA-E1-07" for the baseline channels. |
| B-LA-E7-01-03 (MINOR) | **Closed.** The fill values come from `TEXT_PLACEHOLDERS` (`:590-592`), and both canaries now use `{site}`. |
| B-LA-E7-01-04 (MINOR) | **Closed.** The cross-canary import is gone. Both manifests end with `satisfies ChannelManifest`, and both profile files end with `satisfies readonly ProfileSource[]` (BD-A1-21). Each folder has a `README.md` with copy steps and a facts table. |
| B-LA-E7-01-05 (MINOR) | **Closed.** The kernel and profile types are imported, not copied. The profile module is a static import. The `ports.ts` gap is an `it.todo` with its reason. |
| B-LA-E7-01-06 (NIT) | **Closed.** No `export` in the test file; `'package.json'`. |

### New in this round

#### B-LA-E7-01-07 — MINOR — A wording change in LA-ADR-01 D3 now turns K0 red in every lane's `npm run check`

- **File:** `tests/ltiaas/k0/contract.test.ts:63`, `:72-123` (`parseAdr01D3Tables` reads the ADR markdown at test time), `:136`, `:725` (`d3GuardSubstring` prose matches), `:179`, `:282`, `:299`, `:316`, `:333`, `:350`, `:367`.
- **Problem:** The cross-check against D3 is the right idea, because it ties the oracle to the design. But it matches free prose: "the picker stays single select", "ungraded placement is not offered", "the embedded page stays static", and so on. A1 edits the ADR in docs-only commits, which do not run `npm run check`. A rewording, or a new table column, then fails K0 for the next code lane that runs the check, and that lane changed nothing related. The message names D3, so the cause can be found, but the lane that sees the failure does not own the fix.
- **Evidence:** In the clone I changed only the D3 cell text "the picker stays single select" to "the picker keeps single selection". Result: **5 K0 tests fail** (`content.multiple: D3 guard column matches: expected 'the picker keeps single selection, …' to contain 'the picker stays single select'`), one for each channel where the capability is off.
- **Suggested fix:** Keep the structured part of the cross-check: the `4xx CODE` pattern and the legacy-flag table. These values are contract values, so a change there should fail. Drop the prose `d3GuardSubstring` matches, or move them into one separate test named "LA-ADR-01 D3 doc consistency" whose message says "the ADR text changed: update CAPABILITY_GUARD_TABLE (QA)". The Lead can also add one line to the A1 routine: "after an edit of LA-ADR-01 D3, run K0".

#### B-LA-E7-01-08 — NIT — The `toolConfiguration` context in K-ADAPTER and in the canary is not the D5 context

- **File:** `tests/ltiaas/k0/contract.test.ts:1025-1031`; `tests/ltiaas/canary/zz-canary/app.ts` (`toolConfiguration(ctx: { publicLtiOrigin?, publicAppOrigin? })`); D5 ("`toolConfiguration(ctx: ToolConfigurationContext): ToolRow[]; // … (unchanged signature)`"); today's type `services/cogniate-app/src/providers/types.ts:53-55` (`{ urls: PublicUrls; libraryName: string; … }`).
- **Problem:** BD-A1-20 fixes only names, arity and result shapes before LA-E1-07, so this is allowed. But D5 says the signature does not change, and today's context is `{ urls, libraryName, sharedClientId }`. The canary reads `ctx.publicLtiOrigin`, and the README tells a channel author to copy the folder. A copied adapter therefore reads a context field that the kernel will not pass. When LA-E1-07 lands, the K-ADAPTER call will throw on the real adapters (`ctx.urls` is undefined), and QA must rewrite the call then.
- **Suggested fix:** Pass and read the D5 names now: `toolConfiguration({ urls: { lti, app, content }, libraryName: 'Library A', sharedClientId: null })`, and in the canary use `ctx.urls.lti`. Or mark both objects in a comment as placeholders to replace with the `ports.ts` types at LA-E1-07.

## Round 1

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22). Diff: commit `2c1b1e0`, the files `tests/ltiaas/k0/contract.test.ts` and `tests/ltiaas/canary/**`, with the proof `docs/reviews/LA-E7-01/qa.md`. Author: the lead QA (kit owner). Spec: `docs/architecture/ltiaas/tasks/LA-E7-01.md`. Design: TEST-STRATEGY §2.7, LA-ADR-01 D1, D4, D5, D12, README §4 F4. I did not open any reviewer-a file. I did not run Docker.

Counts: **0 BLOCKER, 2 MAJOR, 3 MINOR, 1 NIT.**

The suite has a good structure. One `describe.each` runs over the discovered product channels, and a second one runs over the canary root. Each case has a short id (`K-MANIFEST`, `K-LEGACY`, `K-CAP`, `K-PROFILE`, `K-ADAPTER`) and the channel id in its name. Most `expect` calls carry a message. A new channel folder adds its cases with no test edit (AC-02). When a channel author breaks a manifest, the file stops at collection with the kernel error, which names the channel, the load check and the field. That error is easy to act on. My two MAJOR findings are about tests that cannot fail on the thing they claim. K-CAP compares its own table to itself. K-ADAPTER calls an adapter shape that is not the D5 port, so it will skip or wrongly fail the real adapters. Because of the second point, the canary is not yet a usable template for a channel with an `app.ts`.

## How I checked

- Scratch clone of `2c1b1e0` in a private `/tmp` folder (`git clone --no-hardlinks`, `node_modules` copied). The shared LA worktree did not change.
- `vitest run --config tests/ltiaas/k0/vitest.config.mts`: **3 files, 109 tests passed**. `contract.test.ts` alone: 67 passed.
- Mutations (each one reverted after the run):
  - M1: I changed the documented `status` (409 → 418) and `code` of every row in the test's `CAPABILITY_GUARD_TABLE`. **67/67 still pass.**
  - M2: I renamed the canary adapter methods to D5-style names (`checkCreate`, `parseBindingBody`). **67/67 pass.**
  - M3: I added a canary method that writes to `ctx.db` at call time, under a D5 name. **67/67 pass.**
  - Channel-author probes: an unknown placeholder `{SCHOOL}` and a non-boolean `launch.windowHint` each stop the file with a clear `RegistryError` (check 1, check 4). The allowed placeholder `{site}` fails `K-MANIFEST` (B-LA-E7-01-03).

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | Only `tests/ltiaas/k0/**`, `tests/ltiaas/canary/**` and the QA file of this task, plus a one-line `TEST-STRATEGY.md` change and a note in `docs/reviews/LA-E0-03/qa.md` (both QA files). No product code or root `package.json` change. OK. |
| Ownership | The lead QA owns the kit (plan LD-13, LD-17). OK. |
| Entry points (design note) | Imports only `@cogniate/channel-kernel` and `services/lti-service/src/profiles/index.ts`. OK. |
| AC-02 (per-channel cases) | Real: cases come from discovery. QA's scratch-channel run added 14 cases. OK. |
| AC-03 (legacy projection) | Real: `M1_BASELINE_LEGACY_FLAGS` is an oracle, compared with `toStrictEqual` (`contract.test.ts:421-425`). OK. |
| AC-05, AC-06 (canary root, negative control) | Real: product registry without the canary ids; a broken copy gives `RegistryError` with `channel`, `check: 1` and `names.label`. OK. |
| AC-04, AC-07 | See B-LA-E7-01-01 and -02. |

## Findings

### B-LA-E7-01-01 — MAJOR — The K-CAP guard cases compare the test's own table with itself, so they cannot fail on status, code or `details.capability`

- **File:** `tests/ltiaas/k0/contract.test.ts:461-486` (the assertion at `:475-484`); `docs/reviews/LA-E7-01/qa.md:25`.
- **Problem:** Each `K-CAP.<channel>.<guard>` case builds `guardContract` from the row's `status`, `code` and `detailsCapability`. It then expects that object to equal the same three values of the same row. The assertion is always true. The other checks in the case are true by construction too: the case list is `offGuards`, which is built with the same `isSupported` call. The legacy-flag check repeats `K-CAP.<channel>.catalog`. K0 has no product guard to call: the kernel exports no guard response, and the app guards land with LA-E1-08. Yet qa.md row AC-04 says that each of the 39 cases verifies "status (`409` or `400`), error code … and `details.capability`".
- **Evidence:** Mutation M1 changed every documented status to 418 and every `CAPABILITY_NOT_SUPPORTED` code to another value. All 67 contract tests still pass. `git grep CAPABILITY_NOT_SUPPORTED -- packages/channel-kernel/src` finds nothing, so K0 has nothing to compare the values with.
- **Suggested fix:** Keep the case generation. It is the real K0 part of AC-04 ("one case per false or absent guarded capability, read from the catalog and the guard table"). Remove the self-comparison. Keep the documented status, code and `details.capability` as case data (they are already in the case name), and write in the file that the HTTP answer is checked by K1-CAP C2 and by LA-E1-08 when the app guard exists. Then call that guard from K0 if it is a public entry point. Correct qa.md row AC-04 so that it claims only what the test checks.

### B-LA-E7-01-02 — MAJOR — K-ADAPTER and the canary `app.ts` use an adapter shape that is not the D5 port, and the case skips silently when a method is missing

- **File:** `tests/ltiaas/k0/contract.test.ts:568-658` (shape at `:592-597`; `typeof … === 'function'` guards at `:603`, `:619`, `:629`; `config.rows` at `:611`); `tests/ltiaas/canary/zz-canary/app.ts:48-105`; `docs/reviews/LA-E7-01/qa.md:28`; design LA-ADR-01 D5 (`ConnectionSetup`, `adr/LA-ADR-01-channel-kernel.md:250-267`).
- **Problem:** The case calls `toolConfiguration(input)` and expects `{ rows }`. It calls `stageCreate(body)` and `bindingTarget(body, staged)`. D5 defines `channel`, `checkCreate(input)`, `toolConfiguration(ctx): ToolRow[]`, `parseBindingBody(body, ctx)`, `selfCreate?`, `initialTarget?` and `createRequest?`. The canary `app.ts` implements the invented shape, so K-ADAPTER passes on the canary, but it proves nothing about the port that the kernel will call. When LA-E1-07 lands the real `app.ts` files:
  - `toolConfiguration` returns an array, so `config.rows` is `undefined`, and the case fails for a correct adapter.
  - `stageCreate` and `bindingTarget` do not exist, so the strict-body checks are skipped without a message.
  - The "no database, no LTI call" check (AC-07, TEST-STRATEGY §2.7) runs only inside the methods that the case finds, so a real adapter that touches `ctx.db` is never caught.

  qa.md marks AC-07 PASS on the canary, but the spec places AC-07 after LA-E1-07. F4 ("a new channel needs no kernel edit") is therefore not shown for a channel with an `app.ts`.
- **Evidence:** M2 gave the canary methods D5-style names: 67/67 pass. M3 added a method that calls `ctx.db.run()`: 67/67 pass. The test's own types (`:592-597`) name `stageCreate` and `bindingTarget`, which appear nowhere in D5.
- **Suggested fix:** Write K-ADAPTER against the D5 names and signatures now. The design note allows a case to be written before its entry point and wired later. Fail when a required port function is missing (no `typeof` skip). Call every port function with throwing `db` and `lti` stubs. Rewrite the canary `app.ts` to the D5 shape: plain functions now, and the `ports.ts` types after LA-E1-07. In qa.md, change AC-07 to "pending: LA-E1-07" until the case runs on the real port.

### B-LA-E7-01-03 — MINOR — `K-MANIFEST` fails a correct manifest that uses the allowed placeholder `{site}`

- **File:** `tests/ltiaas/k0/contract.test.ts:383-388`; kernel `packages/channel-kernel/src/text.ts:4`.
- **Problem:** The kernel placeholders are `LMS`, `tool` and `site`. The test fills `LMS`, `tool` and `platform`. `platform` is not a placeholder, so `{site}` stays in the text, and the case reports "fillText leaves no unresolved placeholders". The channel author's manifest is correct, so the message sends the author to look for a mistake that is not there.
- **Evidence:** Probe: the canary admin step `'Ask the {site} administrator for an approval code.'` passes load check 1 and fails `K-MANIFEST.zz-canary` with `expected 'Ask the {site} administrator …' not to match /\{[^{}]+\}/`. The S7 text tasks (LA-E1-09, LA-E1-10) move more texts into manifests, so a `{site}` text is likely.
- **Suggested fix:** Build the fill values from `TEXT_PLACEHOLDERS` (one sample value per name), so a new placeholder needs no test edit. At a minimum, change `platform` to `site`.

### B-LA-E7-01-04 — MINOR — The canary does not follow the channel folder rules, so it is a poor template

- **File:** `tests/ltiaas/canary/zz-canary/manifest.ts:4`, `:100-103`; `tests/ltiaas/canary/zz-canary-admin/manifest.ts`; both canary folders (no `README.md`); compare `packages/channels/moodle/manifest.ts:73`.
- **Problem:** `zz-canary/manifest.ts` imports and re-exports the manifest of the other canary folder. LA-ADR-01 D1 forbids both: a `manifest.ts` imports only kernel types, and a channel never imports another channel folder. Nothing reads the re-export. F3 does not lint `tests/**`, so nothing catches this. The canary manifests also end with `as const` only, while the product manifests end with `satisfies ChannelManifest`. So a copy gets no type check. Neither folder has the D1 `README.md` (facts and sources). A developer who copies the canary to start a channel copies these gaps, and gets an F3 error in `packages/channels/`.
- **Evidence:** `git grep adminValueCanaryManifest -- tests` finds only the definition, the import and the unused re-export.
- **Suggested fix:** Remove the import and the re-export. Add `import type { ChannelManifest } from '@cogniate/channel-kernel'` and `satisfies ChannelManifest` to both manifests. Add a short `README.md` to each folder ("test-only channel; to start a real channel, copy this folder, change id, names, profiles; facts table"). Keep the test-only values (`simulation-only`, `order: 990`), but name them in the README.

### B-LA-E7-01-05 — MINOR — Hand-kept copies of the kernel types and silent "entry point exists" guards

- **File:** `tests/ltiaas/k0/contract.test.ts:38-136`, `:307-309`, `:518`, `:577-586`.
- **Problem:** The file declares its own `ChannelManifest`, `LoadedChannel`, `ChannelRegistry`, `ProfileRecord` and `ProfileRegistry`, and casts the kernel results to them. The kernel exports these types, and tasks README §3 allows the import. When the kernel changes a field, these copies do not show it. The profile module loads only `if (fs.existsSync(...))`, and the whole K-PROFILE body runs only `if (ltiProfilesMod && profileReg)`. LA-E1-05 has landed, so a rename or move of `profiles/index.ts` now turns K-PROFILE into a silent pass.
- **Suggested fix:** Import the types from `@cogniate/channel-kernel` and `ProviderProfile` from the profiles module. Import `profiles/index.ts` statically, now that it exists. For entry points that do not exist yet (`kernel/ports.ts`), use `it.todo` or `it.skip` with the reason, so the report shows the gap.

### B-LA-E7-01-06 — NIT — Small oddities

- **File:** `tests/ltiaas/k0/contract.test.ts:139`, `:149`, `:703`.
- **Problem:** The test file `export`s `CapabilityGuardSpec` and `CAPABILITY_GUARD_TABLE`, but no other file imports them. `path.join(badCanaryDir, ' package.json'.trim())` is `'package.json'` written in a way that makes the reader stop and think.
- **Suggested fix:** Remove the `export` keywords, or move the table into a shared QA helper if another suite needs it. Write `'package.json'`.

## Not checked

- I did not repeat QA's `npm run check` or the scratch-channel run (AC-02); qa.md records them.
- Lens-A items: if the M1 oracle values are the exact M1 bytes, and if the guard table matches every D3 row.
