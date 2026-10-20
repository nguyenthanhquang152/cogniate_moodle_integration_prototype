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
