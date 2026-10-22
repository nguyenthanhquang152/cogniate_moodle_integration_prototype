# Review response, G-DESIGN round 2: Architect A2

Status: short fix round 2 (task LA-D2d, 2026-10-22). Design SHA under review: `877d951`. Reviews: [QA round 2](../../reviews/LA-DESIGN/qa.md) (Reviewer-A and Reviewer-B approved round 2). A2 changed only the lines named below; all other text stays as the reviewers approved it.

| Id | Severity | Decision | Where | Note |
| --- | --- | --- | --- | --- |
| Q-LAD-24 | MINOR (A2 part: AP-05-29) | fixed | `adr/LA-ADR-05-lti-advantage-completeness.md` D6, AP-05-29 | One oracle: a staged Canvas DR platform is inactive, so the LTI service refuses the learner login with `PLATFORM_NOT_ACTIVE`, and the app sees no launch. This now matches AP-07-11 (`adr/LA-ADR-07`) and the contract (`contracts/lti-service-api-delta.md` §4.5: a staged platform is inactive). The LA-ADR-02 text is A1's. AP-08-04 (`deployment_not_approved`) stays: in LA-ADR-08 D3 the staged record is **active** at the LTI service (rule 1), so the app refusal is the right oracle there. |
| Q-LAD-26 | MINOR | fixed | `adr/LA-ADR-05-lti-advantage-completeness.md` §6, K2 row | Now: "README F7.7 makes K2 U1–U4 Must; other K2 checks (F7.9) are Could". |
| Q-LAD-27 | MINOR | fixed | `adr/LA-ADR-06-service-operability.md` D1 (text under the class table), AP-06-05; `contracts/lti-service-api-delta.md` §1.4, §2.4; `security-delta.md` §13 | The session cap is keyed by (client address, tool account). A fresh account starts with an empty cap, and one sender still cannot fill the cap of another account. AP-06-05 adds a second fresh account as the control and restores the setting in its clean-up. The setting name `registrationSessionsPerAddress` stays. |
| Q-LAD-23 | MAJOR (A1) | aligned | `operability.md` §2, `JOB_INSTANCE_ID` row | Now matches A1's LA-ADR-03 D7 (task LA-D2e): a random boot id per process; `stop()` deletes the heartbeat row, so a normal restart keeps today's timing; after a crash the runner waits up to 30 s before its first send while the web part serves; only a second live process with the same id gets `job_instance_conflict` (a worker exits 1, the web process keeps serving with its runner off); both runners. |

## Alignment lines of README §8 OC-12 (task LA-D2e)

| Id | Severity | Decision | Where | Note |
| --- | --- | --- | --- | --- |
| OC-12 (a), B-LAD-20 | MINOR (A1 decision) | aligned | `adr/LA-ADR-08-onboarding-and-connection-health.md` D6 (decision row, text), §6 K0 row | The manifest has no `setup.verify`; the shell takes the verify step from the binding authority (LA-ADR-01 D2, D9). Only `setup.connectionCheck` stays. The K0 row checks `setup.connectionCheck` and the `binding.authority` map. |
| OC-12 (b), A-LAD-22 | MINOR (A1 design) | aligned | `adr/LA-ADR-06-service-operability.md` D1 (`auth_failure` row, text under the class table) | The app-edge limit on `/tool/launch` and `/tool/deep-link` is cited as designed in app API delta §5a. The 60 s providers cache is Could and not built in LA. |
| OC-12 (c), A-LAD-23 | MINOR (A1 decision) | aligned | `operability.md` §8 (new row before "Wrong library binding"); `adr/LA-ADR-07-security-and-tenancy.md` D5 (evidence policy bullet), §7 Q22 row | Runbook step and Q22 recommendation: confirm a foreign host with the LMS administrator before `app:grant issue … --confirm-foreign-hosts`; without the flag the command exits 1; record the confirmation in `--evidence-ref`. |
| OC-12 (d), A-LAD-19 | MINOR (A1 decision) | aligned | `adr/LA-ADR-07-security-and-tenancy.md` R-LA-1; `security-delta.md` §12 "Signed product family" | A registration-level guard refuses a launch of its family on a Moodle `standard` platform (the `MANUAL_SELF_LEGACY_CHANNELS` path) before any claim is stored; on other platforms it only logs `family_guard_mismatch`. |
