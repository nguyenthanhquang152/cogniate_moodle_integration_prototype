Verdict: CHANGES_REQUESTED
Round: 1

# Architect A1 conformance, milestone LA (final SHA `8fadb828`)

Scope: every decision in A1's files (README, terms, LA-ADR-01..04, data-model, cogniate-app-api-delta, epics, task specs; BD-A1-01..118), checked against the code at `8fadb828` with `git show` and `git grep` only. Integration `aad1619d` has the same product files (`git diff 8fadb828 aad1619d -- services packages apps infra` is empty). No Docker, no test run.

**Result.** The product conforms. No product change is required. Doc drift that no BD row recorded is now fixed in A1's files (BD-A1-118). The verdict is `CHANGES_REQUESTED` only because the LA-IC table cannot be confirmed in full: four test-change records are missing (see "Required before round 2"). They are records, not code.

Paths: `app/` = `services/cogniate-app/src/`, `lti/` = `services/lti-service/src/`, `kernel/` = `packages/channel-kernel/src/`, `ch/` = `packages/channels/`.

| Design item | Status | Evidence at `8fadb828` | Note |
| --- | --- | --- | --- |
| ADR-01 D1 channel folders, build, imports | Built | `ch/tsconfig.portal.json:11`; `eslint.config.js:186-250`; `apps/portal/vite.config.ts:7-8` | Vite `fs.allow` is the repo root (dev only): recorded BD-A1-118 |
| D2 manifest schema (icon, toolRows, connectionCheck, texts.errors, texts.registration) | Built | `kernel/manifest.ts:57-113,156-193` | |
| D3 capabilities, legacy projection | Built | `kernel/capabilities.ts:48-66,99-148`; `kernel/legacy-wire.ts:74-83` | Frozen `details.capability` strings at guard sites: recorded BD-A1-118 |
| D4 registry, load checks 1–8, 14 | Built | `kernel/registry.ts:157-215`; `lti/profiles/schema.ts:25-118`; `lti/lti/checks.ts:251-258` | BD-A1-06, -22, -23, -74, -79, -99 |
| D5 ConnectionSetup, PortContext (seal by column), ChannelSql, BuildQueue, K0 surface | Built with recorded deviations | `app/kernel/ports.ts:244-305`; `app/kernel/port-context.ts:35-192`; `tests/ltiaas/k0/contract.test.ts:1132-1192` | BD-A1-20, -28, -29, -35, -47, -85, -110; BD-A2-91. Recorded now (BD-A1-118): the member `sharingOf`, the reason `issuerOrigin`, the label from `names.label` |
| D6 familyGuardVerdict phases, privacyFloor, wireLms | Built | `kernel/family-guard.ts:8-22`; `lti/http/routes/registration.ts:178`; `app/kernel/launch-router.ts:35` | BD-A1-39, -54, -55 |
| D7 authority, routing; D8 extras as capabilities | Built | `app/kernel/authority/index.ts:9-13`; `app/domain/connections.ts:239-248`; `app/kernel/extensions.ts:31-86` | |
| D9 portal from manifest, ManifestWizard | Built | `apps/portal/src/Integrations.tsx:95,153`; `apps/portal/src/channels/ManifestWizard.tsx:156-165` | BD-A1-44, -49 |
| D10 F1 (no LMS name in core) and exceptions | Built | `infra/scripts/fitness/lms-names.mjs`; `f1-baseline.json` (all 0) | Exceptions: `legacy-wire.ts`, applied migrations, the 013 literals (BD-A1-19, -73) |
| D11 frozen wire projection; D12 texts | Built | `kernel/legacy-wire.ts:63-116`; `kernel/text.ts:19-47`; `app/app/redemption.ts:233` | BD-A1-31, -56, -101, -111, -112 |
| README F2–F5, N10 | Built; N10 has a test gap | `infra/scripts/fitness/{channel-diff.mjs,rules/*.mjs}`; `eslint.config.js` | N10: see follow-up 1 |
| ADR-02 D1–D4 channels, traits, I-SELF, `lti-generic`, `brightspace` | Built | `ch/{lti-generic,brightspace,canvas,blackboard,moodle}/lti-profiles.ts`; `lti/profiles/registry.ts:27-31`; `lti/lti/platform-rules.ts:54-119` | BD-A1-74, -75, -83, -99, -105, -108, -109, -111, -112; `lti-generic` storage trait from E3 (LA-ADR-05 D1 rule 1a) |
| D5 DR fixes, items 1–8 and 10 | Built | `lti/lti/registration.ts:127-216,321-327`; `lti/http/routes/registration.ts:220-418` | Item 9 (Could) not built. Start floor as made exact by BD-A2-94/95 (ADR text aligned now) |
| D5 item 5, guarded family at `complete` | Built with recorded deviation | `lti/http/routes/registration.ts:348-352`; `app/tool-pages/register.ts:172-182` | Safe refusal, but the app shows `REGISTRATION_FAILED`, not `PROVIDER_PROFILE_MISMATCH`, when another loaded channel owns the family: known limit (BD-A1-118); see follow-up 2 |
| D6 grants for admin values; staged DR (BD-A1-90, -91, -97, -106, -107) | Built | `app/app/operator.ts:173-267`; `app/app/redemption.ts:124-126,226-338`; `app/domain/connections.ts:212-218`; `app/tool-pages/register.ts:77-89,149-182` | A site mismatch after `complete` records `last_error_*` (doc aligned, BD-A1-118) |
| App delta §1–§3 (DTO, lms-providers, create with a ref, tool rows, strict bodies) | Built | `app/app/connections.ts:87-241`; `app/kernel/setup/admin-value.ts:12-142` | A staged connection gets `409` on registration-url (doc aligned, BD-A1-118) |
| ADR-03 D1–D8 records, placements, dispatch, reporter, job runner, guards | Built with recorded deviations | `app/domain/migrations/014_learning_records.sql:2-99`; `app/kernel/records/**`; `app/drivers/lti-ags/**`; `packages/shared/src/jobs.ts` | BD-A1-10, -14, -46, -61, -66, -70, -71. The web-process conflict path follows LA-E4-01 AC-09 (doc aligned, BD-A1-118) |
| D2 ungraded rule; D9 backlog ports | Not built | — | LA-H22 (LA-E3-08, -14, LA-E4-08); D9 is names only by design |
| Data model §1–§5b, migrations | Built | app `013`–`018`; LTI `005`–`021` | `015` is named `015_audit_event.sql`; extra index `record_dispatch_started`; `018` index and copy of single picks (doc aligned, BD-A1-118). `admin_launch_code` not built (LA-H24) |
| App delta §6–§8a (results, refused-event codes, log events, metrics) | Built | `app/app/results.ts:57-61`; `app/app/operator.ts`; `app/app/metrics.ts:42-223` | `job_run` is `warn` for a failed run (doc aligned, BD-A1-118) |
| ADR-04 D2 frozen values; D4 rules 1–5 (`013`); D5 (`014`) | Built | `kernel/legacy-wire.ts:10-116` (byte-equal to `1b17261`); `app/domain/connections.ts:145-218` | |
| D8 LA-IC-01 to -06, -10 to -23 | Built, as their rows say | per row (for example LA-IC-06 `lti/lti/login.ts:77`; LA-IC-22 `lti/http/routes/protocol.ts:52`; LA-IC-23 `ch/moodle/portal/moodle-steps.json`) | LA-IC-12 now also names the `PLACEMENT_NOT_GRADED` picker page (BD-A1-118) |
| D8 LA-IC-07, LA-IC-08 | Not built | — | LA-H22, LA-H4 |
| D8 LA-IC-09 (P5 fixture) | Built (product); record missing | the gate test tree changes `tests/host/storage-fixture-script.mjs:389-396` | No LD-6 review by both reviewers in this repo: required item 1 |
| LD-9 lists and addenda r1–r4 | Approved by both reviewers | `tests/ltiaas/golden/expected/LA-IC-*.json`; `docs/reviews/LA-LD9/`; `docs/reviews/LA-E7-08/ld9-addendum-r1..r4*` | r1: LA-IC-14, -22; r2: LA-IC-06; r3: LA-IC-23 and WE-F8; r4: WE-F10, WE-F11 (now in the D8 "Not LA changes" note) |

