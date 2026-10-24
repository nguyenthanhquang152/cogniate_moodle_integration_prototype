# LA-E8-02 walkthrough log: add the channel `acme-lms` with `docs/guides/ltiaas/add-a-channel.md`

Scratch file on branch `nguyenthanhquang152/la-walk` (never merged, not pushed). Walker: Claude Code, Opus 5.5 (xhigh), new to this repository. I used the guide and the files and commands it points to. I did not read `docs/reviews/**`, `docs/team/**`, `docs/architecture/ltiaas/build-decisions-*.md` or old git history.

## 1. Summary

| Item | Value |
| --- | --- |
| Start (UTC, `date -u`) | Sat Oct 24 13:44:56 UTC 2026 |
| End (UTC, `date -u`) | Sat Oct 24 13:53:45 UTC 2026 |
| Total time | 8 min 49 s (§6) |
| Base SHA (step 10.1 item 1) | `3880a1b70d115c03f5a5accc813875332dcee64e` |
| Channel id, profile id, simulator provider id | `acme-lms`, `acme-lms`, `acme-lms-sim` |
| Files added or changed | 8 (the §1 table of the guide only); 3 commits, then this log |
| Places where I left the guide or needed help outside it | **4** (§4, L1 to L4) |
| Places where the guide was unclear or wrong, resolved with the files that it points to | 10 (§5, U1 to U10) |
| Host checks | `npm run check` PASS; F2 PASS (`core = 0, paths = 8`); K0 PASS (163/163); simulator discovery PASS (7 ids, 1 new); kit host check **FAIL 2/25** (§3, §4 L3) |
| Not run | Step 5 (needs a stack; §4 L2); Docker and K1-SIM (QA runs K1-SIM later on this branch); step 11 (optional) |

The times are the `date -u` stamps that I took during the walk. They include my reading and thinking time.

## 2. Time per guide step

| Step | UTC | Time | What I did |
| --- | --- | --- | --- |
| Setup | 13:44:56–13:45:05 | 0:09 | `date -u`; `npm ci` (node_modules was missing; exit 0) |
| Read the guide, §0 | 13:45:05–13:46:34 | 1:29 | Read the guide. §0.2: kind A. §0.3: a named channel (task). §0.4: facts (all design; U1). §0.5: ids `acme-lms`, `acme-lms`, `acme-lms-sim`. Read the example files that the guide names: `packages/channels/brightspace/{manifest,lti-profiles,README,channel.test}.*`, `packages/channels/lti-generic/manifest.ts`, `tests/sim/brightspace/index.mjs`, `tests/sim/hosts.json`, `tests/sim/README.md`, `tests/ltiaas/kit/channels/{brightspace,lti-generic}.json`, `tests/ltiaas/kit/README.md`. Also read kernel types (L1). |
| 1 | 13:46:37 | 0:01 | `mkdir packages/channels/acme-lms`. No `app.ts`, no `portal/`. |
| 2 | 13:46:37–13:47:16 (with 3, 4) | 0:39 for 2–4 | `manifest.ts`: card order 6, `availability: 'ga'`, one `manual` method with `operatorGrant` (no Dynamic Registration; U3), four AGS scopes, capabilities (U2), field defaults on `{siteUrl}`, no `toolRows` (generic 8 rows), texts. |
| 3 | (in 2) | | `lti-profiles.ts`: the guide template, `listOrder: 100`, `productFamily: 'acme'`, `dynamicRegistration: null` (L1). |
| 4 | (in 2) | | `lti.guardedFamilies: [{ family: 'acme', level: 'registration' }]`, UNVERIFIED in the README (U4). |
| 5 | 13:47:16 | 0:00 | Not run (L2). |
| 6 | 13:47:16–13:47:52 | 0:36 | `README.md` (facts table, Live status) and `channel.test.ts` (6 tests, pass). |
| 7 | 13:47:52–13:48:40 (with 8) | 0:48 for 7–8 | `tests/sim/acme-lms/index.mjs` from the template (one provider). Optional `protocol.test.mjs` (5 tests; U7). Discovery check of item 5 after step 8. |
| 8 | (in 7) | | One `hosts.json` entry: `acme-lms-sim`, alias and allowlist `acme-lms.sim.test`. |
| 9 | 13:48:40–13:49:58 | 1:18 | `tests/ltiaas/kit/channels/acme-lms.json` from `brightspace.json` and `lti-generic.json`. Kit host check: FAIL 2/25. Diagnosis and one experiment (L3). |
| 10.1 | 13:49:58–13:50:00 | 0:02 | Three commits (`fe87eb45` channel, `4d12a291` simulator, `337b807d` kit fixture). `git status --short` printed nothing. |
| 10.2 | 13:50:00–13:52:30 | 2:30 | F2, `npm run check` (1:30), K0, discovery, kit host check (results in §3). One extra registry check (L4). |
| 11 | — | 0:00 | Skipped (optional; U10). |
| Log | 13:52:42–13:53:45 | 1:03 | This file; F2 at the log commit for information (§6). |

