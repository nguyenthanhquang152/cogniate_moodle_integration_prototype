# Two LMS teams and one shared engine

Owner: Lead. Date: 2026-10-20.
Behavior baseline: `56591df0e71939d5d62c9042c630c841d01f84e8`.
Execution map: Architect report `msg_272893001364`, task `task_f8c34ad605f6`.

This brief replaces the undispatched horizontal M1/M2 task allocation.
The accepted ADR-011 revision 6, external contracts and all acceptance criteria still apply.
The Lead accepted two independent design approvals and QA's design-testability PASS.
No product or live-provider PASS is implied.

## Teams

| Team | Implementer | Independent QA |
| --- | --- | --- |
| Blackboard | Existing Author: Claude Code Opus 5.5 xhigh | Existing QA: Codex GPT-6-Astra xhigh |
| Canvas | Existing Author-2: Codex GPT-6-Astra xhigh | Existing QA-E2E: Claude Code Opus 5.5 xhigh |

Use only these models and xhigh effort. Retain the dedicated instances.
Reviewer-A and Reviewer-B remain separate from both implementers and both QA workers.
They review both providers and the shared engine.
Architect, Docs and Lead remain shared roles.
At most three workers run beside the Lead.

### Backend quota replacement (2026-10-20)

The Claude Author stopped at its session limit during `task_de758fb0e31a`, before completion.
The Lead fenced dispatch `ctx_610c9d2ca767` with `worker-abandon` and preserved its partial files.
The owner's earlier authorization to use Codex GPT-6-Astra as a replacement applies to this quota recovery.
A dedicated Codex GPT-6-Astra xhigh replacement retries the same backend task and takes its existing exclusive paths.
This assignment supersedes the old task brief's Claude-instance requirement for this retry only.
The old Claude session stays retained but has no edit authority for the retry.
Canvas, both QA owners and both reviewers keep their existing assignments and independence.
No second backend editor, broader file scope or extra active worker is authorized.

## One common engine

Moodle, Blackboard and Canvas use the same LTI engine.
There is one implementation of launch validation, keys, Deep Linking and grade transport.
There is one grant, lease, history, approval, compensation and cleanup engine.
Provider data and small adapters supply the differences.
Use one profile registry with separate provider data files; do not add a plugin framework.
This refines the earlier single-file profile layout without changing its values or behavior.

## Product file ownership

Paths below are exclusive. Unit tests beside an owned module have the same owner.
No author edits `tests/**`, `docs/**`, `README.md` or setup-generated `pnpm-workspace.yaml`.
Workers do not commit or push. The Lead commits exact paths and integrates branches.

### Blackboard implementer and shared backend owner

Worktree: `lti-multi-lms`; branch: `nguyenthanhquang152/lti-multi-lms`.

Own:

- `services/lti-service/**`, except the Canvas profile module and its unit test named below after the foundation handoff.
- `services/cogniate-app/**`, except the four Canvas modules and their unit tests named below after the foundation handoff.
- `packages/shared/**`, `infra/**`, root `package.json` and `package-lock.json` when required.
- `apps/portal/src/connect/blackboard/**`, after the portal wizard interface is available.
- `packages/tracking/src/outcome.ts` and `packages/tracking/src/tracking.test.ts`, only for AC-M1-33's permanent HTTP 422 grade failure and its unit test.

This includes all shared route mounts, stores, DTOs, migrations, profile registries and provider registries.
It also includes the app's redemption and cleanup engines, both operator CLIs and the shared-platform CLI.
Keep the Blackboard wizard in this team; route a proposed ownership change through the Lead first.
Do not edit other portal files, `apps/player/**`, or other files in `packages/tracking/**`.
This closes the ownership gap reported in `msg_495acdccb262`; it does not change the approved grade policy.

### Canvas implementer and shared portal owner

Worktree: `lti-multi-lms-portal`; branch: `nguyenthanhquang152/lti-multi-lms-portal`.
The existing worktree name is historical; this task includes Canvas backend modules.

Own these backend files, and each same-basename `.test.ts` file, after the foundation handoff:

- `services/lti-service/src/profiles/canvas.ts`
- `services/cogniate-app/src/providers/canvas.ts`
- `services/cogniate-app/src/app/canvas-configuration.ts`
- `services/cogniate-app/src/app/canvas-deployments.ts`
- `services/cogniate-app/src/tool-pages/canvas-embedded.ts`

Own `apps/portal/**`, except `src/connect/blackboard/**`.
Own `apps/player/**` and `packages/tracking/src/status-text.ts` with its colocated unit test.
The latter paths supply provider-aware learner text, as specified in M1.
Do not edit other service files, shared packages, tracking runtime files, infrastructure or root build files.

