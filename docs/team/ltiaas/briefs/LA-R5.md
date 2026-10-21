# LA-R5: Test and QA baseline for milestone LA

Output file (the only file you write): docs/research/ltiaas/R5-test-baseline.md

Target: tests/** (acceptance T*, M1, M2, e2e T7, tests/sim simulator, runners), root package.json scripts, vitest config, infra/** test profiles, docs/reviews/M1/**, docs/reviews/M2/**, docs/reviews/M3/**, docs/reviews/T7/qa.md, docs/architecture/tasks/M1-M4.md (or M1.md..M4.md).

Change:
1. Inventory every suite: name, what it proves, how to run it (exact command), stack needs (Docker? Moodle? simulator?), typical duration (from review records), last known result and SHA, known flakes or infrastructure trouble (cite review files).
2. Simulator (tests/sim): what it can sign and serve today; how a new LMS profile is added to it; effort estimate.
3. Run in this worktree, with no Docker: `npm ci` (root) then `npm run check`. Record the exact command, duration, pass/fail/skip counts, and any failure. You may also run `npm ci` in tests/ if its own runner needs it, but do not start stacks. If npm ci needs network and fails, record it and continue.
4. Propose the LA test strategy inputs: (a) a "conformance kit" shape (shared contract tests per port that every channel adapter must pass on the simulator); (b) how CI can measure "a new LTI LMS changes 0 core files" and "no LMS name in core"; (c) the minimum regression set to prove "no behaviour change" for Moodle, Canvas and Blackboard after the E1 refactor, with time cost; (d) what parts can run in parallel lanes with separate stacks (COMPOSE_PROJECT_NAME, PUBLIC_PORT, STACK_SUBNET), and machine limits (8 GB Docker RAM).
5. Lessons from the Blackboard and Canvas phase: what made QA slow (storage harness, rounds), and what LA should avoid. Be factual; cite files.

Constraints: node_modules created by npm ci are git-ignored and allowed. Do not edit any tracked file. Do not start Docker.

Observable acceptance: the suite table; the check run result; sections 2-5; recommendations.
