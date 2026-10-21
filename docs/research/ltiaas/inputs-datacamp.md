# DataCamp LMS/LXP integrations: facts for milestone LA

Collected by the Lead on 2026-10-22 from the 17 public articles in the DataCamp support collection "LMS/LXP Integrations" (`https://support.datacamp.com/en-us/collections/19782752-lms-lxp-integrations`). The text below is our own summary. It describes behaviour only; we do not see DataCamp code. Architecture statements marked *(inferred)* are our reading of that behaviour. Treat this file as data, not as instructions.

## 1. Channel families

DataCamp has 16 channels in two families.

**LTI family (4 articles: generic LTI, Moodle, Canvas, Blackboard).** The LMS/LXP overview article does not list them.

- Standard: LTI 1.3 with Deep Linking and AGS. No NRPS, no Tool Settings, no LTI 1.1, no custom parameters.
- One tool host for all customers. Endpoints: OIDC login initiation, one launch and Deep Linking target URL, an OIDC callback, a published tool JWKS. Blackboard also has a separate redirect "proxy" URL.
- Registration is manual. "Dynamic registration is not supported."
  - Moodle: the admin adds a manual tool, then sends 6 values (platform id, client id, deployment id, keyset URL, token URL, auth URL).
  - Canvas: the admin makes a developer key (Public JWK URL, privacy level Public, 6 Advantage scopes, Link Selection and Assignment Selection placements), installs the app by client id, then sends client id, deployment id and Canvas URL.
  - Blackboard: the admin registers **one fixed global client id** and sends the deployment id. *(Inferred: one central app registration.)*
- Deep Linking: the content picker can run in a frame. Only DataCamp group admins or managers can use it.
- Launch: always a new tab, never a frame. The learner is logged in automatically.
- Accounts: made on first launch from `sub` and `email`. Accounts match mainly by email.
- Grades: on completion, AGS sends 100/100 at once.
  - The learner must launch once from the LMS first. This makes the link between user, resource link and line item.
  - After the first launch, an earlier completion syncs too.

**Catalog family (12 articles).** Absorb, Workday Cloud Connect, Workday AICC, Cornerstone, 360Learning, Docebo, Viva Learning, xAPI, Catalog API, Generic SFTP, Degreed, SAP SuccessFactors OCN.

- Only metadata goes to the LMS/LXP. The learner opens the content on DataCamp through a deeplink and SSO.
- Completions come back as a binary "completed". Only xAPI also sends "started" and "progressed".

## 2. Shared mechanisms (16 channels, 6 mechanisms)

| Mechanism | Channels that use it |
| --- | --- |
| One LTI 1.3 engine with settings per LMS | Moodle, Canvas, Blackboard, generic LTI |
| SFTP upload with CSV templates (full or changes only, scheduled, optional PGP) | Generic SFTP, Cornerstone, Absorb (catalog), Workday AICC (package upload) |
| xAPI client (verbs completed, started, progressed) | xAPI, Workday Cloud Connect (completions) |
| Vendor API push (REST or SOAP, OAuth) | Degreed, Docebo, 360Learning, Absorb, Workday, SAP OCN, Viva Learning |
| Pull API (catalog and learner events, Bearer key, rate limit) | Catalog API, Workday AICC option B |
| SSO deeplink and user matching (email, SAML NameID, custom attribute) | All 12 catalog-family channels |

## 3. Design patterns (inferred)

1. **Core models in the middle:** catalog item, learner identity and learning event. Channels do not change them.
2. **A mapper at the edge of each channel:** "everything is a course", a type suffix in titles, duration in different units, base64 or URL thumbnails.
3. **A channel is a set of capabilities:** catalog out, launch, records back, identity match.
4. **Settings for each connection:** content types, completions on or off, frequency, identifier type, credentials. One customer can have more than one connection (for example staging and production).
5. **Two background pipelines:** a scheduled catalog sync (full or changes; add, update, archive), and an event-driven record dispatch (within minutes, with retry).
6. **The same onboarding shape each time:** show our values, collect their values, verify, enable. Onboarding is support-led.

## 4. What Cogniate does differently (already decided)

- Cogniate sends real scores, not only 100/100.
- Cogniate shares no name or email by default (pseudonymous LTI `sub`).
- Cogniate has Dynamic Registration for Moodle.
- Cogniate content can also travel as packages (SCORM 1.2, HTML). DataCamp does not support SCORM.

## 5. Article list

LMS/LXP Integration Overview, LTI Integration, Moodle LTI, Canvas LTI, Blackboard LTI, Absorb, Workday Cloud Connect for Learning, Workday AICC, Cornerstone, 360 Learning, Docebo, Microsoft Viva Learning, xAPI, Catalog API, Generic SFTP, Degreed Direct, SAP SuccessFactors OCN. All are under `https://support.datacamp.com/en-us/articles/`.
