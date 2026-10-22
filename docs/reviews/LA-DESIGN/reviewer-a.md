Verdict: CHANGES_REQUESTED
Round: 1

# LA-DESIGN review: Reviewer-A (lens "Is it right and is it safe?")

- Design SHA: `19476fc` (branch `quang/ltiaas-milestone`). The design files in the shared worktree are equal to this SHA (`git diff 19476fc HEAD -- docs/architecture docs/team/ltiaas/plan.md` is empty).
- Scope: the 15 files under `docs/architecture/ltiaas/` and plan v1.2. `tests/ltiaas/TEST-STRATEGY.md` is context only.
- I checked the design claims against the product code at the same SHA (product code = baseline `00977f8`). File references without a folder are relative to `docs/architecture/ltiaas/`.
- Blind review: I did not open `reviewer-b.md` or the QA pre-review `qa.md`.
- Counts: **3 BLOCKER, 5 MAJOR, 9 MINOR, 1 NIT.**

## Summary

The kernel, the frozen wire names, the fail-equivalent `lms` behaviour class, the byte-identical service-key derivation, the "no ltik before the storage check" rule and the inactive Canvas DR create are well designed. The intended changes have ids (LA-IC-nn), and every Must item of plan §3 has a decision.

Three problems block G-DESIGN:

1. **A-LAD-01:** `self` Dynamic Registration on an `any-https` profile, with an audience taken from `authorization_server`, lets one library user steal platform access tokens of other schools (D2L, Canvas, and the shared Blackboard application).
2. **A-LAD-02:** the `auth_failure` rate-limit bucket locks out the Cogniate app. An unauthenticated sender can stop launches and grade return for every library.
3. **A-LAD-03:** the outbox allows two runners. Then two sends of one learner can be in flight at the same time, and the ADR-010 P2 confirmation is skipped.

## Findings

### A-LAD-01: BLOCKER: Dynamic Registration with `self` authority and `any-https` endpoints leaks platform access tokens of other schools

