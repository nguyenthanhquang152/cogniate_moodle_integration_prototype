# Common rules for P3 breakdown (milestone LA)

Milestone LA "LTI as a Service v1". Claude Code Opus 5.5 xhigh. Orca run run_06d07dc77faf. Shared worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone (branch quang/ltiaas-milestone). The design passed G-DESIGN at the SHA the Lead gives you. Read the design review files docs/reviews/LA-DESIGN/*.md for the accepted changes and deferred items.

Output: task specs that Authors and QA can build from with no other context, in parallel lanes, with disjoint file ownership.

Task spec rules (lean; plan LD-4 and charter-LA §5):
- One file per task: docs/architecture/ltiaas/tasks/LA-<epic>-<nn>.md (for example LA-E1-01.md).
- Header: Owner lane (K, P, S, L, R, QA, QA-E2E, Docs), Wave (B1-B4), Depends on (task ids), Design links (ADR sections, contract delta sections), Size (S = 1 day, M = 2-3 days, L = 4-5 days; split anything larger).
- Sections: Goal (2-4 sentences); Files (exclusive "May edit" and "Must not edit" table; must match the ownership matrix); Scope In / Out; Design notes (only what the ADRs do not already say); Acceptance criteria.
- Acceptance criteria: id AC-LA-<epic>-<nn>-<mm>; 4-12 per task; each AC states ONE observable outcome (input, expected output or state, and the evidence label UNIT, K0, K1-SIM, MOODLE-LIVE or LIVE). No AC depends on implementation details that the design does not fix. Every Must feature of the design maps to at least one AC.
- "No behaviour change" tasks list the exact regression subset (from tests/ltiaas/TEST-STRATEGY.md) that proves it.
- Keep each spec under about 200 lines.

Hard rules: write only the files your brief names; do not commit, stash, checkout, reset; no Docker; do not touch run run_ebe671ad72a9 or its worktrees; STE (about 80%); path:line or ADR-section evidence for design claims. Read only messages addressed to your own handle. When done: one worker_done (--outcome), three-sentence summary, --files-modified (comma list), --report-path (your main file). Then stop.
