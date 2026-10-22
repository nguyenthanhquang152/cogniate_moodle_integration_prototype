Verdict: CHANGES_REQUESTED
Round: 1

# LA-DESIGN review, Reviewer-B (lens: "Can a human team own it?")

Reviewer-B, milestone LA, gate G-DESIGN. Design SHA `19476fc` (15 files under `docs/architecture/ltiaas/`), plan v1.2, `tests/ltiaas/TEST-STRATEGY.md` at the same SHA. File references are relative to the repo root; `ltiaas/` means `docs/architecture/ltiaas/`. "(inferred)" marks my own reasoning without a direct source.

Counts: **0 BLOCKER, 8 MAJOR, 7 MINOR, 4 NIT.**

## Summary

The design is strong in the places where a human team usually loses control. The refactor is a chain of small strangler steps, each with its own proof (LA-ADR-04 D1). Golden outputs make "no behaviour change" a checked claim. Frozen wire names are listed, and the `LA-IC-nn` ids make each intended change visible. Migrations are additive with a migration test each. The operability file is close to a runbook. A2's decisions all have observable acceptance points. Load checks fail closed.

The main problems for my lens are in the channel kernel itself, the part that must make "new LTI LMS = one folder" real:

1. The channel folder is not a workspace, and the design does not say how its code is typechecked, tested, linted and styled (B-LAD-01).
2. The portal import rule and the extension ports (P5–P7, P11, the "port context") are not specified well enough to move today's Moodle, Canvas and Blackboard code (B-LAD-02, B-LAD-03).
3. Adding a named channel can break live generic connections, and `brightspace` still needs kernel work that E2-K does not list (B-LAD-04, B-LAD-05).
4. The parallel-lane claim of LA-ADR-04 is not true for several files (B-LAD-06).
5. Two Must items depend on a test level that the README marks Could, and plan measure 3 needs a Lead decision that is not recorded (B-LAD-07, B-LAD-08).

## Checks that the brief asks for

| Check | Result |
| --- | --- |
| Plan §1 goal | Met in structure (registry, manifest, capabilities, authority strategies, frozen projection). At risk: B-LAD-01, B-LAD-04, B-LAD-05. |
| §4 measure 1 (0 core files for the new LMS) | At risk: B-LAD-05 (E2-N needs kernel parts that E2-K does not list); B-LAD-01 (the canary proves only the Node loader, not typecheck, tests or the portal). |
| §4 measure 2 (no LMS name in core) | Plan is clear (S2 ratchet, S9 = 0). Open: the end state of the `config.ts` exception (B-LAD-19) and the DTO field `moodleCourse` (B-LAD-03). |
| §4 measure 3 (M1, M2, T7 assertions unchanged except LD-1) | Not met as written: B-LAD-08. |
| §4 measures 4, 6 | Covered (K0 + K1 for both new channels; E5 acceptance points AP-06-xx). |
| §4 measure 5 (guide, < 1 day) | Depends on B-LAD-01 and B-LAD-05 (the per-channel work is code, not data, today). |
| Every Must item decided | Yes, except the shapes of P5–P7, P11 and the port context (B-LAD-02, B-LAD-03). |
| Human decisions recorded | LA-H21..LA-H24 are in plan v1.2. The Lead decision for the `LA-IC` test changes is missing (B-LAD-08). |
| A1 / A2 consistency | Mostly consistent. Open: `app.ts` purity vs port context (B-LAD-03), K2 priority (B-LAD-07), stale open-item notes (B-LAD-16). |
| Parallel lanes without shared files | No: B-LAD-06. |

## Findings

### B-LAD-01 — MAJOR — Channel folders get no typecheck, no unit-test run, no lint profile and no Tailwind scan

