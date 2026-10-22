# LA-ADR-04: Refactor and migration of Moodle, Canvas and Blackboard into the kernel

Status: Proposed (A1, milestone LA P2, 2026-10-22). Epics: E0, E1 (Must), E4 data move (Must). Terms: [terms](../terms.md). Inputs: [plan v1.1 §3 E0, E1, §4, §6.1](../../../team/ltiaas/plan.md), [R3 §7.3](../../../research/ltiaas/R3-extensibility-audit.md) (migration risks M-1 to M-6), [R5 §4c](../../../research/ltiaas/R5-test-baseline.md) (regression tiers), [ADR-011 §14](../../adr/ADR-011-multi-lms.md#14-compatibility-migration-upgrade-and-rollback), [ADR-006](../../adr/ADR-006-storage.md) (migration rule).

## Context

- The three baseline channels must move into the kernel with **no behaviour change** (plan §1). M1, M2 and T7 must pass with only the reviewed closed-list rewrite of E0 (plan §4 measure 3, LD-1).
- E1 must change no storage command and may make only additive schema changes, each with a migration test (plan §3 E1).
- Two facts limit the schema work:
  - `connection.lms` has `NOT NULL DEFAULT 'moodle' CHECK (lms IN ('moodle','canvas','blackboard'))` (`services/cogniate-app/src/domain/migrations/011_lms_types.sql:4`). SQLite cannot change a CHECK without a table rebuild. The runner runs each file in one transaction with foreign keys on, and eight foreign keys reference `connection`, so a rebuild does not fit (R3 M-1; ADR-011 §1 fact 4).
  - An old build refuses a database with migrations that it does not know (ADR-011 §1 fact 4). Rollback is the ADR-011 §14 backup-and-restore procedure.
- Tests and clients read wire names that contain LMS words or LTI words: `canvasConfiguration`, `/canvas-configuration`, `createMoodleCourse`, `resourceLinkId`, `scoreSyncs`, the `score_sync` log event (R3 M-4; `apps/portal/src/types.ts:9,191,207`).
- No stack suite has run at HEAD; the baseline must come first (R5 §1.3).

## Decision

### D1. Order of work (strangler steps)

Each step keeps the product working and is one reviewable task (P3 makes the task specs). A step changes no behaviour unless this table says so.

```mermaid
flowchart LR
  E0[E0 baseline<br/>G-BASE rebase, golden outputs,<br/>LD-1 rewrite] --> S1[S1 unblock:<br/>open Zod enum]
  S1 --> S2[S2 kernel package +<br/>3 manifests]
  S2 --> S3[S3 LTI profiles into<br/>channel folders]
  S2 --> S4[S4 migration 013 +<br/>channel and authority reads]
  S4 --> S5[S5 setup adapters +<br/>authority strategies]
  S5 --> S6[S6 extension ports:<br/>Canvas JSON, WS, shell, .mbz]
  S3 & S6 --> S7[S7 texts from manifests]
  S2 --> S8[S8 portal shell from registry]
  S7 & S8 --> S9[S9 lint ratchet = 0,<br/>add-channel gate, canary]
  S9 --> E2K[E2-K generic traits, DR fixes,<br/>lti-generic]
  E2K --> E2N[E2-N brightspace folder<br/>gate: 0 core files]
  S4 --> E4[E4 migration 014 +<br/>outbox and AGS reporter]
```

| Step | Change | Lane | Behaviour change | Proof (beyond `npm run check` with unit tests and K0) |
| --- | --- | --- | --- | --- |
| E0 | Rebase on G-BASE (LA-H10); QA records the baseline and the golden outputs (D6); QA rewrites the closed-list assertions once (LD-1) | QA | none | baseline run (R5 §6 item 1) |
| S1 | The app accepts any `lms` string in `GET /api/providers` (`services/cogniate-app/src/clients/lti-client.ts:55`); the app ignores a profile that no adapter owns | K | none (all answers today have known values) | golden `GET /app-api/lms-providers` |
| S2 | `packages/channel-kernel`; manifests for `moodle`, `canvas`, `blackboard`; registry loaders; legacy capability projection. S2 also installs the channel build model (LA-ADR-01 D1), the scope file `packages/channel-kernel/fitness-scope.json`, F1 (the LMS-name lint) with today's per-file counts as the ratchet baseline, F3 (the import fence) and the F5 SQL portability lint for new SQL files, so no later step can add an LMS name to core (QA Q-LAD-18) | K | none | K0: projection equals the M1 capability objects (golden); F1, F3 and the build-model probe pass on the S2 tree |
| S3 | `profiles/{standard,canvas,blackboard}.ts` move to `packages/channels/*/lti-profiles.ts`; traits `endpoints`, `privacyFloor`; generic check 14; `channel` field on `GET /api/providers`; text names from manifests; `PUBLIC_MOODLE_URL` leaves the services: `moodle` leaves `PublicUrls` (`packages/shared/src/config.ts:18,43`); no service reads it, and the infra scripts read the variable themselves (Reviewer-B B-LAD-19) | L | additive `channel` field only | golden `GET /api/providers` (plus `channel`); check 14 refusal table; M1 sim protocol rows |
| S4 | Migration `013` (D4); the connection repository reads `channel` and `binding_authority`; routing, the disabled rule and the cleanup read the stored authority and target kind | K | none | migration test (D4); M1 `migration` and `snapshot-upgrade` phases; R1 tier |
| S5 | `ConnectionSetup` port for all three channels (Moodle create rules and the six-value parser move into `packages/channels/moodle/app.ts`); authority strategies `self` and `operatorGrant`; operator CLI by authority | K | none | M1 sim rows (grants, redemption, suspend, release); T4b1 manual connect |
| S6 | Extension ports: Canvas JSON route, web services route, course-shell hook, `.mbz` exporter move into their folders behind capability guards, with frozen paths | K | none | golden Canvas JSON (url and inline); T8 subset; M1 guard rows |
| S7 | `{LMS}` texts from manifests in tool pages, player, `packages/tracking`, LTI service pages; closed name unions become `string` | K, L | none (Moodle text name is `Moodle`) | golden error pages and status texts per channel |
| S8 | Portal shell: registry routes, manifest cards, manifest wizard; Moodle, Canvas and Blackboard modules move into their folders | P | none visible | M2 (64 cases); T6 subset |
| S9 | The F1 ratchet counts reach 0 in core; add-channel gate F2 on; QA canary channel | K, QA | none | the fitness checks themselves |
| E4 | Migration `014` (D5); outbox and job runner; AGS reporter | R | none | migration test (D5); T5a, T5b (P2, P5, P11), T7 |

S3 (lane L) and S8 (lane P) touch other files than S4–S6 (lane K), so they can run in the same wave. But E1, E3, E4 and E5 share several hot files in waves B1–B3 (Reviewer-B B-LAD-06, Reviewer-A A-LAD-12). README §6 lists each hot file with one proposed owner lane and the order of edits; P3 fixes the final owners and the migration numbers. E2-K and E2-N follow S9 ([LA-ADR-02 D8](LA-ADR-02-generic-lti-channel.md#decision)). E4 starts the shared launch and score files only after S4 and S5 land.

F5 rules start with the step that makes them true (QA Q-LAD-18): no core read of `connection.lms` from S4; no product SQL on `score_sync` from E4 (migration `014`); channel SQL table names (LA-ADR-01 D5) from S6; the SQL portability lint for new SQL files from S2; A2's rules with their E5 items (no `'/lti/launch/'` literal outside the account resolver with E5 D2; no `DELETE FROM audit_event` outside its job with E5 D4).

### D2. Frozen wire names

These names stay byte for byte, although they contain an LMS word or an LTI word. Only `packages/channel-kernel/src/legacy-wire.ts` may hold the LMS-named ones (LMS-name lint exception, [LA-ADR-01 D10](LA-ADR-01-channel-kernel.md#decision)).

| Kind | Frozen names |
| --- | --- |
| DTO fields | `lms`, `capabilities` with the six legacy flags, `webServices`, `serviceUrl`, `platform.*`, `registrationUrl`; the publication fields `moodleCourse`, `shellStatus`, `shellError` (app contract §11; LA-ADR-01 D5 `dtoFields`; Reviewer-B B-LAD-03) |
| Request fields | `lms`, `profile`, `createMoodleCourse` |
| Paths | `/app-api/lms-providers`, `…/canvas-configuration`, `…/web-services`, `…/deployments`, `…/mbz`, `…/download?kind=mbz`, `/integrations/moodle/…`, `/integrations/canvas/…`, `/integrations/blackboard/…` |
| Error details | `details.capability` values of the M1 guards |
| Error and page codes | `MOODLE_TOOL_MAY_EXIST` (app contract §6; its text `pendingToolText` moves byte for byte from `packages/shared/src/html.ts:8-12` to `legacy-wire.ts`, BD-A1-30); the M1 default descriptions of `PLATFORM_IN_USE`, `DEPLOYMENT_IN_USE` and `DEPLOYMENT_FIXED` (frozen values in `legacy-wire.ts`, BD-A1-56), `MOODLE_WS_ERROR` (`services/cogniate-app/src/app/api-errors.ts:45`) |
| Values that core writes | the behaviour-class values `moodle`, `canvas`, `blackboard` of the frozen `connection.lms` column (D4 rule 2); the lists `MANUAL_SELF_LEGACY_CHANNELS` (load check 6, one entry: the Moodle channel) and `LAUNCH_GUARD_CHANNELS` (load check 8: the Canvas and Blackboard channels). The frozen `lms` value of each `GET /api/providers` profile (`null` for `standard`) is profile data `wireLms` in the channel folders (LA-ADR-01 D6; QA Q-LAD-17). The frozen map `BASELINE_PROFILE_WIRE_LMS` (eight baseline profile ids and their values) is in `legacy-wire.ts`, so load check 7 can tell the baseline profiles (build ratification BD-A1-06). |
| Ids and records | `rl_…`, `sync_…`, `resourceLinkId`, `scoreSyncs`, `lastScoreSync` |
| Log events | `score_sync`, `resource_link_rebound`, `launch_rejected` reasons, `provider_not_ready`, every ADR-011 event |
| Schema | every table and column name (applied migrations are history; ADR-006) |

### D3. App API and portal route compatibility

- Every change is additive ([app API delta](../contracts/cogniate-app-api-delta.md)). A request without the new fields behaves as today.
- The three baseline portal routes keep their URLs because the generic route pattern `/integrations/:channelId/…` gives the same paths. The server allowlist (`services/cogniate-app/src/app/portal.ts:29-30`) uses the same pattern.
- The LTI service API is additive too (`channel` on `GET /api/providers`; E2 fields). A2 owns that delta ([lti-service-api-delta](../contracts/lti-service-api-delta.md)).

### D4. Migration `013_channel_kernel.sql` (E1, step S4)

| Table | Change | Backfill | Meaning |
| --- | --- | --- | --- |
| `connection` | `channel TEXT` | `= lms` | the channel id; core reads only this |
| `connection` | `binding_authority TEXT CHECK (binding_authority IN ('self','operatorGrant','verifiedAdminLaunch'))` | `moodle` → `self`; `canvas`, `blackboard` → `operatorGrant` | the authority used to bind (D7 of LA-ADR-01) |
| `binding_attempt` | `target_kind TEXT CHECK (target_kind IN ('exclusive_platform','platform_deployment','shared_deployment'))` | Canvas `initial` → `exclusive_platform`; Canvas `add_deployment` → `platform_deployment`; Blackboard → `shared_deployment` | the record kind for cleanup (R3 S9, S12) |
| `binding_grant` | `bound_values TEXT` (JSON) | `NULL` | the admin values of an admin-value binding ([LA-ADR-02 D6](LA-ADR-02-generic-lti-channel.md#decision)) |

Rules:

1. **Writes.** A new connection writes `channel` and `binding_authority` in its insert. `channel` never changes. `binding_authority` changes at most once: from `self` to `operatorGrant`, for a `pending` dynamic connection whose registration breaks the self invariant I-SELF ([LA-ADR-02 D2a, D5 item 10](LA-ADR-02-generic-lti-channel.md#decision)); the change happens in the same transaction that records the staged platform, and that transaction also writes `lms = 'canvas'` (the behaviour class of `operatorGrant` with an exclusive platform, rule 2), so the class always matches the authority (Reviewer-A A-LAD-20).
2. **The frozen `lms` column.** A new connection of a baseline channel writes `lms` = its channel id. A connection of any other channel writes its **behaviour class**: `moodle` for `self`; `canvas` for `operatorGrant` with an exclusive platform; `blackboard` for `operatorGrant` with a shared platform. Reason: the CHECK allows only these values. A missed old read of `lms` then still selects the same authority rules (fail-equivalent, not fail-open).
3. **Reads.** Core never reads `connection.lms`. The connection repository maps `channel` (never `NULL` after the backfill) and carries one comment rule above the mapping: "never read `connection.lms`; it is a frozen behaviour class" (Reviewer-B B-LAD-17). A fitness check in `npm run check` fails when product SQL outside the repository names `lms` of `connection`.
4. **`binding_grant.lms`** has no CHECK (`011_lms_types.sql:30`); new grants store the channel id.
5. **Writer test.** A staged Dynamic Registration of an `lti-generic` connection leaves `binding_authority = 'operatorGrant'` and `lms = 'canvas'` (A-LAD-20).
6. **Migration test (Must, plan E1 constraint).** On a copy of every M1 fixture database: after `013`, every row has `channel = lms`, the expected `binding_authority` and `target_kind`; every API answer of the golden set is equal; an `012` build refuses the `013` ledger (ADR-011 §1 fact 4).

### D5. Migration `014_learning_records.sql` (E4)

| Step | Rule |
| --- | --- |
| 1 | Create `placement`, `learning_record`, `record_dispatch`, `job_lease` ([data-model §3](../data-model.md#3-cogniate-app-migration-014-e4-learning-records-and-job-runner)). |
| 2 | One `placement` per `resource_link` row: same id, same `connection_id` and `publication_id`, `external_key` = `json_array(deployment_id, context_id, resource_link_id)`, `graded = 1`. The runtime code makes `external_key` with one encoding function whose output equals SQLite `json_array` text for the same three strings, and upserts on `placement.id` (= `resource_link.id`), never on `external_key` (Reviewer-A A-LAD-15). |
| 3 | One `learning_record` (kind `final`) per `score_sync` row: its `attempt_id`, `resource_link_id` as `placement_id`, `user_sub`, score, `occurred_at = created_at`; `outcome` and `course_version_id` from the row's attempt (A-LAD-15). The record id is derived from the sync id (`rec_` + the sync id body), so the step is repeatable in a test. |
| 4 | One `record_dispatch` per `score_sync` row: the same id and every state column copied (status, tries, times, `last_error`, `resent_at`, `send_started_at`, `delivery_uncertain`, `confirmation_after`, `payload`, scores); `reporter = 'lti-ags'`; no lease. `partition_key` is total (Reviewer-A A-LAD-04): the connection's `lti_platform_id`; else the reservation's `lti_platform_id` + `:` + its deployment id; else `connection.target_platform_id` (`012`) + `:` + the row's resource link deployment id; else the connection id. A released Blackboard connection has neither `lti_platform_id` nor a reservation, so it takes a later branch; its rows are never sent anyway (disabled connection). |
| 5 | `score_sync` stays unchanged and is never read or written after `014` (frozen copy). |

The migration runs at the first start, before the job runner starts (today `recoverInterruptedSends` runs at worker creation, `services/cogniate-app/src/worker/score-sync.ts:39`). A copied row with `send_started_at` has no lease, so the recovery rule of [LA-ADR-03 D7](LA-ADR-03-learning-record-core.md#decision) (rows with no live lease of another instance) makes it `delivery_uncertain`, exactly as today (Reviewer-A A-LAD-05).

**Migration test (Must).** Every `score_sync` row has one equal `record_dispatch` row and one record; every `resource_link` has one placement; the results API JSON, Resend answers and the play status answer are equal before and after; a P2 fixture (a row with `send_started_at` set and a pending confirmation) behaves as in T5b after the restart. Two more fixtures: a released Blackboard connection with score rows (`014` succeeds; A-LAD-04), and a launch of an old resource link after `014` (no new placement appears; A-LAD-15).

### D6. Regression proof (Must)

| Item | Content |
| --- | --- |
| Golden outputs (E0) | Recorded at the G-BASE SHA and compared after every step: `GET /api/providers`; `GET /app-api/lms-providers`; connection DTOs per channel and status; tool-configuration rows per channel; Canvas JSON (`jwk=url` and `jwk=inline`); `/healthz` of both services; every tool error page per channel (HTML); player status texts; results API rows; simulator records per M1 scenario (stored claims, client assertion `aud`, Deep Linking items). The only allowed differences are the additive fields (`channel`, `channelName`, `channelCapabilities`) and the D8 items. |
| Tiers (R5 §4c) | R0 on every commit (`npm run check` with K0 and the fitness checks, about 1.5 min). R1 (M1 `--phase sim --provider all`, 394 rows, and M2, 64 cases; about 40 min on the simulator slot) before the QA PASS of each step that changes a runtime path: S3, S4, S5, S6, S8 and E4. S1, S2, S7 and S9 use R0 plus the golden compare of the step; the wave-end gate runs R1 for them (Reviewer-B B-LAD-11, plan LD-4). R2 at the end of E1 and at the final SHA: T7 (3 × 17) and the legacy suites, about 1.5–2.5 h on the Moodle slot; R2-lite after S3, S5, S6 and S7 (plan LD-8). QA aligns the strategy tiers (QA strategy §4.4). |
| Schema steps | S4 and E4 add the M1 `migration` and `snapshot-upgrade` phases once each. The 70 storage rows stay out, because no storage command changes (plan E1 constraint; LD-3). |
| Assertions | Only the E0 open-world rewrite changes test assertions (LD-1). QA owns that list (QA strategy §4.3); it must cover every exact list and count of profiles, providers, LMS entries, cards and simulation profiles, also `tests/acceptance/M1/canvas/11-canvas-platforms.test.ts:255` and `tests/acceptance/M1/common/90-simulation-gates.test.ts:19` (QA pre-review Q-LAD-08). Any other assertion change in M1, M2 or T7 is a behaviour change and needs an `LA-IC` id (D8) or the Lead. |
| Intended changes | Only the items of D8, each with its id. A golden difference or a frozen-test failure without an id is a FAIL (QA strategy §4.7). |

### D7. Rollback

- Every migration is forward only. No ledger entry is edited or deleted.
- Rollback uses the ADR-011 §14 procedure unchanged: stop both services, `stack:data-restore` of the verified backup made before the first start of the new revision, then the old revision. No storage command changes in LA.
- WARNING: a rollback loses every write after the backup: connections, grants, launches, attempts, learning records and dispatches. After a rollback across `014`, scores that the LMS accepted stay in the LMS gradebook; the portal no longer shows their dispatch rows.
- `013` alone is safe to roll back with the same procedure: the old build reads `lms`, which keeps the M1 values for every baseline connection. A connection of a new channel does not exist before E2.

### D8. Intended behaviour changes (ids `LA-IC-nn`)

Each id names the golden fields and the frozen tests that it changes. Plan LD-9 rules the test changes: QA makes one reviewed list per `LA-IC` at the task that ships it, and both reviewers approve the list. The owner of the design writes the exact expected values in its ADR.

| Id | Change | Epic | Design | Golden fields changed | Frozen tests touched (QA confirms) |
| --- | --- | --- | --- | --- | --- |
| LA-IC-01 | Additive wire fields: `channel`, `channelName`, `channelCapabilities` (connection DTO, `lms-providers` entries); `bindingAuthority` (connection DTO; BD-A1-24, lands with LA-E1-07); `channel` on each `GET /api/providers` profile (E1); the trait fields `endpoints`, `issuerKind`, `endpointOrigins` on each `GET /api/providers` profile (E2-K; values in A2's [lti-service-api-delta §4.7](../contracts/lti-service-api-delta.md)) | E1 S2, S3; E2-K | [LA-ADR-01 D6, D11](LA-ADR-01-channel-kernel.md#decision); [LA-ADR-02 D2](LA-ADR-02-generic-lti-channel.md#decision) | new fields only; every baseline field equal | whole-object assertions that LD-1 does not open |
| LA-IC-02 | The LTI service no longer requires `PUBLIC_MOODLE_URL`. The outbound allowlist still comes from `MOODLE_HOST` (`infra/compose.yaml:135`), so `/healthz` does not change | E1 S3 | this ADR, D1 | none expected | none expected |
| LA-IC-03 | Moodle DR accepts an issuer with a path (`path-prefix`); the configuration URL must be the issuer plus `/mod/lti/openid-configuration.php`, so another path on the Moodle site is refused; host-root Moodle unchanged | E2-K | [LA-ADR-02 D2, D5](LA-ADR-02-generic-lti-channel.md#decision) | none for the baseline | a Q18 refusal test, if one exists |
| LA-IC-04 | No NRPS scope in any channel: Canvas JSON `scopes`, the DR request scope, Moodle manual row 13 "Do not use this service" | E3 | A2 [LA-ADR-05 D4](LA-ADR-05-lti-advantage-completeness.md) | Canvas JSON, Moodle tool rows, DR request | M1 Canvas JSON rows, T4b1 and T7 tool-row checks |
| LA-IC-05 | A valid launch without a context opens the player | E3 | A2 [LA-ADR-05 D2](LA-ADR-05-lti-advantage-completeness.md) | the `not_resource_link` refusal page for that case | a test that expects the refusal, if one exists |
| LA-IC-06 | Platform storage launch when the state cookie is missing | E3 | A2 [LA-ADR-05 D1](LA-ADR-05-lti-advantage-completeness.md) | login page for profiles with `platformStorage` | none for profiles with `platformStorage: null` |
| LA-IC-07 | Ungraded placements (channels with `content.ungraded` only) get a record, no dispatch, and "Not graded in {LMS}"; the Canvas JSON gets the `link_selection` placement | E3 Should (LA-H22) | A2 [LA-ADR-05 D5](LA-ADR-05-lti-advantage-completeness.md); [LA-ADR-03 D2](LA-ADR-03-learning-record-core.md#decision) | results rows of ungraded placements; Canvas JSON | B-PF-03 checks for ungraded placements only; the M1 Canvas JSON rows |
| LA-IC-08 | Claim policy per tool account; the `cogniate` account moves to `allowlist` (D-9), so Moodle launches keep only the allowlist claims | E3 Should (LA-H4) | A2 [LA-ADR-05 D7](LA-ADR-05-lti-advantage-completeness.md), [security-delta](../security-delta.md) | stored Moodle claims; `GET /api/idtoken` (`raw=true`) for Moodle; `launch_claims_minimized` lines | tests that read Moodle `custom`, `lis`, name or e-mail claims (QA scan) |
| LA-IC-09 | After `014`, the T5b P5 fixture must delete the failed row in `record_dispatch`, not in `score_sync` (`tests/host/p5-fixture.mjs`) | E4 | [LA-ADR-03 D4](LA-ADR-03-learning-record-core.md#decision), D5 above | none (product behaviour equal) | the P5 fixture only; the Lead decided it (plan LD-6): the fixture deletes the same row in `record_dispatch`, the assertions do not change, both reviewers review the fixture diff |
| LA-IC-10 | E5 service changes (rate limits `429`, API key table, signing-key states, audit) | E5 | A2 [LA-ADR-06](LA-ADR-06-service-operability.md) | A2 lists them | A2 lists them; M1, M2, T7 must stay green (AP-06-18) |
| LA-IC-11 | A platform `429` (and the Canvas throttling `403`) becomes `429 PLATFORM_RATE_LIMITED`; the outbox keeps the row `pending` until `Retry-After` and pauses the partition (`throttled`). Today both become `502 PLATFORM_ERROR` in the LTI service and are retried with the normal backoff. | E4, E5 | [LA-ADR-03 D5, D7](LA-ADR-03-learning-record-core.md#decision); A2 [lti-service-api-delta §1.3](../contracts/lti-service-api-delta.md) | score sync rows after a throttled send | none in M1, M2, T7 (no test sends `429`) |
| LA-IC-12 | Deep Linking: a "Cancel" button on the picker page and on the "No course is published" page; `POST /api/deeplinking {contentItems: []}` gives `200` (was `400`); an item with `lineItem` gives `400 INVALID_CONTENT_ITEM` when the launch has `accept_lineitem: false`; `acceptLineItem`, `acceptMediaTypes` in the shaped token | E3 | A2 [LA-ADR-05 D3](LA-ADR-05-lti-advantage-completeness.md) (exact values in its §5 table) | picker page HTML; `deepLinkingSettings` | tests that click the only picker button; a test that expects `400` for an empty list; whole-object checks of `deepLinkingSettings` (QA scan) |
| LA-IC-13 | Could gaps: `scoreGiven: null` accepted as absent (was `400`); an NRPS claim without `2.0` in `service_versions` gives `403 SERVICE_NOT_AVAILABLE`; an untrusted extra `aud` fails check 5 | E3 Could | A2 [LA-ADR-05 D10](LA-ADR-05-lti-advantage-completeness.md); [LA-ADR-07 D8](LA-ADR-07-security-and-tenancy.md) | none for the baseline platforms | tests that expect `400` for `scoreGiven: null` (QA scan) |
| LA-IC-14 | Canvas Dynamic Registration (D-1): the Canvas legacy flag `dynamicRegistration` becomes `true`, Canvas gets the `dynamic` method, and a Canvas `method: dynamic` create is accepted (staged with a grant) | E3 Should | A2 [LA-ADR-05 D6](LA-ADR-05-lti-advantage-completeness.md) | K0 legacy projection of Canvas; `GET /app-api/lms-providers` Canvas `methods` | `tests/acceptance/M1/canvas/11-canvas-platforms.test.ts:218`, `:241`, `:257` (QA Q-LAD-16) |
| LA-IC-15 | The score `409` conflict text names the connection's channel: "({LMS} has a grade with a newer time)" instead of "(Moodle has a grade with a newer time)" on every row (BD-A1-27). E1 keeps the frozen text byte for byte | E4 (LA-E4-03, lane R) | [LA-ADR-03 D5](LA-ADR-03-learning-record-core.md#decision); LA-E4-03 AC-01 | G3 `canvas/` and `blackboard/` `publications/B-conflict/results/0/scoreSyncs/0/lastError` | tests that read the conflict `lastError` of a Canvas or Blackboard row (QA scan) |
| LA-IC-16 | The simulator allowlist hosts of the `acceptance` profile come from `tests/sim/hosts.json` (README §4b), so each new simulator provider adds its hosts to the `acceptance` LTI `outbound_allowlist` (BD-A1-36). A rule, not a frozen list: in `acceptance.*Health.outbound_allowlist`, the entries that end in `.sim.test` equal, as a set, the union of the manifest allowlist hosts at the compared SHA; every other entry equals G-BASE. The `default` profile `/healthz` stays strictly equal | E7 (LA-E7-02, on LA-E7-03) | README §4b; [LA-ADR-02 D7](LA-ADR-02-generic-lti-channel.md#decision) | G1 `acceptance.ltiHealth.outbound_allowlist` (compared by the rule) | `tests/ltiaas/tasks-lti/LA-E1-05/profiles.k1sim.test.ts` (AC-LA-E1-05-07 compares by the rule) |
| LA-IC-17 | Moodle `PUT /app-api/connections/:id/platform` refuses unknown body keys with `422 INVALID_PLATFORM_VALUES` and the key in `details.fields` (before: ignored), as Canvas and Blackboard do: one strict-body rule for every channel (the D5 port contract; BD-A1-41; Reviewer-A A-LA-E1-07-01) | E1 (LA-E1-07, lane K) | [LA-ADR-01 D5](LA-ADR-01-channel-kernel.md#decision); app API delta §3.4 | none expected (the portal and the frozen T4b1 bodies send exactly the six keys) | none expected; QA confirms with a scan (LD-9 list, may be empty) |
| LA-IC-18 | Portal looks that now follow the manifest (BD-A1-50; Reviewer-A A-LA-E1-11-02): (a) the publish modal names the connection's LMS ("Published to Canvas", "the Canvas content picker"; before: "Moodle" for every LMS); (b) the Connect-page logo uses the card colour (Blackboard: blue, as on its card; before: red there); (c) the logo has a `title` tooltip | E1 (LA-E1-11, lane P) | [LA-ADR-01 D9](LA-ADR-01-channel-kernel.md#decision) | none | none expected; QA-E2E confirms for K2 U1/U2 and M2 (LD-9 list, may be empty) |
| LA-IC-19 | The `410 RUNTIME_EXPIRED` body of `GET /rt/{token}/state` names the session's channel: "…Open the activity again in {LMS}." (before: "Moodle" for every channel). Moodle sessions keep the same bytes (BD-A1-57) | E1 (LA-E1-09, lane K) | [LA-ADR-01 D12](LA-ADR-01-channel-kernel.md#decision) | none (not golden-pinned) | none expected; QA confirms by scan (LD-9 list, may be empty) |

### D9. Merge with the Blackboard and Canvas run

LA starts on the frozen candidate (LA-H10 recommendation). Lane K rebases at each wave end and owns the merge of the E1 files. A change of the other run in a file that E1 moves (for example `services/cogniate-app/src/providers/canvas.ts`) is merged into the new channel folder file, with the golden outputs as the check.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| A table rebuild to change the `lms` CHECK | Not possible inside the migration runner with foreign keys on (R3 M-1); forbidden by ADR-011 §1 fact 4. |
| Write `moodle` into `lms` for every new channel | A missed old read would treat an operator-grant channel as Moodle and route launches without an approval (fail-open). The behaviour class is fail-equivalent. |
| One big-bang refactor | Not reviewable; no golden comparison per step; high merge risk with the other run. |
| Move `score_sync` rows by an `UPDATE` or rename | Breaks the frozen-table rule and the foreign keys; copying keeps the old table as evidence. |
| Skip the backfill of old dispatch rows | The results API and Resend would read two tables. |

## Consequences

- E1 has one migration (`013`), E4 one (`014`), E2-K one small LTI service migration. Each has a migration test.
- `connection.lms` and `score_sync` stay as frozen columns and tables. A later clean-up (LG, with the Postgres move) can drop them.
- The golden outputs make "no behaviour change" a checkable claim, not a review opinion.

## Migration and compatibility

This ADR is the migration and compatibility record. Table details: [data-model](../data-model.md). App API: [app API delta](../contracts/cogniate-app-api-delta.md).

## Test impact

The proof of D6. QA owns the exact suites, slots and the golden-output tool ([`tests/ltiaas/TEST-STRATEGY.md`](../../../../tests/ltiaas/TEST-STRATEGY.md) §4).

## Open questions

| Id | Question | Default until decided |
| --- | --- | --- |
| LA-H10 | Start the build on the frozen candidate or wait for the full Blackboard and Canvas acceptance | Frozen candidate; rebase at each wave end |
