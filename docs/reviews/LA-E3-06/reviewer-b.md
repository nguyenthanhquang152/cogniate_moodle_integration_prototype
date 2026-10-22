Verdict: CHANGES_REQUESTED
Round: 1

# LA-E3-06 review, Reviewer-B (lens: "Can a human team own it?")

Diff: `git diff 36f70d8^1 36f70d8` (lane L commit `ad6823f`, merged as `36f70d8`). Spec: `docs/architecture/ltiaas/tasks/LA-E3-06.md`. Design: LA-ADR-05 D4 (D-8), LA-ADR-02 D5 item 5, contract delta §4.5 and §5 (`registration.complete`), LA-ADR-06 D4 (Transaction rule T0–T5). I did not open the other reviewer's file. I did not run Docker.

Counts: **1 BLOCKER, 0 MAJOR, 1 MINOR, 1 NIT.**

The code is clear. `scopes` is a typed enum of the five ADR-009 scopes, `buildRegistrationRequest` sends them in request order, and the whole `complete` route now runs inside `withAudit`. The async platform call stays before `audit.change`, and the local writes plus the `ok` event commit in one synchronous change (T2, with a comment). The tests prove the audit rollback with a failing trigger, and that an audit event never contains the registration token. The BLOCKER is one behaviour change outside the spec: a `complete` **without** `scopes` now also checks the five default scopes against `scopes_supported`.

## How I checked

- Scratch clone of `36f70d8` in a private `/tmp` folder (`--no-hardlinks`, `node_modules` copied; removed after the run). The shared LA worktree did not change.
- `vitest run services/lti-service/src/http/routes/registration.test.ts services/lti-service/src/lti/registration.test.ts`: **41 of 41 passed**. `tsc --noEmit -p services/lti-service/tsconfig.json`: exit 0. `eslint services/lti-service/src`: exit 0.
- Probe: I put back the test fixture's **pre-LA** `scopes_supported` (two scopes, `score` and `lineitem`; this diff changed it to all five at `registration.test.ts:24`). Result: **11 tests fail**. Default `complete` calls that passed before now give `400 INVALID_REQUEST` (`expected 400 to be 200`, `expected [400, 'INVALID_REQUEST'] to deeply equal [502, 'PLATFORM_ERROR']`, …).

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | `lti/registration.ts`, `http/routes/registration.ts` and their tests. No change to `store/audit.ts`, `platform/nrps.ts`, the memberships route, app files or `packages/channels/**`. OK. |
| Ownership | Lane L, B2. OK. |
| No behaviour change outside the spec | **Not met**: see B-LA-E3-06-01. |
| No LMS name in core | None added. |
| UNIT ACs | AC-04: `scopes` outside the five, or `[]`, gives `400 INVALID_REQUEST` naming `scopes`. There was no `scopes` field before, so the test fails on the old code. The audit tests (`ok`, `refused` with the code, rollback on an audit insert failure, no token in events) back AC-05, which is K1. |

## Findings

### B-LA-E3-06-01 — BLOCKER — Required outcome not met: a `complete` without `scopes` no longer "still sends the five scopes"

- **File:** `services/lti-service/src/http/routes/registration.ts:213-217` ("check explicit **and default** scopes", `const scopes = body.data.scopes ?? REGISTRATION_SCOPES; if (scopes.some(… !config.scopesSupported.includes(scope))) throw …`); `services/lti-service/src/lti/registration.ts:79` (`scopesSupported: strings(body.scopes_supported)` is `[]` when the field is absent); fixture change `services/lti-service/src/http/routes/registration.test.ts:24`.
- **Problem:** The required outcomes say the default path does not change:
  - contract delta §4.5: "`scopes` … Absent = the five scopes (**as today**)";
  - LA-ADR-05 D4 table: "without it the service keeps the five scopes (**other tool accounts unchanged**)";
  - AP-05-21 and AC-LA-E3-06-02: "A `complete` call without `scopes` **still sends the five scopes**" / "as before LA".

  The refusal for `scopes_supported` is about "a scope of the **channel** scope set" (LA-ADR-02 D5 item 5), which is the explicit list that the app sends. With this change, every default `complete` (every Cogniate `complete` until LA-E3-07, and every other tool account) is refused with `400` when the platform's configuration lists fewer than the five scopes or has no `scopes_supported` at all (`strings(undefined)` gives `[]`). Before LA, such a registration went through.
- **Evidence:** The test fixture before this diff advertised only two scopes, and the default `complete` tests passed with it. The diff changes the fixture to all five scopes so that they pass again. My probe with the old fixture shows 11 failing tests. Under charter §5 (Lead rule for required outcomes), a required outcome that fails in a reachable path is a BLOCKER, even if Moodle 5.2.4 lists all five scopes today.
- **Suggested fix:** Check `scopes_supported` only for an explicit `body.data.scopes`. For an absent field, send `REGISTRATION_SCOPES` as today, with no check. Restore the pre-LA two-scope fixture. Change the test "checks advertised scopes for an explicit list = %s" so that `explicit = false` with a one-scope configuration gives `200` and sends the five scopes, and `explicit = true` gives `400` with no registration request.

### B-LA-E3-06-02 — MINOR — The unsupported-scope refusal does not say which scope is missing

- **File:** `services/lti-service/src/http/routes/registration.ts:216`.
- **Problem:** "Invalid field: scopes. The platform does not support every requested scope." tells the tool developer and the operator that *some* scope is missing. But the scopes are long URLs, and the platform configuration is not shown in the answer. To find the missing one, the person must fetch the platform's OpenID configuration and compare up to five URLs by hand. Scope URLs are public and not secret, so the answer can name them.
- **Suggested fix:** Name them: "Invalid field: scopes. The platform does not support: `<scope>`[, `<scope>`]." Also add `details: { field: 'scopes', unsupported: [...] }`, so the app can show the exact scope. Optionally give the `refused` audit event the same `unsupported` list in `details`.

### B-LA-E3-06-03 — NIT — A repeated scope is accepted and sent twice

- **File:** `services/lti-service/src/http/routes/registration.ts:68` (`z.array(z.enum(REGISTRATION_SCOPES)).min(1)`).
- **Problem:** The contract calls `scopes` a "subset", but `["…/score", "…/score"]` passes and sends `scope: "…/score …/score"`. A platform may refuse that, or store an odd value, and the tool developer gets a platform error instead of a clear `400`.
- **Suggested fix:** Add `.refine((s) => new Set(s).size === s.length, 'scopes must not repeat')`, and one test row.

## Not checked

- K1-SIM AC-01, -02, -03, -05, -06 (QA). LA-E3-07 (the app sends the four AGS scopes).
