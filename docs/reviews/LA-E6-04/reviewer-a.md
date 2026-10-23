Verdict: APPROVE
Round: 1

# LA-E6-04 review: Reviewer-A (lens "Is it right and is it safe?")

## Round 1

- Reviewer: Claude Code Opus 5.5 xhigh (Reviewer-A, same session).
- Diff:
  - `b38887ce` (merge `ed548446`): `packages/channels/canvas/manifest.ts`, `setup.connectionCheck: true`;
  - `cc0a4bae` (merge `474628d7`): `packages/channels/lti-generic/manifest.ts`, `setup.connectionCheck: true`.
  - Both come after the lead QA's K0 change `879228b6` (A1 BD-A1-110).
- References: `docs/architecture/ltiaas/tasks/LA-E6-04.md`; LA-ADR-08 D4, D6; LA-ADR-01 D2; A1 BD-A1-110.
- I ran these in a private clone at `474628d7`. I deleted the Vitest cache before each run. No Docker.
  - `npm run test:k0`: 145 tests pass, as expected after BD-A1-110.
  - `npm run test:unit`: 3156 tests pass, 5 skipped.
  - F1 PASS; `npm run typecheck`: exit 0.
  - A registry dump before (`3a00f90a`) and after (`474628d7`).
- Blind review: I did not open the other reviewer's file.
- **Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

| Check | Result |
| --- | --- |
| AC-01, AC-02 | The registry gives `setup.connectionCheck: true` for `canvas` and `lti-generic`. Dump: `false` → `true` for these two only. |
| AC-03 | `moodle`, `blackboard` and `brightspace` have no flag in their manifests, so the registry gives `false`, the same before and after. |
| AC-04 (no wire change outside the flag) | The six legacy capability flags of all five channels are identical in the before and after dumps. The change is visible only as `setup.connectionCheck` in the additive `channelCapabilities` (LA-IC-01). |
| Safety | No product code reads the flag yet: no app or LTI route uses it until LA-E6-01. So this task enables no outbound call. Note for the LA-E6-01 review: Canvas (staged Dynamic Registration, LA-E3-15) and `lti-generic` (staged admin values) both have staged records. LA-ADR-08 D4 requires the check to run only for an active platform that its authority bound (`registered` or `connected`), never for a staged record, so that our client assertion goes only to a proven token endpoint. |
| Scope and ownership | Only the `setup.connectionCheck` value in the two manifests changed, as the "May edit" row allows. No portal or service file changed. The comments name the design, not an LMS behaviour in core code. F1 PASS. |

### Verdict

APPROVE for lens A. The two flags match LA-ADR-08 D6, nothing else in the capability projection changes, and no route acts on the flag before LA-E6-01.