- **File:** `adr/LA-ADR-02-generic-lti-channel.md:57` (also `:34`, `:35`, `:95`, `:97`; `contracts/lti-service-api-delta.md:271`, `:296`; `adr/LA-ADR-07-security-and-tenancy.md:70`; `adr/LA-ADR-08-onboarding-and-connection-health.md:81`, `:100`; `security-delta.md:26`).
- **Problem:** A `self` binding (Dynamic Registration) on a profile with `endpointOrigins: any-https` and an assertion `aud` from `authorization_server` lets any library user do two things. First, the LTI service signs client assertions for the client id of another school. Second, the service sends those assertions, or the access token that they buy, to a host that the library user controls.
- **Evidence:**
  - LA-ADR-02:57 says: "Dynamic Registration is `self`: the configuration comes from the issuer's own path, so the issuer host vouches for the endpoints". But the issuer host vouches only for itself.
  - With `any-https`, the configuration can name any token endpoint whose host passes site rules 2–4 (LA-ADR-02:34, :95; lti-service-api-delta:296, rule 2). Site rule 4 refuses only the fixed hosts of the same profile (`docs/architecture/adr/ADR-011-multi-lms.md:236`). `lti-generic` has no fixed host, so `auth.brightspace.com`, `<school>.instructure.com` and `developer.blackboard.com` all pass.
  - The platform's registration answer supplies the client id (`services/lti-service/src/lti/registration.ts:137-143`). So a fake platform can return the client id of a real school, and ids are not secrets (ADR-011:18).
  - `authorization_server` from the same fake configuration becomes the assertion `aud` (LA-ADR-02:97; lti-service-api-delta:271).
  - The platform unique key is (account, issuer, client id). So the fake issuer does not collide with the real school's platform row.
  - **Attack path.** One library user, no operator:
    1. Create an `lti-generic` connection with method `dynamic`.
    2. Serve a configuration at `https://evil.example` with its own JWKS, the token endpoint `https://auth.brightspace.com/core/connect/token` and `authorization_server` = the D2L audience. Return the victim school's D2L client id in the registration answer.
    3. Sign a learner launch with the attacker's own key. The attacker controls the issuer and the JWKS, so checks 1–14 pass. Finish a course.
    4. The outbox posts the score. The LTI service asks the real D2L token endpoint for a token. It sends a client assertion signed with the `cogniate` tool key, with `sub` = the victim client id.
    5. D2L trusts that key for the victim's registration, so it returns a token with the victim's scopes.
    6. The service sends that token in `Authorization` to the AGS URL in the attacker's signed claim.
  - The same path works with a Canvas account domain (token URL = `aud`). It also works with the Blackboard gateway and the shared Cogniate Application ID: there, one token serves every Blackboard school (ADR-011 R-M-14).
  - Today, the `standard` rule keeps auth, token and JWKS on the issuer origin (`services/lti-service/src/lti/platform-rules.ts:23-36`; DR: `services/lti-service/src/lti/registration.ts:60-69`). So a party that can forge launches only reaches its own token host. The design removes this tie for `self` bindings.
  - **Required outcomes that fail:**
    - "The platform access token goes only to platform URLs." (`docs/architecture/security.md:190`)
    - "So typed ids never prove that a library may use an LMS installation." (ADR-011:18)
  - The threat table has no row for this case (LA-ADR-07:151-175; T4 covers typed manual values only).
  - The same root cause is in two Could items:
    - LA-ADR-08:81 (D3 rule 6) binds only the JWKS URL. The attacker controls the issuer, so the signed administrator role proves nothing.
    - LA-ADR-08:100 (D4): the connection check asks for a token on demand, once per minute.
  - A second effect: `path-prefix` together with an off-origin registration endpoint. A user who can upload one JSON file under the path of a kind A LMS (for example a Moodle file URL) can register that LMS's issuer under their own library.
- **Suggested fix:**
  - Add one invariant to LA-ADR-02 D2 and D5, and to security-delta §2.4 and §9: "For a `self` binding, the token endpoint, the JWKS URL, the registration endpoint and the client assertion `aud` are on the issuer origin (today's rule). A value off the issuer origin, or a separate audience, needs an operator grant, or a fixed value of a named profile together with a grant."
  - Then apply it:
    - (a) Dynamic Registration on an `any-https` profile stages an inactive platform and uses `operatorGrant`, as Canvas DR does (LA-ADR-05 D6). Keep DR `self` only when every endpoint and `authorization_server` are on the issuer origin.
    - (b) Refuse an admin-value endpoint host that is a fixed host or an issuer host of any loaded profile.
    - (c) Apply the same rule in LA-ADR-08 D3 rule 6 (the token endpoint and the audience, not only the JWKS) and in D4.
    - (d) Add a threat row (LA-ADR-07 D6) and a K1 negative case: a DR configuration with a foreign token host must not create an active `self` platform.

### A-LAD-02: BLOCKER: the `auth_failure` bucket lets any sender block every API call of the Cogniate app

