Lane L (same Claude session; new dispatch): E2-K follow-up fix (MAJOR from both reviewers), then the LA-E2-02 flag removal (BD-A1-75/83). Worktree la-l. Merge quang/ltiaas-milestone first (git merge --no-ff; integration is at 4d08fc1 or later). Delete node_modules/.vitest-cache and node_modules/.vite before each check.

Why you: both items are E2-K core work (BD-A1-94) that must land before I name a NEW E2-K-done SHA; lane K is busy with LA-E3-15 and LA-E2-06. Your LA-E3-09 still waits for K's LA-E3-15 (I send it when K reports the SHA).

Task 1 (first; small): E2-K follow-up A-LA-E2-03-03 (Reviewer-A) = the E2-K MAJOR of Reviewer-B. Read docs/reviews/LA-E2-03/reviewer-a.md and reviewer-b.md, sections "Follow-ups (E2-K)". Two core tests still reject a valid simulation-only extension (N10, README §4, BD-A1-95):
- services/lti-service/src/profiles/canvas.test.ts:26 (your file): do not require a fixed tail ('blackboard-sim', 'canvas-sim-cloud'). Assert membership and the relative order of the baseline simulation profiles, plus the general real-before-simulation and order rule (LA-ADR-01 D4).
- packages/channel-kernel/src/registry.test.ts:163 (K file, RQ-2 granted): compare the simulation-off registry with the simulation-on registry filtered by each manifest's availability (not only by removing 'zz-sim'). Keep the explicit hidden/shown checks for the 'zz-sim' fixture.
- The add-folder extension control: exercise both a real channel addition and a simulation-only channel addition (and, if it fits, a normal channel with a simulation profile).
Proof (put it in your status): the reviewers' reproduction. Copy a valid data-only channel folder twice with unique ids (one real: card.order 5, listOrder 90; one simulation-only: card.order 6, listOrder 90, simulation: true) into a scratch copy, run the affected suites: all pass; then remove the scratch folders. Do not commit the scratch folders.
Commits: "E2-K follow-up (L): open-world simulation assertions (A-LA-E2-03-03)" for your file; "E2-K follow-up RQ-2 (K file): registry open-world simulation filter" for registry.test.ts. Send me a status message with the SHA(s) and a green check as soon as Task 1 is done.

Task 2: LA-E2-02 flag removal, per BD-A1-75 (ratified: "LA-E2-02 (L) removes the flag (kernel type, schema, three baseline files) after the lead QA's K0 and canary change lands") and BD-A1-83. The lead QA's K0 and canary change has landed (la-qa 19da95e, merged in 4d08fc1; the lead QA verified K0 with a simulated flag removal).
- Remove flags.clientAssertionAudArray from: packages/channel-kernel/src/profiles.ts; services/lti-service/src/profiles/{types.ts,schema.ts,registry.ts} and their tests (registry.test.ts, traits.test.ts, canvas.test.ts); the baseline channel profiles packages/channels/{moodle,canvas,blackboard}/lti-profiles.ts; and packages/channels/{lti-generic,brightspace}/lti-profiles.ts (RQ-2 granted: one named commit "LA-E2-02 RQ-2 (channel files): drop the clientAssertionAudArray flag").
- Check 7 and the default form now come from clientAssertionAud only (LA-ADR-02 D2). The token client already reads only clientAssertionAud.
- BD-A1-83: Canvas and Blackboard profiles get an explicit dynamicRegistration: null in the same commit.
- Lane K is editing packages/channels/brightspace/** for LA-E2-06 in parallel: keep your brightspace diff to the flag line only. I resolve merge conflicts mechanically.
- Do not edit tests/** (QA-owned). The QA K0 tests (tests/ltiaas/k0/contract.test.ts, tests/ltiaas/tasks-lti/LA-E2-02/*.k0.test.ts) must pass after the removal: run npm run test:k0 (or the K0 part of npm run check) and report the count.
Commit: "LA-E2-02: remove the clientAssertionAudArray flag (BD-A1-75); explicit dynamicRegistration null (BD-A1-83)".

Self-check: npm run check green (caches deleted first). One worker_done with all SHAs, unit/infra/K0 counts, F1 and F5 results.
Questions: the ask command (design questions go to the Architects through me).

DOCKER BAN stays: host-only. No docker, no stack:*, no runner that starts a stack.
