# Blackboard and Canvas integration phase

Date: 2026-10-20. Base: `9e24137`. Owner: Lead.

## Authority and goal

The product owner requested Blackboard and Canvas support as the next step toward an enterprise LTI service.
The owner requested both Claude Code Opus 5.5 and Codex GPT-6-Astra, each at xhigh effort.
The existing Codex coordinator remains Lead for this phase.
The role ownership and independent review gates in the charter still apply.
The earlier push request covered the completed Moodle release. This phase has no push authorization.

Work branch: `nguyenthanhquang152/lti-multi-lms`.
Orca run: `run_ebe671ad72a9`.

## Sources and scope

- [DataCamp Blackboard case](https://support.datacamp.com/en-us/articles/17598773-blackboard-lti-integration)
- [DataCamp Canvas case](https://support.datacamp.com/en-us/articles/17598821-canvas-lti-integration)
- Current official Blackboard, Canvas, and 1EdTech documentation.

Use the cases to understand administrator, teacher, and learner flows.
Implement the open standards independently.
Do not copy DataCamp credentials, client IDs, private endpoints, prose, or product policies.
Keep Cogniate's current privacy and grade policies unless a reviewed design requires a change.

The phase covers provider setup, registration, Deep Linking, learner launch, and grade return for both LMSs.
Keep the existing Moodle flow and its native-only features.
Separate the LMS site URL, issuer, registration endpoints, and service origins where the standards require it.
Do not weaken SSRF checks or tenant isolation to accept a new provider.
Treat a provider profile as configuration, not proof of live interoperability.

The Architect will define precise acceptance criteria and file ownership before implementation.
Enterprise operations such as billing, high availability, and certification require a separate scope decision.
They are not implied by adding these two LMS integrations.

## Roles and gates

| Role | Model | Initial responsibility |
| --- | --- | --- |
| Lead | Existing Codex coordinator | Task briefs, team records, commits, integration, gate tracking |
| Architect | Claude Code Opus 5.5, xhigh | Sources, design, contracts, acceptance criteria, final conformance |
| Author | Claude Code Opus 5.5, xhigh | Backend and shared protocol implementation after design review |
| Author-2 | Codex GPT-6-Astra, xhigh | Portal provider flows in an isolated worktree after design review |
| QA | Dedicated Codex GPT-6-Astra, xhigh | Independent acceptance tests from the approved criteria |
| QA-E2E | Dedicated Claude Code Opus 5.5, xhigh | Moodle regression and available live LMS checks |
| Reviewer-A | Dedicated Claude Code Opus 5.5, xhigh | Correctness, protocol conformance, security |
| Reviewer-B | Dedicated Codex GPT-6-Astra, xhigh | Operability, maintainability, evidence, user flows |
| Docs | Dedicated Claude Code Opus 5.5, xhigh | Setup guides and small human review artifacts |

Both reviewers submit their first findings independently.
No author or Docs worker acts as QA or as a reviewer.
The Lead commits only named paths and marks tasks done only after the charter gates pass.
Record requested and effective worker models from Orca receipts.
Report a model or effort mismatch before relying on that worker's result.

## Validation boundary

Use local signed LTI platform fixtures for deterministic protocol and isolation tests.
These fixtures do not prove behavior on a real Blackboard or Canvas tenant.
Use existing authorized LMS environments when available.
Do not create third-party accounts or expose the local stack publicly without authorization.
Record unavailable live checks as unverified, with exact steps for the team.

Preserve the existing stack and unrelated containers.
Every test stack needs its own ports, network, data, and cleanup.
Do not run a destructive reset against the user's existing environment.

## Task board

| Task | Result | State |
| --- | --- | --- |
| M0 | Source review, architecture, contracts, criteria | In progress |
| M0-A2 | Read-only portal and integration audit | Complete; no code or tests changed |
| M0-AU | Read-only backend and deployment impact audit | In progress |
| M0-QE | Independent environment and live-LMS validation preflight | Complete; environment inventory, no product verification |
| M1 | Shared backend and provider registration support | Planned |
| M2 | Blackboard and Canvas portal flows | Planned |
| M3 | Independent QA and Moodle regression | Planned |
| M4 | Guides, interactive review pack, final conformance | Planned |

## Launch evidence

Orca accepted these workers. Each receipt reports the requested model and effort as effective.

| Role | Dispatch | Effective model | Effort |
| --- | --- | --- | --- |
| Architect | `ctx_c8c00b22d5f1` | `claude-opus-5-5` | `xhigh` |
| Author-2 | `ctx_1eeade383449` | `gpt-6-astra` | `xhigh` |
| QA-E2E preflight | `ctx_3c4961a02f14` | `claude-opus-5-5` | `xhigh` |
| Author impact audit | `ctx_94cbe8647c96` | `claude-opus-5-5` | `xhigh` |

The initial Docker inventory found no running containers.
The Lead asked which existing LMS test environments are available; the answer is pending.

## M0 checkpoints

Author-2 completed the read-only audit in `ctx_1eeade383449`.
Messages `msg_57b462b0aec3`, `msg_c8afa054e00e`, and `msg_b3a206ea8b3f` hold the findings.
The Lead sent the contract questions and source findings to the Architect.
Main gaps include provider identity, endpoint trust, deployment binding, framing, native-feature guards, and provider-specific UI.
These are implementation inputs, not independent QA evidence.

The Author-2 instance remains idle for later implementation.
This preserves the charter's requirement to use the same dedicated author instance across tasks.
The Lead accepted its successful completion and recorded retention before acknowledging the report.

Design review tasks `task_8539cca49e29` and `task_6df3fc0172eb` depend on the Architect's M0 task.
Each reviewer will write its own report before it sees the other review.

QA-E2E completed [the environment preflight](../reviews/M0/qa-e2e-preflight.md).
The Lead accepted its report and retained the dedicated QA-E2E instance for the later regression task.
The VM has 7.75 GiB of memory. Seven existing Docker volumes belong to earlier work and must remain intact.

## Test environment decisions

Proceed with signed platform simulations and real Moodle regression first.
Assess local Canvas alone after those checks; do not change Docker Desktop settings.
Local Canvas and hosted Canvas are separate evidence levels.
Hosted Canvas and Blackboard validation still need confirmed access and a reachable tool configuration.

QA owns simulator behavior, signing fixtures, and score oracles under `tests/**`.
The Author owns required infrastructure and test transport plumbing.
Test overrides must stay unavailable in production.
A simulation must not impersonate real vendor hosts through DNS or certificates.

| Test lane | Project prefix | Port | Subnet |
| --- | --- | --- | --- |
| QA acceptance | `qa-multi-r` | 8443 | `172.29.0.0/16` |
| QA-E2E Moodle | `qa-e2e-m3-r` | 8543 | `172.31.0.0/16` |
| QA-E2E provider simulation | `qa-e2e-sim-r` | 8643 | `172.27.0.0/16` |
| Author smoke, when needed | `cogniate-multi-author` | 8743 | `172.26.0.0/16` |

Check availability again before each run. Run at most two stacks at once.
Cleanup of a worker's own temporary stack, clone, secrets, traces, and test image is authorized.
Preserve redacted evidence first. Never remove existing volumes, shared base images, or another worker's resources.

