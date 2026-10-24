Verdict: APPROVE
Round: 1

# LA-E1-01 review, Reviewer-B (lens: "Can a human team own it?")

Diff: `git diff 1b17261 b93d7f2` (lane K commit `b93d7f2`; integration merge `20648c2`). Spec: `docs/architecture/ltiaas/tasks/LA-E1-01.md`. I wrote my findings before I read the Author notes, and I did not open the other reviewer's file.

Counts: **0 BLOCKER, 0 MAJOR, 0 MINOR, 2 NIT.**

## Checks

| Check | Result |
| --- | --- |
| Scope and files | Only the three named files and their unit tests changed (`connections.test.ts` is new). One edit lies outside "the `lms-providers` builder only": `lmsOfRow` returns `string` and the unused `LmsType` import is gone (`services/cogniate-app/src/app/connections.ts:10`, `:131-132`). The open type forces this edit. The create route (`:205`) still compares the row value with a known adapter value, so its result does not change. Accepted. |
| Ownership (`epics.md` §5) | Lane K owns `clients/lti-client.ts`, `providers/**` and `app/connections.ts` in B1. OK. |
| No behaviour change outside the spec | The `lms-providers` builder already kept only rows whose `lms` equals an adapter's value. So today's answers give the same entries, and the other callers of `providerProfiles` (`app/operator.ts:82`, `app/redemption.ts:237`, the create route) look rows up by profile id or by a known `lms`. An unknown row only adds hosts to the site-rule-5 list of the create route, which refuses more, never less. |
| No LMS name in core | The added code tokens have no LMS name (the test fixtures use `x-new`). |
| UNIT ACs fail on the old behaviour | AC-01 (`clients/lti-client.test.ts`): the old `z.enum(['canvas','blackboard'])` refuses `"x-new"`, so `getProviders` would throw. AC-02 (`app/connections.test.ts`): the old code writes no `channel_profile_unknown` line, so the log expectation fails. Both test files pass at HEAD (12 tests, about 0.4 s, no Docker). |
| AC-03, AC-04 | K1-SIM golden and the F1 counts: not UNIT; they wait for LA-E0-03 and LA-E1-04 ("pending", tasks README §1). |

## Findings

### B-LA-E1-01-01 — NIT — The once-per-process log memory is module state

- **File:** `services/cogniate-app/src/providers/index.ts:24`, `:31`.
- **Problem:** `unknownProfilesLogged` is a module-level `Set`, so every test in one file shares it. A second test that uses the same profile id would see no log line, and the reason is not visible in the test.
- **Evidence:** `const unknownProfilesLogged = new Set<string>();` next to `export function ownedProfiles(rows, logger, traceId)`. The design asks for "at most once per process and profile id" (app API delta §8). So module state matches the rule, but it is hidden state.
- **Suggested fix:** None needed now; `providers/**` leaves in LA-E1-02. When the kernel registry takes this rule over, keep the "seen" set on the app instance (or pass it in), so each test app starts clean.

### B-LA-E1-01-02 — NIT — AC-02 does not exercise the original failure path

- **File:** `services/cogniate-app/src/app/connections.test.ts:32-34`.
- **Problem:** The test adds the unknown row to the fake LTI client, which does not run the Zod parse. So it proves the filter and the log, but not "one unknown profile never breaks the answer" through the real client, which is the user-visible claim of blocker 2 (R3 S32).
- **Evidence:** With the old code, the two `toBe(baseline)` lines would pass, because the old builder already filtered rows by adapter; only the log expectation fails. The old failure came from the client parse, which AC-01 covers in a separate file.
- **Suggested fix:** Optional. Keep both tests; if the kit adds a K0 or K1 case for an unknown profile through the real client (LA-E7 golden or K1-CAP), no unit change is needed.
