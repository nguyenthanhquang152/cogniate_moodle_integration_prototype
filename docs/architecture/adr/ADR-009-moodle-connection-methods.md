# ADR-009: Connect a Moodle site — dynamic registration first, manual fallback

Status: Accepted (round 2). Date: 2026-10-16.

## Context

A Moodle admin registers Cogniate as an LTI 1.3 tool once per site and library. DataCamp uses manual registration (about ten values into Moodle, six values back). Moodle 5.2 supports Dynamic Registration (spike §5b).

Moodle 5.2 facts (`registration_helper.php`, `startltiadvregistration.php`, `openid-registration.php`):

- The registration needs `domain`, and `target_link_uri` must be on that domain. `token_endpoint_auth_method` must be `private_key_jwt`.
- Scopes set the services. `claims` with `name` or `email` set "share name / email" to "Always"; without them "Never".
- The new tool is PENDING, launch container "embed without blocks", course visibility "preconfigured list only".
- If a tool with the same domain exists, Moodle shows a choice page. "Update" overwrites that tool (token `scope = reg-update`, `sub = <type id>`) and also resets its launch container and course visibility.

## Options

| | Dynamic only | Manual only | Both, dynamic first |
| --- | --- | --- | --- |
| Admin effort | 1 URL + Activate + 1 edit | About 16 fields, two directions | Choice |
| Error risk | Low | High (copy errors) | Low by default |
| Works where dynamic registration is off | No | Yes | Yes |

## Decision

Both. Dynamic registration is the default in the wizard. Manual is the fallback.

Dynamic registration request (built by the LTI service at `complete`; URLs from `PUBLIC_LTI_URL`):

| Field | Value |
| --- | --- |
| `application_type` | `web` |
| `response_types` | `["id_token"]` |
| `grant_types` | `["implicit", "client_credentials"]` |
| `initiate_login_uri` | `{PUBLIC_LTI_URL}/lti/login/{toolAccountId}` |
| `redirect_uris` | `["{PUBLIC_LTI_URL}/lti/launch/{toolAccountId}"]` |
| `jwks_uri` | `{PUBLIC_LTI_URL}/lti/keys/{toolAccountId}` |
| `token_endpoint_auth_method` | `private_key_jwt` |
| `client_name` | `platformName` (the app sends `Cogniate (<library name>)`, ASCII) |
| `scope` | AGS `lineitem`, `lineitem.readonly`, `result.readonly`, `score`; NRPS `contextmembership.readonly` |
| `lti-tool-configuration.domain` | host of `PUBLIC_LTI_URL` |
| `lti-tool-configuration.target_link_uri` | `{PUBLIC_LTI_URL}/lti/launch/{toolAccountId}` |
| `lti-tool-configuration.claims` | `anonymous`: `["iss", "sub"]`; `name_only`: + `name`, `given_name`, `family_name`; `email_only`: + `email`; `public`: all |
| `lti-tool-configuration.messages` | `[{ "type": "LtiDeepLinkingRequest", "target_link_uri": "{PUBLIC_LTI_URL}/lti/launch/{toolAccountId}", "label": "Cogniate", "placements": ["ContentArea"] }]` |

**Default privacy: `anonymous`** (spec §7.5, §10; Q3).

**"Update existing tool":** the service reports `operation` and `existingPlatformId` (security §2.5). The app **refuses every update** in the prototype: a registration URL exists only for a `pending` connection, so the only updates that can reach it are attempts to overwrite another library's tool. It tells the admin "Go back in Moodle and choose Register as a new external tool", and nothing is sent to Moodle. Re-connect = delete the old tool in Moodle, disconnect, connect again. A platform belongs to one connection only.

Manual values (shown in the portal; URLs from `PUBLIC_LTI_URL`, account `cogniate`). The API returns them with stable keys, in the order of app contract §4.1:

| Moodle field | Value |
| --- | --- |
| Tool name | `Cogniate (<library name>)` |
| Tool URL | `{PUBLIC_LTI_URL}/lti/launch/cogniate` |
| LTI version | LTI 1.3 |
| Public key type | Keyset URL |
| Public keyset | `{PUBLIC_LTI_URL}/lti/keys/cogniate` |
| Initiate login URL | `{PUBLIC_LTI_URL}/lti/login/cogniate` |
| Redirection URI(s) | `{PUBLIC_LTI_URL}/lti/launch/cogniate` |
| Supports Deep Linking (Content-Item Message) | Yes |
| Content Selection URL | `{PUBLIC_LTI_URL}/lti/launch/cogniate` |
| Tool configuration usage | Show in activity chooser and as a preconfigured tool |
| Default launch container | New window |
| IMS LTI Assignment and Grade Services | Use this service for grade sync and column management |
| IMS LTI Names and Role Provisioning | Use this service to retrieve members' information as per privacy settings |
| Share launcher's name with tool | Never |
| Share launcher's email with tool | Never |
| Accept grades from the tool | Delegate to teacher |

The admin sends back: Platform ID (issuer), Client ID, Deployment ID, Public keyset URL, Access token URL, Authentication request URL. The last three must be on the issuer origin.

The wizard steps (both methods) are kept as data in the portal (T6), so that T7 can follow the steps that the admin sees.

## Consequences

- After a dynamic registration (new or update) the admin does: Activate, then edit "Tool configuration usage" and "Default launch container". The status stays `registered` until the first launch.
- Two libraries can connect the same Moodle site. Each gets its own tool and client id. Moodle shows the choice page to every registration after the first one on a site (same domain), so the second admin must choose "Register as a new external tool"; the wizard says so in every case. In our dev stack the seed tool has the same domain, so every dynamic registration sees the choice page.
- MoodleCloud support for dynamic registration on every plan is not verified (Q5).