- **File:** `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md:22` (D1), `:156` (D4), `:158-163` (load checks), `:174`.
- **Problem:** The design moves code out of three typed and tested workspaces into `packages/channels/*/`, which is not a workspace and is loaded only by `import()` with a computed path or by `import.meta.glob`, but it does not say how that code is typechecked, unit-tested, linted and styled.
- **Evidence:**
  - `tsconfig.json:3` includes only `vitest.config.ts`. Each workspace typechecks only its own `src` (`services/cogniate-app/package.json:9`, `apps/portal/tsconfig.json:10` `"include": ["src", "vite.config.ts"]`). TypeScript does not follow a computed `import()` or `import.meta.glob`, so no `tsc` run sees `packages/channels/*/**` (inferred from TypeScript module resolution).
  - `vitest.config.ts:7` includes only `packages/*/src/**`, `services/*/src/**` and `apps/*/src/**`. The tests that live next to channel code today (`services/cogniate-app/src/providers/canvas.test.ts`, `services/lti-service/src/profiles/canvas.test.ts`, `services/lti-service/src/profiles/registry.test.ts`, `apps/portal/src/connect/canvas/canvas.test.ts`, `apps/portal/src/connect/blackboard/blackboard.test.ts`) stop running when they move into a channel folder.
  - `apps/portal/src/styles.css:1` has `@import "tailwindcss";` and no `@source` line. Tailwind v4 scans the files under the build base (the portal workspace), so utility classes in `packages/channels/*/portal/**` are not generated (inferred from the Tailwind v4 source-detection rules). Today's modules use many arbitrary classes (for example `apps/portal/src/connect/Connect.tsx:30-42`). S8 promises "none visible" (LA-ADR-04:47); this failure is silent.
  - `LoadedChannel.ltiProfiles` is `unknown[]` (LA-ADR-01:174), and load checks 1–6 validate the manifest, ids, families, capabilities and authority (:158-163), but not the profile shape. So a profile typo (for example a missing `privacyFloor` trait) is caught neither at compile time nor at load time. Profiles are trust data ("A change to a profile is an architecture change", ADR-011 §6).
  - D1 says "no infra change is needed" (:22), but that covers only the Docker mounts. The canary (F4, `ltiaas/README.md:116`) proves only the Node loader of K0, not typecheck, tests or the portal glob.
- **Suggested fix:** In E1 step S2, add the build model once, so that no later channel edits a shared build file (F2): (1) a `tsconfig` for channel folders, with a Node part (`manifest.ts`, `lti-profiles.ts`, `app.ts`, `app/**`) and a portal part (`portal/**`, `jsx`, DOM libs), run by `npm run typecheck`; (2) the Vitest include `packages/channels/*/**/*.test.{ts,tsx}`; (3) ESLint blocks for the channel globs; (4) the Tailwind `@source` line and the Vite `server.fs.allow` entry for `packages/channels`; (5) load check 7: every profile passes one `ProviderProfile` schema with a closed trait set. Add one QA probe: a type error and a failing test in a scratch channel folder fail `npm run check`.

### B-LAD-02 — MAJOR — The portal import rule and P11 cannot carry the modules that S8 moves

- **File:** `ltiaas/adr/LA-ADR-01-channel-kernel.md:68` (import rule), `:215` (P11), `:291` (D9).
- **Problem:** A channel portal module may import only kernel types, `apps/portal/src/ui/**` and its own manifest, but the Canvas and Blackboard modules that S8 moves "with no visible change" import the portal API client, hooks, DTO types, LMS texts, error helpers and wizard types, and P11 has no interface sketch that replaces them.
- **Evidence:**
  - `apps/portal/src/connect/canvas/CanvasBinding.tsx` imports `../../api.ts`, `../../hooks.ts`, `../../types.ts` and `../provider-errors.tsx`. `apps/portal/src/connect/blackboard/BlackboardCreate.tsx` also imports `../../lms.ts` and `react-router`. `apps/portal/src/connect/canvas/CanvasWizard.tsx` imports `../wizard-types.ts`.
  - `ProviderWizardProps` (`apps/portal/src/connect/wizard-types.ts:11-18`) uses `Connection` and `LmsProvider` from `apps/portal/src/types.ts`, which a channel module may not import.
  - The Moodle flow that also moves (`CreateConnection.tsx`, `DynamicSetup.tsx`, `ManualSetup.tsx`, `WebServices.tsx`, `courses/MoodleBackup.tsx`, `MoodleCourse.tsx`, `CoursePackage.tsx`) is larger and uses the same modules.
  - P11 is one table row ("Wizard parts, teacher steps, extra panels", :215). Only P2 has a sketch (:219-238). A file under `packages/` that imports `apps/portal/src/ui/**` is also an upward dependency with a deep relative path, and the design gives no alias.
- **Suggested fix:** Sketch P11 `ChannelUiModule` in LA-ADR-01 D5, like P2: the props and one portal context that the shell gives (named API calls, the connection and provider view types, the error-notice helper, navigation). Put the shared types in `@cogniate/channel-kernel` or in one named portal SDK folder with a path alias, and add that SDK to the D1 import table, so F3 can enforce it.