## 3. Host check results

| Check (guide §10.2) | Command | Result |
| --- | --- | --- |
| Repository check | `npm run check` | **PASS**, exit 0 (13:50:05–13:51:35). lint OK; typecheck OK (all workspaces, `tsconfig.node.json`, `tsconfig.portal.json`); test:unit 205 files, 3323 passed, 5 skipped; test:infra 255/255; test:k0 163/163; `F1 PASS: 0 files with hits, 0 hits`; `F5 PASS: 6 rules ..., 0 hits`. |
| F2 add-channel gate (after 10.1) | `npm run fitness:channel-diff -- --base 3880a1b70d115c03f5a5accc813875332dcee64e --channel acme-lms` | **PASS**: 8 lines (`channel:acme-lms` x4, `tests` x1 for the kit fixture, `sim` x3), last line `F2 PASS: core = 0, paths = 8`. 8 = the number of committed files. Note: this log is a root file; it is committed after this run (§6). |
| K0 contract suite | `npm run test:k0` | **PASS**: 3 files, 163/163, exit 0 (in `npm run check` and again on its own). The output does not name the loaded channels (U9; see L4). |
| Simulator discovery (step 7 item 5) | the `node --input-type=module -e ...` command of the guide | **PASS**: `acme-lms-sim blackboard-sim brightspace-sim canvas-sim-cloud canvas-sim-self generic-sim moodle-sim` (the 6 existing ids and one new id). |
| Kit host check | `LA_LEVEL=k0 npx --no-install vitest run --config tests/ltiaas/kit/vitest.config.mts` | **FAIL**: 23 passed, 2 failed (25). Both failures are L4 self-tests in `tests/ltiaas/kit/kit.k0.test.ts` (§4 L3). With `expect.guardedFamilies: []` in the fixture (temporary experiment, reverted): 25/25 pass. |
| K1 kit on the simulator | (QA, Docker window) | Not run by me (task rule). Pending QA SIM on this branch: `LA_RUN_DIR=/tmp/kit-run QA_KIT_CHANNELS=acme-lms QA_TASK=K1 npm --prefix tests run acceptance:api` from `/repo` in the `e2e` container. |

Other host checks that I ran (not in the §10.2 table):

- `npx --no-install vitest run packages/channels/acme-lms`: 6/6 pass (step 6).
- `node --test tests/sim/acme-lms/protocol.test.mjs`: 5/5 pass (step 7 item 4).
- `node --test 'tests/sim/core/*.test.mjs' 'tests/sim/*/protocol.test.mjs'` (the self-test command of `tests/sim/README.md`): 64/64 pass, including `tests/sim/core/loading.test.mjs` 36/36 (U5).
- Registry load (L4): `loadChannelFolders` plus `buildChannelRegistry` from `@cogniate/channel-kernel` load `acme-lms` on both sides (`lti`, `app`) with no load-check error. The computed capabilities and the six legacy flags of `acme-lms` equal the kit fixture values. `ownerOfFamily('acme')` = `acme-lms`.

## 4. Places where I left the guide or needed help outside it (4)

