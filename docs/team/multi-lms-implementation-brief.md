# Blackboard and Canvas implementation handoff

Owner: Lead. Date: 2026-10-20.

## Start gate

The design candidate is ADR-011 revision 6 at `158a4d86fb5764f597ff20e3f652ae6d5225f96b`.
Round 3 passed: both reviewers APPROVE, QA gives a design-testability PASS, and no BLOCKER or MAJOR remains.
The Lead accepted this design gate. Three nonblocking text corrections are queued before the implementation handoff.
Task completion by itself is not approval.

After acceptance, the Lead advances the portal branch to the accepted integration commit.
The Lead then sends each retained worker a fresh dispatch and the approved SHA.
The task specs and contracts define behavior. This handoff defines execution and ownership.

## First implementation wave

| Role | Queued task | Scope |
| --- | --- | --- |
| Author, Claude Code Opus 5.5 xhigh | `task_88ef41c0aea3` | Full M1; integration worktree |
| Author-2, Codex GPT-6-Astra xhigh | `task_3b1e979ab893` | Full M2; portal worktree |
| QA, Codex GPT-6-Astra xhigh | `task_7676dddddb02` | Simulator and M1 acceptance test preparation |
| QA-E2E, Claude Code Opus 5.5 xhigh | `task_732732ad5b91` | M2 browser test preparation, when a slot is free |

Use the same dedicated instances. Run at most three workers beside the Lead.
Respect the exact paths in each task. Workers do not commit or push.
The Lead commits only reported paths. Leave setup-generated `pnpm-workspace.yaml` files untouched.

M1 follows its stated internal order: LTI service, shared package and infrastructure first; app and player second.
Partial M1a evidence does not close M1. Every M1 criterion needs the full implementation.
M2 can use typed contract fixtures until M1 is ready.
Authors route contract questions through the Lead. They do not invent another API.

## Independent test preparation

The QA task was queued before the criteria expanded.
Its old reference to AC-M1-01 through AC-M1-33 is superseded by the full approved M1 specification.
Revision 6 contains AC-M1-01 through AC-M1-40, including all AC-M1-37 and AC-M1-38 subcases.
M2 contains 13 criteria; M3 contains 7; M4 contains 8.

QA writes tests from the approved criteria before reading author code or notes.
The simulator signs claims and checks results independently of production validators.
QA owns simulator behavior and test oracles. The Author owns infrastructure and transport plumbing.
The M3 simulator and gate contracts are their shared interface.
QA-E2E owns browser tests and coordinates simulator needs through the Lead.

Harness checks prove only that the harness runs. They do not prove product behavior.
Later verification uses a clean clone of an exact candidate SHA.
Keep `SIM`, `MOODLE-LIVE`, `CANVAS-LOCAL`, `CANVAS-HOSTED`, `BLACKBOARD-LIVE` and `DOC` evidence separate.

## Checks and resource limits

Use the [phase plan](multi-lms-plan.md#test-environment-decisions) for stack lanes.
Check ports before use. Reserve each stack with the Lead.
Run at most two stacks, and prefer one within the current Docker memory limit.
No account creation, public tunnel, tenant write or Docker Desktop setting change is authorized.
Preserve baseline volumes and other workers' resources.

For root checks, set `COURSE_FIXTURES_DIR` to:

```text
/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses
```

Do not weaken old assertions to obtain a pass.
The intentional portal label changes are listed in M2; QA owns corresponding acceptance and browser selector changes.
Report any other regression before changing its expected result.

## Completion evidence

Each author reports exact paths, self-check commands, results and unresolved gaps.
Each QA worker reports the criterion mapping, commands, evidence labels and remaining blockers.
Self-check success is not independent verification.
The Lead freezes a candidate before independent QA and both code reviews.
Docs describes only verified behavior and marks unavailable live checks explicitly.
The accepted A-M0-10 MINOR deferral must remain visible in M4; no BLOCKER or MAJOR is waived.