### B-LAD-03 — MAJOR — Extension ports P5–P7 and the "port context" are named, not designed

- **File:** `ltiaas/adr/LA-ADR-01-channel-kernel.md:209-211`, `:285`, `:327`; `ltiaas/adr/LA-ADR-07-security-and-tenancy.md:48`, `:92-95`; `ltiaas/adr/LA-ADR-04-refactor-and-migration.md:57-67`.
- **Problem:** Step S6 (Must, F1.7) moves the most complex Moodle code behind P5–P7 and a "port context", but the design gives no interface for them, no shape for the storage handle "limited to these tables and to the connection's library", no rule for channel fields on core DTOs, and two files disagree on whether `app.ts` gets a context.
- **Evidence:**
  - P5 `ExtensionRoutes`, P6 `PublishHook` and P7 `PackageExporter` are one row each (LA-ADR-01:209-211). `PortContext` is a parameter type in LA-ADR-07:92-95 but is defined nowhere. LA-ADR-07:48 points to "A1, LA-ADR-01 consequences", and that text says only "through the port context" (LA-ADR-01:327).
  - LA-ADR-01:327 keeps `app.ts` pure (no database, no LTI call). LA-ADR-07:48 says the kernel gives `app.ts` **and** `app/` code a port context.
  - The course shell reads the encrypted web-services token, calls Moodle web services and writes `publication.moodle_course_*` inside the publish route (`services/cogniate-app/src/app/publications.ts:56-96`). The publication DTO carries `moodleCourse { id, idnumber, url }`, `shellStatus` and `shellError` (`docs/architecture/contracts/cogniate-app-api.md:888`). Core uses `moodleCourse` in 7 lines of `services/cogniate-app/src/domain/publications.ts` and in the portal (`apps/portal/src/courses/MoodleCourse.tsx`, `PublishDialog.tsx`). `moodleCourse` is not in the frozen list D2 (LA-ADR-04:57-67), and no port lets a channel add a field to a core DTO.
  - `.mbz` is a course-version feature without a connection (LA-ADR-01:130; ADR-011 §11 note), so a context "limited to the connection's library" does not fit P7.
- **Suggested fix:** Add sketches for `PortContext`, `ExtensionRoute`, `PublishHook` and `PackageExporter` to LA-ADR-01 D5. Decide: what the context holds (library id; connection id only for connection ports; a narrow repository object, not a SQL handle; the guarded outbound client; a reader for sealed secrets); how a channel adds DTO fields (for example frozen `legacy-wire.ts` entries for `moodleCourse`, or one `extensions` member); where `createMoodleCourse` is parsed. Remove the `app.ts` contradiction. If this is too large for E1, record the alternative explicitly: the course-shell and `.mbz` code stays in one kernel-owned module with a reviewed F1 exception until LE (this needs a Lead decision, because it touches plan measure 2).

### B-LAD-04 — MAJOR — A new named channel silently breaks existing generic and `standard` connections to its LMS

- **File:** `ltiaas/adr/LA-ADR-02-generic-lti-channel.md:24` (D1), `:81`, `:98` (D5 item 5); `ltiaas/adr/LA-ADR-01-channel-kernel.md:250` (generic check 14).
- **Problem:** When a new channel guards the product family of an LMS, every existing `lti-generic` or `standard` connection to that LMS stops working at once (`PROVIDER_PROFILE_MISMATCH` on every launch), and the design has no migration path, warning or gate for it.
- **Evidence:**
  - Generic check 14: "If a channel guards F, the platform profile must belong to that channel; else `PROVIDER_PROFILE_MISMATCH`" (LA-ADR-01:250). The generic channel refuses "every guarded product family of another channel" (LA-ADR-02:24).
  - LA-ADR-02:7: most LMSs "will never get a named channel. They need a generic LTI 1.3 channel." So the LMSs that later get a named channel are exactly the LMSs with live generic connections.
  - Example: a D2L school connects through `lti-generic` (DR `self`, or manual with a grant). Later the `brightspace` folder adds `guardedFamilies: ['desire2learn']` (LA-ADR-02:81). All launches of that school now fail. The same applies to a Sakai site that connects as `standard` today (its endpoints are on the issuer origin) when a later `sakai` channel guards `sakai`.
  - The add-channel gate F2 counts this change as "channel folder only" (`ltiaas/README.md:114`), so the gate shows it as safe. The guide sources (README F8.1, :298) do not mention it.
