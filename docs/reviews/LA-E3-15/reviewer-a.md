Verdict: APPROVE
Round: 2

# LA-E3-15 review: Reviewer-A (lens "Is it right and is it safe?")

## Round 1

- Reviewer: Claude Code Opus 5.5 xhigh (Reviewer-A, same session as LA-E2-01, LA-E2-02 and LA-E3-05).
- Diff: `git diff 2cc2aa5^1 2cc2aa5` (lane K, `4a62acb`):
  - the Canvas `registration` list gets `{ method: 'dynamic', authority: 'operatorGrant', the five Canvas profiles, defaultProfile canvas-cloud-production }`;
  - `packages/channel-kernel/src/registry.test.ts:80-81` expects the Canvas legacy flag `dynamicRegistration: true`.
- References: `docs/architecture/ltiaas/tasks/LA-E3-15.md`; LA-ADR-05 D6 ("Authority", "Manifest"); LA-ADR-01 D4 load checks 5 and 6; LA-ADR-04 D8 LA-IC-14; app contract §4 (`POST /app-api/connections`); A1 BD-A1-90, BD-A1-91, BD-A1-103.
- I ran these in a private clone at `2cc2aa5`. I deleted the Vitest cache before each run. No Docker, no stack.
  - `npm run test:unit` (all workspaces): 191 files, 3081 tests pass, 5 skipped.
  - `npm run test:k0`: 149 tests pass.
  - F1 PASS; `npm run typecheck`: exit 0; ESLint on `packages/channels` and `packages/channel-kernel`: clean.
  - A unit probe of the app flow for a Canvas `dynamic` connection, with the app testkit and its fake LTI service. The probe file is kept outside the repo, at `/tmp/ra-e201/e315/ra-e315-probe.test.ts`.
- Blind review: I did not open the other reviewer's file.
- **Counts: 0 BLOCKER, 1 MAJOR, 1 MINOR, 0 NIT.**

### Checks

| Check | Result |
| --- | --- |
| No Canvas manual-path byte change (LD-9) | Holds. The `manual` entry, the profiles, the capabilities, the `bindingFields` and the texts do not change. The manual create still finds its own method entry. The only visible changes are the LA-IC-14 values: the legacy flag `dynamicRegistration` becomes `true` (the kernel test changes to match), `binding.authority` gets a `dynamic` key, and `methods` lists `dynamic`. The M1 assertions that LA-IC-14 names (`11-canvas-platforms.test.ts:218`, `:241`, `:257`) are QA's LD-9 list. The Canvas portal wizard still sends only `method: "manual"` (BD-A1-103 known gap). |
| Load check 5 | Passes. The five `dynamic` profiles are the five profiles of `packages/channels/canvas/lti-profiles.ts`, so the LTI side loads them. On the app side, the create path accepts a profile only when `GET /api/providers` reports it for the channel (`usableProfileRow`). |
| Load check 6 | Passes. Every Canvas profile is `exclusive`, and the new method uses `operatorGrant`, not `self`. |
| Capability | `registration.dynamic` is `true` for the Canvas channel. Per profile it stays `false` while the Canvas LTI profiles have `dynamicRegistration: null` (until LA-E3-09). Until then, the LTI service refuses a Canvas `complete` ("This profile has no Dynamic Registration"), so nothing is stored or activated: fail closed. |
| AC-04 (create) | Probe: `POST /app-api/connections {lms: "canvas", method: "dynamic", profile: "canvas-sim-cloud", …}` gives `201`, with `method: dynamic`, `status: pending`, `binding_authority: operatorGrant`, `lms: canvas`. See A-LA-E3-15-02 for the registration URL. |
| Ownership and must-not-edit list | Only the Canvas manifest and K's own kernel test changed. `lti-profiles.ts` and `services/lti-service/**` are not touched. F1 PASS. |

### Findings

