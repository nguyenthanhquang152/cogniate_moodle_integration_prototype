Verdict: APPROVE
Round: 1

# LA-E3-03 — Reviewer-A

Reviewed `6d53559` and `73fdebe` in merge `a722724` against the task spec, LA-ADR-05 D2, LA-ADR-03 D2, contract delta §4.1, LA-IC-05 and plan §6.1. Lens: correctness, service scope and placement isolation. Blind review; no Reviewer-B file read.

## Round 1

Counts: **0 BLOCKER, 0 MAJOR, 1 MINOR, 0 NIT**. The L2 changes meet the empty-context contract. The finding below belongs to S1's idempotency integration.

### A-LA-E3-03-01 — MINOR — one no-context activity has different idempotency fingerprints across schemes

- **Where:** `services/lti-service/src/http/idempotency.ts:29` and `:32`. Fix owner: **lane S1, LA-E5-16**.
- **Problem:** the ltik target uses `contextId: null` when the context claim is not an object, while the issued service key correctly uses `contextId: ""`. A client that retries the same line item create with the other credential scheme gets `422 IDEMPOTENCY_KEY_REUSED` instead of the stored answer. These are the same target under LA-ADR-05 D2 and LA-ADR-06 D9 / BD-A2-56.
- **Evidence:** private HTTP probes at `a722724` created a no-context launch, obtained its service key through `GET /api/idtoken`, then posted the same body and key to `/api/lineitems`. LTIK first then SERVICE, and SERVICE first then LTIK, both gave `201` followed by `422`. A retry with the original scheme replayed correctly. Both cross-scheme orders with context `c1` passed. There was one platform create in each case. Normalizing only the absent/non-object launch context to `""` in a private S1 control made all six service probes pass; the control was restored.
- **Impact:** this is a defect for API consumers that switch schemes during a no-context create retry. It fails closed: it neither replays another course's answer nor makes a second create. The current Cogniate client has no line-item create method or idempotency header path, so its launch and score flow is unaffected. Safe to defer as a cross-lane MINOR.
- **Suggested fix:** S1 should use the same absent-context normalization as `serviceKeyForLaunch`, preserving every real string context id and the existing behavior for a context object without a string id. Add both cross-scheme replay orders and a named-context isolation control. L2 should keep the specified empty-string service-key and placement scope.

### Checks

- The service key still includes tool account, platform, deployment, context and resource link, with length-framed derivation; binding generation is forwarded unchanged. Empty context is distinct from `c1`. Different deployments and resource links give different keys. The deployment-wide uniqueness of a valid LTI resource link id is the design's basis for the absent-context case.
- A non-object context matches the existing shaped-token rule: `launch.context` is absent. A context object without a string id still gives no key. AGS and NRPS claims are copied unchanged; neither service claim means no key.
- Private API probes confirmed that the no-context service key works after ltik expiry, sends a score to its claimed line item and reads its claimed roster. A foreign-course line item or roster URL and an unavailable create permission were refused before outbound work. No-context `GET /api/idtoken` without either service claim omitted the key.
- The app removes only the context requirement from the resource-launch guard. Message type, resource link, connection/site checks, signed publication, roles and single-use handoff remain. Both the resource-link and picker-link paths use `""`; the placement uses the existing `(connection, deployment, context, resource link)` key. Private app probes kept identical external keys separate across two connections and refused another connection's publication and an unsigned query-string publication.
- UNIT AC-07 has direct repeated-key and named-context tests. UNIT AC-08 retains the unchanged Deep Linking rejection, with additional missing-resource-link coverage. The new app tests cover empty-context player launch, placement reuse/separation and picker linking. No forbidden file, QA-owned test or new LMS-name branch changed.

### Verification

A private clone at `a722724` passed **174 tests in 11 files**, covering service-key issuance/store, token shaping, launch checks, service routes, idempotency, app launches/router, placements/records/migration and results. Both service typechecks and ESLint on the four changed files passed.

The extra probes passed **5** tests and failed the **2** cross-scheme cases recorded above. Four independent mutation controls were detected: restore the old service-key context requirement (5 test failures), collapse all service-key contexts (2), restore the app's context requirement (4), and collapse all placement contexts (3). The private clone was restored, and only this review file was written in the integration worktree.

K1-SIM AC-01 through AC-06 and QA's LA-IC-05 / LD-9 evidence remain with QA. The in-process probes do not replace the simulator score-delivery run. No Docker, stack or host stack runner was used.