- **Suggested fix:** Decide the rule in LA-ADR-01 D6 and LA-ADR-02 D1, and put it into the guide content (F8.1). Options: (a) a guard applies only to platforms created after the guard exists (store the guard set or a guard version on the platform at create); (b) a kind A named channel guards its family only against `standard` (manual `self`), not against `lti-generic`, whose manual path already needs a grant and whose DR is proven by the platform (Reviewer-A should confirm the security side); (c) the add-channel procedure lists the existing connections with that family and moves them with an operator step before release. Add one unit or K0 case for the chosen rule.

### B-LAD-05 — MAJOR — `brightspace` still needs kernel work that E2-K does not list, so measure 1 is fragile

- **File:** `ltiaas/adr/LA-ADR-02-generic-lti-channel.md:80`, `:88` (D4), `:121` (D8); `ltiaas/adr/LA-ADR-01-channel-kernel.md:28`, `:69`, `:112`.
- **Problem:** Two things that the `brightspace` folder needs are not in the E2-K kernel scope, so the E2-N task must either edit core (F2 fails: plan §4 measure 1) or copy the `lti-generic` adapter.
- **Evidence:**
  - D4 says that the portal pre-fills the D2L defaults (`{siteUrl}/d2l/lti/authenticate`, the token host, the audience; LA-ADR-02:80) and that `brightspace` has no portal module (:88). But `FieldSpec` is `{ key, label, kind, required, method? }` (LA-ADR-01:112): it has no default value.
  - The manual binding of `lti-generic` and `brightspace` is the same: the same 8-key strict body (`ltiaas/contracts/cogniate-app-api-delta.md:89`), the same `exclusive_platform` target with admin values, the same staged create. A channel folder must not import another channel folder (LA-ADR-01:69), and the kernel has no shared admin-value setup adapter. So `packages/channels/brightspace/app.ts` repeats the code of `lti-generic/app.ts`. `app.ts` is required in D1 (:28), while `portal/` is optional (:30).
  - Plan §1 says "A new LTI LMS is one adapter folder plus profile data". With the current design it is one folder plus copied adapter code.
- **Suggested fix:** In E2-K, add `default` (a template with `{siteUrl}`) to `FieldSpec`, and one kernel default `ConnectionSetup` for admin-value profiles (tool configuration rows from manifest data, the 8-key body, the target and the staged create). Make `app.ts` optional when this default fits. Then a kind A named LMS is data only (manifest, profiles, README). Add an E2-K exit check: a canary folder with an admin-value profile and no `app.ts` passes K0.

### B-LAD-06 — MAJOR — The parallel-lane claim is not true: several files need edits from two or three lanes in one wave

- **File:** `ltiaas/adr/LA-ADR-04-refactor-and-migration.md:51`; `ltiaas/README.md:167-177` (§6); `ltiaas/data-model.md:13`.
- **Problem:** LA-ADR-04 says "S3 and S8 can run in parallel with S4–S6 (different lanes, different files) … E4 needs S4 only", but several files need edits from two or three lanes in the same wave, against charter-LA §3 ("Two lanes never own the same file").
- **Evidence** (wave B2 of plan §5.3: K = E1 rest, R = E4, L = S3 and E3 platform storage, S = E5 Must 5–7; E3 rest and E2 in B3):
  - `services/cogniate-app/src/domain/score-syncs.ts`: S4 (K) changes the disabled rule at `:29` (`ltiaas/data-model.md:68`); E4 (R) replaces the module with the outbox on `record_dispatch` (LA-ADR-03 D4).
  - `services/cogniate-app/src/tool-pages/launch.ts`: S5 and S7 (K) remove `lmsOfProfile` and `lmsOfFamily` (`:62`, `:89-91`) and the Moodle texts; E4 (R) writes the placement in the launch transaction (LA-ADR-03 D2); E3 D2 (L) accepts a launch without context (`:149`, LA-ADR-05:127).
  - `services/cogniate-app/src/app/results.ts`: S4/S5 (K) change the disabled rule by authority (`:47`); E4 (R) adds the `records.readBack` guard and moves the read-back (LA-ADR-03 D8).
  - `services/lti-service/src/lti/registration.ts` and `http/routes/registration.ts`: S (B1) adds the account resolver and the session cap (LA-ADR-06:102, :130); E2-K adds the DR fixes (README §6 gives E2 to "K, L"); L adds `complete.scopes` and Canvas DR (LA-ADR-05 D4, D6).
  - `services/lti-service/src/lti/login.ts`, `lti/launch.ts`: S adds the resolver, the status gate and the rate limit (LA-ADR-06 D1, D2); L adds the platform storage launch (LA-ADR-05 D1).
  - `services/lti-service/src/config.ts`, `packages/shared/src/config.ts`, `services/lti-service/src/http/app.ts`: L (S3 removes `PUBLIC_MOODLE_URL`; the storage-check route) and S (operator listener, `TRUSTED_PROXY_CIDRS`, key ring).
  - Channel folders: `packages/channels/*/manifest.ts` gets values from K (E1, E2), L (E3: `registration.scopes`, `content.multiple`, `content.ungraded`, the Canvas `dynamic` method) and P (E6 `setup.connectionCheck`). `packages/channels/canvas/app.ts` gets the JSON route from K (S6) and the scopes and `link_selection` from L (LA-ADR-05 D4, D5).
  - LTI service migration numbers are left to P3 (`ltiaas/data-model.md:13`), while lanes K/L, L and S each add LTI migrations.
