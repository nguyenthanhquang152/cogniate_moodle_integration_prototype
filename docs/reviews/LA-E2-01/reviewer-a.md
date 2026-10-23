Verdict: APPROVE
Round: 1

# LA-E2-01 review: Reviewer-A (lens "Is it right and is it safe?")

## Round 1

- Reviewer: Claude Code Opus 5.5 xhigh. It replaces a Codex Reviewer-A session that its provider's content filter stopped (Lead brief `docs/team/ltiaas/briefs/p4/RA-C1-E201.md`).
- Diff: `git diff 4d53fed b33c178` (merge of lane L) plus `git diff 829c753 4b0f003` (F1 fix, `scope-jwt`, BD-A1-76). Commits `6d91c5b` (RQ-2, K file), `5dcf673`, `e5b33e4`, `ac75ca0`, `1c345d2`, `c54b7f2`, `48284a7`, `c7929d1`.
- References: `docs/architecture/ltiaas/tasks/LA-E2-01.md`; LA-ADR-02 D2, D2a; LA-ADR-01 D4 check 7; contract delta §4.6, §4.6.1, §4.7; data-model §4; A1 BD-A1-74, -75, -76, -82, -83.
- I ran these in a private clone at `4b0f003` (`git clone --no-hardlinks` into `/tmp`, `npm ci` there; no Docker, no stack):
  - Vitest on `services/lti-service` and `packages/channel-kernel`: 98 files, 1266 tests pass.
  - `npm run test:k0`: 3 files, 121 tests pass.
  - `npm run fitness:lms-names`: F1 PASS (0 hits). `npm run typecheck` and ESLint on the changed packages: exit 0.
  - Six probe tests on `POST /api/platforms` with test profiles (results below). I deleted the probe file after the run.
- Known before the review: B-LA-E2-01-01 / BD-A1-82 (the active-admin audience check runs only in the `any-https` branch). My probe P5 confirms it: a `{platformValue}` profile with `endpointOrigins: issuer` stores an active foreign audience (`201`). I do not record it again. I found no wider path to an active foreign audience at this SHA: a `fixed` profile drops the value (P4), `PATCH /api/platforms/:id` cannot set it or any URL, and `applyRegistrationUpdate` does not write the column.
- Blind review: I did not open the other reviewer's file.
- **Counts: 0 BLOCKER, 0 MAJOR, 3 MINOR, 2 NIT.**

### Checks

