# Flows

Status: T0 round 2; Canvas and Blackboard flows 6g and 6h, operator containment 6i, added in M0 (2026-10-20; corrected after the formal M0 reviews). Overview: [`README.md`](README.md). Rules behind each step: [`security.md`](security.md). Paths use the tool account `cogniate`. URLs come from the four `PUBLIC_*_URL` values ([`local-stack.md`](local-stack.md)).

## 6a. Connect a Moodle site

### 6a-1. Dynamic registration (default)

```mermaid
sequenceDiagram
    autonumber
    actor CU as Cogniate user
    participant P as Portal
    participant APP as Cogniate app
    actor MA as Moodle admin
    participant M as Moodle
    participant LTI as LTI service

    CU->>P: Integrations > Moodle > Connect (site URL, name)
    P->>APP: POST /app-api/connections {method: dynamic}
    APP-->>P: connection pending + registrationUrl /lti/register/cogniate?ref={refToken}
    MA->>M: Manage tools > paste URL > Add LTI Advantage
    alt a tool with the LTI service domain exists (always in our stack, in production for a 2nd library or a re-connect)
      M-->>MA: choice page: update a tool, or register as new
      MA->>M: register as new (the app refuses every update)
    end
    M->>LTI: (iframe) GET /lti/register/cogniate?ref=..&openid_configuration=..&registration_token=..
    LTI->>M: GET openid-configuration (guarded client)
    LTI->>LTI: issuer = config URL origin. Read operation (new or update) from the token.
    LTI-->>M: 303 /tool/register?registrationId={id}&ref={refToken}
    M->>APP: (iframe) GET /tool/register
    APP->>LTI: GET /api/registrations/{id} (Bearer)
    alt operation = update
      APP-->>MA: page UPDATE_NOT_ALLOWED: "Go back and choose Register as a new external tool"
    else new
      APP-->>MA: confirm page (site, Moodle version, library, privacy)
      MA->>APP: POST /tool/register (Connect)
      APP->>LTI: POST /api/registrations/{id}/complete
      LTI->>M: POST registration_endpoint (Bearer registration_token)
      M-->>LTI: client_id, deployment_id
      LTI-->>APP: {platformId, html}
      APP-->>M: close page: postMessage org.imsglobal.lti.close
    end
    Note over M: New tool is PENDING, embed, preconfigured only
    MA->>M: Activate. Edit: usage = activity chooser, launch container = New window
```

- The `ref` token binds the Moodle registration to one connection. The confirm page needs no Cogniate cookie (it runs in a cross-site iframe).
- Moodle fixes `launchcontainer=3` (embed) and `coursevisible=1` for a dynamic registration, also for an update. So the admin always does the two edits after it. Until then, launches are embedded and get the embed notice page (6c, step 8).
- The tool name in Moodle is `Cogniate (<library name>)`, ASCII only.
- Moodle shows the choice page whenever a tool with the same domain exists. In our stack the seeded tool "Cogniate (seed)" has that domain, so every dynamic registration sees it. In production, the first library on a site does not see it, but a second library or a re-connect does. The admin chooses "register as new"; the app refuses every update (security §2.5).

### 6a-2. Manual registration (DataCamp model)

```mermaid
sequenceDiagram
    autonumber
    actor CU as Cogniate user
    participant P as Portal
    participant APP as Cogniate app
    actor MA as Moodle admin
    participant M as Moodle
    participant LTI as LTI service

    CU->>P: Connect > Manual
    P->>APP: POST /app-api/connections {method: manual}
    APP-->>P: tool values (ADR-009 table)
    MA->>M: Manage tools > configure a tool manually (paste values)
    M-->>MA: Tool configuration details (6 values)
    CU->>P: paste the 6 values
    P->>APP: PUT /app-api/connections/{id}/platform
    APP->>LTI: POST /api/platforms (Bearer)
    LTI->>LTI: all endpoint URLs on the issuer origin
    LTI-->>APP: platform {id, active: true}
    APP-->>P: connection registered
```

## 6b. Teacher adds a course with Deep Linking

