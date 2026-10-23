# Blackboard admin guide: connect a Blackboard Learn site

Evidence basis: `31f4d0bb`, 2026-10-23. Product: C6 `4008afb9`. M1 tests: C9 `9eb504f5`. M2 actual tests: C8 `5561e8f7`. T7 actual tests: C10 `97b68af4`.

Runtime evidence is accepted. Architect conformance is APPROVE. Guide revision 911219b0 passed independent QA and both reviews. See the [evidence table](../../README.md#evidence-labels).

This guide connects one Blackboard Learn site to one Cogniate library. Three people take part:

- **Cogniate library user:** makes the connection in the Cogniate portal.
- **Learn admin:** registers the Cogniate tool in Learn.
- **Cogniate operator:** registered Cogniate once in the Blackboard Developer Portal, and issues a one-time approval code ([operator guide](operator.md)).

Tags: each step names its evidence label, for example `[SIM AC-M2-06]`. The [evidence table](../../README.md#evidence-labels) gives the status of each label.

NOTE: Nobody has tested this setup on a real Blackboard site. All Blackboard live checks are `UNVERIFIED` ([M3 live matrix](../architecture/tasks/M3.md#5-live-check-matrix)). Learn menu names come from provider documentation ([research](../research/multi-lms.md#3-blackboard-facts)).

## How Blackboard differs from Canvas

| Topic | Rule | Evidence |
| --- | --- | --- |
| Registration | Cogniate has one Blackboard application for all schools. Its Application ID is the client ID. | `[DOC F-BB-1, F-BB-2]` Not yet tested on a real Blackboard site. |
| Your school | One Learn site is one deployment ID. One Cogniate connection owns it. | `[SIM AC-M1-10, AC-M1-29]` |
| Other schools | A disconnect at your school does not affect other schools. | `[SIM AC-M1-18]` |
| Key access | Learn must reach the Cogniate key URL over public HTTPS (blocker B-3). | `[DOC F-BB-13]` Not yet tested on a real Blackboard site. |

## Procedure 1: Make the connection (Cogniate library user)

1. In the portal, open Integrations → LMS Publishing → Blackboard → Connect `[SIM AC-M2-01]`.
2. Enter the connection name and the Learn URL, for example `https://learn.school.edu` `[SIM AC-M2-06]`.
3. Click "Next" `[SIM AC-M2-06]`.

Result: the connection is `pending`. The portal shows the step "Register Cogniate in Blackboard Learn" [SIM AC-M2-06].

If the card says "Blackboard is not set up for this Cogniate service yet. Ask your Cogniate operator.", then "Connect" is off. The operator must do the one-time setup first [SIM AC-M2-02].

## Procedure 2: Register the tool in Learn (Learn admin)

1. In the portal step 2, copy the "Client ID" `[SIM AC-M2-02]`.
2. In Learn, open the administrator page for LTI tool providers `[DOC F-BB-12; L-B03 UNVERIFIED]`. Not yet tested on a real Blackboard site.
3. Register a new LTI 1.3 tool with the Client ID `[DOC F-BB-12; L-B03 UNVERIFIED]`. Not yet tested on a real Blackboard site.
4. Compare the values that Learn shows with the 9 rows below `[SIM AC-M1-19; L-B03 UNVERIFIED]`. Not yet tested on a real Blackboard site.
5. Set "User Fields to Send" to the role in the course only `[SIM AC-M1-14; L-B11 UNVERIFIED]`. Not yet tested on a real Blackboard site.
6. Turn on the grade service and the membership service `[SIM AC-M1-19; L-B03 UNVERIFIED]`. Not yet tested on a real Blackboard site.
7. Submit the form, then copy the Deployment ID that Learn shows `[DOC F-BB-12; L-B03 UNVERIFIED]`. Not yet tested on a real Blackboard site.

The 9 rows in the portal [SIM AC-M1-19]. `{PUBLIC_LTI_URL}` is the address of the Cogniate LTI service. The portal shows the real value.

| # | Learn label | Value |
| --- | --- | --- |
| 1 | Client ID | The Cogniate Application ID |
| 2 | Login Initiation URL | `{PUBLIC_LTI_URL}/lti/login/cogniate` |
| 3 | Tool Redirect URL(s) | `{PUBLIC_LTI_URL}/lti/launch/cogniate` |
| 4 | Tool JWKS URL | `{PUBLIC_LTI_URL}/lti/keys/cogniate` |
| 5 | Tool Status | `Approved` |
| 6 | User Fields to Send | Role in Course only. Do not send Name or Email Address. |
| 7 | Allow grade service access | `Yes` |
| 8 | Allow Membership Service access | `Yes` |
| 9 | Placement | Cogniate: type Deep Linking, Target Link URI `{PUBLIC_LTI_URL}/lti/launch/cogniate`, student access off |

NOTE: Learn can send names and emails if an admin turns them on. Cogniate removes them before it stores a launch [SIM AC-M1-14].

WARNING: Do not delete the Cogniate tool or its placement in Learn. A delete breaks all Cogniate course links in Learn for good. `[DOC F-BB-15]` Not yet tested on a real Blackboard site. To stop Cogniate, disconnect it in the portal ([Disconnect](#disconnect)).

## Procedure 3: Ask for the approval (Learn admin)

The Deployment ID is not a secret. So Cogniate needs an operator approval before it binds your site [SIM AC-M1-29].

1. Send these values to your Cogniate contact through your school's normal channel `[SIM AC-M1-28]`:
   - the Cogniate library and connection name;
   - the Learn URL;
   - the Deployment ID.
2. Wait for the operator check. The operator sends an approval code to the library user `[SIM AC-M1-28]`.

## Procedure 4: Save the binding (Cogniate library user)

1. In the portal step 3, enter the Deployment ID `[SIM AC-M2-06]`.
2. Enter the approval code `[SIM AC-M2-06]`.
3. Click "Save" `[SIM AC-M2-06]`.

Result: the connection is `registered`. The portal shows the teacher steps for Ultra and Original [SIM AC-M2-06].

If Save fails with "Cogniate could not save the connection", click "Save" again with the same code [SIM AC-M2-06].

A connection keeps the first Deployment ID that Cogniate reserves for it. To use another Deployment ID, disconnect this connection and make a new one [SIM AC-M2-06, AC-M1-29].

## Disconnect

The dialog says: "This switches off Cogniate for this Blackboard site only. Other schools are not affected. Cogniate items in Blackboard courses stop working, and connecting again later does not restore them." [SIM AC-M2-09]

After you confirm, the connection is `disabled`. Learner launches show `DEPLOYMENT_NOT_ACTIVE`. Other schools keep working [SIM AC-M1-18; L-B13 UNVERIFIED]. Not yet tested on a real Blackboard site.

To connect the same site again, make a new connection and get a new approval code. Old keys then fail, and old course items show "This course is not available" [SIM AC-M1-27, AC-M1-38]. Teachers add the courses again (D-7).

## Learner window and roles

| Topic | Status | Evidence |
| --- | --- | --- |
| New window or frame | Depends on the Learn settings (D-10). | `[L-B08 UNVERIFIED]` Not yet tested on a real Blackboard site. |
| Teacher Deep Linking in Safari, or with blocked cross-site cookies | Depends on the browser, its version and its settings. | `[L-B10 UNVERIFIED]` Not yet tested on a real Blackboard site. |
| Teaching assistant, course builder, grader, guest | Not documented. The live check records their raw roles. | `[L-B14 to L-B17 UNVERIFIED]` Not yet tested on a real Blackboard site. |

## What Blackboard connections cannot do

| Limit | Evidence |
| --- | --- |
| No dynamic registration. | `[SIM AC-M1-15]` |
| No web services section and no "empty Moodle course" option. | `[SIM AC-M2-08, AC-M1-21]` |
| No "Add deployment ID". One connection has one Deployment ID. | `[SIM AC-M2-07]` |
| One Blackboard application for each Cogniate LTI service host (D-6). | `[DOC F-BB-10]` Not yet tested on a real Blackboard site. |
| The `.mbz` export is for Moodle only. | `[SIM AC-M2-08]` |

Next: give the teachers the [teacher guide](teacher.md#blackboard-learn).