## Required before round 2 (records only; no product change)

1. **LA-IC-09:** commit the P5 fixture diff (`tests/host/storage-fixture-script.mjs`, the delete in `record_dispatch`) to integration, or cite the la-qa commit, and record the review by both reviewers that plan LD-6 requires. Owner: lead QA; the Lead routes.
2. **LD-1 rewrite (LA-E0-04, `f0a7b306`):** record the reviewer and Lead approvals that `docs/reviews/LA-E0-04/qa.md` says are still missing. LA-IC-01's "no more frozen edits" rests on it. Owner: the Lead.
3. **Rows with only a QA scan (LA-IC-02, -05, -10, -11):** file an approved empty list for each (as for LA-IC-17), or the Lead records a waiver. Owner: lead QA.
4. **Runner change `tests/host/m1-migration.mjs:331-338`** (outside the WE-F5 one-line fix): both reviewers confirm that it changes no assertion, or the Lead records a waiver. Owner: lead QA.

## Follow-ups (recommended, not blocking)

1. N10: `app/app/lti-generic.test.ts:27` and `app/app/redemption.test.ts:536` fix the order of the first three channels on the real registry. A new channel with `card.order` 3 or lower would break them. Lane K: compare with the registry order instead.
2. The guarded-family refusal at `complete` (D5 item 5): the app register page can map an LTI `400` whose `details.reason` starts with `family=` to the page `PROVIDER_PROFILE_MISMATCH` with the owner channel's name (`channels.ownerOfFamily`). Lane K, `app/tool-pages/register.ts`; deferred list.
3. `kernel/manifest.ts:63` still gives `your LMS` as the `names.text` example (BD-A1-111). Lane K, one comment.

## Doc drift fixed in A1's files (BD-A1-118)

- data-model: `015_audit_event.sql`; the `014` index `record_dispatch_started`; the `018` index and the copy of single picks.
- LA-ADR-01: Vite `fs.allow` as built (D1); frozen `details.capability` strings at guard sites (D3); `sharingOf`, the reason `issuerOrigin` and its core text, and the adapter label from `names.label` (D5).
- LA-ADR-02: the start floor as made exact by BD-A2-94/95 (D5); the `lti-generic` storage trait from E3 (BD-A1-33 note).
- LA-ADR-03 D7: the web-process conflict path as built (LA-E4-01 AC-09).
- App delta: `job_run` level and fields (§8); staged connection on registration-url (§3.2); the `issuerOrigin` answer (§3.4); `last_error_*` on a site mismatch and the guarded-family known limit (`/tool/register`).
- LA-ADR-04 D8: LA-IC-12 names the `PLACEMENT_NOT_GRADED` page; the "Not LA changes" note lists WE-F10 and WE-F11.
