Verdict: APPROVE
Round: 1

# LA-E1-01 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: `git diff 1b17261 b93d7f2` (lane commit `b93d7f2`). The integration merge `20648c2` has the same product diff (`git diff b93d7f2 20648c2` over the five files is empty).
- References: `docs/architecture/ltiaas/tasks/LA-E1-01.md`; app API delta §2 and §8 (`channel_profile_unknown`, warn, field `profile`); LA-ADR-04 D1 step S1.
- Blind review: I did not open the other reviewer's file. I wrote my findings before I read the Author notes.
- **Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT.**

## Checks

| Check | Result |
| --- | --- |
| AC-01 has a test that fails on the old code | Yes. `services/cogniate-app/src/clients/lti-client.test.ts:54` runs the real client and its zod parse, with only the outbound transport faked. The old `z.enum(['canvas', 'blackboard'])` throws on `lms: "x-new"`. The "today's answer" half uses `toStrictEqual`. |
| AC-02 has a test that fails on the old code | Yes. The old code has no `channel_profile_unknown` line, so `services/cogniate-app/src/app/connections.test.ts:34` fails. The unknown row sits between two known rows, and the whole body string is compared, so a change of order or values would also show. The test calls the route twice, which proves "once". |
| No behaviour change for today's answers | Yes. `ownedProfiles` (`providers/index.ts:31-40`) keeps every row with `lms: null` or a known `lms`, in answer order. The builder then applies the same `lmsOfRow` and `profileLabel` filter as before (`connections.ts:178`). The `lmsOfRow` runtime is unchanged (`p.lms ?? 'moodle'`). |
| Other consumers of the open value fail closed | Yes. I checked each reader of `GET /api/providers`. Connection create matches `lmsOfRow(p) === lms` for a known `lms` only (`connections.ts:205`), so an unknown row is never a create target. `operator.ts:82` and `redemption.ts:237-238` find the row by the connection's stored (known) profile id. `allFixedHosts` (`connections.ts:212`) still takes every row, so the fixed hosts of an unknown profile stay refused for a self-hosted site. That is the safe direction, and it agrees with the design rule that the hosts of every loaded profile are reserved. |
| Log line | Matches app API delta §8: `warn`, field `profile` (plus `trace_id`), at most once per process and profile id (module-level set). The set is unbounded, but its keys come only from the trusted LTI service. |
| "Must not edit" and ownership | The five changed files are in "May edit" and are lane K's in B1. See A-E1-01-01 for the two type-only lines outside the builder in `connections.ts`. |
| No LMS name added to core paths | Yes. The new code and comments name no LMS. The test data uses `x-new`. |

## Findings

- **A-E1-01-01 (NIT): two edits in `connections.ts` are outside "the `lms-providers` builder only".**
  - Where: `services/cogniate-app/src/app/connections.ts:10` (the unused `LmsType` import is removed) and `:132` (the `lmsOfRow` return type becomes `string`).
  - Problem: the spec limits this file to the builder. `lmsOfRow` is also used by the connection create path (`:205`).
  - Evidence: both edits are type-only. The emitted code of `lmsOfRow` is the same, and the create path still compares it with a validated, known `lms`. So there is no behaviour change.
  - Suggested fix: none needed in the code. Record the two type-only lines in the task's evidence, or widen the spec note to "the builder, plus type-only edits that it needs".

## Notes (no finding)

- AC-03 (golden G1, K1-SIM) and AC-04 (F1 counts) wait for LA-E0-03 and LA-E1-04. Under the tasks README "Done rule per AC", they are "pending".
- `lmsOfProfile` (`providers/index.ts:43`) still maps an unknown platform profile id to `moodle` for the launch LMS check (`tool-pages/launch.ts:90`). This task does not change that path. LA-E1-07 replaces it with the channel-based LMS check and its guard levels.