```mermaid
sequenceDiagram
    autonumber
    actor T as Teacher
    participant M as Moodle
    participant LTI as LTI service
    participant APP as Cogniate app

    T->>M: Edit mode, Add content > Activity or resource > Cogniate (Thanh's Library) > Add > Select content
    M->>LTI: (modal iframe) POST /lti/login/cogniate
    LTI-->>M: state cookie (Partitioned), 302 /mod/lti/auth.php
    M->>LTI: POST /lti/launch/cogniate (id_token LtiDeepLinkingRequest, state)
    LTI->>LTI: 12 launch checks, store launch, issue ltik
    LTI-->>APP: 303 /tool/deep-link?ltik=..
    APP->>LTI: GET /api/idtoken
    APP->>APP: handoff single use. Instructor role? platform.id -> connection. Picker session.
    APP-->>T: 303 /tool/picker/{pickerId}: radio list of this connection's publications
    T->>APP: POST /tool/picker/{pickerId} (one publicationId)
    APP->>APP: check again: publication of this connection, not withdrawn
    APP->>LTI: POST /api/deeplinking {one ltiResourceLink + lineItem 100}
    LTI-->>APP: {message: signed JWT, target: deep_link_return_url}
    APP-->>M: auto-submit form to contentitem_return.php (form-action = that origin)
    M->>LTI: GET /lti/keys/cogniate (verify JWT)
    M-->>T: activity form filled. Teacher sets completion "Receive a grade", saves.
```

Content item (the app sends exactly this; the LTI service adds no field):

```json
{
  "type": "ltiResourceLink",
  "title": "Build Your First Website with AI: The Zero-to-Hero Micro-Sprint",
  "url": "https://lti.cogniate.test/lti/launch/cogniate?resource=pub_8Jk2",
  "lineItem": { "scoreMaximum": 100, "label": "Build Your First Website with AI", "resourceId": "pub_8Jk2", "tag": "cogniate-score" }
}
```

- The picker is always single select. If Moodle gets more than one item, it hides the activity form, and the teacher cannot set completion (Moodle `contentitem.js`).
- Moodle 4.3+ ignores the `window` and `iframe` hints. The launch container comes from the tool settings.

## 6c. Learner launch → SCORM 1.2 → AGS

```mermaid
sequenceDiagram
    autonumber
    actor L as Learner
    participant M as Moodle
    participant LTI as LTI service
    participant APP as Cogniate app
    participant RT as Runtime (content origin)
    participant SCO as Package page
    participant WK as Score sync worker

    L->>M: open activity (New window)
    M->>LTI: POST /lti/login/cogniate
    LTI-->>M: state cookie, 302 auth.php
    M->>LTI: POST /lti/launch/cogniate (id_token LtiResourceLinkRequest)
    LTI-->>APP: 303 /tool/launch?resource=pub_..&ltik=..
    APP->>LTI: GET /api/idtoken
    APP->>APP: handoff single use. Publication from the SIGNED launch.target (URL param ignored).<br/>Resource link by (connection, deployment, context, resource link).<br/>Attempt: continue an in-progress attempt of the same course, else new attempt on the current version.
    alt presentation.documentTarget is iframe
      APP-->>L: 303 /play/{playId}/embedded: "Open in a new window" button
    else window or frame
      APP-->>L: 303 /play/{playId}
    end
    L->>APP: GET /play/{playId}: shell + runtime iframe
    RT->>APP: GET /rt/{runtimeToken}/state
    RT->>SCO: load /pkg/{packageId}/index.html
    SCO->>RT: LMSInitialize, LMSGetValue, LMSSetValue ...
    SCO->>RT: LMSCommit, LMSFinish
    RT->>APP: POST /rt/{runtimeToken}/commit {seq, cmi}
    APP->>APP: validate, apply the LMSFinish rule, derive outcome
    APP->>WK: final and better than every pending or sent row? new score sync
    WK->>LTI: POST /api/lineitems/{id}/scores (SERVICE-AUTH-V1)
    LTI->>M: POST token.php (client assertion, iat = now - 30 s), cached in memory
    LTI->>M: POST {lineitem}/scores (timestamp, FullyGraded)
    M-->>LTI: 200
    LTI-->>WK: 204
```

What the Cogniate SCORM package does (vendored `scorm-api.js`, read in full):

| Step | cmi element | When |
| --- | --- | --- |
| Probe | reads `cmi.core.lesson_status` before `LMSInitialize` | Every page. Expects error `301` if no session is open. |
| Start | `cmi.core.lesson_status = incomplete` | First visit, if empty, `not attempted` or `unknown` |
| Location | `cmi.core.lesson_location = <pageKey>` | Every page and when a page is seen |
| Progress | `cmi.suspend_data = v:2;q:f5f1e28b;p:index,...;a:1` (max 4000 chars) | When a page is seen or a question is answered |
| Answer | `cmi.interactions.0.*` | First answer per question. Later answers are ignored. |
| Score | `cmi.core.score.raw = round(correct/total*100)`, `min=0`, `max=100` | On every answer and at completion |
| Time | `cmi.core.session_time = HHHH:MM:SS.SS` | On load, on commit, on unload |
| Exit | `cmi.core.exit = suspend` or `""` | On unload |
| End | `cmi.core.lesson_status = passed / failed` (mastery 70), then `LMSFinish` | All pages seen and all questions answered. Also at once on a later load of a finished course. |