- **File:** `adr/LA-ADR-06-service-operability.md:80` (also `:99`, `:111`; `contracts/lti-service-api-delta.md:105`; `security-delta.md:131`).
- **Problem:** The `auth_failure` bucket is keyed by the client address, and every `401` spends it, also when the API key is valid. So anyone on the internet can block all API calls of the Cogniate app (launches and grade return of every library) with about two requests per second.
- **Evidence:**
  - LA-ADR-06:80: "A failed authentication spends one token of the `auth_failure` bucket of the client address". Class `auth_failure`: "any `401` on `/api/*` …", key = client address, 120 per minute (:99).
  - AP-06-04: "31 failed authentications from one address in one minute give `429` on the 31st, also with a valid key" (:111). The same rule is in lti-service-api-delta:105 and security-delta:131.
  - The app calls the LTI service from one address, through the trusted proxy (`TRUSTED_PROXY_CIDRS=proxy`, LA-ADR-06:81, :436).
  - A `401` under a valid API key happens for every bad ltik. `GET /tool/launch?ltik=<any 43 base64url characters>` writes a handoff row and calls `GET /api/idtoken` (`services/cogniate-app/src/tool-pages/launch.ts:110-121`). The answer is `401 INVALID_LTIK_AUTH_AUTHORIZATION_HEADER`. The app has no rate limit of its own.
  - After 120 such requests in one minute, every app call gets `429` for the rest of that minute: `/api/idtoken` for real learners, score POSTs, Deep Linking. Repeated each minute, this is a full outage for every library.
  - Service keys that the outbox holds after a revoke also give `401` and spend the same bucket. LA-IC-10 already expects test suites to go over the bucket from one address (LA-ADR-06:429).
  - **Required outcome:** plan E5 Must 1 asks for rate limits as an abuse control (R4 L-1: abuse must not "harm every tenant"). This control creates a cross-tenant denial of service that needs no credential.
- **Suggested fix:**
  - Spend `auth_failure` only when the API key (or operator key) itself is unknown, expired or revoked.
  - Count ltik and service-key failures under a valid API key in a per-API-key bucket, or not at all (the `api` bucket already bounds them).
  - Change AP-06-04 to "31 failed authentications with unknown keys". Add one point: 200 bad-ltik calls with the valid `cogniate` key do not block the next valid call.
  - Optional: a small per-address limit on `/tool/launch` and `/tool/deep-link` in the app.

### A-LAD-03: BLOCKER: two runners can send two scores of one learner at the same time and skip the P2 confirmation

- **File:** `adr/LA-ADR-03-learning-record-core.md:172` (also `:148`, `:175`, `:206`; `operability.md:86`).
- **Problem:** The design allows two job runners (the web process and `npm run worker`) and counts `perPartition` per runner. So two sends of the same learner and placement can be in flight at the same time. Then the P2 confirmation is skipped, and a lower score can stay in the gradebook.
- **Evidence:**
  - `limits: { parallel; perPartition; leaseMs }` belong to one queue job of one runner (LA-ADR-03:148). "`parallel` default 4 for the whole runner; `perPartition` 1" (:172). The lease is per dispatch row (:146, :168).
  - "A second process is safe only with distinct instance ids" (:175). "A second worker instance becomes safe (R4 B-2)" (:206). operability.md:86 allows `npm run worker` beside the web process.
  - **Race with two runners:**
    1. Row A (60) is in flight on runner 1 (`send_started_at` set).
    2. A new final result commits row B (80) and supersedes A (ADR-010 rule 5).
    3. Runner 2 leases B at once, because its own partition slot is free. B gets `204` while A still waits.
    4. `needsConfirmation` looks only at `delivery_uncertain = 1` (`services/cogniate-app/src/domain/score-syncs.ts:72-77`). A is not uncertain yet, so B becomes `sent` with no confirmation.
    5. A then times out (uncertain) or lands late.
  - Today the single serial worker records A's result before it sends B, so the confirmation rule always sees the uncertainty.
  - ADR-010 P2 records that an old timed-out request can write after the higher score (`docs/architecture/adr/ADR-010-grade-and-completion-policy.md:43`).
  - **Required outcomes:** "When an uncertain lower send is superseded, the current best pending row requires confirmation" (ADR-010:46). Plan E4 Must: "Keep the ADR-010 grade policy and the retry and confirmation guarantees". One runner with `perPartition` above 1 (an operator setting) has the same race.
- **Suggested fix:**
  - Make "at most one in-flight dispatch per (placement, learner subject, reporter)" a database rule: the lease update succeeds only when no row with the same key has a live lease or a `send_started_at` value.
  - In the confirmation rule, treat a superseded row that is still in flight like an uncertain row.
  - Keep `perPartition` = 1 for `bestResult` reporters, or enforce it in the lease query across runners.
  - Correct :175, :206 and operability.md:86 to state the invariant. Add an Author unit test with two runners.