| Check | Result |
| --- | --- |
| Defaults are the strictest values | Correct (`profiles/registry.ts:24-33`). `issuerKind` comes from the issuer; `endpointOrigins` is `issuer` for `admin` and `null` for `fixed`; `clientAssertionAud` is `{tokenEndpoint}` with the form of the legacy flag; `assertionDeploymentId` is `false`; `dynamicRegistration` is `null`. So a profile that leaves out a trait can only lose a feature. Test: "supplies the defaults for a profile file without the traits". |
| Load check 7 | Correct (`profiles/schema.ts:62-77`). It refuses an `issuerKind` that does not agree with the issuer, `endpointOrigins` other than `null` for `fixed`, `null` for `admin`, an aud form that does not agree with `flags.clientAssertionAudArray` (BD-A1-75), and `configurationPath` without `path-prefix`. Each refine has a test that fails when the refine is removed. Small gap: A-LA-E2-01-04. |
| Baseline trait values (AC-01) | They equal LA-ADR-02 D2. Canvas and Blackboard leave out `dynamicRegistration`, and the registry gives `null` (BD-A1-83). After `c7929d1`, no `moodle-scope-jwt` is left in `services/` or `packages/`. |
| Client assertion for M1 profiles (AC-06, AC-08) | Byte-identical. The claim object keeps the order `iss, sub, aud, jti`, and no extra claim is added while `assertionDeploymentId` is `false`. The aud is a string for `standard` and Canvas, and a one-item array for Blackboard. The body fields and the scope string do not change (with `granted_scopes` `NULL`, the filter keeps every scope). The cache key does not change. `main.ts` passes no `profiles`, so the token client reads the same discovered registry as before. |
| Deployment claim | Correct. The claim name is the LTI `deployment_id` claim (`CLAIM.deploymentId`). The value comes from the validated ltik or service key (`deploymentIdOf`), not from the request body. With the trait on, the cache key includes the deployment, so one deployment never gets the token of another. |
| `any-https` rules (AC-04, AC-05) | Correct and in the order of rule 5 (`lti/platform-rules.ts:57-84`). Probe P2: a trailing-dot host, a `%2e` host, `127.1`, `0x7f000001` and `[::1]` are all refused by rule 2 as endpoint hosts. In the issuer probes, the endpoints on the same host fail rule 2 first; the issuer check (rule 1) calls the same `checkSiteUrl`, which also refuses these hosts. A reserved host is refused with any port and in any letter case. Probe P3: an explicit `:443` is the same origin (`201`); another port is refused (`PLATFORM_URL_NOT_ON_ISSUER_ORIGIN`). A staged create needs both `active: false` and a `bindingRef` (test: `active: false` alone is refused). Gap in the design, not in the code: A-LA-E2-01-01. |
| Staged values are never contacted before activation | Correct. An inactive platform is refused at launch (`lti/launch.ts:157`) and by `platformOf`. So no JWKS, token or AGS call goes to a staged URL. The only callers of `getToken` are the AGS and NRPS clients. |
| I-SELF for `standard` | Unchanged. `checkPlatformUrls` and `ISSUER_RESERVED` run as before, also for a staged create (test). A `{tokenEndpoint}` profile refuses `clientAssertionAud` with `INVALID_REQUEST`. The `platform_created` log keeps the old rule for `standard` and `fixed`. D2a's row "Every admin-value endpoint" also names Moodle values, but contract §4.6.1 keeps `standard` unchanged. The code follows the contract. This is safe, because with I-SELF an endpoint on a fixed host can only be reached with a launch that that host signs. |
| Granted scopes (AC-07) and the Author note | The token client asks only for granted scopes and makes no outbound request when no granted scope is left. The order is not ideal: A-LA-E2-01-02. |
| Migration `020` (AC-09) | Additive and portable: two nullable `TEXT` columns, as in data-model §4. Old rows get `NULL` (test). Evidence gap: A-LA-E2-01-03. |
| `GET /api/providers` (AC-03) | The three trait fields come from the registry with the §4.7 values (unit test for every baseline profile). QA owns the K1-SIM golden. |
| Must-not-edit list and ownership | The must-not-edit list is respected. Two notes: `channel-kernel/src/profiles.ts` changed by RQ-2 `6d91c5b` (BD-A1-74 allows it), and the L-lane files that the brief names are outside the may-edit list. One more file: A-LA-E2-01-05. No LMS name was added to a core path (F1 PASS). |

### Probe results (`POST /api/platforms`, test profiles, private clone)

| Probe | Request | Answer |
| --- | --- | --- |
| P1 | `any-https`, staged, `clientAssertionAud` = `https://developer.blackboard.com/api/v1/gateway/oauth2/jwttoken` | `201`, value stored |
| P2 | trailing dot, `%2e`, `127.1`, `0x7f000001`, `[::1]` (endpoint and issuer) | `400 PLATFORM_URL_NOT_IN_PROFILE`, rule 2 |
| P3 | active, token URL with `:443` / with `:8443` | `201` / `400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN` |
| P4 | `fixed` profile with `{platformValue}`, `clientAssertionAud` posted | `201`, `clientAssertionAud: null` (dropped) |
| P5 | `{platformValue}` + `endpointOrigins: issuer`, active foreign audience | `201` (known BD-A1-82, fix round) |
| P6 | simulations off, staged endpoint on `sso.canvas.sim.test` | `201` (as contract §4.6.1 rule 3: `.sim.test` only with simulations on) |

### Findings

- **A-LA-E2-01-01 (MINOR): a staged create accepts a `clientAssertionAud` on a reserved host, for example the Blackboard token URL.**
  - Where: `services/lti-service/src/lti/platform-rules.ts:59-65` (rule 2 checks only the three endpoints) and `:76-84` (the audience is checked only in rule 7, which a staged create skips).
  - Problem: rule 2 refuses a reserved host for an endpoint, also in a staged create (A-LAD-01). But the audience decides where a signed client assertion is valid. So a staged platform can hold an aud of a hosted LMS while its token URL is on another host.
  - Evidence: probe P1 gives `201`. Path after activation: the library types the public client id of the hosted LMS (in the shared tool account, that LMS trusts the same tool key). The token client then sends the token host an assertion with `aud` = the hosted LMS token URL. That host can replay the assertion at the hosted LMS until `exp`.
  - Why only MINOR: the operator grant binds every admin value (LA-ADR-02 D6), so a person must approve the value first. The task spec and contract §4.6.1 list only endpoints, so the code meets the spec. The gap is in the design.
  - Suggested fix: route this to A1/A2 as defence in depth. When `clientAssertionAud` parses as an https URL, refuse it if its host is a reserved host (`PLATFORM_URL_NOT_IN_PROFILE`, field `clientAssertionAud`), also in a staged create. This blocks nothing legitimate: the Brightspace audience host is not a fixed host of any profile.

