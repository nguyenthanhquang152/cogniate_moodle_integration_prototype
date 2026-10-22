# Review response, G-BREAKDOWN round 1 (Part 1): Architect A2

Status: fix round 1 (task LA-B2b, 2026-10-22); §4 is the alignment with A1's fix round (task LA-B2c). Reviewed SHA: `ec1afc5`. Reviews: [Reviewer-A](../../../reviews/LA-BREAKDOWN/reviewer-a.md) (APPROVE), [Reviewer-B](../../../reviews/LA-BREAKDOWN/reviewer-b.md) (CHANGES_REQUESTED), [QA](../../../reviews/LA-BREAKDOWN/qa.md) (FAIL). A2 changed only its files: `tasks/A2-lanes.md`, the specs LA-E3-*, LA-E5-*, LA-E6-*, and (for B-LAB-03) `operability.md` §7.3 and LA-ADR-06 D14. New specs: LA-E3-14, LA-E3-15, LA-E6-04, LA-E6-05, LA-E6-06, LA-E6-07. Items for A1 went through the Lead; A1 already added forms (d)–(g) to `tasks/README.md` §2, and A2 sent one correction for form (g) (no `stack:reset`).

## 1. MAJOR findings

| Id | Severity | Decision | Where | Note |
| --- | --- | --- | --- | --- |
| Q-LAB-01 | MAJOR | fixed | LA-E5-05 header and design notes, AC-03, -04, -05, -07; LA-E5-21 AC-01; LA-E5-24 header and scope | LA-E5-05 cites tasks README §2 form (d) (`lti:bootstrap` with its write flags, fresh account) and form (e) (operator key file renamed, then restored). LA-E5-21 cites form (f) (one `STACK_PROFILE=production` process). LA-E5-24 cites form (g) (the drill in QA's own project). |
| B-LAB-01 | MAJOR | fixed | LA-E3-05, LA-E3-08, LA-E3-09, LA-E6-01, LA-E6-02, LA-E6-03; new LA-E3-14, LA-E3-15, LA-E6-04, LA-E6-05, LA-E6-06, LA-E6-07; A2-lanes §3, §4 note 4 | Every multi-line cross-lane piece is now a named task with its own lane, size, ACs and cut partner: K values and the Canvas `link_selection` JSON (LA-E3-14), the Canvas `dynamic` method (LA-E3-15), `setup.connectionCheck` (LA-E6-04), `artifact_key_kid` (LA-E6-05), refusal events in `tool-pages/launch.ts` (LA-E6-06, L), the portal verify panel (LA-E6-07, P). A1 task ids carry the rest: LA-E2-03 (`content.multiple: true` for `lti-generic`), LA-E4-08 (ungraded record part, AP-05-23/24/28), LA-E4-02 AC-11 (course name "—"). ACs moved to the task whose files make them true (LA-E3-08 AC-02..04 → LA-E4-08; LA-E3-08 AC-06 → LA-E3-14; LA-E3-09 AC-06 → LA-E3-15). "Needs" now holds only one-line requests (A2-lanes §4 note 4). |
| B-LAB-02 | MAJOR | fixed (LD-10) | every E5 spec header; LA-E5-01, -02, -03, -04, -07, -08, -09, -10, -15, -19, -20 Files; A2-lanes §1, §2, §4 notes 2–3 | Lanes S1 (LA-E5-01..05, -11, -16, -17, -19, -20, -21) and S2 (LA-E5-07..10, -15, -23). `http/operator/**` is split per endpoint group; S1 owns `index.ts` and mounts S2's modules. S2 starts in B1 (LA-E5-08, LA-E5-10); LA-E5-09 and LA-E5-19 move to B2; the `signing-key-cleanup` job moves into LA-E5-10. Size per lane and wave: A2-lanes §2 (S1 14/6, S2 9/5 Must days in B1/B2). A2-lanes §2 also gives the Lead an option (LA-E5-03 and LA-E5-06 to B2: S1 9.5 days in B1). |
| B-LAB-03 | MAJOR | fixed | LA-E5-24 (rewritten); `operability.md` §7.3; LA-ADR-06 D14 "Restore drill" row | The drill restores into the **same** compose project (the restore refuses another one: `project_mismatch`, `infra/scripts/stack-data.mjs:178`; LD-3 keeps the storage commands). QA uses a fresh drill project: backup, a marker account, restore, check that the marker is gone, launch and score, then remove the project. No `stack:reset` (it also deletes the secrets and `infra/.data/backups/`, `infra/scripts/stack-reset.sh:2-4`). The operator drill of the runbook uses a second host or Docker context with the same project name. |

## 2. MINOR and NIT findings

| Id | Severity | Decision | Where | Note |
| --- | --- | --- | --- | --- |
| A-LAB-01 | MINOR | fixed | LA-E5-13 AC-03 | Right `Origin` and value; expect `storage_check_unknown_used_or_expired`, not `storage_origin`; control: the same check on `cogniate` passes. |
| A-LAB-02 | MINOR | fixed | LA-E6-03 AC-09, new AC-11 | The off-origin case is tested at `PUT …/platform` and as `PLATFORM_NOT_ACTIVE` at login; rule-2 negatives (another deployment, `LtiResourceLinkRequest`, site mismatch) give no code. |
| A-LAB-03 | MINOR | fixed | LA-E3-02 scope, AC-12, header (depends on LA-E5-04); LA-E5-06 AC-10 | The storage-check route has the status gate; the launch POST of a suspended account has its own AC. |
| A-LAB-04 | MINOR | fixed | LA-E3-05 scope (D3b server rule), AC-12 | Exactly one id when `content.multiple` is false or `acceptMultiple` is not true. |
| A-LAB-05 | MINOR | fixed | LA-E5-07 AC-04, AC-12 | `admin`-only key on `GET /api/idtoken`; revoked and expired keys on LTIK-AUTH-V2 and SERVICE-AUTH-V1. |
| A-LAB-06 | MINOR | fixed | LA-E5-03 AC-11 (`keys`), AC-12 (`admin`); LA-E3-02 AC-11 (storage-check path in `protocol`) | The bucket bound and the session-cap function are Author unit tests (LA-E5-03 design notes); in LA-E3-02 the two time rules share AC-04, and the `405` rule is an Author unit test, so both specs stay at 12 ACs. |
| A-LAB-07 | MINOR | fixed | LA-E5-02 AC-01 (B1 actor `api_key:bootstrap-<account>`); LA-E5-04 AC-08 (status gate only) and LA-E5-07 AC-11 (revoked rows); LA-E5-03 header | No B1 AC needs B2 work. |
| A-LAB-08 | MINOR | fixed | LA-E5-24 "Needs" and design notes | The Lead confirms that the Should drill may use the existing ADR-012 commands unchanged (as AC-M1-23 does), else the drill moves to LG with LA-H8 option (b). App readiness: `/healthz` until LA-E4-07 exists. |
| A-LAB-09 | NIT | fixed | A2-lanes header (`54e8088`); LA-E3-02 AC-08, AC-09 (label K1-SIM, K2 named in the text); LA-E6-01 AC-09, LA-E6-02 AC-08 (Author unit test named in the text); LA-E5-22 AC-01 and new AC-06 (MOODLE-LIVE) | |
| B-LAB-04 | MINOR | fixed | LA-E5-01 Files; LA-E5-03, -04, -07, -10, -11, -14 | `api-errors.ts`, `logger.ts` and the LTI `package.json` are in LA-E5-01's table; the stale "A2-lanes does not list" sentences are gone. |
| B-LAB-05 | MINOR | fixed | LA-E5-19 Files, scope, AC-05 | LA-E5-19 adds both LTI tables `job_lease` and `job_instance` in one migration (epics OI-3); the runner creates no table. |
| B-LAB-06 | MINOR | partly fixed | LA-E5-13 | The duplicate AC-04 (= AC-LA-E5-02-06) is removed. The storage-check and picker-cancel cases stay in LA-E5-13: they need two tool accounts or two libraries with live data, and their building tasks already carry 12 ACs; the B1 route (audit read) keeps its isolation AC in LA-E5-02. |
| B-LAB-07 | MINOR | fixed | LA-E5-22, LA-E5-23 headers | "LG unless B3 ends early"; if kept, the first B4 step with the full R2 and R3 regression after it. |
| B-LAB-08 | MINOR | fixed | every A2 spec header and body | A1's task ids replace the design step names (epics §2.1). |
| B-LAB-09 | NIT | fixed | A2-lanes header | `54e8088`. |
| Q-LAB-02 | MINOR | fixed | LA-E5-04 AC-01 (`account.create`), AC-09 (`platform.create_shared`); LA-E6-01 AC-10 (`platform.check`) | |
| Q-LAB-03 | MINOR | fixed | LA-E5-04 AC-08; LA-E5-07 AC-11; LA-E5-03 header | Same as A-LAB-07. |
| Q-LAB-04 | MINOR | fixed | LA-E5-03 design notes and AC-01, -12; LA-E5-04 AC-02, -07, -08, -09; LA-E5-06 AC-01; LA-E5-15 AC-05; LA-E3-10 AC-01 | Fresh accounts for state changes (a close is final); limit changes restore their value in the clean-up (AL-4); the `cogniate` claim change is the LA-IC-08 step at its run-order point. |
| Q-LAB-05 | MINOR | fixed | LA-E5-02 AC-10; LA-E5-06 AC-08 | The F5 check in check-one-text mode, no product file. |
| Q-LAB-06 | MINOR | fixed | LA-E6-01 AC-06 | `limits: "shared-application"` on the LTI route of the shared Blackboard platform. |
| Q-LAB-07 | MINOR | fixed | LA-E3-01 AC-06 | The escapes are written out again. |
| Q-LAB-08 | MINOR | no change (QA owns) | LA-E5-13 AC-01 | QA names the route list at build time. |
| Q-LAB-09 | MINOR | fixed | LA-E5-08 AC-08 | AP-06-26 is met by AC-08 alone when LA-E5-17 is cut. |

## 3. Other changes in this round

| Item | Where | Note |
| --- | --- | --- |
| `store/retention.ts` in B2 | LA-E3-02, LA-E5-19, A2-lanes §4 note 1 | LA-E5-19 moved to B2 (S1), so LA-E3-02 no longer edits `store/retention.ts`: it exports its cleanup function from `store/storage-checks.ts`, and S1's retention job calls it (RQ-1). |
| Cycle LA-E3-09 / LA-E3-15 | LA-E3-15 header | LA-E3-09 depends on LA-E3-15, not the other way round. |
| epics OI-3, OI-4, OI-5 | LA-E5-19, LA-E5-21, every spec header | Closed in the specs. |

## 4. Alignment with A1's fix round (task LA-B2c)

A1's list in [review-response-B1-A1.md §3](review-response-B1-A1.md#3-a2-spec-changes-needed-sent-to-the-lead), with Lead decisions LD-11, LD-14 and LD-16 (plan §6.1).

| Item | Decision | Where | Note |
| --- | --- | --- | --- |
| LD-11 (lane L2) | done | LA-E3-03, -05, -08, -10, -13, LA-E5-18, LA-E6-06 headers; A2-lanes header, §1, §2, §3, §4 note 1; lane names in LA-E3-12, LA-E3-14, LA-E5-15, LA-E5-17, LA-E6-02, LA-E6-03 | Owner lane L2. The "May edit" files of the seven tasks are all in L2's B3 cells (epics §5). Other B3 and B4 specs that named L as the owner of `lti/{login,launch,service-keys}.ts` or `tool-pages/{launch,picker}.ts` now name L2. A2-lanes §2 splits L (12.5 Must, 17 all) and L2 (3.5 Must, 11.5 all; 10.5 without the deferred LA-E6-06, as in epics §8). |
| LD-14 (LA-E5-03, LA-E5-06 to B2) | done | LA-E5-03 header, Files, requests 1–2, scope; LA-E5-06 header, Files, Needs, scope; LA-E5-04 Needs; LA-E5-01 and LA-E5-14 Files notes; A2-lanes §1, §2, §4 note 1 | LA-E5-03 no longer edits `lti/codes.ts` or `http/auth.ts`. By RQ-1, L adds the page code `RATE_LIMITED` (request 1) and S2 adds the `auth_failure` call line (request 2); the limiter stays in `http/rate-limit.ts` (RQ-4). LA-E5-03 now also lists `http/operator/index.ts` (S1) for the `operator` class and the operator key failure call; it was missing. LA-E5-06 (L owns `lti/codes.ts` in B2) adds `TOOL_ACCOUNT_SUSPENDED` and `REGISTRATION_SESSION_LIMIT` itself. LA-E5-04 adds its `http/auth.ts` status gate in B1 and does not wait for LA-E5-03 (after LD-14 that wait was a loop). S1 has 9.5 Must days in B1 and 10.5 in B2. |
| OI-11 (LD-16) | done | LA-E6-02 header, Needs, AC-01..03; LA-E6-03 header, Needs, AC-03; LA-E6-05, LA-E6-06, LA-E6-07 headers; A2-lanes §1 (LA-E6-02, LA-E6-03), §3 | The partners LA-E6-02 and LA-E6-03 no longer depend on their companions. LA-E6-02 AC-01 is "pending: LA-E6-06", and AC-02 and AC-03 are "pending: LA-E6-05". All three tasks are B3, so the done rule allows this. LA-E6-03 has no pending AC: AC-03 to AC-05 call the verify route directly, and AC-03 now says so. |
| OI-13 (form letters) | done | LA-E5-03 design notes; A2-lanes §4 note 6 | `AL-4` → form (h); `AL-1`–`AL-5` → forms (a), (b), (c), (h), (i). |
| A-LAB-10 follow-up | done | LA-E5-19 AC-06 | AC-06 runs the interval-lease part of the LA-E4-01 store-contract suite (AC-LA-E4-01-07) on the LTI job store, after this task's migration. |
| Own fix | done | A2-lanes §1 row LA-E3-15 | The row still had LA-E3-09 as a dependency (left over from LA-B2b; the spec header and epics were already right). Removed: no loop. |

For A1 (epics §5, not an A2 file): the note on the `lti/codes.ts` row ("S1: page codes (B1)") is out of date. S1 has no B1 edit of that file now: LA-E5-06 (L, B2) adds two page codes, and L adds `RATE_LIMITED` for LA-E5-03 by RQ-1.
