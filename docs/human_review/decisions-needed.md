# Decisions needed

Source: commit `6932539`, 2026-10-19.

Only a human can answer these questions. Each row has our recommendation, what the answer blocks, and who decides. Until you decide, the prototype uses our recommendation.

**How to answer:** open [`explainer.html`](explainer.html), tab **Decisions**. Select an answer for each row, then click **Copy my answers** and send the text to the Lead. Or reply with the row ids (for example "Q1 accept, Q3 change: …").

Source: [`docs/architecture/open-questions.md`](../architecture/open-questions.md) (Q1 to Q18, R1 to R5), plus two hand-over checks (HR-1, HR-2). The groups are a proposal by Docs. Time: about 10 minutes.

## A. Decide before the pilot

| Id | Question | Our recommendation | It blocks | Who decides |
| --- | --- | --- | --- | --- |
| Q1 | Legal: is our clean-room method acceptable? May QA use the MIT `ltiaas` Python SDK as a test-only client? May we use the claim below? | Yes, yes (test only, not shipped), and yes: use only the claim below. Check the LTI® mark and plan 1EdTech membership. | Any external claim about LTIAAS compatibility | Legal |
| Q5 | Do we test on a real MoodleCloud site (registration, Activate, launch container, grades, web services, `.mbz` size limit)? | Yes, one test on a MoodleCloud trial site. A human must make the account, because the agents may not sign up. | The claim "works on MoodleCloud" | Product owner |
| Q3 | Privacy: do we share the learner name and email with Cogniate? (DataCamp shares both.) | No, by default. Moodle sends only an anonymous LTI user id. Add an opt-in per connection later, with a data processing agreement. | Learner names in the portal | Product and Legal (DPO) |
| Q16 | A teacher on Safari may not be able to add Cogniate content ("Select content" runs in a Moodle frame). Learner launches open in a new window, so by design they do not have this problem. QA tested Chromium only. Residual risk R4. | For the pilot: teachers use Chrome, Edge or Firefox to add content. Before general release, choose: accept the limit, a special mode after a security review, or ask Moodle HQ for support. | The browser statement for teachers | Product and a security reviewer |
| Q9 | The packages load images from the Cogniate production storage. The HTML export loads Google Fonts. | Ask the exporter to put all assets and fonts into the package. Google Fonts sends learner IP addresses to Google (GDPR risk). | Privacy, offline use | Cogniate engineering and DPO |
| Q17 | In the HTML export, a decorative layer covers the centre of the lesson link on the menu page. Does a person also miss clicks there? | Ask the exporter to give decorative layers `pointer-events: none`. Check the menu page by hand in this review. No change in our product. | Usability of HTML packages | Cogniate engineering |
| Q2 | Does the course open in a new window or inside the Moodle page? | New window (current setting). A course inside the Moodle page fails in browsers that block third-party cookies. DataCamp also uses a new window. | Admin guide text | Product |
| Q4 | Which grade does Moodle show: the best result or the latest? What does a completion-only course give? | Keep the best result as the intended policy. A completion-only course gives 100/100. Q4 remains open. No human approval of the P2 remote-ordering limit is recorded. | The grade rule (ADR-010) | Product |
| Q12 | Do we offer the native channel (`.mbz` backup and course shell, task T8) in the pilot? T8 round 2 passed its listed ACs and two race checks. MoodleCloud and Moodle-page restore remain unverified. | Keep LTI as the main path. Offer the native backup only to a customer who needs editable courses on MoodleCloud. | Pilot scope | Product owner |
| Q18 | A Moodle site in a subfolder (for example `https://school.edu/moodle`) cannot connect today. Dynamic registration is refused. Web service and course links (T8) would use the wrong path. Manual connect may work, but nobody tested it. MoodleCloud is not affected. | Support it before the first self-hosted customer. It is about 1 day of work. Our local stack cannot test it before the hand-over. | Self-hosted Moodle customers in a subfolder | Product and Engineering |