### A-LAD-04: MAJOR: migration `014` fails on a released Blackboard connection

- **File:** `adr/LA-ADR-04-refactor-and-migration.md:99` (also `data-model.md:109`).
- **Problem:** Migration `014` takes the `partition_key` of a Blackboard row from its reservation. A released Blackboard connection has no reservation and no `lti_platform_id`, so the NOT NULL insert fails, and the app does not start after the upgrade.
- **Evidence:**
  - Step 4: "`partition_key` = the LTI platform id of the connection (`lti_platform_id`; for a shared platform, the `lti_platform_id` of its reservation)" (:99). The column is `partition_key TEXT NOT NULL` (data-model.md:109).
  - Base data model: a Blackboard connection has `lti_platform_id = NULL` (`docs/architecture/data-model.md:511`), and "`app:binding release` (§4.9) deletes only the row of the released connection" (:512).
  - The score rows of the released connection stay, because they are the record of results.
  - Each migration runs in one transaction (ADR-011 §1 fact 4), so one such row stops the whole migration.
  - The D5 migration test does not name this fixture.
- **Suggested fix:** Define a total fallback: the reservation, else `connection.target_platform_id` (`012`), else the connection id. A disabled connection's rows are never sent anyway. Add a fixture to the `014` migration test: a released Blackboard connection that has score rows.

### A-LAD-05: MAJOR: in-flight rows copied by `014` are not covered by the recovery rule

- **File:** `adr/LA-ADR-03-learning-record-core.md:170` (also `adr/LA-ADR-04-refactor-and-migration.md:99`, `:102`).
- **Problem:** The job runner's recovery rule covers only rows whose lease it takes back. But `014` copies in-flight rows with no lease. So a copied `send_started_at` row may never become uncertain, and may never be sent.
- **Evidence:**
  - LA-ADR-03 D7: "Recovery: A dispatch with `send_started_at` set and a lease that the runner takes back becomes `delivery_uncertain = 1`" (:170). "At start, the runner takes back at once the leases of its own instance id" (:169).
  - LA-ADR-04 D5 step 4 copies rows with "no lease" (:99). It then states: "So a copied `send_started_at` becomes `delivery_uncertain` by the normal startup recovery, exactly as today" (:102). D7 as written does not do that.
  - Today's recovery marks every row that has `send_started_at` (`services/cogniate-app/src/domain/score-syncs.ts:96-107`). `beginSend` needs `send_started_at IS NULL` (:90). So a row that is not recovered stays `pending` for ever.
  - **Required outcome:** "After restart, an unresolved send is uncertain" (`docs/architecture/data-model.md:224`).
- **Suggested fix:** In LA-ADR-03 D7, state: "At start, every row with `send_started_at` set and no live lease of another instance (also `lease_owner IS NULL`) becomes uncertain and loses the marker." Add the leaseless case to the D7 tests, not only to the `014` text.

### A-LAD-06: MAJOR: the signing-key migration publishes old retired keys again

- **File:** `adr/LA-ADR-06-service-operability.md:297` (also `:431`).
- **Problem:** The signing-key migration sets `retired_at` = migration time for every retired row. So a key that left the JWKS long ago, perhaps after a compromise, is published again for 30 days.
- **Evidence:**
  - :297: "a `retired` row gets `retired_at` = the migration time (it stays published 30 more days; this is the safe side)".
  - Today a retired key is published only while `now - created_at < 30 days` (`services/lti-service/src/store/tool-keys.ts:30-37`).
  - Today the only retire path is `--rotate-signing-key`. This is also the compromise path, because there is no "retire immediate".
  - Platforms that fetch our JWKS again (`max-age=300`) then accept client assertions and Deep Linking responses signed with that old private key.
  - This also changes the golden `GET /lti/keys/:account` of an upgraded stack. LA-IC-10 says "unchanged for a stack with one key" only (:431).
