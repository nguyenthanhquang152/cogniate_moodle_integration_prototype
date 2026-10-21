# Canvas admin guide: connect a Canvas site

Source: commit `e2d58e9` (candidate C = `d3296dd`), 2026-10-22. Status: **draft**. Final runtime checks are pending.

This guide connects one Canvas site to one Cogniate library. Three people take part:

- **Cogniate library user:** makes the connection in the Cogniate portal.
- **Canvas admin:** makes the developer key and installs the app in Canvas.
- **Cogniate operator:** checks the request and issues a one-time approval code ([operator guide](operator.md)).

Tags: each step names its evidence label, for example `[SIM AC-M2-05]`. The [evidence table](../../README.md#evidence-labels) gives the status of each label.

NOTE: Nobody has tested this setup on a real Canvas site. All Canvas live checks are `UNVERIFIED` ([M3 live matrix](../architecture/tasks/M3.md#5-live-check-matrix)). Canvas menu names come from provider documentation ([research](../research/multi-lms.md#4-canvas-facts)).

## Before you start

| Item | Rule | Evidence |
| --- | --- | --- |
| Canvas type | Choose one: Instructure-hosted production, beta or test, or self-hosted. | `[SIM AC-M2-03]` |
| Environments | Beta and test have their own issuer. Make one connection and one approval for each environment. | `[DOC F-CV-1]` Not yet tested on a real Canvas site. |
| Canvas URL | The address that teachers use (the page host), for example `https://canvas.school.edu`. | `[SIM AC-M2-03, AC-M1-32]` |
| Canvas service URL | The Canvas account domain, for example `https://school.instructure.com`. Leave it empty if it is the same as the Canvas URL. | `[SIM AC-M2-03, AC-M1-32]` |
| One key per library | Each Cogniate library needs its own Canvas developer key. | `[SIM AC-M2-05]` |

NOTE: Canvas can put its pages and its grade services on two hosts. Cogniate checks each launch against both URLs. A wrong service URL stops graded launches with `SERVICE_ORIGIN_MISMATCH` [SIM AC-M1-12, AC-M1-32]. The operator can correct it without a new developer key ([operator guide](operator.md#3-contain-and-correct-a-binding)).

NOTE: The service host comes from Canvas code reading and one inference ([F-CV-18](../research/multi-lms.md#4-canvas-facts)). Live row L-C11 checks it. Not yet tested on a real Canvas site.

## Procedure 1: Make the connection (Cogniate library user)

1. In the portal, open Integrations → LMS Publishing → Canvas → Connect `[SIM AC-M2-01]`.
2. Enter the connection name and the Canvas URL `[SIM AC-M2-03]`.
3. Enter the Canvas service URL, or leave it empty `[SIM AC-M2-03]`.
4. Select the Canvas type `[SIM AC-M2-03]`.
5. Click "Next" `[SIM AC-M2-03]`.

Result: the connection is `pending`. The portal stores both URLs in canonical form, for example `https://canvas.school.edu` [SIM AC-M2-03, AC-M1-05].

If the portal marks a URL, read the text next to the field. See [troubleshooting](troubleshooting.md#canvas-and-blackboard) for `INVALID_SITE_URL`.

## Procedure 2: Make the developer key (Canvas admin)

Only the "Paste JSON" method is supported. Do not type the values by hand.

1. In the portal step "Make a developer key in Canvas", click "Copy JSON" or "Download JSON" `[SIM AC-M2-04]`.
2. Do not edit the JSON `[SIM AC-M1-19]`.
3. In Canvas, open Developer Keys and add an LTI key `[DOC F-CV-7; L-C01 UNVERIFIED]`. Not yet tested on a real Canvas site.
4. Select the method "Paste JSON" and paste the JSON `[DOC F-CV-7; L-C01 UNVERIFIED]`. Not yet tested on a real Canvas site.
5. Copy the portal value "Redirect URIs" into the Canvas field of the same name `[SIM AC-M2-04; L-C01 UNVERIFIED]`. Not yet tested on a real Canvas site.
6. Save the key and turn it on `[DOC F-CV-14; L-C01 UNVERIFIED]`. Not yet tested on a real Canvas site.
7. Copy the client ID of the new key `[DOC F-CV-14; L-C01 UNVERIFIED]`. Not yet tested on a real Canvas site.

The JSON asks for anonymous users, has no custom fields and has one placement, `assignment_selection` [SIM AC-M1-19]. Cogniate keeps only an allowlist of launch claims, with no names or emails [SIM AC-M1-14].

If "Copy JSON" cannot use the clipboard, the portal shows the JSON in a text box. Select and copy it there [SIM AC-M2-04].

### Option: inline public key

Use this only when Canvas cannot reach the Cogniate key URL, for example a local test stack.

1. Select "Put a copy of the current public key in the JSON" `[SIM AC-M2-04]`.
2. Write down the key id that the portal shows `[SIM AC-M2-04, AC-M1-19]`.
3. Copy or download the JSON again `[SIM AC-M2-04]`.

CAUTION: Canvas does not refresh an inline key. After a Cogniate signing key change, Deep Linking and grade return stop for this installation until you paste a new JSON. See [Procedure 6](#procedure-6-after-a-cogniate-key-change-inline-key-only).

## Procedure 3: Install the app and read the deployment ID (Canvas admin)

1. In Canvas, open the account or sub-account settings, then Apps `[DOC F-CV-14; L-C02 UNVERIFIED]`. Not yet tested on a real Canvas site.
2. Add an app by client ID, then enter the client ID from Procedure 2 `[DOC F-CV-14; L-C02 UNVERIFIED]`. Not yet tested on a real Canvas site.
3. Install the app `[DOC F-CV-14; L-C02 UNVERIFIED]`. Not yet tested on a real Canvas site.
4. Open the app configuration and copy its deployment ID `[DOC F-CV-14; L-C02 UNVERIFIED]`. Not yet tested on a real Canvas site.

## Procedure 4: Ask for the approval (Canvas admin)

The client ID and the deployment ID are not secrets. So Cogniate needs an operator approval for each new binding [SIM AC-M1-29].

1. Send these values to your Cogniate contact through your school's normal channel `[SIM AC-M1-28]`:
   - the Cogniate library and connection name;
   - the Canvas URL and the Canvas service URL;
   - the client ID and the deployment ID.
2. Wait for the operator check. The operator sends an approval code to the library user `[SIM AC-M1-28]`.

NOTE: The evidence that the operator needs is a human decision (Q22, [decisions](../human_review/decisions-needed.md#e-canvas-and-blackboard-decisions)).

## Procedure 5: Save the binding (Cogniate library user)

1. In the portal step "Client ID", enter the client ID `[SIM AC-M2-05]`.
2. Enter the deployment ID `[SIM AC-M2-05]`.
3. Enter the approval code `[SIM AC-M2-05]`.
4. Click "Save" `[SIM AC-M2-05]`.

Result: the connection is `registered`. The portal shows the teacher steps [SIM AC-M2-05]. The code works once and expires after 24 hours by default [SIM AC-M1-28, AC-M1-29].

The portal clears the approval code after every Save. It does not keep the code in the URL or in browser storage [SIM AC-M2-05].

If Save fails, the connection stays `pending`. See [troubleshooting](troubleshooting.md#canvas-and-blackboard) for the error text [SIM AC-M2-05].

### Add a second deployment ID

An install in a second account or sub-account makes a second deployment ID. Its launches fail with `UNKNOWN_DEPLOYMENT` until you add it [SIM AC-M1-20].

1. Ask the operator for an approval code for the new deployment ID `[SIM AC-M1-20]`.
2. Open the connection detail in the portal `[SIM AC-M2-07]`.
3. Enter the deployment ID and the approval code `[SIM AC-M2-07]`.
4. Click "Add deployment ID" `[SIM AC-M2-07]`.

Result: the detail lists both deployment IDs. The first deployment keeps working [SIM AC-M2-07, AC-M1-20].

## Self-hosted Canvas

| Rule | Evidence |
| --- | --- |
| Select the Canvas type "Self-hosted Canvas". | `[SIM AC-M2-03]` |
| The Canvas issuer must be the site host. The Canvas default is the hosted issuer, so the Canvas admin must change it. | `[DOC F-CV-2]` Not yet tested on a real Canvas site. |
| Enter the site host as the Canvas URL. A separate service URL is allowed. | `[SIM AC-M1-26]` |
| A host that ends with `instructure.com` or `canvaslms.com` is refused. Select a hosted type for these. | `[SIM AC-M2-03]` |

NOTE: The local Canvas check L-C13 (`CANVAS-LOCAL`) is deferred and `UNVERIFIED`. A self-hosted result never proves hosted Canvas.

NOTE: A released self-hosted Canvas binding has a known setup race (D-12). See the [operator guide](operator.md#3a-accepted-limit-d-12-self-hosted-canvas-after-a-release).

## Procedure 6: After a Cogniate key change (inline key only)

The operator tells you when the Cogniate signing key changes ([operator guide](operator.md#5-signing-key-rotation-and-inline-canvas-keys)). A JSON with the key URL needs no change.

1. Get a new JSON with the inline key from a signed-in portal session: `GET /app-api/connections/<connection id>/canvas-configuration?jwk=inline` `[SIM M1-19.canvas.inline-key]`.
2. Check that the response header `X-Cogniate-Key-Id` shows the new key id `[SIM M1-19.canvas.inline-key; rotation: L-C14 UNVERIFIED]`. Not yet tested on a real Canvas site.
3. In Canvas, paste the new JSON into the same developer key `[DOC F-CV-8; L-C14 UNVERIFIED]`. Not yet tested on a real Canvas site.

NOTE: QA case `M1-19.canvas.inline-key` used this request on a registered connection: it returned the active key, with that key id in the header. No QA case changed the signing key first. So the full rotation procedure is not verified (live row L-C14).

NOTE: The portal shows "Copy JSON" only while the connection is `pending`. For a registered connection, use the request in step 1.

NOTE: A token that Canvas already issued can still work until it expires. Live row L-C14 records this. Not yet tested on a real Canvas site.

## Disconnect

The Canvas disconnect dialog names Canvas [SIM AC-M2-09]. After you confirm, the connection is `disabled` and its Canvas platform is switched off. Its unused approval codes stop working. A pending grade row ends as `failed` with `CONNECTION_DISABLED` at its due time [SIM AC-M1-18].

Connecting again does not restore old Cogniate items (D-7). A new connection needs a new developer key and a new approval, or an operator release first [SIM AC-M1-38].

## What Canvas connections cannot do

| Limit | Evidence |
| --- | --- |
| No dynamic registration (D-1). | `[SIM AC-M1-15]` |
| No web services section and no "empty Moodle course" option. | `[SIM AC-M2-08, AC-M1-21]` |
| No module items (`link_selection`); graded assignments only (D-11). | `[SIM AC-M1-19]` |
| One page origin and one service origin per connection (D-2). A third page host fails for Deep Linking. | `[SIM AC-M1-40]` |
| Inherited (global) developer keys for many schools are refused with `PLATFORM_IN_USE` (D-5). | `[SIM AC-M2-05]` |
| The `.mbz` export is for Moodle only. | `[SIM AC-M2-08]` |

Next: give the teachers the [teacher guide](teacher.md#canvas).
