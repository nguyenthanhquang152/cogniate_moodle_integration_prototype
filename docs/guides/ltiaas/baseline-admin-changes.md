# LA changes for Moodle, Canvas and Blackboard admins

Source: wave-end SHA `02f5d420` (product code) on `quang/ltiaas-milestone`, 2026-10-24. Status: **draft for review**.

The M1 admin guides stay the base for the three baseline channels: [Moodle](../moodle-admin.md), [Canvas](../canvas-admin.md), [Blackboard](../blackboard-admin.md). Milestone LA changed only a few things that an admin sees. This file lists each change that has an intended-change id (`LA-IC-nn`, [LA-ADR-04 D8](../../architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md#d8-intended-behaviour-changes-ids-la-ic-nn)) and that QA verified, with its evidence link. Section 5 lists new panels that change no M1 step.

Evidence labels: see [operator runbook §0.1](operator-runbook.md#01-evidence-labels). For example, `[SIM E3-15-04]` means that QA ran AC-LA-E3-15-04 on a simulator stack.

NOTE: Every Canvas and Blackboard result is a simulator result. The Moodle results below are simulator results too; their local Moodle checks (`MOODLE-LIVE`) are pending.

## 0. Guide per channel

| Channel | Portal card | Guide | LA changes |
| --- | --- | --- | --- |
| Moodle | Moodle | [Moodle admin guide](../moodle-admin.md) | [§1](#1-moodle) |
| Canvas | Canvas | [Canvas admin guide](../canvas-admin.md) | [§2](#2-canvas), with the new Dynamic Registration procedure |
| Blackboard Learn | Blackboard | [Blackboard admin guide](../blackboard-admin.md) | [§3](#3-blackboard) |
| Another LTI 1.3 LMS | LTI 1.3 | [LTI 1.3 admin guide](lti-generic-admin.md) | new in LA |
| D2L Brightspace | D2L Brightspace | [D2L Brightspace admin guide](brightspace-admin.md) | new in LA |
| — (Cogniate operator) | — | [M1 operator guide](../operator.md), [LA operator runbook](operator-runbook.md) | — |

## 1. Moodle

| Id | Change | What you see or do | Evidence | Status |
| --- | --- | --- | --- | --- |
| LA-IC-03 | Moodle in a subfolder | Dynamic Registration accepts a Moodle site in a subfolder, for example `https://school.edu/moodle`. The configuration URL must be the Moodle address plus `/mod/lti/openid-configuration.php`. Another path on the site is refused. A Moodle at the host root works as before. | `[SIM E2-02-07]` ([qa](../../reviews/LA-E2-02/qa.md)) | simulator only; the local Moodle check (AC-LA-E2-02-08) is pending |
| LA-IC-04 | No roster scope | Manual method, tool row 13 (key `nrps`, "IMS LTI Names and Role Provisioning"): set it to **Do not use this service**. Dynamic Registration asks for the four grade (AGS) scopes and no roster (NRPS) scope. | `[SIM E3-07-03]` ([qa](../../reviews/LA-E3-07/qa.md)) | simulator only; the local Moodle part of AC-LA-E3-07-03 is pending |
| LA-IC-20 | Error text in the portal | If a Moodle form gets `DEPLOYMENT_IN_USE`, the portal shows the generic text "This LMS site is already connected to Cogniate." The other Moodle error texts do not change. | `[UNIT E1-12-01]` ([qa](../../reviews/LA-E1-12/qa.md)) | verified (unit) |

Rule for an LMS that is not Moodle (no `LA-IC` id; LA-ADR-02 D1):

- Use the Moodle card for Moodle only. Connect another LMS with its own card, or with the card **LTI 1.3** ([LTI 1.3 guide](lti-generic-admin.md)).
- A D2L Brightspace launch on a Moodle connection is refused with `PROVIDER_PROFILE_MISMATCH` before Cogniate stores any data [SIM E2-05-05] ([qa](../../reviews/LA-E2-05/qa.md)).
- If a library connected a non-Moodle LMS with the Moodle card, move it to the matching card before that LMS gets its own card.

## 2. Canvas

| Id | Change | What you see or do | Evidence | Status |
| --- | --- | --- | --- | --- |
| LA-IC-14 | Canvas Dynamic Registration | A new connection method: **Dynamic Registration**. It still needs an approval code. See [§2.1](#21-procedure-connect-canvas-with-dynamic-registration). | `[SIM E3-15-03]`, `[SIM E3-15-04]` ([qa](../../reviews/LA-E3-15/qa.md)); `[SIM E3-09-01]` to `[SIM E3-09-05]` ([qa](../../reviews/LA-E3-09/qa.md)); `[UNIT E3-16-01]` to `[SIM E3-16-04]` ([qa](../../reviews/LA-E3-16/qa.md)) | simulator only |
| LA-IC-04 | No roster scope | The developer key JSON (key URL and inline key) lists the four AGS scopes and no roster (NRPS) scope. Paste the JSON as before; do not edit it. | `[SIM E3-07-02]` ([qa](../../reviews/LA-E3-07/qa.md)) | simulator only |
| LA-IC-06 | Launch in a frame without the Cogniate cookie | When the browser blocks the Cogniate cookie in the Canvas frame (for example Safari), Cogniate uses Canvas platform storage. The learner still gets the activity. If that also fails, the page says: "Your browser blocked the Cogniate sign-in in this frame. Open the activity in a new window, or allow cookies for this site." | `[SIM E3-02-02]` ([qa](../../reviews/LA-E3-02/qa.md)); `[K2 E7-07-04]`, `[K2 E7-07-05]` ([qa](../../reviews/LA-E7-07/qa.md), round 3) | simulator only |
| LA-IC-15 | Grade conflict text | A results row with a grade conflict says "… (Canvas has a grade with a newer time)". Before LA, it said "Moodle" for every LMS. | `[SIM E4-03-02]` ([qa](../../reviews/LA-E4-03/qa.md)) | simulator only |

### 2.1 Procedure: connect Canvas with Dynamic Registration

Limit: in LA, use this method only when the Canvas configuration URL is on the school's own Canvas host (for example a self-hosted Canvas). A configuration URL on an Instructure host (`canvas.instructure.com`, `sso.canvaslms.com`) is refused (`ISSUER_RESERVED` or `PLATFORM_URL_NOT_IN_PROFILE`), and nothing is stored [SIM E3-09-05]. For a Canvas that Instructure hosts, use the developer key method of the [Canvas guide](../canvas-admin.md). The hosted case waits for a live Canvas check.

The portal still offers Dynamic Registration for every Canvas type. A later portal change (BD-A2-106) adds this help to the method: "Copy one registration URL into Canvas. Cogniate gets the Client ID and the Deployment ID. For Instructure-hosted Canvas, use Developer key. Cogniate does not support this method there yet." That text is not in the wave-end build: pending verification.

Three people take part, as in the Canvas guide: the Cogniate library user, the Canvas administrator and the Cogniate operator.

Step A. Make the connection (Cogniate library user):

1. In the portal, open **Integrations**, then the card **Canvas**. Click **Connect** [K2 E7-07-01].
2. Enter the values of [Canvas guide procedure 1](../canvas-admin.md#procedure-1-make-the-connection-cogniate-library-user). Its labels are M1 evidence.
3. In **Connection method**, select **Dynamic Registration**. The default is **Developer key** [UNIT E3-16-01].
4. Finish the create step [SIM E3-16-04].

Result: the connection is `pending`, with authority `operatorGrant`. The portal shows the registration URL at once [SIM E3-15-03], [UNIT E3-16-02].

Step B. Register Cogniate in Canvas (Canvas administrator). The portal shows these steps under "Register Cogniate in Canvas" [UNIT E3-16-02]. Steps 2 and 3 happen in Canvas; QA did them with the Canvas simulator [SIM E3-09-01], [SIM E3-16-04]:

1. Copy the registration URL. If there is no URL, or the URL expired, select **Get registration URL**.
2. In Canvas, open **Admin**, select your account, then open **Developer Keys**.
3. Select **+ Developer Key**, then **+ LTI Registration**. Paste the registration URL and complete the steps in Canvas.
4. Come back to this page. When Canvas sends the registration, the next step shows the Client ID and the Deployment ID.

The Canvas menu names come from provider documentation. Not yet tested on a real Canvas site.

While Canvas has not sent the registration, the portal says: "Finish the registration in Canvas. Then this page shows the values to check." [UNIT E3-16-03]

What Cogniate checks:

- The registration must use the Canvas issuer and the Canvas endpoints of the selected Canvas type. Another value gives a refusal page, and nothing is stored [SIM E3-09-04].
- The registration request has the four AGS scopes and the Canvas privacy level `anonymous` [SIM E3-09-02].
- Cogniate stages the platform: it does not work before the approval. A learner launch gets `PLATFORM_NOT_ACTIVE` [SIM E3-09-03], [SIM E3-15-03].

Step C. Ask for the approval code (Canvas administrator):

1. Send the request to your Cogniate operator, as in [Canvas guide procedure 4](../canvas-admin.md#procedure-4-ask-for-the-approval-canvas-admin).
2. Give the Cogniate library and connection name, the Canvas URL, the Client ID and the Deployment ID. Ask the library user for the library and connection name.
3. The operator issues a normal Canvas grant. The operator does not use `--accept-staged`; the CLI refuses it for Canvas [SIM E3-15-04].
4. Give the approval code to the library user through a private channel.

Step D. Save the connection (Cogniate library user):

1. Open the connection page. The portal says: "Canvas sent the registration. The registration URL is not necessary now. In the next step, check the Client ID and the Deployment ID. Then enter the approval code from your Cogniate operator and select Save." [UNIT E3-16-03]
2. Check the **Client ID** and the **Deployment ID**. The portal fills them from the registration. You can change them [UNIT E3-16-03].
3. Enter the **Approval code** [SIM E3-16-04].
4. Select **Save** [SIM E3-16-04].

Result: the connection is `registered`, and the platform works. A learner launch and a score pass [SIM E3-15-04], [SIM E3-16-04], [SIM E3-09-03].

## 3. Blackboard

| Id | Change | What you see or do | Evidence | Status |
| --- | --- | --- | --- | --- |
| LA-IC-15 | Grade conflict text | A results row with a grade conflict says "… (Blackboard has a grade with a newer time)". Before LA, it said "Moodle" for every LMS. | `[SIM E4-03-02]` ([qa](../../reviews/LA-E4-03/qa.md)) | simulator only |

The Blackboard setup steps do not change.

## 4. All three channels

| Id | Change | What you see or do | Evidence | Status |
| --- | --- | --- | --- | --- |
| LA-IC-13 | Extra audience in the launch | If your LMS sends a second `aud` value next to the Client ID, and the value is not on the trusted list of the platform, the launch is refused with `INVALID_ISSUER_OR_AUDIENCE`. Tell your Cogniate operator the exact extra value. The operator checks the cause and the expected value, then adds the value to the trusted list ([runbook §17.1](operator-runbook.md#171-launches-fail-at-check-5-extra-audience)). That stops this refusal when the other launch checks pass. For example, with several `aud` values the LMS must also send `azp` equal to the Client ID (pending verification). | `[SIM E3-12-03]` ([qa](../../reviews/LA-E3-12/qa.md)) | simulator only |

## 5. New panels (no `LA-IC` id; no M1 step changes)

| Panel | Channels | What it does | Evidence |
| --- | --- | --- | --- |
| **Check connection** | Canvas (also LTI 1.3) | On a `registered` or `connected` connection, it tests the Canvas keyset and one token. It does not change the connection. Moodle, Blackboard and D2L Brightspace have no check. | `[SIM E6-01-01]` to `[SIM E6-01-05]` ([qa](../../reviews/LA-E6-01/qa.md)), `[UNIT E6-01-09]` |
| Connection health | all channels | It shows the grade sends of the connection and their last error. It warns when a grade waits more than 1 hour. | `[SIM E6-02-05]` ([qa](../../reviews/LA-E6-02/qa.md)), `[UNIT E6-02-08]` |
| Old inline key warning | Canvas | After a Cogniate signing key change, a Canvas connection with an inline key shows a warning. Do [Canvas guide procedure 6](../canvas-admin.md#procedure-6-after-a-cogniate-key-change-inline-key-only). | `[SIM E6-02-03]`, `[UNIT E6-02-08]` |

## 6. Not listed here

| Id | Change | Why not listed |
| --- | --- | --- |
| LA-IC-07 | Ungraded items; Canvas `link_selection` placement | not built: waits for the human decision LA-H22 |
| LA-IC-08 | Claim policy `allowlist` for Moodle | not built: waits for the human decision LA-H4 |
| LA-IC-18 | The publish window names the LMS; Blackboard logo colour; logo tooltip | unit tests only; the stack checks are pending in the QA file ([qa](../../reviews/LA-E1-11/qa.md)) |
| LA-IC-01, -02, -05, -09 to -12, -16, -17, -19, -21 | API fields, operator, teacher, learner or test changes | no change to an admin step |