- **A-LA-E3-15-01 (MAJOR): the app refuses the staged registration of a Canvas `dynamic` connection, so Canvas Dynamic Registration cannot complete.**
  - Where: `services/cogniate-app/src/tool-pages/register.ts:146` calls `stageRegistration`. That function's guard (`services/cogniate-app/src/domain/connections.ts:206`, `… AND binding_authority = 'self'`, BD-A1-90) assumes that a staged connection starts as `self`. A Canvas `dynamic` connection starts as `operatorGrant` (this task, LA-ADR-05 D6 "Authority"), so the guard misses. The `else` branch then answers `REGISTRATION_FAILED` / `PLATFORM_NOT_ACTIVE`.
  - Problem: the task Goal ("a Canvas registration stages an inactive platform and the operator grant still proves ownership") and AP-05-29 of LA-E3-09 need the app to keep the staged platform on the pending connection, so that the grant redemption can adopt it (BD-A1-91). With this manifest, every Canvas registration that the LTI service stages correctly fails in the app. The connection stays `pending` with no platform record. The inactive platform, which carries our binding ref, stays in the LTI service as an orphan.
  - Evidence (probe, staged answer): `complete` is sent with `profile: canvas-sim-cloud` and a fresh `bindingRef`. The fake LTI service creates the platform inactive with that ref. The register page answers `502 REGISTRATION_FAILED`. The connection is `{status: pending, binding_authority: operatorGrant, lti_platform_id: null}`, and the platform is `{active: false, bindingRef: set}`.
  - Related (defence in depth, same code): `register.ts:156` calls `markRegistered` for any active answer, whatever the authority. Probe (active answer): the Canvas `operatorGrant` connection becomes `registered` with the platform id and no grant. It is not a security hole today:
    - `routeLaunch` gives an `operatorGrant` connection launch authority only through `approved_deployment` (a redeemed grant), so launches get `deployment_not_approved`;
    - LA-ADR-05 D6 says the LTI service always stages a Canvas registration.

    But it contradicts D6 ("always staged with a grant"), and it leaves the connection `registered` with no approval.
  - Why MAJOR: no AC of this task fails, because AC-04 tests only the create. But the case this task enables, a Canvas DR after LA-E3-09, fails every time, and it fails in the app, not in the simulator. The fix is in K's LA-E2-04 files, not in this task's may-edit list, so the Lead decides where it goes: this task's next round with a file grant, or a K companion before LA-E3-09's K1-SIM.
  - Suggested fix (A1 to ratify, because it widens the BD-A1-90 guard):
    1. `stageRegistration` also accepts a pending `dynamic` connection whose authority is already `operatorGrant` and that has no platform yet (`binding_authority = 'self' OR (binding_authority = 'operatorGrant' AND method = 'dynamic' AND lti_platform_id IS NULL AND platform_json IS NULL)`). It keeps the authority and writes the staged platform record in the same single write.
    2. `register.ts`: an active answer for a connection whose authority is not `self` is never marked `registered`. Refuse it as `REGISTRATION_FAILED`, and deactivate it as an orphan if no connection owns it.
    3. Tests: a Canvas `dynamic` connection with a staged answer shows "Waiting for approval", keeps `pending`/`operatorGrant` with the staged platform record, and the grant redemption adopts it. With an active answer, the connection stays pending.

- **A-LA-E3-15-02 (MINOR): a Canvas `dynamic` create returns no registration URL.**
  - Where: `services/cogniate-app/src/app/connections.ts:175` makes a ref only in the `authority === 'self'` branch. The `operatorGrant` branch (`:208`) calls `createConnection(…, null, …)`.
  - Problem: the base app contract §4 says "`POST /app-api/connections` → `201`. Dynamic: `registrationUrl`". The Canvas `dynamic` answer has `registrationUrl: null` and no stored ref (probe: `has_ref: 0`). A client must call `POST /app-api/connections/:id/registration-url` first. That call works (probe: `200`), so a workaround exists.
  - Suggested fix: make the ref for every `method: 'dynamic'` create, whatever the authority, and add one test. It can go in the same K change as A-01.

### Verdict

CHANGES_REQUESTED for lens A, because of A-LA-E3-15-01. The manifest change itself is correct and safe: load checks 5 and 6 pass, the manual path does not change outside LA-IC-14, the authority is `operatorGrant`, and the feature fails closed until LA-E3-09. But with this method, the app cannot stage the Canvas registration that D6 requires. The fix sits in K's LA-E2-04 files, so the Lead routes it.

## Round 2

- Reviewer: Claude Code Opus 5.5 xhigh (same session as round 1).
- Diff:
  - `07eab11` (merge `dc98c43`): the Canvas `dynamic` binding rows and the README row, BD-A1-103/104;
  - `d32a7a8` (merge `a03e15b`): BD-A1-106;
  - `75d81fa` (merge `dfe94ff`): BD-A1-107, G1 and G2.
- References: A1 BD-A1-103 to BD-A1-107; app delta §3.4, §5, §7; LA-ADR-05 D6.
- I ran these in the private clone at `dfe94ff`. I deleted the Vitest cache before each run. No Docker, no stack.
  - `npm run test:unit` (all workspaces): 191 files, 3102 tests pass, 5 skipped. Test 4f now runs.
  - `npm run test:k0`: 148 tests pass.
  - F1 and F5 PASS; `npm run typecheck`: exit 0; ESLint on `services/cogniate-app` and `packages/channels/canvas`: clean.
  - My round 1 probe, extended to four cases (below). The probe file is kept at `/tmp/ra-e201/e315/ra-e315-r2.test.ts`.
- Blind review: I did not open the other reviewer's file.
- **Counts (open after round 2): 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

### Round 1 findings