The Canvas deployment handler calls the common redemption engine.
It does not implement another grant, adoption, approval or cleanup state machine.
The shared portal owner wires both wizards, capability UI, publication labels and results text.
Blackboard requests for a shared portal change go to this owner through the Lead.

## Small interface handoffs

The backend owner first reports a compilable foundation checkpoint with exact paths and exported signatures:

- LTI `src/profiles/types.ts` and `index.ts`: typed profile data and one registry.
- App `src/providers/types.ts` and `index.ts`: create/body parsing, tool rows, target description and create-request construction.
- A target distinguishes an exclusive platform from a deployment of a shared platform.
- The common engine owns all sequencing and authority; adapters do not receive permission to bypass it.
- Typed Canvas module stubs, only where needed to keep the foundation compilable.
- Required shared origin/site-rule exports.

The Lead commits that checkpoint and advances the Canvas branch.
Only then does Canvas take exclusive ownership of its backend files, including any initial stubs.
The backend owner stops editing those files at the handoff.
Subsequent interface changes go through the Lead and the same owner.
Migrations remain owned by the backend implementer and must be complete before product verification.
They need not delay the initial type and adapter handoff if the checkpoint compiles without them.
A stub is not an implemented feature and must not advertise a working provider.

In parallel, Canvas starts the portal shell and Canvas wizard against the approved wire contract.
Its first checkpoint supplies `connect/wizard-types.ts` and `connect/wizards.ts` for provider wizard wiring.
The Blackboard implementer consumes this interface for `connect/blackboard/**`.
The shared portal owner mounts that wizard after integration.
These are ordinary typed module interfaces, not a second external contract.

## Independent test ownership

Codex QA owns:

- `tests/sim/core/**`, `tests/sim/blackboard/**` and simulator entry/build glue.
- `tests/acceptance/M1/common/**` and `tests/acceptance/M1/blackboard/**`.
- `tests/fixtures/**`, `tests/host/run-m1.mjs` and non-browser harness glue.
- Migration/rollback and legacy non-browser Moodle acceptance.
- `docs/reviews/M1/qa-plan.md` and `docs/reviews/M1/qa.md`.

Claude QA-E2E owns:

- `tests/sim/canvas/**`, using the QA-owned simulator interface.
- `tests/acceptance/M1/canvas/**`.
- `tests/e2e/M2/**` and necessary browser harness glue under `tests/e2e/**`.
- All M2 browser checks, including Blackboard and common portal behavior.
- Real Moodle browser regression and the separate local/live LMS assessment.
- `docs/reviews/M1/qa-canvas.md`, `docs/reviews/M2/qa-plan.md` and `docs/reviews/M2/qa.md`.

Neither QA worker edits another owner's harness, product code or infrastructure.
They write tests from the approved criteria before reading author code or notes.
The first QA checkpoint defines a small simulator fixture interface for Canvas to consume.
Use independent signing and expected values; do not import production validators.
QA owns scenarios and assertions. The backend owner supplies the M3 transport gate and compose wiring.
Additional evidence paths require a later explicit brief.

The complete inventory remains 40 M1, 13 M2, 7 M3 and 8 M4 criteria.
Enumerate every profile, subcase and named variant, especially M1-37 and M1-38.
The two QA plans must together account for every required case.
A provider-neutral race that the criteria require for both LMSs needs evidence for each.
No missing provider case may become a silent skip.
Preparation and harness self-checks are not product PASS.

## First parallel wave

1. Claude Author: shared backend foundation, then common engine and Blackboard adapter, CLI and wizard.
2. Codex Author-2: portal shell and Canvas wizard; Canvas backend modules after the foundation handoff.
3. Codex QA: simulator core, Blackboard fixtures, common and Blackboard acceptance preparation.

Claude QA-E2E starts Canvas and browser test preparation when a slot becomes free.
Both implementation tracks can progress before a real tenant is available.
Each provider gets its own readiness and evidence record.
Shared work remains the common dependency; it is implemented once.

## Integration and verification

The Lead advances branches only at explicit checkpoints and preserves uncommitted work.
The Lead integrates disjoint commits into `lti-multi-lms`, then freezes a candidate SHA.
QA verifies clean clones. Both reviewers assess the candidate independently.
All shared and provider criteria, root self-checks and Moodle regressions remain required.
Use the fixture path and stack limits in the [implementation handoff](multi-lms-implementation-brief.md).
Intentional portal selector changes follow M2; do not weaken other baseline assertions.
Keep SIM, Moodle, local Canvas, hosted Canvas and live Blackboard evidence separate.
No push, account creation, public exposure or live tenant write is authorized.