- **Suggested fix:** Correct LA-ADR-04:51. Add a short "file owner per wave" table to README §6, or give it to P3 as a required input: one owner per hot file, the order of edits inside a wave, and the migration numbers of both services. One split that works (inferred): L owns `services/lti-service/src/lti/**` and the protocol and registration routes; S owns `http/app.ts`, `http/auth.ts` and the new operator and store modules, and delivers the resolver and the rate-limit hook as new modules that L calls; K owns `manifest.ts` and `app.ts`; L owns `lti-profiles.ts`; P owns `portal/**`; R starts the launch and score files only after S4–S5 land.

### B-LAD-07 — MAJOR — Two Must items have their only end-to-end proof in K2, which the README marks Could

- **File:** `ltiaas/README.md:291` (F7.7); `ltiaas/adr/LA-ADR-01-channel-kernel.md:291`; `ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md:114`, `:328`; `ltiaas/adr/LA-ADR-02-generic-lti-channel.md:148-153`.
- **Problem:** A scope cut of Could items would remove the only proof of two Must items, because README F7.7 says "K2 browser checks | Could".
- **Evidence:**
  - F1.9 (Must): the shell renders the wizard from the manifest, and "A new channel needs no module" (LA-ADR-01:291). The three baseline channels keep their own modules, so only `lti-generic` and `brightspace` use the generic wizard. LA-ADR-02 test impact (:148-153) has no UI test; the only UI proof is K2 U2 and U3 (`tests/ltiaas/TEST-STRATEGY.md` §2.4, §8 E2 row).
  - F3.1 (Must, platform storage): AP-05-03 and AP-05-06 are K2 cases (LA-ADR-05:114, :328).
  - The QA strategy treats K2 as part of E7 Must (`tests/ltiaas/TEST-STRATEGY.md` §0, rows E3 and E7), so README and QA disagree. Plan risk control: "the Lead cuts Should items at the end of B2 if Must items slip" (plan §7); a Could item goes first.
- **Suggested fix:** In README F7.7, mark K2 U2, U3 and U4 as Must (they prove Must items) and keep the other K2 cases Could. Add one cheap Author test for the shell: a portal Vitest test with Testing Library (already a portal dev dependency, `apps/portal/package.json:14`) that renders the manifest wizard for every registered manifest.

### B-LAD-08 — MAJOR — Plan measure 3 cannot pass as written; the Lead decision for the `LA-IC` test changes is not recorded

- **File:** `ltiaas/adr/LA-ADR-04-refactor-and-migration.md:125` (D8); `ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md:184`, `:317`; `docs/team/ltiaas/plan.md` §4 measure 3, §6.1.
- **Problem:** The design plans frozen-assertion changes for Must items beyond the LD-1 rewrite, but plan measure 3 allows only LD-1, and no Lead decision extends it.
- **Evidence:** Plan §4 measure 3, required outcome: "M1, M2 and T7 pass. Their assertions do not change, except the closed-list rewrite of E0, which both reviewers approve." LA-ADR-04 D8 says "The Lead approves each test change as one reviewed list, like LD-1" (:125), and lists LA-IC-04 (Must, D-8: "M1 Canvas JSON rows, T4b1 and T7 tool-row checks", :132), LA-IC-12 (Must, DL Cancel: "tests that click the only picker button; a test that expects `400` for an empty list", :140) and LA-IC-08 (Should). Plan §6.1 records LD-1 and LD-6 (only the P5 fixture). The plan's own D-8 input (E3 Must) already needs the row-13 assertion change.
- **Suggested fix:** The Lead records one decision (for example LD-9: "an `LA-IC` id may change frozen assertions as one reviewed list, approved by both reviewers") and changes measure 3 to "… except the LD-1 rewrite and the reviewed `LA-IC` lists". No design change is needed; only the record is missing.