**L1. Steps 2 and 3: a channel with no Dynamic Registration.** The guide says "`dynamicRegistration`: only if the LMS supports Dynamic Registration; leave it out otherwise". The guide does not say what "left out" means. I read `packages/channel-kernel/src/profiles.ts` (not linked by the guide): an absent trait means "no limit", and `null` means "no Dynamic Registration". The `blackboard` profile (a channel with no Dynamic Registration) has `dynamicRegistration: null`. So I wrote `dynamicRegistration: null`, which is not what the guide says. I also read `packages/channel-kernel/src/capabilities.ts`, `manifest.ts` and `legacy-wire.ts` for three facts that the guide does not give: the capability catalog and the source of each value (`registration.dynamic` is false when the manifest has no `dynamic` method); the derivation of the six legacy flags (needed for `expect.legacyFlags`, because `brightspace.json` has `dynamicRegistration: true`); and the manifest schema (card fields, field `default` placeholders). Proposed guide fix: in step 3, write "`dynamicRegistration: null` when the LMS has no Dynamic Registration". In step 9, give the rule: no `dynamic` method gives `registration.dynamic: false`, `binding.authority: { manual: operatorGrant }` and `legacyFlags.dynamicRegistration: false`.

**L2. Step 5: not run.** The list command needs a running stack and the `tenant` helper of the operator runbook §1. The task does not allow Docker or a stack. Acme LMS is simulated only, so no real Moodle `standard` platform can sign `acme`. I shipped the guard with the move not done. The guide says "move first, then guard". Pending QA (AC-LA-E8-01-03). Proposed guide fix: tell a walker of a simulated-only LMS what to do at step 5 (for example: "no live platform can sign the family; record step 5 as not applicable").

**L3. Step 9 and §10.2: the kit host check fails with a new registration-level guard.** The guide says that the check passes "with your fixture discovered and its sources audited". The guide also says that a sixth fixture gives 16 of 16. My run: 23 passed, 2 failed (25 tests). To find the cause, I read `tests/ltiaas/kit/kit.k0.test.ts`, which the guide does not point to:

1. `A-LA-E7-06-07 / B-LA-E7-06-02 (L4): fixture guard data equals LA-ADR-01 D6, and the L4 selector ...` expects `table('brightspace')` to equal `['canvas:launch_guarded:refuse', 'moodle:unguarded:pass']`, and a note that says no other channel guards a family at the registration level. With `acme-lms`, the selector also gives `acme:registration_guarded:warn_passthrough` for `brightspace`.
2. `A-LA-E7-06-07 / B-LA-E7-06-02 (L4): the L4 case body passes on a check-14 fake ...` fails with `L4 family guard on "brightspace": expected an LTI log family_guard_mismatch for foreignFamily="acme" (registration_guarded) on "brightspace", got 0`. The check-14 fake does not know a new guarded family.

Experiment: I set `expect.guardedFamilies` to `[]` in a working copy of the fixture, ran the check (25/25 pass), then restored the file. No commit has this change. So the kit is open-world for a fixture with no guard, but closed-world for a new registration-level guarded family. I did not change `kit.k0.test.ts`: it is QA-owned and not in the §1 table. I kept the guard because §0.3 and step 4 lead to it, and `brightspace` guards a family that is also UNVERIFIED. The K1 suites do not run `kit.k0.test.ts` (`LA_LEVEL` k1sim selects the 7 suite files only). So this failure does not block the K1-SIM run of QA. Proposed fixes: (a) QA makes the two L4 self-tests open-world (compute the expected table from all fixtures; give the check-14 fake every registration-level family of the fixtures); (b) the guide says in step 4 or step 9 that a new guard changes the L4 probe table of every other channel (each now also gets an `acme` probe), and it updates the stale "16 of 16" (now 25 tests).

**L4. §10.2: one extra check outside the guide.** The K0 output does not show that `acme-lms` was loaded (U9). I ran a short `tsx` script (in `/tmp`, deleted after use) that calls `loadChannelFolders` and `buildChannelRegistry`, and compared the computed capabilities and legacy flags with the kit fixture (§3). I also read the `scripts` block of the root `package.json` to see what `npm run check` runs. I did not need this to finish the steps, but I needed it to trust "with your channel loaded".

