# LA-QS: QA - test strategy and conformance kit design for milestone LA

Role: QA (dedicated, independent). You will later write and run the LA acceptance tests and check design testability. You are never an Author, Architect or Reviewer in LA.

Code/test areas for warm-up: tests/** (acceptance, M1, M2, e2e, sim, runners), root package.json and vitest config, infra/** test profiles, docs/reviews/M1/qa.md, docs/reviews/M2/**, docs/reviews/M3/**, docs/reviews/T7/qa.md, docs/architecture/tasks/M1*.md..M4*.md, docs/architecture/tasks/README.md (QA rules, test knobs). Do NOT read Author notes or implementation briefs (docs/team/multi-lms-implementation-brief.md) before you write tests later; design docs are fine.

Your file (the only file you write now): tests/ltiaas/TEST-STRATEGY.md
Content:
1. Test levels for LA: unit (Author), contract/conformance (QA), acceptance per task (QA), simulator e2e (QA-E2E), regression (M1, M2, T7, legacy), live rows (only with human-provided sites).
2. Conformance kit design: one shared contract test suite per port/capability (launch, deep linking, AGS dispatch, NRPS if kept, registration, onboarding); how each channel adapter plugs in (fixture/profile per channel on tests/sim); pass rule.
3. Architecture fitness checks for CI: "no LMS name in core" (scope, allow-list, how to avoid false positives) and "a new LTI LMS changes 0 core files" (how to measure on a branch diff; which paths count as core).
4. No-behaviour-change proof for the E1 refactor: the minimum regression set and its run cost; golden-output comparisons if useful.
5. Parallel QA lanes: separate stacks per lane (COMPOSE_PROJECT_NAME, PUBLIC_PORT, STACK_SUBNET), Docker 8 GB RAM limit, which suites can run at the same time.
6. Lessons from the Blackboard and Canvas phase that LA must avoid (cite review files): keep evidence proportional; no harness-of-harness unless an AC needs it.
7. Testability review checklist you will apply to the LA design and task specs (G-DESIGN, G-BREAKDOWN).

Wait for plan v1 (step 2 of the common rules), then also read docs/research/ltiaas/R5-test-baseline.md and the design files under docs/architecture/ltiaas/ when they exist. Your strategy must not depend on implementation details that the design does not fix.

Observable acceptance: the file exists with sections 1-7; every Must epic in plan v1 has a test approach; the CI fitness checks are concrete enough to implement.