### B-LAD-09 — MINOR — Two job runners with the default instance id are neither refused nor tested

- **File:** `ltiaas/adr/LA-ADR-03-learning-record-core.md:169`, `:175`, `:206`, `:215`; `ltiaas/operability.md:31`, `:86`.
- **Problem:** The design says that a second worker becomes safe, but nothing stops two runners with the same instance id, and no planned test runs two runners on one database.
- **Evidence:** The default `JOB_INSTANCE_ID` is `app-1` for every app process (operability.md:31). At start, a runner "takes back at once the leases of its own instance id" (LA-ADR-03:169). The web process runs the runner by default, and `npm run worker` runs "the same code" (:175); no setting switches the web runner off. So the documented option "The app worker may run apart" (operability.md:86) with the default id gives two runners that both own the `app-1` leases: each start marks the other's live sends uncertain, and both may record results. The guard is only text ("only with a distinct `JOB_INSTANCE_ID`"). The test impact (:215) has single-runner lease rules only, but the consequence says "A second worker instance becomes safe (R4 B-2)" (:206).
- **Suggested fix:** (1) A runner keeps a heartbeat row per instance id and refuses to start when the same id is live (`job_instance_conflict`). (2) `npm run worker` needs the web runner switched off (for example `APP_JOB_RUNNER=off`); the `production` profile refuses the other combination. (3) One Author unit test: two runners with distinct ids on one temporary SQLite file and one due row give exactly one `beginSend`; the second runner takes the row only after `lease_until`.

### B-LAD-10 — MINOR — One fairness partition for every Blackboard school

- **File:** `ltiaas/adr/LA-ADR-03-learning-record-core.md:102`, `:172-173`; `ltiaas/adr/LA-ADR-04-refactor-and-migration.md:99`.
- **Problem:** The `lti-ags` partition key is the LTI platform id, so all Blackboard schools (one shared platform) share one partition with `perPartition: 1`, and one throttled or slow Learn host pauses grade return for every Blackboard school.
- **Evidence:** `partitionKey` = "the LTI platform id of the connection" (LA-ADR-03:102); for a shared platform, the `lti_platform_id` of the reservation (LA-ADR-04:99). `perPartition` 1 (LA-ADR-03:172). A `429` sets `not_before` on every pending row of that partition (:173). Blackboard AGS calls go to each school's Learn host (ADR-011 §6, site URL on the deployment). The E4 goal is "one slow platform no longer delays the other platforms" (LA-ADR-03:206, R4 B-1).
- **Suggested fix:** Use (platform, deployment) as the partition key for shared platforms, or the AGS host. Say whether a `429` from the shared token gateway (all schools) and a `429` from one Learn host (one school) pause different partitions.

### B-LAD-11 — MINOR — R1 before every E1 step is not proportional

- **File:** `ltiaas/adr/LA-ADR-04-refactor-and-migration.md:111` (D6 tiers), `:40-48` (proof column).
- **Problem:** R1 (about 40 min of the scarce SIM slot) is required before the QA PASS of every E1 step, also for steps that change no runtime path.
- **Evidence:** "R1 before each E1 step's QA PASS: M1 `--phase sim --provider all` (394 rows) and M2 (64)" (:111). QA estimates about 40 min per R1 (`tests/ltiaas/TEST-STRATEGY.md` §4.4). Nine steps give about 6 h of SIM slot. S1 is one Zod line (proof: golden `GET /app-api/lms-providers`, :40). S2 adds kernel code that no route uses yet (:41). S7 changes texts only (golden G4, :46). S9 turns checks on (:48). Plan LD-4: "harness work only when an AC needs it; one full regression gate at the end of each wave". LD-2 allows 2 stacks.
- **Suggested fix:** Require R1 only for the steps that change a runtime path (S3, S4, S5, S6, S8, and E4). For S1, S2, S7 and S9, use R0 plus the golden compare of the step. The wave-end gate covers the rest.

### B-LAD-12 — MINOR — "Core" has two meanings