- **Suggested fix:** Keep the published set the same at the migration. A retired row with `now - created_at < 30 days` gets `retired_at` = migration time. An older retired row becomes `removed` (private part zeroed). Put the rule into the migration test and into LA-IC-10.

### A-LAD-07: MAJOR: one account-wide protocol bucket lets unauthenticated traffic block all launches

- **File:** `adr/LA-ADR-06-service-operability.md:93` (also `:80`, `:81`, `:102`).
- **Problem:** The `protocol_account` bucket is keyed only by the tool account in the URL, and requests spend it before any check. So an unauthenticated sender can empty the bucket of `cogniate` and block launches of every library. The per-address bucket does not stop a sender that has many addresses.
- **Evidence:**
  - Classes `protocol` (per address, 600 per minute) and `protocol_account` (per tool account, 6,000 per minute) apply to login, launch and the storage check (:92-93).
  - "The IP classes run in an `onRequest` hook, before any database read" (:80). "the per-account limit is the main control" (:102).
  - Ten addresses reach 6,000 requests per minute with junk `iss` values. So does one IPv6 /64, because the key is "the socket address" (:81).
  - All libraries share the tool account `cogniate`.
- **Suggested fix:**
  - Spend the account bucket only after the request passes the cheap checks: a known account, a known `iss` + `client_id`, or a known state for a launch. Or use the account class only for a metric and an alert.
  - Key IPv6 addresses by their /64.
  - Add one acceptance point: junk logins from many addresses do not block a valid launch.

### A-LAD-08: MAJOR: Must items change M1 and T7 assertions, but plan success measure 3 forbids it

- **File:** `docs/team/ltiaas/plan.md:146` (also `adr/LA-ADR-04-refactor-and-migration.md:113`, `:132`, `:136`, `:140`; `adr/LA-ADR-05-lti-advantage-completeness.md:184`, `:317`).
- **Problem:** Plan success measure 3 allows only the LD-1 rewrite. But Must items of the design change M1 and T7 assertions (LA-IC-04, LA-IC-12), and no recorded Lead decision allows that.
- **Evidence:**
  - plan.md:146: "Their assertions do not change, except the closed-list rewrite of E0".
  - LA-ADR-04 D8:
    - LA-IC-04 (Must, D-8) touches "M1 Canvas JSON rows, T4b1 and T7 tool-row checks" (:132).
    - LA-IC-12 (Must, Deep Linking Cancel) touches "tests that click the only button of the picker page" (:140).
    - LA-IC-08 (Should) touches the Moodle claim tests (:136).
  - LA-ADR-04 D6 sends these changes "to the Lead" (:113). LA-ADR-05 D4 item 4 sends them "to the Lead as one reviewed change list, like LD-1" (LA-ADR-05:184, :317).
  - Plan v1.2 §6.1 has LD-1 to LD-8. None of them covers the LA-IC lists. LD-6 changes a fixture only; its assertions do not change.
- **Suggested fix:** The Lead records one decision (for example LD-9): measure 3 allows the LD-1 rewrite and the listed LA-IC change lists, each reviewed by both reviewers. Otherwise the Must items D-8 and Cancel fail measure 3 by design.

### A-LAD-09: MINOR: the storage check is weaker than the cookie, and three page details are open

