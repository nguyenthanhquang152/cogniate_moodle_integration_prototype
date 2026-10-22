Verdict: APPROVE
Round: 1

# LA-E3-06 review, lens A ("Is it right and is it safe?")

Reviewer: Reviewer-A2 (Claude Code Opus 5.5 xhigh, plan LD-22). Date: 2026-10-22.
Spec: `docs/architecture/ltiaas/tasks/LA-E3-06.md`. Design: LA-ADR-05 D4; contract delta §4.5 (`scopes` row), §5 (`registration.complete`); LA-ADR-06 D4.

Diff: `git diff 36f70d8^1 36f70d8` (4 files).

Method: a throwaway `git archive 36f70d8` copy under `/private/tmp`, with a clone of the integration `node_modules`. I ran the LTI service tests (71 files, 906 passed) and 4 mutants in that copy only. I used no Docker and no network. I did not change the integration worktree, except for this file.

## Summary

| Id | Severity | Topic |
| --- | --- | --- |
| A-LA-E3-06-01 | MINOR | The `scopes_supported` check also runs on the default five scopes, and a missing `scopes_supported` parses as `[]`. So a `complete` without `scopes` is refused where today it registers. Route to A2. |
| A-LA-E3-06-02 | NIT | Duplicate scopes are accepted and sent twice |

There is no BLOCKER and no MAJOR finding. The lens-A points pass (see "Checks that pass").

## Findings

### A-LA-E3-06-01 — MINOR — the default scopes now depend on `scopes_supported`

- **Files:** `services/lti-service/src/http/routes/registration.ts` (`const scopes = body.data.scopes ?? REGISTRATION_SCOPES; if (scopes.some((scope) => !config.scopesSupported.includes(scope))) throw …`), `services/lti-service/src/lti/registration.ts` (`scopesSupported: strings(body.scopes_supported)`; the configuration parser does not require the field).
- **Problem:** contract delta §4.5 says "Absent = the five scopes (as today)", and AC-02 says "A `complete` without `scopes` sends the five scopes, as before LA". The default list is now also checked against `scopes_supported`. A platform that lists only some of the five, or sends no `scopes_supported` at all (it parses to `[]`), now gets `400 INVALID_REQUEST` (field `scopes`) on a `complete` without `scopes`. Before LA, that `complete` registered, and the platform granted what it supports. The test `checks advertised scopes for an explicit list = false` pins this new behaviour (mutant N1, "check only an explicit list", fails it).
- **Risk today:** low for Moodle, which lists all five, so T7 and the Moodle DR path do not change. It affects LTIAAS-compatible API callers that send no `scopes`, and platforms with a partial or missing `scopes_supported`. A field that the caller never sent then shows up in the error.
- **Suggested fix (A2):** either check only an explicit `scopes` list and keep the default as today; or keep the check, record it as an intended change, and treat a missing `scopes_supported` as a start-page problem (`INVALID_OPENID_CONFIGURATION`, `missing=scopes_supported`) instead of a late `400` at `complete`.

### A-LA-E3-06-02 — NIT — duplicate scopes

- **File:** `services/lti-service/src/http/routes/registration.ts` (`scopes: z.array(z.enum(REGISTRATION_SCOPES)).min(1).optional()`).
- **Problem:** `[lineitem, lineitem]` passes and is sent as `scope: "… lineitem … lineitem"`. It cannot widen the grant, but it is not the "subset" that the contract describes.
- **Suggested fix:** refuse duplicates (`.refine((s) => new Set(s).size === s.length)`), with field `scopes`.

## Checks that pass

| Item | Result |
| --- | --- |
| A scope can never widen (lens focus) | `scopes` is an array of the five ADR-009 values only (`z.enum(REGISTRATION_SCOPES)`, at least 1). Every requested scope must be in the platform's `scopes_supported`. The request `scope` is exactly the list, space-separated, in the request order. Absent gives the five (see -01). The tests refuse an empty list, `openid`, a mixed list, a string, `null` and a non-string member. Mutants N2 (no supported check), N3 (scopes not sent) and N4 (empty list allowed) are each killed. |
| Refusal before outbound work (lens focus) | The body parse, the update rule, the message target rule, the scope check and the reserved-issuer check all run before `claimRegistrationSession` and before the registration request. The refusal tests assert that the simulator recorded no registration and that the session stays `open`. |
| Audit atomicity (lens focus) | `withAudit` wraps the authenticated `complete`, so an unauthenticated call writes no event. The local writes (platform create or update and the session completion) and the `ok` event (`details: {platformId, operation}`) run in one synchronous `audit.change` after the remote call. The test "rolls back the platform and session completion if the audit insert fails" proves it. A refused call writes one `refused` event with its code (the scope tests check `INVALID_REQUEST`), and the session is released on any error after the claim, as before. |
| NRPS unchanged | `platform/nrps.ts` and the memberships route are untouched (AC-06 is K1-SIM). |
| Ownership | Only `lti/registration.ts`, `http/routes/registration.ts` and their tests change. `store/audit.ts`, the app and `packages/channels/**` are untouched. |