- **File:** `ltiaas/terms.md:22`; `ltiaas/README.md:79-84`, `:101-107`, `:163`.
- **Problem:** "Core" means "all product code outside the channel folders" (terms §1, the F1/F2 scope, which includes the kernel and the drivers) and also the "Core" layer (library, course, …) that "must not … know LTI message details" (README §3), so a new developer cannot tell from a path which rules apply.
- **Evidence:** terms.md:22 vs README:81. README:83 puts the LTI driver in `tool-pages/`, `clients/lti-client.ts` and `domain/launch.ts`, and README:163 keeps these paths (LA-ADR-04 D9). The layer rule "know LTI message details" has no check, and `attempt.resource_link_id` stays a core column (LA-ADR-03:69).
- **Suggested fix:** Use two words, for example "shared code" for the F1/F2 scope and "domain core" for the layer. Add one table "app path → layer" to README §5. Say that the layer rules other than N1–N8 are review rules in LA.

### B-LAD-13 — MINOR — Migration `015` mixes two epics, and its number does not match its landing order

- **File:** `ltiaas/data-model.md:11`, `:15`, `:192`.
- **Problem:** `015` holds an E5 Must table and an E6 Could column, against the rule in the same file, and it lands in wave B1 before `014` (wave B2).
- **Evidence:** data-model.md:11: "`015_app_audit.sql` | E5 (app part) | … | `audit_event`; `connection.artifact_key_kid` (E6)". :15: "each file keeps one epic". §5 (:192) adds the E6 column to `015`. Plan §5.3 puts E5 Must 1–4 (audit) in B1 and E4 in B2. The runner applies every new file in name order (`packages/shared/src/migrations.ts:39`, `:53-64`), so it works, but dev and QA ledgers then show `015` before `014`.
- **Suggested fix:** Move `artifact_key_kid` to `016` (E6). Let the Lead give migration numbers in landing order at P3, or state: "migrations of different lanes must not depend on each other; the number order is not the apply order".

### B-LAD-14 — MINOR — Two data rules have two sources of truth

- **File:** `ltiaas/adr/LA-ADR-02-generic-lti-channel.md:33`; `ltiaas/contracts/lti-service-api-delta.md:297`; `ltiaas/adr/LA-ADR-01-channel-kernel.md:117`, `:121`.
- **Problem:** The trait `issuerKind` repeats what the profile `issuer` already says, and the capability model claims one source per value but gives `registration.dynamic` two.
- **Evidence:** (1) The `issuer` is a fixed URL, a `{siteUrl}` template, or `null` for admin values (`services/lti-service/src/profiles/types.ts:30-38`); `issuerKind` (`per-tenant` | `fixed`) says the same. The reserved issuer set now comes from `issuerKind: fixed` (lti-service-api-delta.md:297), not from the issuer value as today (`services/lti-service/src/profiles/index.ts:78-89`). A profile with a fixed issuer and `issuerKind: per-tenant` would not reserve its issuer. (2) "The value comes from one source only" (LA-ADR-01:117) vs `registration.dynamic` = manifest method **and** profile DR trait (:121).
- **Suggested fix:** Derive `issuerKind` from `issuer`, or add a load check that the two agree. Change the D3 sentence to "one rule per capability" and state the rule for `registration.dynamic`.

### B-LAD-15 — MINOR — Manual onboarding of admin-value channels types five URLs twice

- **File:** `ltiaas/adr/LA-ADR-02-generic-lti-channel.md:106-111` (D6); `ltiaas/data-model.md:66`; `ltiaas/contracts/cogniate-app-api-delta.md:89`.
- **Problem:** Every manual `lti-generic` and `brightspace` binding needs the operator and the library user to type the same five URLs and two ids, and the exact-text compare refuses any small difference.
- **Evidence:** The operator types `--issuer`, `--auth-url`, `--token-url`, `--jwks-url` and `--token-audience` (LA-ADR-02:109). The library user types the same values in the strict body (app API delta :89). "Exact text compare at redemption" (data-model.md:66). A trailing `/` or a different letter case in a path gives `422 GRANT_MISMATCH`, and the operator must issue a new grant. `brightspace` manual is a Must path, so this is the normal D2L onboarding.
- **Suggested fix:** Consider the order "the library stages its values, the operator confirms": `app:grant issue --connection <id>` prints the staged values, and the operator confirms them against the evidence instead of typing them again. If the order stays, the runbook must show the fixed D2L values, and the portal must show each differing field (the app already returns `details.fields`).