- **File:** `adr/LA-ADR-05-lti-advantage-completeness.md:104` (also `:94`; `security-delta.md:53`, `:66`).
- **Problem:** The storage check binds the flow to the browser less strongly than the cookie, although the design says it is the same. Three details of the platform storage pages are also open.
- **Evidence and fix:**
  1. **Binding.** :104 says the check "binds the OIDC flow to the browser in the same way as the cookie". But the server trusts a posted value.
     - A person who starts a login knows its state. That person can post the id_token without the cookie, read the `check` value from the storage-check page, and make another browser post `check` + `value`.
     - There is no `Origin` rule (security-delta:66). The page has `Referrer-Policy: no-referrer` (security-delta:53), so the browser sends `Origin: null`.
     - The gain equals residual R2 (`docs/architecture/open-questions.md:42`).
     - Fix: give the storage-check page `Referrer-Policy: same-origin`, and require `Origin` = `PUBLIC_LTI_URL` on `POST …/storage-check`. Or keep the rule, and record the equivalence with R2 instead of "the same way as the cookie".
  2. **Storage key limit.** Each login writes a new key `cog_state_<8>` (:94) and never removes it. R1 PS-07 limits one tool to 4,096 bytes and 500 keys. Fix: remove the key after `lti.get_data`, or reuse one key per tool and frame. State the limit.
  3. **Script encoding.** Rule 3 puts the auth URL and the state into an inline nonce script. `login_hint` and `lti_message_hint` come from the request. Fix: state the encoding (JSON with `<` escaped, or a `data-` attribute that the script reads).

### A-LAD-10: MINOR: multi-select picks do not fit the picker data model

- **File:** `adr/LA-ADR-05-lti-advantage-completeness.md:148`.
- **Problem:** Multi-select returns up to 20 publications from one picker session. But the data model keeps one `publication_id` per picker session. So the "Selected in {LMS}" stats and the retention exception count only one pick.
- **Evidence:**
  - D3b (:148).
  - `picker_session.publication_id`: "the picked course (set with used_at)" (`services/cogniate-app/src/domain/migrations/004_launch.sql:37`).
  - Retention keeps "a used pick not yet matched to a launch (kept, because `stats.activities` counts it)" (`docs/architecture/data-model.md:235`).
  - The LA `data-model.md` has no change for this.
- **Suggested fix:** Add a pick table (picker session, publication, resource link), or store one row per pick. Add a migration and a stats rule.

### A-LAD-11: MINOR: all libraries share one `admin` bucket through the app

- **File:** `adr/LA-ADR-06-service-operability.md:98`.
- **Problem:** The `admin` bucket (120 per minute per API key) is shared by all libraries. The app calls the Bearer route `GET /api/providers` for every `GET /app-api/lms-providers`, and it uses the same key for grant redemption.
- **Evidence:** `services/cogniate-app/src/app/connections.ts:172-173`. Redemption steps S1 and S3 and `getPlatform` use the same key (`services/cogniate-app/src/app/redemption.ts:327-331`). A busy Integrations page can make a redemption step get `429`.
- **Suggested fix:** Cache the providers answer in the app (it changes only when platforms change). Set a higher `admin` limit for the first-party key, or use a separate key for redemption.

### A-LAD-12: MINOR: several lanes own the same files in the same wave

- **File:** `README.md:170` (also `adr/LA-ADR-06-service-operability.md:130`; `adr/LA-ADR-04-refactor-and-migration.md:42-48`).
- **Problem:** The lane map gives the same LTI service and app files to several lanes in the same wave. Charter-LA §3 says two lanes never own the same file, so P3 must name one owner per file.
- **Evidence:**
  - LTI service, wave B2 (plan §5.3): lane L changes `services/lti-service/src/lti/login.ts` and `lti/launch.ts` (E3 platform storage) and `lti/registration.ts` (DR scopes). Lane S changes the same files and `lti/target.ts` (status and account resolver, LA-ADR-06:130), and `http/app.ts` (rate limits).
  - S3 (lane L) changes `lti/checks.ts` and `profiles/index.ts`, while E5 adds `tool_account` reads.
  - App: `tool-pages/launch.ts` and `tool-pages/picker.ts` get lane K (E1 routing and capabilities), lane L (E3 launch without context, Cancel, multi-select) and lane R (E4 placement upsert). `domain/score-syncs.ts` gets lane K (S4 disabled rule) and lane R (E4).