A page is seen after 10 s of visible time and a scroll to the end. The menu page (`index`) is seen on visit. The course has 2 pages and 1 question: correct answer = `passed` 100, wrong answer = `failed` 0.

## 6d. Learner launch → HTML course → AGS

The HTML export has no SCORM API and no completion event. Its only native signal is `localStorage.lessonProgress` (scroll percent). That signal has no quiz result and is browser-local, so we do not use it. The HTML runtime applies the same rule as the SCORM package from the outside (ADR-004).

```mermaid
sequenceDiagram
    autonumber
    participant RT as HTML runtime (content origin)
    participant PG as Package page (same origin)
    participant APP as Content host
    RT->>APP: GET /rt/{runtimeToken}/state (profile of the attempt's version, saved progress, lastSeq)
    RT->>PG: load /pkg/{packageId}/index.html
    loop each page (attach when the document is parsed, not on load)
      RT->>PG: attach listeners to contentDocument
      RT->>RT: seen = 10 s visible + scroll to end. Menu page = seen on visit.
      RT->>RT: answer = first [data-cog-correct] value per question
      RT->>APP: POST /rt/{runtimeToken}/commit {seq, progress}
    end
    APP->>APP: complete = all pages seen and all questions answered.<br/>score = correct/total*100. passed if score >= 70.
    APP->>APP: new score sync if better (as 6c)
```

## 6e. Publish to Moodle

"Publish" makes a course version visible in the content picker of one connection. It does not copy anything into Moodle.

```mermaid
sequenceDiagram
    autonumber
    actor CU as Cogniate user
    participant P as Portal
    participant APP as Cogniate app
    CU->>P: Course > Publish to Moodle
    P->>APP: GET /app-api/connections (registered or connected)
    CU->>P: pick connection and version
    P->>APP: POST /app-api/publications {connectionId, courseId, versionId}
    APP->>APP: upsert (one per connection + course). status = available.
    APP-->>P: publication + stats
    P-->>CU: "Available in Moodle. Teachers: Add content > Activity or resource > Cogniate (Thanh's Library) > Add > Select content."
```

The portal shows "Selected in Moodle" when `stats.activities > 0` (a pick counts even if the teacher then cancels the activity form; Moodle does not tell us) and "In use" when `stats.learners > 0`. "Withdraw" hides the course from the picker. Existing activities then show "This course is no longer available". An empty Moodle course through web services (course shell) is stretch (T8).

## 6f. Native channel (stretch, T8)

```mermaid
flowchart LR
    V[Course version<br/>SCORM 1.2 zip] --> D[Portal: Download SCORM package<br/>T6]
    V --> BR[Build Runner<br/>throwaway Moodle 5.2, internal network]
    BR --> BK[backup.php --nousers]
    BK --> MBZ[.mbz]
    MBZ --> RS[Admin restores in the Moodle UI]
    D --> MA[Teacher adds a SCORM package activity]
    RS --> NS[Native mod_scorm, Moodle grades it]
    MA --> NS
```

## 6g. Canvas (M1, ADR-011)

### 6g-1. Connect (developer key, operator approval)

