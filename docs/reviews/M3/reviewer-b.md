Verdict: CHANGES_REQUESTED
Round: 1

Reviewer: dedicated Reviewer-B, Codex GPT-6-Astra xhigh. Date: 2026-10-20.

Reviewed commit: `9964e6f132e6608216616bff621e3f9ba5667b04`.
Product code: `76b03c7f24c15de2f7e164b836b27a398d45158a` (unchanged by the harness supplement).
Accepted M0 behavior: `56591df0e71939d5d62c9042c630c841d01f84e8`.
Implementation comparison baseline: `294114092b643766b5f552150038b812513da1d0`.

This is an independent implementation and prepared-harness review. It is not a QA acceptance result or live-provider approval. Code was read from a detached external clone at the exact reviewed commit. No stack, tenant, sign-up, database migration on persistent data, or live provider check was run. Only these review reports change the integration checkout. The Lead requested round-1 delivery now; fixes need a separate review at their exact commits.

## Result

Two open MAJOR harness findings prevent approval. The simulator, transport gate and host runners have useful boundaries and strict evidence accounting. Their self-tests pass, but the M2 UI recipes still contain assumptions that either stop execution before the intended checks or erase the state those checks need to observe.

## Findings

### B-M3-01 — MAJOR — Wizard and badge selectors do not match the implemented flow

Locations: `tests/e2e/M2/lib/m2.ts:178` through 194; `tests/e2e/M2/03-blackboard-wizard.m2.ts`; `tests/e2e/M2/06-keyboard-axe.m2.ts`; `tests/e2e/M2/04-detail.m2.ts:23` through 31.

Both `canvasToStep3` and `blackboardToStep3` click Next once to create the connection, then expect a second Next between setup and approval. The implemented pending wizard renders those two sections together and has no such second button (`apps/portal/src/connect/canvas/CanvasWizard.tsx:23`, and the equivalent Blackboard wizard). Direct Blackboard and keyboard/axe cases repeat the same assumption. These cases will wait for a nonexistent control instead of reaching approval, retry, keyboard or end-to-end checks.

The badge case goes to `/integrations` and searches for rows containing individual connection names and badges. The connection list is the `ConnectionOverview` shown by a connection detail; the Integrations page contains provider cards. That case cannot establish AC-M2-07 at its selected page.

Evidence: exact source comparison at `9964e6f`. This is a static harness defect, not a browser execution failure observed in this review. QA's H-1 already identified the second-Next and list-location assumptions as unresolved; they remain in the committed supplement.

Correction: align all shared and direct wizard callers with the actual visible setup/approval sections, preserving each step's assertions and screenshots. Navigate the badge test to the real connection list and retain assertions for all three LMS badges. Do not delete cases or loosen result requirements to get a passing run. Check related prepared selectors against the accepted product before the first product run.

### B-M3-02 — MAJOR — Route-state oracle reloads away its own observation

Locations: `tests/e2e/M2/08-routes.m2.ts:39` through 64; `tests/e2e/M2/lib/m2.ts:97` (`integrations`, the helper that calls `page.goto`).

The no-stale-values case installs a MutationObserver and `window.__staleSeen`, then clicks the client-side Integrations link. It next calls `integrations(page)`, which performs a hard navigation. This replaces the document and deletes the observer and captured array before the Blackboard transition. The final assertion expects the deleted value to equal `[]`; more fundamentally, the test no longer observes whether Canvas values appear on the Blackboard route.

The adjacent form-state case also uses a hard navigation from Canvas to Blackboard. It can show that a new document starts empty, but it cannot expose stale React form state during a client-side route change.

Evidence: the observer lifecycle and navigation calls are explicit in the source. No running-browser result is claimed.

Correction: use actual client-side navigation for the transitions under test. Preserve the same document and assert that its observation sentinel remains present. Check forbidden values during the transition, including late data responses, as well as after it finishes. Preserve library/provider mismatch assertions separately. Do not replace the observer check with a final-page-only assertion.

## Narrow contract and baseline follow-ups

These are specific open QA preparation items, not extra implementation requirements:

- Canvas C-1: app contract §4.6 says the extension domain is the host of `PUBLIC_LTI_URL`; the prepared exact-JSON oracle accepts both URL host (with port) and hostname (without port). Architect must state one exact intended value, then QA must assert it. A test accepting both cannot prove an exact body. This review does not select a new product behavior from the ambiguity.
- Canvas C-2: the pending add-deployment route's `409 CONNECTION_NOT_READY` matches its stated endpoint precondition. It is not a new defect.
- Canvas C-3: reuse of an already redeemed initial code on add-deployment currently accepts `redeemed` or `purpose` in the audit reason. Phase 1 checks redeemed before purpose. Assert the required `redeemed` reason, while retaining the public `403 GRANT_INVALID` response. Architect clarification is queued by the Lead.
- Canvas C-4: a signing-key-rotation host action is not required by a SIM criterion. The existing inline-key snapshot check does not prove live rotation; L-C14 stays UNVERIFIED.
- M2 H-3: the unchanged Moodle disconnect baseline is `This stops launches through this connection. The tool stays in Moodle.` Use exact equality for the accepted text, not only presence of Moodle.
- M2 H-6: T7 still names old publish/connection/publication labels. Apply only the Lead-approved M2 label changes before AC-M3-02. Preserve the underlying Moodle workflow assertions.