NOTE: Q4 asks people to choose the intended grade policy. It does not guarantee permanent agreement with Moodle’s gradebook. Q4 remains open, without human approval of the delivery limit. See the [P2 remote-ordering limit](../architecture/adr/ADR-010-grade-and-completion-policy.md#p2-bounded-confirmation-after-uncertain-delivery-2026-10-19).

### Q1: the claim to approve

Source: [ADR-003, "Promises"](../architecture/adr/ADR-003-ltiaas-compatibility-scope.md#promises). In plain words:

> For the endpoints listed in ADR-003, our LTI service uses the paths, header schemes and field names of the public LTIAAS API reference. The differences are listed in contract §8. The real `ltiaas` Python SDK passed our test for the id token, deep linking, scores and memberships (AC-T3-27). We used it only as a test client (MIT licence).

One limit: a line item id with a raw slash gets 404. The form that the SDK sends passes (D15).

Do not say:

- "a copy of LTIAAS"
- "works with any LTIAAS tool"
- "LTIAAS" in a product name

## B. Hand-over checks (this week)

| Id | Question | Our recommendation | It blocks | Who decides |
| --- | --- | --- | --- | --- |
| HR-2 | Can a person who did not build the stack start it with the guides in 10 minutes? | The Lead accepted QA’s 61-second fresh-clone run for AC-T9-01. Ask an unfamiliar team member to follow the [run guide](../guides/run-the-stack.md) and report unclear steps. | Unfamiliar-human usability; not AC-T9-01 acceptance | Product team (one member) |
| HR-1 | Do we keep the Vietnamese video (`video/explainer-vi.mp4`)? It is machine-translated, and a computer voice reads it. | Keep it only if one Vietnamese team member watches it and says that it is clear. Otherwise drop it. | The Vietnamese video | Product team |
| Q15 | The two course zips (24 MB) are test files. Do they go into git, into Git LFS, or outside git? | Outside normal git: Git LFS or a documented download. Until then, use `COURSE_FIXTURES_DIR` and `npm run fixtures:check`. | QA runs in a clean clone, hand-over | Lead and product owner |

## C. Decide before you sell or go to production

| Id | Question | Our recommendation | It blocks | Who decides |
| --- | --- | --- | --- | --- |
| Q8 | The browser calculates the score, and the correct answer is in the page. Residual risk R3. | Acceptable for completion-type courses. Not acceptable for graded or certified tests: calculate the score on the server before you sell graded courses. | A graded-course offer | Product |
| Q10 | Do we buy a separate domain for course content, with one subdomain per customer? Residual risk R5. | Yes, before production. Course content on the same site can attack the portal. | Production deployment | CTO |
| Q11 | Who runs the LTI service, in which region, with which SLA and key management? | The same cloud and region as Cogniate. Keys in a KMS, with rotation every 90 days. Target 99.95 % uptime. | Production deployment | CTO |
| Q14 | Who defines the real Cogniate API that replaces our stand-in app? | A Phase 0 contract workshop with Cogniate engineering. Our stand-in contract is an input. | Production integration | Cogniate engineering |
| Q6 | Which Cogniate plans get "Publish to Moodle (LTI)"? Does a publication count as an export? | Pro Creator and above. One publication per course per Moodle site counts as one export. | Plan checks (not built) | Product and Sales |
| Q7 | Will the HTML export keep the markup that our HTML runtime reads? Can the exporter send a real completion signal? | Yes. Freeze the markup as "Cogniate HTML export markup v1". Better: the exporter adds a small adapter that sends progress, like `scorm-api.js`. | Stable HTML results | Cogniate engineering |
| Q13 | When a course gets a new version, do the Moodle activities of that course show it at once? | Yes (live link). Learners in progress stay on their version. Later, if customers ask, let a teacher keep an activity on one version. | Publish UI | Product |

## D. Residual risks: confirm before production

A reviewer found each risk, and the Lead accepted it for the prototype. A human confirms each one before production.

| Id | Risk (plain words) | Why we accepted it | Our recommendation |
| --- | --- | --- | --- |
| R1 | A changed Moodle can make a new registration take over an old, unused tool record. | A standard Moodle cannot do this. Only a site admin with a modified Moodle can. | Accept. A security reviewer checks it again before production. |
| R2 | A person can send an unused launch link to someone else. The first person who opens it gets the attempt. | It needs social engineering. The only gain is credit for the other person's work. | Accept for the pilot. A security reviewer checks it before production. |
| R3 | A learner can change the score with browser developer tools. | Acceptable for completion-type courses only. | Same as Q8. |
| R4 | Teacher "Select content" can fail in Safari. | Moodle 5.2 has no LTI client-side storage. QA tested Chromium only. Other browsers are not proven. | Same as Q16. |
| R5 | All libraries share one content site, so course code of two libraries shares browser storage. | Prototype only. The content site has no cookies, and the proxy drops `Cookie`. | Same as Q10: one content subdomain per customer. |

## E. Canvas and Blackboard decisions

Added by the Lead on 2026-10-20 for AC-M4-07.
Sources: [Q19 to Q22](../architecture/open-questions.md) and [ADR-011 revision 6](../architecture/adr/ADR-011-multi-lms.md).
These are open decisions. They do not claim that implementation or verification is complete.
The earlier Moodle explainer does not yet include these rows. Send answers to the Lead with the row ids.

| Id | Decision needed | Recommendation or current boundary | It blocks | Who decides |
| --- | --- | --- | --- | --- |
| Q19 | Which Canvas and Blackboard environments may the team use for live checks? | Give written permission for each tenant and each allowed change. Canvas needs a developer key, test course and enrolled learner. Blackboard also needs Developer Portal access, Learn admin access and a public JWKS URL. | Live interoperability checks and claims | Product owner |
| Q20 | Who owns the Blackboard application, and which host runs the production LTI service? | Use a company account and a stable LTI host. Keep one application per host. A second tool account needs another host. | Blackboard production setup | Product owner and Legal |
| Q21 | Which enterprise follow-ups come first? | Prioritize D-3 before many customers and D-12 before enterprise recovery depends on release. Then assess D-2, D-4, D-1, D-5 and D-11 by customer need. | Next phase scope | Product |
| Q22 | What evidence permits an approval grant, and who may operate the commands? | Check a request from the institution's LMS administrator through an institutional channel. Match the library, site, Canvas service URL, client id and deployment id. Record the evidence reference in the note. Name the support staff who may issue grants, suspend bindings and release them. | Operator policy and first customer setup | Product and Legal |

Q19 does not authorize an account, a public tunnel, a deployment or a real tenant change.
Without permission and matching evidence, live rows stay **UNVERIFIED**.
An inline public key can avoid public exposure for an authorized Canvas test.
Blackboard needs a JWKS URL that its services can reach.

## F. Enterprise follow-ups

These defaults come from [ADR-011 §15](../architecture/adr/ADR-011-multi-lms.md#15-out-of-scope-and-follow-ups).
They define this phase's scope. They are not human approval of a production service.

| Id | Decision needed | Default until decided |
| --- | --- | --- |
| D-1 | Add Canvas Dynamic Registration with profile checks? | Manual Canvas setup. |
| D-2 | Accept more than one Canvas page origin? | One page origin and one service origin. The third-host rules in ADR-011 §5 apply. |
| D-3 | Replace operator approval with self-service ownership proof? | One operator approval grant for each new binding. |
| D-4 | Add LTI platform storage for frames without cookies? | A partitioned cookie, with the browser limit in R4. |
| D-5 | Support inherited Canvas keys across institutions? | Refuse shared key ownership with `409 PLATFORM_IN_USE`. |
| D-6 | Add one Blackboard host for each tool account? | Blackboard uses only the `cogniate` tool account. |
| D-7 | Reconnect a disabled connection and keep its publications? | Create a new connection. Old activities stay unavailable. Another library needs an operator release first. |
| D-8 | Remove the NRPS scope? | Keep the Moodle scope policy. Each service call asks for one scope. |
| D-9 | Apply the claim allowlist to standard Moodle profiles? | Keep Moodle behavior unchanged. |
| D-10 | Request a new learner window in Blackboard and Moodle? | Keep Moodle unchanged. Blackboard follows the Learn setting. Canvas already honors the window hint. |
| D-11 | Offer ungraded Canvas module items? | Do not offer `link_selection` before a decision on completion without a grade column. |
| D-12 | Reserve released self-hosted Canvas identifiers, or add a quarantine period? | Use the operator order in ADR-011 §4b and document the remaining race. This needs a design before enterprise recovery relies on release. |

D-12 applies only to self-hosted Canvas. Hosted Canvas and Blackboard issuers are already reserved.
After release, a grant-free Moodle registration can take the self-hosted Canvas issuer and client id first.
That can block setup. Check 14 refuses Canvas launches before storage, so it gives no Canvas access.
Issue the rightful grant, suspend the old binding, release it, then redeem the rightful grant promptly.
This order shortens the window but does not prevent the race.

## G. Review escalations

Added by Docs on 2026-10-21, under the Round 3 rule in [charter §2](../team/charter.md#2-workflow-graph).
That rule sends each BLOCKER or MAJOR that is open after review round 3 to this list.
This section asks for no decision.
The charter does not require human permission before the authorized corrections.

### G1. Storage design: UNRESOLVED

Topic: SQLite data on Docker named volumes ([ADR-012](../architecture/adr/ADR-012-sqlite-volume-storage.md)).
Round 3 checked design revision 3 at commit `b3bd22e`. The report text is at commit `7f2c2c5`.

| Check | Round 3 verdict | Report |
| --- | --- | --- |
| Reviewer-A | APPROVE, design only | [Round 3](../reviews/M0/storage-reviewer-a.md#round-3-2026-10-21) |
| Reviewer-B | APPROVE, design only | [Round 3](../reviews/M0/storage-reviewer-b.md#round-3--recheck-of-revision-3) |
| Common QA | FAIL, design testability: 2 MAJOR | [Round 3](../reviews/M0/storage-qa.md#round-3) |

Open MAJOR findings:

| Id | Problem |
| --- | --- |
| QA R3-01 | The old-schema import test copies the old app database, but not the package folders that it references. The content check refuses the import, so the test cannot pass. |
| QA R3-02 | The existing T5b test P5 stops only the app, then writes the app database while the LTI service runs. The fixture write rule requires both services stopped. |

Current status:

- QA rates each fix as a bounded text correction, not a design change.
- The Architect corrects both in task `task_e7ed35da6e6b`. The same task corrects the non-blocking findings A-S-12, B-S-20, B-S-21 and QA R3-03 to R3-07.
- There is no waiver and no human approval. The implementation gate is closed. No runtime acceptance exists.
- Each full round keeps 488 rows: the 416 existing rows plus 72 storage rows.
- Product and test files are unchanged from commit `8138097`. All runtime gates stay required. All 32 live LMS rows stay **UNVERIFIED**.
- The Lead's direction is in the [phase plan](../team/multi-lms-plan.md#storage-round-3-escalation-and-bounded-correction).

G1 stays UNRESOLVED until the same reviewers and QA check the frozen correction and record closure.
Do not mark G1 closed without that independent evidence.
Add any new BLOCKER or MAJOR from that check to G1.