| Finding | Status | Evidence at `dfe94ff` |
| --- | --- | --- |
| A-LA-E3-15-01 (MAJOR): the app refuses the staged Canvas registration | **Closed** (BD-A1-106, BD-A1-107) | The `stageRegistration` guard is now `pending AND method = 'dynamic' AND platform_json IS NULL AND binding_authority IN ('self', 'operatorGrant')`, and the SET part does not change. Probe (a): a Canvas `dynamic` connection with a staged answer (registration issuer = the vendor issuer, staged site = the connection site) shows `200` "Waiting for approval", stays `pending`/`operatorGrant` with the staged platform record, and the ref is used up. An active answer for a connection that is not `self` (`register.ts:169`) is refused. Probe (c): `502 REGISTRATION_FAILED`, the platform is switched off (`active: false`), the connection stays `pending` with no platform, and its ref still works. |
| A-LA-E3-15-02 (MINOR): no registration URL at create | **Closed** (BD-A1-106) | The `operatorGrant` create branch makes a ref for `method: 'dynamic'` (`app/connections.ts`). Probe: `201`, the ref is stored, `registrationUrl` is set, and the authority stays `operatorGrant`. |

### Lens A checks of the fix

| Check | Result |
| --- | --- |
| No launch authority without a grant, on any path | Holds. **Staged:** the platform is inactive in the LTI service, and the connection has `lti_platform_id` `NULL` with the platform only in `platform_json`. Probe (a): `routeLaunch` before the grant gives `{ok: false, reason: unknown_platform}`. **Active answer:** refused, and the platform is switched off. **Self routing:** `findLaunchConnection` needs `binding_authority = 'self'`, which a Canvas connection never has, because staging keeps `operatorGrant`. **Redemption:** the only path to authority. It writes `approved_deployment` and activates the platform with a conditional S3, after adoption rule A3 compares profile, client id, deployment, issuer, site URL and service URL with the grant target (the snapshot plus the grant's ids). |
| Staged site proof (G1) | Holds, with A1's recorded trade-off. **Confirm step:** for a fixed-issuer connection (snapshot issuer set; today only Canvas `dynamic` reaches it, because only `dynamic` connections have a ref), it needs the registration issuer to equal the snapshot issuer exactly. Probe (d): an issuer equal to the site gives `400 SITE_MISMATCH` with no `complete` call. **After `complete`:** the staged platform's `siteUrl` must equal the connection site before staging (`register.ts:154`). Probe (b): another school's site gives `400 SITE_MISMATCH`, the connection is unchanged, its ref still works, and the staged platform stays inactive and unowned. A missing `siteUrl` (for example before LA-E3-09) also fails closed. Trade-off (BD-A1-107, security §2.5): the Canvas site is proven only after `complete`, so a link used on a wrong Canvas site makes an inactive tool there. Later hardening is recorded for after LA. |
| Staged fixed redemption (G2) | Holds. `adminValueStaged = stagedRegistration && servedByKernel` is false for Canvas, so a Canvas grant has no bound values and the redemption target is the fixed snapshot target. S1 is skipped for every staged connection (`redemption.ts:208`, unchanged). In S2, a gone staged platform gives `PLATFORM_IN_USE`. `app:grant issue` reads the staged platform and refuses `staged_values_changed` (active, or another issuer, client id, profile or site), `client_id_mismatch` and `deployment_mismatch`. `--accept-staged` gives `bound_values_not_allowed`. Test 4f proves no S1 create, then S2 adopt, then S3 activate, and a registered connection with the approved deployment. A staged `siteUrl` or `serviceUrl` that differs is not adopted. |
| `lti-generic`, `brightspace` and Moodle paths unchanged | Holds. They have no snapshot issuer, so they keep the old site check before `complete`. They are `self`, so an active answer is still `markRegistered` and staging still switches `self` to `operatorGrant` (the guard adds only `method = 'dynamic'` and `platform_json IS NULL`, which their path already meets). For them, `adminValueStaged` equals the old `stagedRegistration`, so bound values are still required. The `staged` flag in `operator.ts` now includes `purpose === 'initial'`; together with `adminValueGrant` the condition is unchanged for them. Their existing tests pass unchanged. |
| Binding rows and README (`07eab11`) | No Canvas byte change. The three `dynamic` rows follow the unchanged `manual` rows; `GET /app-api/lms-providers` does not carry `bindingFields`; the Canvas portal does not read them (BD-A1-104). F1 PASS. |

### Verdict (round 2)

APPROVE for lens A. Both round 1 findings are closed. A Canvas `dynamic` connection now stages and keeps `operatorGrant`, and no path gives launch authority without a redeemed grant. The site is proven before staging, and the other DR channels behave as before. The end-to-end redemption is LA-E3-09 AC-03 (K1-SIM).
