Verdict: CHANGES_REQUESTED
Round: 1

Reviewer: dedicated Reviewer-B, Codex GPT-6-Astra, xhigh.
Date: 2026-10-20.
Design reviewed: `51e69d11c256984929e8522d5c1446b54565dc93`, ADR-011 revision 4, compared with `e280173`.
Task: `task_6df3fc0172eb`; dispatch: `ctx_3c1ba794297e`.

This is an independent design review, with a focus on setup, recovery, maintenance and evidence. It is not product QA or live LMS approval. I read the charter, phase plan, inputs, architecture, contracts, M1–M4 and research. I did not read Reviewer-A reports or messages.

The normal setup paths are much clearer than the preflight proposal. Four MAJOR recovery and upgrade issues remain. Two MINOR inconsistencies should also be corrected. Implementation should wait for the MAJOR findings to close.

## Findings

### B-M0-01 — MAJOR — Blackboard cannot follow its promised retry path

Location: [app contract §4.7](../../architecture/contracts/cogniate-app-api.md#47-operator-approval-grants-deployments-disconnect-and-guards-m1), lines 365–367; §4.4, lines 280 and 283; [data model §4.2](../../architecture/data-model.md#42-cogniate-app-011_lms_typessql), line 432.

The app keeps a Blackboard reservation after an LTI failure, but the next redemption check does not accept that reservation.

Concrete sequence: connection K reserves deployment D. The LTI request fails, so K stays pending and the grant's redeeming mark clears. The user selects Save again. Check 6 accepts only a free reservation or one held by a disabled connection of the same library. K is neither. The request therefore returns `DEPLOYMENT_IN_USE` before it can reach the documented recovery for an existing remote deployment. This also affects a retry with a replacement grant for the same values.

Impact: a temporary LTI outage becomes a blocked customer setup. The portal tells the user that the site is already connected, while their connection remains pending.

Correction: explicitly allow the current connection to reuse its own reservation, after the same grant and value checks. Keep the other-connection conflict rules. Define cancellation of this pending state too: a remote `404 UNKNOWN_DEPLOYMENT` after a failure before creation must count as already absent, so DELETE can disable the connection and revoke its grants.

Acceptance: simulate failure before remote creation and a lost response after creation. Retrying each must finish on the same connection, with one reservation and one redeemed grant. Cancelling either case must leave no active remote binding.

### B-M0-02 — MAJOR — A replacement grant can give one Blackboard connection two reservations

Location: [app contract §4.8](../../architecture/contracts/cogniate-app-api.md#48-operator-cli-approval-grants-m1), lines 397–398; §4.7, line 365; [data model §4.2](../../architecture/data-model.md#42-cogniate-app-011_lms_typessql), lines 368–376 and 403.

The operator can issue a new initial grant with a different deployment ID after a failed setup, without resolving the first reservation.

Concrete sequence: K reserves D1 and the LTI call times out. K remains pending. The operator corrects the deployment ID by issuing a grant for D2; this revokes the old grant. D2 is free, so its redemption inserts a second reservation for K. The SQL has uniqueness on `(platform, deployment)`, but only a non-unique index on `connection_id`. No contract step removes or refuses K's D1 reservation.

Impact: this breaks the stated zero-or-one reservation model. If the timed-out request created D1, both D1 and D2 can later route through K once D2 makes K registered. The singular deployment in the connection DTO and disconnect operation no longer describes all owned bindings.

Correction: enforce one reservation per Blackboard connection. The simplest recovery policy is to freeze its deployment ID once a reservation exists. A correction must cancel that pending connection safely, then use a new connection and grant. Alternatively, specify a full replacement operation that reconciles the old remote deployment before moving the reservation. Add the database constraint and the corresponding CLI refusal.

Acceptance: after both forms of timeout in B-M0-01, issue a grant for a different deployment. Prove that the defined refusal or replacement leaves exactly one reservation, and that disconnect switches off every binding owned by that connection.

### B-M0-03 — MAJOR — Revocation and replacement can race with final activation

Location: [app contract §4.7](../../architecture/contracts/cogniate-app-api.md#47-operator-approval-grants-deployments-disconnect-and-guards-m1), lines 356–367; §4.8, lines 398–400; [ADR-011 §4a](../../architecture/adr/ADR-011-multi-lms.md), lines 127–129.

The grant is checked before the LTI call, but the specified success transaction does not check whether the grant was revoked or replaced during that call.

Concrete sequence: G passes validation and starts its remote call. Before the response, the operator revokes G; the CLI succeeds because G is still unredeemed. The remote call then succeeds. The specified second transaction sets `redeemed_at` and registers the connection, although `revoked_at` is already set. Issuing a replacement grant has the same race.

The 60-second takeover rule adds another ambiguous case: an old request may finish after a newer redemption owns the mark. The contract does not require the old request to prove that it still owns the attempt before finalizing or clearing the mark.

Impact: an operator's successful cancellation can be followed by activation of the cancelled binding. The grant list and audit events can describe contradictory outcomes.

Correction: define the transition rules for a grant that is redeeming. Either refuse revoke/reissue while a live redemption owns it, with a clear retry response, or make finalization conditional on the grant still being valid and owned by that redemption. A timed-out takeover needs an attempt identity checked during finalization and cleanup. A stale completion must not disable a platform or deployment now owned by a successful connection.

Acceptance: pause the LTI response, revoke or replace the grant, then release the response. Assert the chosen cancellation semantics and one consistent audit outcome. Repeat with an expired redeeming mark and a newer attempt.

### B-M0-04 — MAJOR — The upgrade recipe calls a command absent from the old revision

Location: [M1 AC-M1-23](../../architecture/tasks/M1.md), line 127; [ADR-011 §14](../../architecture/adr/ADR-011-multi-lms.md#14-compatibility-migration-upgrade-and-rollback), lines 333–337.

AC-M1-23 starts at `b0b83a8`, runs `npm run stack:data-backup`, and only then switches the checkout to M1. The backup command is introduced by M1.

Evidence: `git show b0b83a8:package.json` has no `stack:data-backup` or `stack:data-restore` script. No stack run is needed to establish that this invocation cannot work in that checkout.

Impact: QA and operators cannot follow the specified upgrade procedure. Moving directly to a normal startup on the new revision would migrate the databases before the required old-schema backup.

Correction: state which revision supplies the maintenance commands. For example, stop the old services, switch only the checkout to M1 without starting either service, run M1's backup command against the existing project and volumes, and then start the new build. Preserve the old project name, paths, configuration and secrets. Use the same explicit sequence in AC-M1-23 and the operator guide.

Acceptance: execute the revised sequence from a clean `b0b83a8` checkout with existing Moodle data. Confirm that the backup contains only the old migration ledgers before the first M1 startup. The restore-before-old-start procedure in AC-M1-30 is otherwise the right approach.

### B-M0-05 — MINOR — Self-hosted Canvas has two different service-origin rules

Location: [ADR-011 §5](../../architecture/adr/ADR-011-multi-lms.md#5-origins), lines 140 and 142, versus §6, lines 165 and 179; [LTI contract §9.1](../../architecture/contracts/lti-service-api.md#91-provider-profiles), line 444.

The origins table fixes the self-hosted token endpoint and service origin to the issuer/site. The profile table and contract allow a separate `serviceUrl` for every Canvas profile.

Impact: the Author, QA and Docs can implement different behavior for the same supported profile. Existing self-hosted acceptance uses equal origins and would not expose the difference.

Correction: align §5 with the chosen contract, or restrict separate service URLs to the profiles that support them. Add one explicit self-hosted split-origin acceptance or refusal case.

### B-M0-06 — MINOR — The inactive-deployment action promises an unavailable repair

Location: [LTI contract §9.2](../../architecture/contracts/lti-service-api.md#92-new-error-codes), line 471, versus [ADR-011 §12](../../architecture/adr/ADR-011-multi-lms.md#12-key-and-connection-lifecycle), lines 289–293.

`DEPLOYMENT_NOT_ACTIVE` tells the learner to ask the Cogniate admin to “switch it on.” The supported portal lifecycle creates a new connection and grant. It does not restore the old publications or course items.

Impact: support staff may promise that reconnecting will repair old course links, contrary to the disconnect warning and D-7.

Correction: make the learner action ask the admin to check the disconnected connection. The troubleshooting guide should explain that a new connection requires new publications and course links. Do not describe direct LTI API activation as a portal repair.

## Preflight disposition

These are design-level closures, not claims that the changes have been implemented or tested.

| Preflight ID | Result at `51e69d1` |
| --- | --- |
| B-PF-01: derived Canvas endpoint hosts refused | Addressed by ADR-011 site rule 4 and positive AC-M1-05 cases. |
| B-PF-02: old build rejects new migration ledger | Restore-before-old-start addresses the original failure. B-M0-04 identifies the remaining backup invocation problem. |
| B-PF-03: ungraded Canvas module path reports failed sync | Addressed by offering only `assignment_selection`; `link_selection` is D-11. |
| B-PF-04: manual form rows mixed with Paste JSON | Addressed by the four-row Paste JSON recipe and complete JSON description. |
| B-PF-05: Save leaves the assignment unpublished | Addressed by Save & Publish and the published-course requirement. |
| B-PF-06: Blackboard placement target missing | Addressed by the explicit Cogniate launch target in operator and school steps. |
| B-PF-07: browser name used as cookie-failure oracle | Addressed by browser/version/settings evidence and conditional outcomes. |
| B-PF-08: inline Canvas key rotation unclear | Addressed by the snapshot warning, key ID header and re-export live check. |
| B-PF-09: local and hosted Canvas evidence mixed | Addressed by separate evidence labels and live rows. |

## Provider and human-workflow checks

I checked current primary sources on 2026-10-20. Source-code observations are not proof of behavior on a specific hosted release.

| Check | Finding and source |
| --- | --- |
| Canvas key and installation | Paste JSON, Redirect URIs and a separate client-ID installation are supported. The deployment ID comes from the installed app. The revised four rows are coherent. [Key configuration](https://community.instructure.com/en/kb/articles/661475-how-do-i-configure-an-lti-key-for-an-account), [client-ID installation](https://community.instructure.com/en/kb/articles/661478-how-do-i-configure-an-external-app-for-an-account-using-a-client-id). |
| Canvas teacher and learner | The official teacher path uses External Tool, Find, selection, the new-tab setting and Save & Publish. The revised wizard follows this path. [Assignment guide](https://community.instructure.com/en/kb/articles/660672-how-do-i-add-an-assignment-using-an-external-app). |
| Canvas launch presentation | Current vendor code sets `document_target` to `iframe`; assignment selection accepts `iframe` and `window`. The top-level continuation and separate framed test are justified. [JWT construction](https://github.com/instructure/canvas-lms/blob/master/lib/lti/messages/jwt_message.rb), [Deep Linking request](https://github.com/instructure/canvas-lms/blob/master/lib/lti/messages/deep_linking_request.rb). |
| Canvas page and service origins | Current vendor code builds AGS and NRPS URLs from the root account's environment-specific domain. Deep Linking uses the request controller to build its return URL. Separate stored origins are justified; the exact hosted-domain mapping remains an inference requiring live evidence. [JWT construction](https://github.com/instructure/canvas-lms/blob/master/lib/lti/messages/jwt_message.rb), [Deep Linking return construction](https://github.com/instructure/canvas-lms/blob/master/lib/lti/messages/deep_linking_request.rb). |
| Blackboard ownership and setup | The vendor registers one application; schools install it by Application ID and obtain Deployment IDs. The placement target is a routing value, so the explicit Cogniate target is needed. [Vendor registration guide](https://docs.blackboard.com/docs/blackboard/lti/1.3/register-an-application). |
| Blackboard capability and recovery limits | Deep Linking exposes the teacher content picker; student access to that placement is a separate setting. Learn exposes per-tool user-field and service permissions. Deleting a tool or placement can permanently break course links; the planned guide warning is appropriate. [Learn administration](https://help.anthology.com/blackboard/administrator/en/integrations/learning-tools-interoperability/set-up-ltis.html), [deletion warning](https://docs.blackboard.com/docs/blackboard/lti/1.3/register-an-application#deleting-an-lti-tool-or-placement-from-blackboard-lms). |
| Evidence and browsers | M3 and M4 distinguish DOC, SIM and each real environment. No live row is claimed as passed. Browser evidence records versions and settings; this matches Safari's restored partitioned-cookie support. [WebKit release notes](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/). |

The public [DataCamp Canvas case](https://support.datacamp.com/en-us/articles/17598821-canvas-lti-integration) and [Blackboard case](https://support.datacamp.com/en-us/articles/17598773-blackboard-lti-integration) were workflow inputs only. Their account provisioning, identifiers, secrets and grade choices are not requirements for Cogniate.

## Review boundary and next action

The trusted-operator decision covers both providers and added Canvas deployments. I am not asking to defer ownership proof or replace that decision. The findings concern the recovery behavior required to make that chosen model reliable.

No product tests, stacks, accounts, tenants or external configuration were changed. I used read-only repository inspection and current vendor sources. Only this report was written. The unrelated untracked `pnpm-workspace.yaml` was present before this review and was not touched.

The Architect should resolve B-M0-01 through B-M0-04 in the contracts, data model and observable acceptance criteria, then provide a new frozen design for review.

---

## Round 2 — 2026-10-20

Verdict: CHANGES_REQUESTED
Round: 2

Reviewed SHA: `bd9fe36edbe59143b914d7ccac424efd1db2c335`, ADR-011 revision 5.
Comparison: round 1 design `51e69d11c256984929e8522d5c1446b54565dc93`.
Task: `task_f5a737f0a439`; dispatch: `ctx_adcbc4bedd37`.

I re-read the charter, phase plan and Architect response, then traced the changed contracts, state model and acceptance criteria. The findings below are traces of the specified behavior, not results from running an implementation. The round 1 report above is unchanged. Established vendor research was not repeated.

Five original findings are closed at the design level. B-M0-03 remains MAJOR. Three new findings remain: one BLOCKER and two MAJOR. The revised design cannot yet be approved.

### Original finding dispositions

All line numbers in this section refer to `bd9fe36`.

| Finding | Disposition | Evidence |
| --- | --- | --- |
| B-M0-01 — MAJOR | CLOSED at design level | App contract lines 371 and 381 explicitly reuse the pending connection's own reservation. Line 402 treats a missing remote deployment as already absent. AC-M1-37(a), (b), (k), at M1 lines 129–130 and 139, cover retry and cancellation before and after remote creation. The remaining concurrent cases are B-M0-03 below. |
| B-M0-02 — MAJOR | CLOSED at design level | Data model line 384 adds a unique index on `connection_id`. App contract lines 280, 371 and 427 fix the deployment ID after reservation. AC-M1-29(k) and AC-M1-37(l), M1 lines 124 and 140, cover the refusal. |
| B-M0-03 — MAJOR | OPEN; partial correction | App contract lines 373–379 add attempt identity, final validation and conditional compensation. These solve the simple revoke-before-finalize case. The takeover and remote-state races below remain possible. |
| B-M0-04 — MAJOR | CLOSED at design level | ADR-011 lines 378–391 and AC-M1-23/30, M1 lines 156–167, explicitly obtain maintenance commands from the new revision while services stay stopped. Backup precedes the first migration; restore precedes the old build's startup. |
| B-M0-05 — MINOR | CLOSED at design level | ADR-011 lines 168–170 and 201, app contract line 234, and AC-M1-26 at M1 line 110 agree on a separate self-hosted service origin. The acceptance case includes split origins and a wrong-host refusal. |
| B-M0-06 — MINOR | CLOSED at design level | LTI contract line 479 now asks the admin to check the connection. M4 line 25 requires the guide to explain the need for new publications and course items. |

### B-M0-03 — MAJOR, still open — Conditional refs do not cover the specified takeover races

Locations: [app contract](../../architecture/contracts/cogniate-app-api.md), lines **281, 377 and 379**; [LTI contract](../../architecture/contracts/lti-service-api.md), lines **655–660**; [M1](../../architecture/tasks/M1.md), lines **134, 137 and 142**.

Two allowed orderings still break the promised final state:

1. **A cancelled attempt can take back a newer binding.** Blackboard attempt A has its create request held. The operator issues a replacement grant. Attempt B redeems it and registers the same connection with remote ref B. Release A's request within its five-second timeout: create returns `DEPLOYMENT_ALREADY_EXISTS`. Line 281 lets A read ref B and take it over because B is an attempt of the same connection. A sends `bindingRef: A, ifBindingRef: B`, which succeeds. Its phase 2 then detects revocation, and its compensation switches off ref A. B's successful binding is now inactive.
2. **A compensation can invalidate a read without changing its ref.** B reads an active deployment with ref A and prepares the ref-only takeover in line 281. A's compensation runs first: `active: false, ifBindingRef: A`, leaving ref A unchanged. B's conditional ref-only PATCH still succeeds, but the deployment remains inactive. B can then finalize and return `200 registered`. Thus two changes expecting the same ref can both succeed; the claim at LTI line 657 is too broad.

Impact: a successful setup can immediately stop working, or report registered while its deployment is inactive. The remote comparison is atomic, but it does not by itself prove that a request is current or that the state used to select the operation is unchanged.

Necessary correction: exclude adoption of a newer attempt by an older or cancelled attempt. Do not treat any newly read ref from the same connection as permission to take over. Also make takeover validate or establish the required active state atomically; a ref-only update must not finalize an inactive deployment. State the ordering rule in the app contract and the exact preconditions in the LTI contract.

Acceptance: redeem the replacement **before** delivering the old create response, and separately apply compensation **between** the replacement's read and takeover PATCH. Both schedules must preserve the successful current binding and its usable launch path. AC-M1-37(f) currently finishes the old attempt before redeeming its replacement, so it misses the first schedule.

### B-M0-07 — BLOCKER, new — A late Canvas added deployment can gain authority after revocation

Locations: [app contract](../../architecture/contracts/cogniate-app-api.md), lines **375–381, 401 and 516**; [LTI contract](../../architecture/contracts/lti-service-api.md), lines **561–564**; [ADR-011](../../architecture/adr/ADR-011-multi-lms.md), lines **85 and 431**; [M1](../../architecture/tasks/M1.md), lines **128 and 136**.

The claim that an unfinalized remote record grants no authority is false for an added deployment of an already registered Canvas connection.

Concrete sequence:

1. Canvas connection C is registered with deployment D1.
2. An `add_deployment` attempt for D2 passes phase 1. Hold its remote POST before the write.
3. The app reaches its five-second timeout, clears the attempt fields and returns `502`.
4. The operator revokes the unredeemed grant. C remains registered.
5. Deliver the held POST. The LTI service creates D2 active. The timed-out handler has already exited; it does not run phase 2 or compensation.
6. A valid D2 launch passes the active-deployment check. App routing at line 516 selects C by platform ID, without requiring a committed D2 binding. Its site and LMS checks also pass.

Impact: the cancelled installation can reach C's picker and publications without a successfully redeemed D2 grant. The “already active → 200, no grant” rule at line 401 also fails to distinguish this remote orphan from an approved added deployment.

Necessary correction: make the committed deployment approval part of the authority check for Canvas additions. A remote active row alone must not enable routing or idempotent success. Define how an uncertain late write is reconciled or switched off, using its ref, while keeping D1 usable. Staging remote records inactive until a fenced activation is another possible design, but the chosen protocol must cover a late activation too.

Acceptance: reproduce the timeout/revoke/late-write sequence without disabling C. Before successful reconciliation, D2 must create no picker, attempt or usable app binding; D1 must keep working. Repeat for a lost response after remote creation. AC-M1-37(h), which disables the entire connection, does not prove this property.

### B-M0-08 — MAJOR, new — Release has no usable ref for an unfinalized Canvas platform

Locations: [app contract](../../architecture/contracts/cogniate-app-api.md), lines **377, 388 and 444–446**; [data model](../../architecture/data-model.md), line **367**; [M1](../../architecture/tasks/M1.md), lines **141 and 148**.

A lost Canvas create response leaves an active platform with attempt ref A, but the connection remains pending. The connection's platform and `lti_binding_ref` are stored only at phase 2.

Suppose the operator now corrects a wrong service URL. Suspend can discover a remote record through this connection's attempt history and switch it off using A. Release, however, specifies deletion using the **connection binding ref**, which is still null. Even if the platform ID is discovered, that condition does not match A. The contract neither persists a recovered ref during suspend nor defines a history-based conditional delete for release.

Impact: the operator can contain the orphan but cannot follow the promised release-and-correct procedure. The corrected connection has different approved URL values, so the exact-value orphan adoption path cannot repair it.

Necessary correction: define how release discovers and conditionally deletes a Canvas record from an unfinalized attempt. Use an identified ref belonging to that connection, preserve the foreign/newer-owner checks, and keep historical state explicit. Do not require the operator to redeem an incorrect binding merely to obtain a connection ref.

Acceptance: lose the initial create response, suspend the still-pending connection, release it after the required wait, then bind the same client ID with a corrected service URL. Also prove that a newer foreign binding cannot be deleted. The current correction case, AC-M1-38(d), starts from a registered connection and misses this path.

### B-M0-09 — MAJOR, new — The held-request test cannot reach its stated cancellation result

Locations: [app contract](../../architecture/contracts/cogniate-app-api.md), lines **375 and 381**; [M1](../../architecture/tasks/M1.md), lines **137, 142–143**; [M3](../../architecture/tasks/M3.md), lines **63–74**.

AC-M1-37(i) holds the first request for more than 60 seconds, lets a second attempt redeem, then expects the first request to return `403 GRANT_INVALID`. The contract gives the first LTI call a five-second timeout. At that point its handler must already return `502 LTI_SERVICE_ERROR` and clear its attempt fields. Delivering the held response after 60 seconds cannot resume that completed handler into phase 2.

The transport gate delays network traffic; it does not pause an app handler or its timeout. The same distinction matters wherever the criteria expect a delayed request to continue into compensation.

Impact: QA cannot prove the stale-live-attempt claim with the specified black-box recipe. Extending a timeout silently would test different behavior from the contract.

Necessary correction: separate live-response races from timed-out late remote writes. Use a replacement-grant overlap within the real timeout for the former, and assert `502` plus safe remote reconciliation for the latter. Keep the app-restart case for a dead attempt's lease recovery. If a different deterministic mechanism is needed, specify its boundary and ownership explicitly.

Acceptance: each revised recipe must state when the caller times out, whether its handler still exists, and which component performs any later cleanup. The existing transport controls should be sufficient for the late-write checks in B-M0-07.

### Round 2 boundary and next action

The normal Canvas Paste JSON and Blackboard operator/admin workflows remain consistent with the earlier source review. The revised backup ordering, canonical origins, operator identity output and recovery explanations are improvements. No unrelated provider research needs to be reopened for the findings above.

Only this report was changed. No product or design file, test, stack, tenant, account or remote configuration was changed; no commit or push was made. This verdict is for design only.

Resolve B-M0-03 and B-M0-07 through B-M0-09 in the contracts and matching criteria, then freeze the correction for recheck. No approval is given while these findings remain open.