- **Suggested fix:** In P3, give each of these files one owner lane and a merge order. Or split the files first (for example, a login-page module for lane L).

### A-LAD-13: MINOR: all Blackboard schools share one fairness partition

- **File:** `adr/LA-ADR-03-learning-record-core.md:102` (also `adr/LA-ADR-04-refactor-and-migration.md:99`).
- **Problem:** The fairness key of `lti-ags` is the LTI platform id. All Blackboard schools use one shared platform, so they share one partition with `perPartition` 1, and one slow Learn host still delays every Blackboard school.
- **Evidence:** `partitionKey` = "the LTI platform id of the connection" (:102).
- **Suggested fix:** Use (platform, deployment) as the key for shared platforms.

### A-LAD-14: MINOR: the value of `tool_account.api_key_hash` for new accounts is not defined

- **File:** `adr/LA-ADR-06-service-operability.md:223` (also `contracts/lti-service-api-delta.md:193`).
- **Problem:** `tool_account.api_key_hash` is `NOT NULL UNIQUE`, and `POST /operator/v1/accounts` makes no API key. The design does not say what a new account writes into the column.
- **Evidence:** :223: "The old column stays (additive rule) and is no longer read". The column is defined at `services/lti-service/src/db/migrations/001_init.sql:5`. lti-service-api-delta:193: "No API key".
- **Suggested fix:** State that a new account writes the SHA-256 of 32 fresh random bytes that nobody holds (an unusable key). Test the create of two new accounts.

### A-LAD-15: MINOR: the placement upsert key and two backfill sources are not defined

- **File:** `data-model.md:82` (also `:78`, `:144`; `adr/LA-ADR-04-refactor-and-migration.md:97-98`).
- **Problem:** The placement upsert key and the encoding of `external_key` are not fixed, and two `014` backfill sources are not named.
- **Evidence:**
  - The unique key is (`connection_id`, `external_key`), and `external_key` is a JSON array string (:78, :82). The launch "upserts both rows (same id)" (:144).
  - If the SQL backfill and the runtime code make different JSON text for the same ids, the first launch after `014` inserts a second placement or hits the primary key.
  - `learning_record.outcome` and `course_version_id` are NOT NULL (:91-93), but LA-ADR-04:98 does not name their source.
- **Suggested fix:**
  - Use one encoding function, and the same SQL form in `014`. Upsert on `placement.id`.
  - In the migration test, launch an old resource link after `014`, and check that no new placement appears.
  - Take `outcome` and `course_version_id` from the attempt of the score row.

### A-LAD-16: MINOR: legacy blobs keep opening, so associated data never fully protects the rows

- **File:** `adr/LA-ADR-06-service-operability.md:261` (also `:263`, `:267`).
- **Problem:** `open` accepts legacy blobs (no associated data) in every sealed column while `legacy` is in the key ring. `legacy` must stay while old service keys exist, so the associated-data protection never becomes complete.
- **Evidence:** :261 (legacy blobs open), :263, :267 ("`legacy` stays while old service keys exist"); operability §6.3 CAUTION.
- **Suggested fix:** After a complete re-wrap, store a flag that refuses legacy-format blobs in sealed columns. Keep `legacy` only for `mac`.

### A-LAD-17: MINOR: the app operator CLIs do not use an operator API (scope of plan E5 Must 3)

- **File:** `contracts/cogniate-app-api-delta.md:157` (also `adr/LA-ADR-07-security-and-tenancy.md:111`, `:119`).
- **Problem:** Plan E5 Must 3 says that "the CLIs become clients of" the operator API. But the app CLIs (`app:grant`, `app:binding`) stay shell commands, and the operator states their own name (self-asserted).
- **Evidence:** app delta:157: "may later become clients of an app operator API; that is not in LA". LA-ADR-07:111 and :119 record residual R-LA-2. Plan E5 Must 3 is at `docs/team/ltiaas/plan.md:93`. R4 A-1 names the app operator commands.
- **Suggested fix:** The Lead confirms that Must 3 covers the LTI service only, and R-LA-2 goes to the human review list. Or plan the app part.

