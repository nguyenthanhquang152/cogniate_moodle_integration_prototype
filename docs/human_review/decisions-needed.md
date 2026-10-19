# Decisions needed

Only a human can answer these questions. Each row has our recommendation, what the answer blocks, and who decides. Until you decide, the prototype uses our recommendation.

**How to answer:** open [`explainer.html`](explainer.html), tab **Decisions**. Select an answer for each row, then click **Copy my answers** and send the text to the Lead. Or reply with the row ids (for example "Q1 accept, Q3 change: …").

Source: [`docs/architecture/open-questions.md`](../architecture/open-questions.md) (Q1 to Q17, R1 to R5), plus two hand-over checks (HR-1, HR-2). The groups are a proposal by Docs. Time: about 10 minutes.

## A. Decide before the pilot

| Id | Question | Our recommendation | It blocks | Who decides |
| --- | --- | --- | --- | --- |
| Q1 | Legal: is our clean-room method acceptable? May QA use the MIT `ltiaas` Python SDK as a test-only client? How may we describe the result? | Yes, and yes (test only, not shipped). Use only the narrow claim of ADR-003. Do not use "LTIAAS" in product names. Check the LTI® mark and plan 1EdTech membership. | Any external claim about LTIAAS compatibility | Legal |
| Q5 | Do we test on a real MoodleCloud site (registration, Activate, launch container, grades, web services, `.mbz` size limit)? | Yes, one test on a MoodleCloud trial site. A human must make the account, because the agents may not sign up. | The claim "works on MoodleCloud" | Product owner |
| Q3 | Privacy: do we share the learner name and email with Cogniate? (DataCamp shares both.) | No, by default. Moodle sends only an anonymous LTI user id. Add an opt-in per connection later, with a data processing agreement. | Learner names in the portal | Product and Legal (DPO) |
| Q16 | A teacher on Safari may not be able to add Cogniate content ("Select content" runs in a Moodle frame). Learner launches are not affected. Residual risk R4. | For the pilot: teachers use Chrome, Edge or Firefox to add content. Before general release, choose: accept the limit, a special mode after a security review, or ask Moodle HQ for support. | The browser statement for teachers | Product and a security reviewer |
| Q9 | The packages load images from the Cogniate production storage. The HTML export loads Google Fonts. | Ask the exporter to put all assets and fonts into the package. Google Fonts sends learner IP addresses to Google (GDPR risk). | Privacy, offline use | Cogniate engineering and DPO |
| Q17 | In the HTML export, a decorative layer covers the centre of the lesson link on the menu page. Does a person also miss clicks there? | Ask the exporter to give decorative layers `pointer-events: none`. Check the menu page by hand in this review. No change in our product. | Usability of HTML packages | Cogniate engineering |
| Q2 | Does the course open in a new window or inside the Moodle page? | New window (current setting). A course inside the Moodle page fails in browsers that block third-party cookies. DataCamp also uses a new window. | Admin guide text | Product |
| Q4 | Which grade does Moodle show: the best result or the latest? What does a completion-only course give? | The best result. Never lower a grade. A completion-only course gives 100/100. | The grade rule (ADR-010) | Product |
| Q12 | Do we offer the native channel (`.mbz` backup and course shell, task T8) in the pilot? T8 is built as a stretch. Its QA is pending. | Keep LTI as the main path. Offer the native backup only to a customer who needs editable courses on MoodleCloud. | Pilot scope | Product owner |

## B. Hand-over checks (this week)

| Id | Question | Our recommendation | It blocks | Who decides |
| --- | --- | --- | --- | --- |
| HR-2 | Can a person who did not build the stack start it with the guides in 10 minutes? | One team member follows [`../guides/run-the-stack.md`](../guides/run-the-stack.md) on a Mac with the images pulled, and reports each unclear step. QA times the commands separately. | AC-T9-01, the human run test | Product team (one member) |
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
| R4 | Teacher "Select content" can fail in Safari. | Moodle 5.2 has no LTI client-side storage. Chrome, Edge and Firefox work. | Same as Q16. |
| R5 | All libraries share one content site, so course code of two libraries shares browser storage. | Prototype only. The content site has no cookies, and the proxy drops `Cookie`. | Same as Q10: one content subdomain per customer. |