### B-LAD-16 — NIT — Stale open-item notes and version references

- **File:** `ltiaas/README.md:3`, `:314`, `:351-367`; `ltiaas/adr/LA-ADR-02-generic-lti-channel.md:121`; `ltiaas/adr/LA-ADR-06-service-operability.md:472`; `ltiaas/adr/LA-ADR-07-security-and-tenancy.md:240`; `ltiaas/contracts/lti-service-api-delta.md:316`.
- **Problem:** Several notes say that an item is open when the design already closed it, so a reader cannot trust the open lists.
- **Evidence:** README:3 cites "plan v1.1" (the plan is v1.2). OC-5 (:314) is "Open", but plan v1.2 adds LA-H21..LA-H24; README §10 lacks LA-H24. LA-ADR-02:121 says the gate base "is recorded as an open consistency item", but OC-1 is closed (README:310). LA-ADR-06:472 asks for `service_setting` and `issue_epoch` in the data model, which data-model.md:164-165 has. LA-ADR-07:240 asks for the evidence flags and `app:audit list`, which app API delta :151-154 has. lti-service-api-delta.md:316 says LA-IC-01 names only `channel`, but LA-ADR-04:129 lists the trait fields too.
- **Suggested fix:** Update or remove these notes.

### B-LAD-17 — NIT — Same names with different meanings

- **File:** `ltiaas/contracts/cogniate-app-api-delta.md:26`; `ltiaas/data-model.md:64`; `ltiaas/adr/LA-ADR-01-channel-kernel.md:122`, `:163`; `ltiaas/terms.md:118`; `ltiaas/README.md:109`.
- **Problem:** Some names mean two things, which makes debugging and review harder.
- **Evidence:** (a) The column `connection.lms` holds the behaviour class, but the DTO field `lms` holds the channel id: a `brightspace` row says `canvas` in SQL. (b) The capability `binding.authority` is a map (method → authority), but the column `binding_authority` is one value. (c) The frozen manual-`self` list, an authority exception, lives in `legacy-wire.ts`, a wire-name file (:163). (d) terms §7 says a fitness check is a rule "in `npm run check`", but F2 is not in `npm run check` (README:109).
- **Suggested fix:** (a) Add a comment rule in the connection repository and one line in the runbook ("never read `connection.lms`"). (b) Consider `registration.authority` for the capability. (c) Give the list a clear export name (for example `MANUAL_SELF_LEGACY_CHANNELS`) and cite it in LA-ADR-07 A3. (d) Change the terms sentence.

### B-LAD-18 — NIT — Job runner layer

- **File:** `ltiaas/README.md:68`, `:145`; `ltiaas/adr/LA-ADR-03-learning-record-core.md:138`.
- **Problem:** README §3 puts "dispatch outbox + job runner" in the kernel layer, but README §5 and LA-ADR-03 D7 put the runner in `packages/shared`.
- **Suggested fix:** Say "job runner in `packages/shared`, dispatch outbox in the app kernel" in the §3 diagram.

### B-LAD-19 — NIT — End state of the `config.ts` F1 exception

- **File:** `ltiaas/README.md:105`; `ltiaas/adr/LA-ADR-01-channel-kernel.md:298`.
- **Problem:** The exception for `packages/shared/src/config.ts` lasts "until E1 S3 makes it optional", but `PublicUrls.moodle` (`packages/shared/src/config.ts:18`) stays in the shared type for the app after S3, so the S9 count cannot reach 0 without a decision.
- **Suggested fix:** Say whether S9 removes `moodle` from the shared type (the Moodle channel reads its own setting) or the exception stays, and until when.

## Overlap with the QA pre-review

I read `docs/reviews/LA-DESIGN/qa.md` only after I wrote the findings above (Lead rule). One overlap: Q-LAD-19 (the `ConnectionSetup` sketch uses types that the design does not define) is near B-LAD-03, which covers the missing port context and P5–P7 shapes. Both can close with one D5 update. I found no other duplicate.

## Notes for the breakdown (not findings)

- Reviewer-B will check the two-tenant port fixtures that LA-ADR-07 D1 asks for (one case per app port with tenant data and per new LTI table).
- The capabilities `records.reporters` and `records.readBack` have the same value in every LA channel, and no LA channel can trigger their guards (LA-ADR-01:139). They cost a catalog entry, a guard and K0 canary variants. This is acceptable, but LC is the first milestone that needs them.