### A-LAD-18: NIT: some open consistency rows are already closed

- **File:** `adr/LA-ADR-06-service-operability.md:472` (also `adr/LA-ADR-07-security-and-tenancy.md:240`; `README.md:314`, `:365-367`; `contracts/lti-service-api-delta.md:316`).
- **Problem:** Some rows say "open", but the item is already done.
- **Evidence:**
  - ADR-06:472: data-model §4 already has `service_setting` and `issue_epoch` (data-model.md:164-165).
  - ADR-07:240: app delta §7 already has the evidence flags and `app:audit list` (app delta:151-154).
  - README:314: OC-5 is "Open", although plan v1.2 adds LA-H21..LA-H24. README §10 (:365-367) does not list LA-H24.
  - lti-service-api-delta:316 says that LA-IC-01 names only `channel`, but LA-ADR-04:129 now lists the trait fields too.
- **Suggested fix:** Close or remove these rows.

## Checks that the brief asks for

| Check | Result |
| --- | --- |
| Plan §1 goal | The channel-kernel shape meets it: one folder per channel, no LMS name in core, the generic channel and D2L, E5 controls, named backlog ports. Exception: A-LAD-01. As designed, the generic channel is not safe. |
| Plan §4 success measures | 1: F2 on the E2-N diff against the E2-K-done SHA (plan.md:144); OK. 2: the F1 ratchet reaches 0 at S9; OK. 3: conflicts with LA-IC-04 and LA-IC-12 (A-LAD-08). 4: K0 + K1 for `lti-generic` and `brightspace` (LA-ADR-02 test impact); OK. 5: guide F8.1, timed once; OK. 6: AP-06-01/02 (`429`), AP-06-14 (audit per route), AP-06-30 (launch and score during rotation); OK. |
| Every Must item decided | Yes: every Must item of plan §3 has a decision (README §7). |
| Human decisions recorded, not guessed | Yes: LA-H1..LA-H10, LA-H21..LA-H24, Q22, Q16 and LA-H8 (with the D14 options) are recorded. I found no guessed human decision. Two items need a Lead decision: A-LAD-08 and A-LAD-17. |
| A1 and A2 consistent | One real gap (A-LAD-05) and stale rows (A-LAD-18). The A-LAD-01 gap is shared: A1's LA-ADR-02 D3 and D5, and A2's security-delta §2.4, LA-ADR-07 D2 rule A2 and LA-ADR-08 D3 rule 6, use the same wrong assumption ("the issuer host vouches for the endpoints"). |
| Parallel lanes, one owner per file | Not shown yet; see A-LAD-12 for P3. |
| No behaviour change for Moodle, Canvas, Blackboard | E1 holds: golden outputs, frozen names, the fail-equivalent `lms` value, `privacyFloor` = today's `minimizeClaims`, generic check 14 with the same refused set, generation-0 key values, a `302` login for `platformStorage: null`. Every intended change has an LA-IC id. Gaps: A-LAD-06 (the JWKS of upgraded stacks) and A-LAD-02, A-LAD-07 (availability under the new limits). |
| Spec correctness (LTI Core, Security Framework, DL 2.0, AGS 2.0, NRPS 2.0, DR 1.0, platform storage drafts) | No other protocol error found. The storage origin (the OIDC auth origin), the reply checks, the empty DL response, `accept_lineitem`, launch without context with a `""` context key, the `path-prefix` issuer rule (with the trailing `/`) and the opaque DR token used only as a Bearer token all match the specs. DR, and the token request behind it, is unsafe as designed (A-LAD-01). |
