# Flows

Status: T0 round 2. Overview: [`README.md`](README.md). Rules behind each step: [`security.md`](security.md). Paths use the tool account `cogniate`. URLs come from the four `PUBLIC_*_URL` values ([`local-stack.md`](local-stack.md)).

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
      MA->>M: register as new (or update only for a re-connect of the same library)
    end
    M->>LTI: (iframe) GET /lti/register/cogniate?ref=..&openid_configuration=..&registration_token=..
    LTI->>M: GET openid-configuration (guarded client)
    LTI->>LTI: issuer = config URL origin. Read operation (new or update) from the token.
    LTI-->>M: 303 /tool/register?registrationId={id}&ref={refToken}
    M->>APP: (iframe) GET /tool/register
    APP->>LTI: GET /api/registrations/{id} (Bearer)
    alt operation = update and existingPlatformId is not this connection's platform
      APP-->>MA: page UPDATE_NOT_ALLOWED: "Go back and choose Register as a new tool"
    else new, or update of this connection's own platform
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
- Moodle shows the choice page whenever a tool with the same domain exists. In our stack the seeded tool "Cogniate (seed)" has that domain, so every dynamic registration sees it. In production, the first library on a site does not see it, but a second library or a re-connect does. The admin chooses "register as new" ("update" only to re-connect the same library; any other update is refused, security §2.5).

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

    T->>M: Add an activity > Cogniate (Thanh's Library) > Select content
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
    P-->>CU: "Available in Moodle. Teachers: Add an activity > Cogniate (Thanh's Library) > Select content."
```

The portal shows "Linked" when `stats.activities > 0` and "In use" when `stats.learners > 0`. "Withdraw" hides the course from the picker. Existing activities then show "This course is no longer available". An empty Moodle course through web services (course shell) is stretch (T8).

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