```mermaid
sequenceDiagram
    autonumber
    actor CU as Cogniate user
    actor CA as Canvas admin
    actor OP as Cogniate operator
    participant P as Portal
    participant APP as Cogniate app
    participant LTI as LTI service
    participant CV as Canvas (school site)
    CU->>P: Integrations → Canvas → Connect
    P->>APP: POST /app-api/connections {lms: canvas, profile: canvas-cloud-production, siteUrl, serviceUrl, method: manual}
    APP->>APP: site rules 1-4 for both URLs (no fetch)
    APP-->>P: 201 pending
    P->>APP: GET …/canvas-configuration, GET …/tool-configuration
    CU->>CA: JSON file + Redirect URIs value
    CA->>CV: Developer Keys → + LTI Key → Paste JSON → Save → On
    CA->>CV: Settings → Apps → + App → By Client ID → Install → read deployment id
    CA->>OP: approval request: library, site, client id, deployment id (out of band)
    OP->>APP: app:grant issue --connection --site --service-url --client-id --deployment-id --note
    APP-->>OP: approval code (once)
    OP->>CU: approval code
    CU->>P: client id, deployment id, approval code
    P->>APP: PUT …/platform {clientId, deploymentId, grantCode}
    APP->>APP: phase 1 (one transaction): grant valid, same library + connection, same values, no live attempt, take the connection lease, save the target, record ref c
    APP->>LTI: POST /api/platforms {profile, clientId, name, siteUrl, serviceUrl, deploymentIds, active: false, bindingRef: c}
    Note over LTI: issuer, auth, JWKS from the profile, token = {serviceUrl}/login/oauth2/token
    LTI-->>APP: 201 platform (inactive)
    APP->>APP: record ref a
    APP->>LTI: PATCH /api/platforms/{id} {active: true, bindingRef: a, ifBindingRef: c}
    LTI-->>APP: 200 active
    APP->>APP: phase 2: grant redeemed, approval (platform, deployment) committed, connection registered
    APP-->>P: 200 registered
```

### 6g-2. Teacher selects content (assignment_selection)

```mermaid
sequenceDiagram
    autonumber
    actor T as Teacher
    participant CV as Canvas (school site)
    participant SSO as sso.canvaslms.com
    participant LTI as LTI service
    participant APP as Cogniate app
    T->>CV: Assignments → + Assignment → Submission Type External Tool → Find → Cogniate
    CV->>LTI: (modal iframe) GET /lti/login/cogniate iss=canvas.instructure.com, client_id, lti_deployment_id
    LTI->>LTI: platform by (iss, client_id), deployment known and active
    LTI-->>CV: 302 to SSO auth endpoint + partitioned state cookie
    CV->>SSO: authorize_redirect
    SSO-->>LTI: form POST id_token (LtiDeepLinkingRequest)
    LTI->>LTI: checks 1-12, JWKS from SSO, check 13 (AGS and NRPS on the service origin, return URL on the site origin), claim allowlist
    LTI-->>APP: 303 /tool/deep-link?ltik
    APP->>APP: site check, role check (context staff or admin)
    APP-->>T: picker (frame-ancestors = school site)
    T->>APP: select course
    APP->>LTI: POST /api/deeplinking (one ltiResourceLink, lineItem 100, window if accepted)
    LTI-->>APP: JWT + target on school site
    APP-->>CV: auto-submit JWT to deep_link_return_url
    CV-->>T: assignment with 100 points, set to open in a new tab (window hint), teacher checks the tab setting and selects Save & Publish
```

### 6g-3. Learner launch and grade

Same as 6c and 6d after the launch. Differences: Canvas always sends `documentTarget = iframe`, so the launch goes to `/play/{playId}/embedded`; for a Canvas connection that page continues to the player at once when it is top-level (new tab), and shows "Open in a new window" inside a frame. The LTI service gets the access token from `{serviceUrl}/login/oauth2/token` and sends the score to the AGS URL on the service origin.

### 6g-4. Add a second deployment

The Canvas admin installs the same key in a sub-account and gets a second deployment id. A launch from it fails with `UNKNOWN_DEPLOYMENT`. The operator issues a grant with `--purpose add_deployment`; the user enters the deployment id and the approval code (`POST …/deployments`); the app redeems the grant: it creates the deployment inactive on the connection's platform, activates it with a conditional call, and commits an approval for it. Until that approval commits, a launch from the new deployment gets `UNKNOWN_PLATFORM` (`deployment_not_approved`), and the first deployment keeps working.

## 6h. Blackboard (M1, ADR-011)

### 6h-1. Operator setup (once per LTI service host)

```mermaid
sequenceDiagram
    autonumber
    actor OP as Cogniate operator
    participant DP as Blackboard Developer Portal
    participant LTI as LTI service
    OP->>DP: register application: domain = host of PUBLIC_LTI_URL, login URL, one redirect URL, JWKS URL, RS256
    OP->>DP: placement "Cogniate", type Deep Linking, Target Link URI {PUBLIC_LTI_URL}/lti/launch/cogniate, student access off
    DP-->>OP: Application ID (= client id)
    OP->>LTI: npm run lti:shared-platform -- --profile blackboard --client-id <Application ID>
    LTI-->>OP: shared platform id
```

### 6h-2. Connect one school (operator approval)

