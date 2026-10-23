# Admin guide: connect a D2L Brightspace site (channel `brightspace`)

Source: wave-end SHA `02f5d420` (product code) on `quang/ltiaas-milestone`, 2026-10-24. Status: **draft for review**. QA check pending (AC-LA-E8-03-01).

This guide connects one D2L Brightspace site to one Cogniate library. In the portal, this channel is the card **D2L Brightspace**. Its texts call the LMS "Brightspace".

Three people take part:

- **Cogniate library user:** makes the connection in the Cogniate portal.
- **Brightspace administrator:** registers the Cogniate tool in Brightspace and makes a deployment.
- **Cogniate operator:** checks the request and issues a one-time approval code ([operator runbook §10](operator-runbook.md#10-approval-grants)).

Evidence labels: see [operator runbook §0.1](operator-runbook.md#01-evidence-labels). For example, `[SIM E2-05-06]` means that QA ran AC-LA-E2-05-06 on a simulator stack; its file is `docs/reviews/LA-E2-05/qa.md`.

NOTE: Nobody tested this channel on a real Brightspace site. QA used a D2L simulator: issuer `https://brightspace.sim.test`, token host `auth.brightspace.sim.test`, an audience that is not the token URL, and UUID deployment IDs ([channel README](../../../packages/channels/brightspace/README.md#live-status)). Brightspace menu names and field labels come from vendor and third-party sources.

## D2L facts and their status

The status comes from the [channel README](../../../packages/channels/brightspace/README.md#facts-and-sources): **confirmed** = from a vendor source; **design** = a Cogniate decision; **UNVERIFIED** = not yet seen on a real Brightspace site.

| Fact | Value | Status |
| --- | --- | --- |
| Admin path | Manage Extensibility › LTI Advantage › Register Tool. "Standard" is manual; "Dynamic" is Dynamic Registration. Then a deployment, then links. | confirmed in shape |
| Issuer | the site URL (`https://<school>.brightspace.com` or a custom domain). Copy it from the Brightspace registration page. | confirmed in shape |
| Authentication endpoint default | `{siteUrl}/d2l/lti/authenticate` | from D2L and third-party sources; the value on the Brightspace page wins |
| Keyset URL default | `{siteUrl}/d2l/.well-known/jwks` | from D2L and third-party sources; the value on the Brightspace page wins |
| Token URL default | `https://auth.brightspace.com/core/connect/token` (a host other than the issuer) | from D2L and third-party sources; the value on the Brightspace page wins |
| Token audience default | `https://api.brightspace.com/auth/token` (not the token URL) | from D2L and third-party sources; the value on the Brightspace page wins |
| Deployments | many per registration; deployment IDs are UUIDs | confirmed |
| Product family `desire2learn` | new Dynamic Registrations of a D2L site must use this card | **UNVERIFIED**; the first real launch confirms it |
| Dynamic Registration token format | used only as a Bearer token | **UNVERIFIED** |
| Tool configuration labels | the labels of the Brightspace "Register Tool" form, in its order | **UNVERIFIED** until a live check |
| Platform storage frame | none: Cogniate has no Brightspace frame name | **UNVERIFIED** |
| Launch | Brightspace opens a link in a frame by default; "Open as External Resource" is set per link | from D2L behaviour (README) |
| Grades | final scores only; a user that cannot get a grade gives `422`, and Cogniate marks the row `rejected` | third-party source |
| Scopes | the four AGS scopes; no roster (NRPS) scope | design |

## Choose the method

| Method | Portal name | Brightspace choice | Approval code | Evidence |
| --- | --- | --- | --- | --- |
| Manual | Manual | Register Tool, **Standard** | yes: the code binds every Brightspace value | `[SIM E2-05-04]`, `[K2 E7-07-03]` |
| Dynamic Registration | Automatic | Register Tool, **Dynamic** | yes: a real Brightspace registration is always staged, because its token host is not the issuer host | `[SIM E2-06-02]`, `[SIM E2-06-03]` |

## Before you start

| Item | Rule | Evidence |
| --- | --- | --- |
| Brightspace URL | the address of the site, as an `https` origin, for example `https://school.brightspace.com` | `[SIM E2-05-04]` |
| Existing LTI 1.3 connection of this site | it keeps working. Use this card for new connections. | `[SIM E2-05-05]` |
| Moodle card | Do not connect Brightspace with the Moodle card. A Brightspace launch on a Moodle connection is refused with `PROVIDER_PROFILE_MISMATCH`. | `[SIM E2-05-05]` |

## Procedure 1: Make the connection (Cogniate library user)

1. In the portal, open **Integrations**, then the card **D2L Brightspace**. Click **Connect** [K2 E7-07-01].
2. In **Your site**, enter the connection name.
3. Select the connection method: **Manual** or **Automatic**.
4. Enter the **Brightspace URL**.
5. Click **Continue** [K2 E7-07-02].

Result: the connection is `pending`. The card **Tool settings** shows the steps for the Brightspace administrator and the tool values [K2 E7-07-02].

## Procedure 2A: Manual method (Brightspace administrator)

1. You need a Brightspace administrator for this procedure.
2. In Brightspace, open **Manage Extensibility**, then **LTI Advantage**, and select **Register Tool** (confirmed in shape).
3. Choose **Standard**.
4. Enter the tool values from the portal card **Tool settings**, in this order. Each row has a **Copy** button [K2 E7-07-02].

   | Order | Key | Portal label | Value |
   | --- | --- | --- | --- |
   | 1 | `tool_name` | Name | `Cogniate (<library name>)` |
   | 2 | `domain` | Domain | the host of `{PUBLIC_LTI_URL}` (with its port, if the URL has one) |
   | 3 | `redirect_urls` | Redirect URLs | `{PUBLIC_LTI_URL}/lti/launch/cogniate` |
   | 4 | `openid_connect_login_url` | OpenID Connect Login URL | `{PUBLIC_LTI_URL}/lti/login/cogniate` |
   | 5 | `target_link_uri` | Target Link URI | `{PUBLIC_LTI_URL}/lti/launch/cogniate` |
   | 6 | `keyset_url` | Keyset URL | `{PUBLIC_LTI_URL}/lti/keys/cogniate` |
   | 7 | `extensions` | Extensions | `Assignment and Grade Services, Deep Linking` |
   | 8 | `roles` | Roles | `Send institution role` |
   | 9 | `privacy` | Privacy | `Do not send name or e-mail.` |

   Evidence: `[SIM E2-05-06]`, `[K2 E7-07-02]`. The labels follow the Brightspace "Register Tool" form; they are **UNVERIFIED** until a live check.

5. Save the tool.
6. From the registration page, copy the Client ID, the Brightspace keyset URL, the OpenID Connect authentication endpoint, the Brightspace OAuth2 access token URL and the OAuth2 audience. The exact Brightspace field names are **UNVERIFIED**.
7. Make a deployment of the tool for your org units. Copy its **Deployment ID** (a UUID; confirmed).
8. Do [Procedure 3](#procedure-3-ask-for-the-approval-code-brightspace-administrator).

Notes:

- `{PUBLIC_LTI_URL}` is the public address of the Cogniate LTI service. The portal shows the full values.
- `<library name>` is the name of your Cogniate library, with ASCII characters only (`packages/channel-kernel/src/setup.ts`).

## Procedure 2B: Automatic method (Brightspace administrator)

1. In the portal, on the connection page, copy the **Registration URL** [K2 E7-07-02]. If there is no URL, or it expired, click **Get registration URL**.
2. In Brightspace, open **Manage Extensibility**, then **LTI Advantage**, and select **Register Tool** (confirmed in shape).
3. Choose **Dynamic** and paste the registration URL (confirmed in shape).
4. The Cogniate page "Connect this Brightspace site to Cogniate" opens. Check the site and the library. Click **Connect**.
5. The result page shows "Waiting for approval" and "Done. Cogniate checks this connection before it works. Ask your Cogniate operator for the approval code." [SIM E2-06-02]
6. Make a deployment of the tool for your org units. Copy its **Deployment ID**.
7. Do [Procedure 3](#procedure-3-ask-for-the-approval-code-brightspace-administrator).

The Brightspace token host is not the issuer host. So Cogniate stages every real Brightspace registration: it does not work before the approval. A learner launch gets `PLATFORM_NOT_ACTIVE` [SIM E2-06-02].

The Brightspace registration token format is **UNVERIFIED**. QA proved only the Cogniate side of the flow on the simulator.

## Procedure 3: Ask for the approval code (Brightspace administrator)

1. Send the request to your Cogniate operator through the channel that your institution agreed with Cogniate.
2. Give these values:

   | Method | Values to give |
   | --- | --- |
   | Manual | the Brightspace URL, the issuer, the Client ID, the Deployment ID, the OpenID Connect authentication endpoint, the OAuth2 access token URL, the keyset URL and the OAuth2 audience |
   | Automatic | the Brightspace URL, the Client ID and the Deployment ID |

3. Answer the operator's check. The token URL is on a host other than the issuer host (for example `auth.brightspace.com`). So the operator asks you to confirm that D2L issued this Client ID for this issuer at that token host [SIM E2-05-04], [SIM E2-06-03].
4. Give the approval code to the Cogniate library user through a private channel.

The code works once and expires (24 hours by default). This is the M1 grant rule (`[SIM AC-M1-28]` in the [M1 operator guide](../operator.md#22-issue-the-code)).

## Procedure 4: Save the connection (Cogniate library user)

1. Open the connection page in the portal.
2. In **Platform values**, check or enter the values from the Brightspace administrator.

   | Method | Fields |
   | --- | --- |
   | Manual | **Issuer**, **Client ID**, **Deployment ID**, **OpenID Connect authentication endpoint**, **Brightspace OAuth2 access token URL**, **Brightspace keyset URL**, **OAuth2 audience** (optional) |
   | Automatic | **Client ID**, **Deployment ID** |

3. For Manual, the portal fills five fields with these defaults [K2 E7-07-02], [K2 E7-07-03]. Replace a default when the Brightspace registration page shows another value. The value on the Brightspace page always wins.

   | Field | Pre-filled value |
   | --- | --- |
   | Issuer | `{siteUrl}` (your Brightspace URL) |
   | OpenID Connect authentication endpoint | `{siteUrl}/d2l/lti/authenticate` |
   | Brightspace OAuth2 access token URL | `https://auth.brightspace.com/core/connect/token` |
   | Brightspace keyset URL | `{siteUrl}/d2l/.well-known/jwks` |
   | OAuth2 audience | `https://api.brightspace.com/auth/token` |

   The four D2L values are defaults from D2L and third-party sources (see [D2L facts](#d2l-facts-and-their-status)). The approval binds the values that you save, not the defaults.
4. In **Verify connection**, enter the **Approval code**.
5. Click **Save**.

Result: the connection is `registered` [SIM E2-05-04], [SIM E2-06-03]. The first valid launch sets it to `connected`.

If a value differs from the approval, the portal shows "The values do not match the approval." and names the field (`GRANT_MISMATCH`) [K2 E7-07-03]. Check the value with the Brightspace administrator.

## After the connection

| Task | Who | Steps | Evidence |
| --- | --- | --- | --- |
| Add Cogniate content to a course | teacher | In Brightspace, add a link to the Cogniate tool in a course, then select the Cogniate course. | `[SIM E2-05-04]`, `[K2 E7-07-03]` |
| Grades | — | Cogniate sends the final score of each learner to Brightspace. | `[SIM E2-05-04]`, `[K2 E7-07-03]` |
| Watch grades | library user | The connection page shows failed grade sends and a warning when a grade waits more than 1 hour. | `[SIM E6-02-05]`, `[UNIT E6-02-08]` |
| Open in a new window | Brightspace administrator or teacher | If a browser blocks the Cogniate sign-in in the Brightspace frame, set the link to "Open as External Resource". | **UNVERIFIED** (no Brightspace frame name; README) |

The Brightspace card has no **Check connection** panel in LA [SIM E6-01-05].

## Messages and what to do

| Message or code | Where | Meaning | Do this | Evidence |
| --- | --- | --- | --- | --- |
| `INVALID_SITE_URL` | portal, Procedure 1 | the Brightspace URL is not a public `https` origin | Use the address of the site. | design (pending verification for this channel) |
| "The values do not match the approval." (`GRANT_MISMATCH`) | portal, Procedure 4 | a value differs from the approval | Check the named field. | `[K2 E7-07-03]` |
| "This LMS tool registration is already connected to Cogniate. Make a new tool registration for this library, or ask your Cogniate operator." (`PLATFORM_IN_USE`) | portal, Procedure 4 | another Cogniate connection uses this Client ID | Register a new tool in Brightspace for this library, or ask the operator. | `[UNIT E2-04]` (round 4) |
| "The staged registration of this connection is gone from the LTI service. Make a new connection, or ask your Cogniate operator." (`PLATFORM_IN_USE`) | portal, Procedure 4 | the staged registration does not exist any more | Make a new connection and register again. | `[UNIT E2-04]` (rounds 3, 4) |
| `PLATFORM_NOT_ACTIVE` | launch | the connection waits for the approval | Finish Procedures 3 and 4. | `[SIM E2-06-02]` |

## What is not verified

- No real Brightspace site took part. All results above are simulator or unit results.
- Every fact marked **UNVERIFIED** in [D2L facts](#d2l-facts-and-their-status): the product family, the registration token format, the field labels, the frame name.
- The exact Brightspace menu and field names. The D2L documentation gives them.