## 5. Places where the guide was unclear or wrong (resolved with the files it points to) (10)

- **U1 (§0.4).** No rule for an LMS with no vendor source (simulated only). I chose standard LTI 1.3 values: issuer = site URL (origin, no path), every endpoint on the issuer host (`/lti/auth`, `/lti/token`, `/lti/jwks.json`), token audience = token URL, family `acme`, string deployments, frame launch. Status: design or **UNVERIFIED (simulated only)** in the README.
- **U2 (step 2, `capabilities`: "copy them").** The two example channels do not agree. `brightspace` has no `content.multiple` and no connection check. `lti-generic` has `content.multiple: true` and `connectionCheck: true`. I chose `content.multiple: true` (Acme speaks standard Deep Linking 2.0, as `lti-generic`) and no connection check (as `brightspace`). A rule in the guide would remove this choice.
- **U3 (step 2, `registration` and `bindingFields`).** The snippet shows both methods and the table says "the three `dynamic` fields". Only the `registration` row says "`dynamic` ... if the LMS supports Dynamic Registration". I removed the `dynamic` method and the three `dynamic` binding fields. The guide should say that both go together.
- **U4 (step 4, guard for an LMS with no Dynamic Registration).** Guard effect 3 (a refused Dynamic Registration on `lti-generic`) cannot happen for Acme. Effects 1 and 2 still apply. The guide does not say whether to guard in this case. I guarded (see L3 for the cost).
- **U5 (step 7, NOTE).** The NOTE says `tests/sim/core/loading.test.mjs` fails with a seventh provider. It does not fail: 36/36 pass. The test `committed tests/sim/hosts.json matches all 6 providers ...` now calls `verifyOpenWorldSimManifest`; only its title still says 6. The NOTE is stale.
- **U6 (step 7).** The guide tells me to follow `tests/sim/README.md`, and that README still says "Copy `tests/sim/generic/index.mjs` to start". The guide forbids that copy. I followed the guide (template, one provider).
- **U7 (step 7 item 4, optional protocol test).** `tests/sim/brightspace/protocol.test.mjs` tests UUID deployments, an off-host token, a fixed audience and Dynamic Registration. Acme has none of these, so "change its import ... and every Brightspace host" means a rewrite. I wrote 5 tests: loader and hosts, launch claims (family, deployments, iframe, AGS and NRPS URLs), token audience = token URL with AGS score and NRPS, Deep Linking (claim data, no `sub`), and no Dynamic Registration route.
- **U8 (step 9, §10.2).** "16 of 16" is stale: the kit host check has 25 tests now.
- **U9 (§10.2, K0).** "pass, with your channel loaded": the K0 output does not name the channels, so a walker cannot see the "loaded" part (L4).
- **U10 (step 11).** Optional; skipped. No real Acme admin UI exists, and the channel README holds the facts and the admin steps.

Other notes:

- I kept my notes outside the repository until the end, so that `git status --short` printed nothing at step 10.1 and F2 counted only the 8 files of the §1 table. This log is a root file, committed last. An F2 run at the log commit would also list this file (§6).
- The guide header links `docs/reviews/LA-E8-01/*` and step 9 links `docs/reviews/LA-E7-06/qa.md`. I did not open them (task rule). The steps did not need them.
- Step 10.2 lists F2 as `--base <the SHA or branch of 10.1 step 1>`. I used the full SHA. The guide was clear here.

## 6. End

- Log commit: the last commit on the branch, after `337b807d`.
- F2 at the log commit (information only, 13:53:42): `F2 FAIL: core = 1, paths = 9`. This log is a root file, so F2 classes it as core. This is expected for a scratch log. For the channel result, run F2 at `337b807d` (the commit before this log): `F2 PASS: core = 0, paths = 8` (§3). A QA rerun on this branch must ignore this file, or run `git checkout 337b807d` first.
- Total time: 13:44:56 to 13:53:45 = 8 min 49 s (setup and steps: 13:44:56–13:52:30, 7 min 34 s; log: 13:52:42–13:53:45).
- End (UTC, `date -u`): Sat Oct 24 13:53:45 UTC 2026