```mermaid
sequenceDiagram
    autonumber
    actor CU as Cogniate user
    actor BA as Learn admin
    actor OP as Cogniate operator
    participant P as Portal
    participant APP as Cogniate app
    participant LTI as LTI service
    participant L as Learn (school site)
    CU->>P: Integrations → Blackboard → Connect (Learn URL)
    P->>APP: POST /app-api/connections {lms: blackboard, siteUrl, method: manual}
    APP-->>P: 201 pending (409 PROVIDER_NOT_READY if no shared platform)
    P->>APP: GET …/tool-configuration (Application ID and values to check)
    CU->>BA: Application ID
    BA->>L: Admin → LTI Tool Providers → register LTI 1.3 tool → Client ID → Submit → Submit → read Deployment ID
    BA->>OP: approval request: library, Learn URL, deployment id (out of band)
    OP->>APP: app:grant issue --connection --site --client-id <Application ID> --deployment-id --note
    APP-->>OP: approval code (once)
    OP->>CU: approval code
    CU->>P: deployment id + approval code
    P->>APP: PUT …/platform {deploymentId, grantCode}
    APP->>APP: phase 1: check grant, take the connection lease, reserve (shared platform, deployment), record ref c
    APP->>LTI: POST /api/platforms/{shared}/deployments {deploymentId, siteUrl, active: false, bindingRef: c} (existing row: read it, adoption rule)
    LTI-->>APP: 201 inactive, generation 0
    APP->>APP: record ref a
    APP->>LTI: PATCH …/deployments/{id} {active: true, siteUrl, bindingRef: a, ifBindingRef: c}
    LTI-->>APP: 200 active, generation + 1
    APP->>APP: phase 2: grant redeemed, approval committed, connection registered
    APP-->>P: 200 registered
```

### 6h-3. Teacher Deep Linking and learner launch

```mermaid
sequenceDiagram
    autonumber
    actor U as Teacher or learner
    participant L as Learn (school site)
    participant GW as developer.blackboard.com
    participant LTI as LTI service
    participant APP as Cogniate app
    U->>L: Ultra: Content Market → Cogniate (teacher) / open the course item (learner)
    L->>LTI: GET /lti/login/cogniate iss=https://blackboard.com, client_id, lti_deployment_id
    LTI->>LTI: shared platform, deployment known and active
    LTI-->>U: 302 to the gateway OIDC endpoint + state cookie
    U->>GW: oidcauth
    GW-->>L: (Blackboard internal)
    L-->>LTI: form POST id_token
    LTI->>LTI: checks 1-12, check 9 (= login deployment), check 13 (URLs on the deployment site), claim allowlist
    LTI-->>APP: 303 with ltik
    APP->>APP: routing by approval (platform, deployment), site check
    Note over APP,LTI: Deep Linking: picker → JWT with sub = client id → Learn return URL. Grades: token from the gateway, score to the AGS URL on the deployment site only.
```

## 6i. Operator containment and recovery (M1, ADR-011 §4b)

```mermaid
sequenceDiagram
    autonumber
    actor OP as Cogniate operator
    participant APP as Cogniate app
    participant LTI as LTI service
    actor RU as Rightful library user
    Note over OP: evidence: a binding is wrong (wrong library, wrong site or service URL, or a standard platform for a self-hosted Canvas)
    OP->>APP: app:binding suspend --connection K --note <evidence>
    APP->>APP: K disabled, unredeemed grants revoked, records = K's binding + K's attempt targets
    APP->>LTI: read each record (Canvas without platform id: GET /api/platforms?url=&clientId=)
    APP->>LTI: owned records only: PATCH active false, new ref, ifBindingRef = read ref (also when already off)
    LTI-->>APP: 200 (404 = absent, foreign or newer ref = left unchanged)
    OP->>APP: app:binding release --connection K --note <evidence>
    APP->>APP: refuse while K's lease is live or an owned record is active
    APP->>LTI: Canvas: DELETE platform ?ifBindingRef = read ref (keys and launches removed)
    APP->>APP: delete only K's reservation (Blackboard, deployment stays inactive) and K's approvals
    Note over APP: K keeps its publications, attempts, grants, ref history and score history
    OP->>APP: app:grant issue for the rightful connection R (normal check)
    RU->>APP: PUT …/platform with the approval code
    APP->>LTI: new Canvas platform, or Blackboard deployment active again (generation + 1)
    Note over LTI: old keys and ltiks fail with 401
```