## Infrastructure and oracle assessment

The provider-independent simulator core owns signing, JWT checks, token/score state and the public test-control boundary. Canvas and Blackboard modules supply their distinct issuer, endpoints, audience and Deep Linking behavior. Private RSA keys are generated in memory; reviewed outputs expose public keys only. Test oracles use independent expected values and public product interfaces rather than importing the implementation. These are simulation fidelity checks, not vendor interoperability evidence.

The transport gate sits between app and LTI service, can record caller disappearance and apply held upstream work after timeout, and leaves product timeouts unchanged. Its reviewed logs avoid headers and bodies. Race recipes record IDs/phases and separate remote activation from app approval. Tight live schedules fail as BLOCKED if they do not fit; they must not extend a product timeout.

The M1 host runner requires exact product/test SHAs and clean frozen test inputs. Its coverage checks reject missing providers, empty selection, duplicate results, skips, mixed SHAs, wrong evidence labels, expected browser failures and retries. The full path runs SIM and migration twice at the same SHAs, then legacy suites. M2 uses a separate manifest and isolated host entry. Preparation-only branches run before Docker or clone operations. The migration helper checks the old snapshot, paired files/sidecars, rejected damaged restore and old-stack behavior; the product shell defect B-M1-02 must be fixed before relying on this path.

Isolation code limits host actions to the designated project and records existing resources; no actual baseline-volume preservation is proven without a run. Browser screenshots mask approval inputs. Private raw artifacts and secret scanning are separate from shared evidence. No evidence from these code checks is relabeled CANVAS-LIVE, CANVAS-LOCAL or BLACKBOARD-LIVE.

## Criterion coverage

| Criterion | Reviewed preparation | Verdict limit |
| --- | --- | --- |
| AC-M3-01 | All 40 M1 criteria are in committed manifests; all 37/38 named variants are enumerated in this review's M1 report. Same-SHA accounting and no-empty/no-skip checks have self-tests. | NOT RUN acceptance. B-M1-01/02/03 remain open. No QA PASS report is supplied by preparation. |
| AC-M3-02 | M1 host runner separates final legacy regression; T7 label alignment is declared H-6. | NOT RUN. Align approved labels, then run both required Moodle regression parts on the final SHA. |
| AC-M3-03 | M2 manifest has 64 browser rows for all 13 criteria and screenshot recipes. | CHANGES_REQUESTED: B-M3-01 and B-M3-02 block meaningful execution/evidence. |
| AC-M3-04 | Simulator keys are memory-only in reviewed code; gate/simulator logs omit secret-bearing traffic fields. | Code reviewed; complete run artifact and generated-file hygiene scan NOT RUN. |
| AC-M3-05 | Live rows have separate labels/environment/authorization rules; step data remains unverified. | All live checks UNVERIFIED in this review. No tenant authorization or execution assumed. |
| AC-M3-06 | Host runners use isolated clones/projects and scoped actions; resource inventories are part of the recipe. | No stacks run. Existing volumes, baseline containers and concurrent-lane limits are not empirically verified here. |
| AC-M3-07 | Captured-secret leak scans, private raw evidence and masked browser artifacts are prepared. | Full run scan NOT RUN. Maintain separate private and shared artifacts when executing. |

## Independent checks

At exact `9964e6f` in the external clone:

- `node tests/host/run-m1.mjs --harness-only --provider all`: 21 self-tests passed, zero skipped; tests TypeScript passed; 359 API cases plus 19 host rows accounted; all simulator modules loaded.
- `node tests/e2e/host/run-m2.mjs --harness-only`: two self-tests passed, zero skipped; tests TypeScript passed; 64 browser cases accounted; T7 discovery excludes M2 files.

These commands passed and made no stack or live-provider calls. They verify manifests, types and discovery. They do not execute the failing wizard selectors or preserve a browser document through a route transition, so their success does not close either MAJOR.

## Next review gate

Review exact committed repairs to B-M3-01/02 and the narrow oracle/baseline items above, together with the product fixes. Then QA must produce actual per-case results and artifacts for the final frozen SHAs. This delivered round-1 report frees repair work; it does not pass the implementation, acceptance, migration, regression or live-provider gates.