- **A-LA-E2-01-02 (MINOR): the granted-scope filter runs after the scope choice and after the LA-E5-16 claim.**
  - Where: `services/lti-service/src/platform/token-client.ts:94-96`, and `platform/ags.ts:164-168` (`needScope` returns the first wanted scope that the launch has).
  - Problem 1: reads call `needScope(ctx, lineitem.readonly, lineitem)`. Example: the launch lists both scopes, and the platform granted only `lineitem` at registration. Then `needScope` chooses `lineitem.readonly`, and the token client refuses with `403 SERVICE_NOT_AVAILABLE`. But the granted `lineitem` scope can do the read.
  - Problem 2 (the Author note): on `POST /api/lineitems` with `Idempotency-Key`, the scope preflight (`http/idempotency.ts:31`, BD-A2-71) runs before the claim, but the grant check runs only in the token client, after the claim. So the `403` is stored and replayed for that key. This is not a safety problem: no assertion is sent, and the stored answer is the true final `4xx`. But a scope refusal of the same kind is not stored when the launch claim causes it, and the result differs here.
  - No effect at this SHA: nothing sets `granted_scopes` before LA-E2-02.
  - Suggested fix (same lane, LA-E2-02 is acceptable): in `needScope`, choose the first wanted scope that the launch has **and** that the platform granted (`grantedScopes === null` or includes it). Then both refusals happen in the preflight, before the claim. Keep the token-client filter as a backstop. Add one test for each problem.

- **A-LA-E2-01-03 (MINOR): AC-09 says "every platform API answer is unchanged", but no unit test reads the API answer of an old row.**
  - Where: `services/lti-service/src/store/platforms.test.ts:39-69` checks the database row and `getPlatform`, not the answer of `GET /api/platforms/:id`. The answer adds `clientAssertionAud` and `grantedScopes` for every platform (`http/routes/platforms.ts:99-105`; contract §4.6).
  - Problem: the AC's second half has no UNIT evidence. Read literally, the AC is also false, because the answer now has two more fields. LA-IC-01 does not name these platform-answer fields. The precedent is that LA-E3-12 added `trustedAudiences` the same way.
  - Suggested fix: add a route-level assertion for a migrated old row: every old field is equal, and the two new fields are `null`. Ask A1 to reword AC-09 to "every old field is unchanged; the new fields are `null`".

- **A-LA-E2-01-04 (NIT): load check 7 accepts `clientAssertionAud.value: '{platformValue}'` on an `endpoints: fixed` profile.** Then the create route accepts the posted field, and `planProvider` drops it silently (probe P4: `201`, `null`). The result fails closed (the aud is the token URL), but the caller gets no error. Where: `profiles/schema.ts:62-77`, `http/routes/platforms.ts:210`. Suggested fix: check 7 allows `{platformValue}` only with `endpoints: admin` (D2 gives it only to admin-value profiles).

- **A-LA-E2-01-05 (NIT): ownership.** `services/lti-service/src/lti/idtoken.test.ts:10` is the unit test of L2's `lti/idtoken.ts` in B3 (epics.md §5, row `lti/{login,launch,claims,idtoken,…}.ts`). The brief's list of L edits outside the may-edit list does not name this file. The change is forced by the type (two `null` fixture fields on `Platform`). Suggested fix: the Lead records it with the other out-of-list edits. No code change.

### Verdict

APPROVE for lens A: I found no BLOCKER or MAJOR. This verdict does not close B-LA-E2-01-01 / BD-A1-82. That finding stays open for the lane L fix round, and probe P5 confirms it. A-LA-E2-01-01 is a design question for A1/A2. A-LA-E2-01-02 can land with LA-E2-02, the task that first sets `granted_scopes`.
