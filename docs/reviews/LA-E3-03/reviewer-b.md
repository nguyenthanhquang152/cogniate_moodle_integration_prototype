Verdict: APPROVE
Round: 1

## Round 1

Reviewer-B: Codex GPT-6-Astra xhigh. Lens: can a human team own it?

Reviewed `6d53559` and `73fdebe` (merge `a722724`) against the task, LA-ADR-05 D2, the placement dependency and plan §6.1. Verification used a private `git clone --no-hardlinks` pinned to `572c627`. No other reviewer's report was read.

### Findings

None. Counts: **0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

### Review evidence

- **Clear rule:** `lti/service-keys.ts:10` explains the empty context component, its scope and its agreement with the shaped ID token. The rule stays in the service-key domain function. In the app, `tool-pages/launch.ts:122` computes `contextId` once and uses it for both the resource-link upsert and pick matching. Both locations cite LA-ADR-05 D2; the key derivation and placement store remain unchanged.
- **Pages and results:** The app stores an empty context title. The existing player shell omits that empty label while retaining the published course and activity titles, preview status and return link (`tool-pages/play.ts:62`). The results projection explicitly returns “—” for an empty context id (`domain/results.ts:47`), and the dependency's AC-LA-E4-02-11 test passed. Missing context is not presented as a launch error. A missing gradebook column retains the separate, specific error “No gradebook column: the activity has no AGS line item.”
- **UNIT AC-07:** Tests assert the actual key value is stable across launches, differs for context `c1`, and has stored context id `""`. Separate cases retain deployment/resource-link scope, NRPS-only issuance and no-service refusal. A real injected launch followed by `/api/idtoken` verifies that the key is present while `launch.context` stays absent.
- **UNIT AC-08:** Tests pin the `401 INVALID_LTIK` page, `not_resource_link` log reason and absence of resource-link writes for a Deep Linking token, with and without context. They also cover a resource launch missing its resource link. This AC preserves existing behavior; removing the combined message-type/resource-link guard made all three refusal cases fail.
- **App coverage:** New cases open the player with and without service claims, verify empty stored context fields, reuse the placement and continuing attempt, separate deployments and nonempty contexts, and transfer a Deep Linking pick without double-counting the activity. The existing missing-`sub` check remains unchanged and tested.
- **Validation:** Six focused suites (service keys, ID token, launch checks, app launch, records and results) passed **129 tests**. Root `npm run typecheck` and ESLint on all four changed TypeScript files passed. Restoring the old context requirements caused **9 expected failures**; removing the preserved rejection guard caused **3 expected failures**. All private mutations were restored.
- **Ownership and scope:** The commits change only the two permitted L2 product files and their colocated author tests. The forbidden service-key store, placement upsert, results route and launch check 11 are untouched. No LMS name or branch was added to core behavior.

This is source and unit approval. K1-SIM AC-01 through AC-06, the task's regression lane and QA's LA-IC-05 test-change-list evidence are separate gates. No Docker, stack or host stack runner was used.
