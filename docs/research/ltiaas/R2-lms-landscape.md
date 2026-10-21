# LA-R2: LMS landscape for LTI as a service

Researcher: LA-R2 (Claude Code, Opus 5.5). Date: 2026-10-22. Milestone LA, Orca run `run_06d07dc77faf`. Input to plan v1.

## Summary

1. 14 of the 18 products launch LTI 1.3 tools; 12 of them also have Deep Linking and AGS. **No LTI 1.3 platform:** Google Classroom, Microsoft Teams, SAP SuccessFactors Learning and Workday Learning. **Partial (no Deep Linking):** Docebo and TalentLMS.
2. Every fixed value in our 3 profiles still matches the public docs. Moodle 4.5 to 5.3 keeps `mod/lti/auth.php`, `token.php` and `certs.php`. The Canvas `sso.canvaslms.com` hosts and the Blackboard `developer.blackboard.com` hosts did not change.
3. The context changed. Canvas Free-for-Teacher accounts are gone (2026). Blackboard has a new brand ("Blackboard LMS"). The Original Course View ends on 2026-12-31. The free Learn AMI became a time-limited VMDK. Moodle 5.3 LTS shipped on 2026-10-05.
4. Platforms come in two kinds. A **per-tenant issuer** (Moodle, D2L, Sakai, Open edX, Absorb, self-hosted Canvas) fits a generic profile. A **fixed vendor issuer** (Canvas cloud, Blackboard, Schoology, itslearning) needs a named profile with a reserved issuer.
5. Two hard-coded rules block a generic profile today. Every endpoint must be on the issuer origin. Dynamic Registration also expects a Moodle-style registration token. Both rules are stricter than the 1EdTech specs.
6. The 4 current flags are not enough. A profile also needs the client assertion `aud` value, an endpoint-origin policy, platform storage data, a Deep Linking item limit, a launch target rule and a product-family value from data.
7. **Recommendation for E2:** D2L Brightspace. It is close to #2 in US higher education and growing, and it is LTI Advantage Complete (2026-04-10) with Dynamic Registration. It is close to the generic profile. It has only 2 quirks, and they are the same 2 quirks the generic profile must solve.
8. Test-site access is the main human blocker. Only Moodle, Sakai, Open edX and self-hosted Canvas are free to run. Blackboard has a VMDK image at USD 0.05/hour plus AWS. D2L, Canvas cloud and itslearning need a partner program, and D2L and Instructure publish no price.
9. Absorb and Cornerstone (corporate) launch LTI 1.3 with Deep Linking and AGS. So the LTI channel can cover their launch and grades. LF needs them only for catalog push.
10. Recommendations for the LA plan are in §9. Each one maps to an epic E0–E8 or a backlog milestone LB–LG.

## 1. Method and rules

- I read only public pages: vendor docs, vendor source code on GitHub, 1EdTech pages and third-party integration guides. I did not sign up, log in or send a form. I did not read LTIAAS pages.
- Every claim about the outside world has a source id. §8 maps each id to its URL. All pages were read on 2026-10-22.
- "UNVERIFIED" = I could not confirm it from a public page. "(inferred)" = my own reasoning. "[snippet]" = only a search-result excerpt, not the full page. "[3rd]" = a third-party guide, not the vendor.
- Many Zendesk and community sites refused direct fetches (HTTP 403 or empty bodies). For some of them, the research read the public JSON copy of the same help-centre article.
- The 1EdTech certification directory (1E1) loads by script. Only the certification pages for Canvas, Blackboard, D2L and Schoology were readable. Other certification claims come from vendor pages.

## 2. Landscape tables

Legend for "LTI 1.3 platform": **YES** = launches LTI 1.3 tools with Advantage services. **PARTIAL** = launches LTI 1.3 tools without Deep Linking. **NO** = does not launch LTI 1.3 tools.

### 2.1 Support, registration, identity model and endpoints

| # | LMS | LTI 1.3 platform | Registration | Issuer, client id, deployment id model | Endpoints (auth · token · JWKS) | Main public URL and sources |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Moodle 4.5 LTS, 5.0–5.3 (self-hosted) | **YES.** LTI 1.3 since 3.7. LTI Advantage Complete per the Moodle docs (MD10). | Manual admin form, or Dynamic Registration since 3.10 (the tool waits as "pending" until an admin activates it). Course-level tools too. | Issuer = `wwwroot`. A new client id per tool type. Deployment id = the tool type id, so 1 deployment per client id. **Exclusive.** | `{wwwroot}/mod/lti/auth.php` · `/mod/lti/token.php` · `/mod/lti/certs.php`. Not changed in 5.x. The `core_ltix` move (MDL-79109) is still in progress with no fix version. | https://docs.moodle.org/503/en/Managing_LTI_External_tools · MD1, MD2, MD3, MD4, MD9, MD10 |
| 2 | MoodleCloud | **YES.** It is core Moodle; LTI 1.3 Advantage is listed. | Same as Moodle. No plugins and no "integrations" can be installed. | Same as Moodle (inferred: hosted core). | Same as Moodle on the `*.moodlecloud.com` site. | https://support.moodle.com/support/solutions/articles/80000836687-moodlecloud-lti-support · MC1, MC2 |
| 3 | Canvas, Instructure cloud | **YES.** LTI Advantage Complete, renewed 2026-10-21. | Developer key (manual, JSON, JSON URL), Dynamic Registration (2 admin routes), and inherited Site Admin keys. The LTI Registrations API is BETA. | Issuer = 1 global value per environment (`canvas.instructure.com`, `.beta.`, `.test.`). Client id = the developer key id. Many deployments per key. **Exclusive** per key; inherited keys are shared (our D-5). | `https://sso.canvaslms.com/api/lti/authorize_redirect` · `{account domain}/login/oauth2/token` · `https://sso.canvaslms.com/api/lti/security/jwks`. The old host still works, with no end date. | https://github.com/instructure/canvas-lms/blob/master/doc/api/lti_launch_overview.md · CV1, CV2, CV3, CV4, CV12 |
| 4 | Canvas, self-hosted (open source) | **YES** (same code). | Same as cloud. | Issuer = `lti_iss` in `config/security.yml`. The default is `https://canvas.instructure.com`, so the operator must change it. The auth host follows the issuer host. **Exclusive.** | `{issuer host}/api/lti/authorize_redirect` · `{site}/login/oauth2/token` · `{issuer host}/api/lti/security/jwks` | https://github.com/instructure/canvas-lms/blob/master/config/security.yml.example · CV1, CV8, CV15 |
| 5 | Blackboard Learn ("Blackboard LMS"), Ultra and Original | **YES.** LTI Advantage Complete (v4000), 2026-04-10. | The vendor registers 1 application in the Developer Portal. Each school admin enters the Application ID and Learn makes a deployment id. Dynamic Registration through the portal is reported [snippet] (UNVERIFIED). | Issuer = `https://blackboard.com`. 1 Application ID (client id) for every school. 1 deployment per school. **Shared.** Exception: register per school when each school has its own login URL. | `https://developer.blackboard.com/api/v1/gateway/oidcauth` · `/api/v1/gateway/oauth2/jwttoken` · `/api/v1/management/applications/{client id}/jwks.json` | https://docs.blackboard.com/docs/blackboard/lti/1.3/register-an-application · BB1, BB2, BB3, BB14 |
| 6 | D2L Brightspace | **YES.** LTI Advantage Complete, 2026-04-10. Advantage since Suite 20.19.10. Dynamic Registration since 20.21.4. Platform Notification (draft) since 20.24.7. Asset Processor (draft) since 20.25.9. | Admin: Manage Extensibility › LTI Advantage › Register Tool, "Standard" (manual) or "Dynamic". Then the admin makes deployments. | Issuer = the site URL (`https://{school}.brightspace.com` or a custom domain). Client id = a GUID per registration. Many deployments per registration, each shared to org units. Deployment id = a UUID. **Exclusive** (inferred: each school registers). | `{site}/d2l/lti/authenticate` · `https://auth.brightspace.com/core/connect/token` · `{site}/d2l/.well-known/jwks`. **The token is on another host.** The token `aud` = `https://api.brightspace.com/auth/token` (a separate "Brightspace Audience" value), not the token URL. | https://docs.valence.desire2learn.com/res/ltiadvantage.html · D1, D2, D3, D5 [3rd], D7 [snippet], D8 |
| 7 | Schoology (PowerSchool) | **YES.** LTI Advantage Complete, 2026-10-15. | The developer makes the app in App Publisher. A public App Center listing needs a review of up to 1 month. A district-only app needs no approval. No Dynamic Registration (inferred). | Issuer = `https://schoology.schoology.com` (fixed). Client id = the app (1 for all districts). Deployment id = `{client id}-{number}` per district install. **Shared.** A district can also make its own app (exclusive). | `https://lti-service.svc.schoology.com/lti-service/authorize-redirect` · `/lti-service/access-token` (JWT assertion only) · `/lti-service/.well-known/jwks` | https://developers.schoology.com/app-platform/lti-apps · SC1, SC2, SC3 [3rd], SC4 |
| 8 | Sakai 23 / 25 | **YES.** LTI Advantage certified in 2019. Current status: UNVERIFIED. | Admin form (Administration Workspace › External Tools), or Dynamic Registration since 21.1. Dynamic Registration can also migrate LTI 1.1 tools. | Issuer = the server URL. Client id per tool record. Deployment id = a site property, the tool record or the server default `1`. **Exclusive** (inferred). | `{server}/imsoidc/lti13/oidc_auth` (1 forum post only) · `{server}/imsblis/lti13/token/{tool id}` · `{server}/imsblis/lti13/keyset` | https://sakai.screenstepslive.com/s/sakai_help/m/114555/l/1629109-how-do-i-set-up-an-lti-advantage-tool-using-dynamic-registration · SK1, SK3, SK4, SK7 |
| 9 | Open edX (Teak, Ulmo, Verawood) | **YES** (xblock-lti-consumer). Teak, Ulmo and Verawood are LTI Advantage Complete per the release notes. | Manual, per component in Studio, or a reusable configuration (openedx-ltistore). Dynamic Registration: none found (UNVERIFIED). | Issuer = `LTI_API_BASE`, else `LMS_ROOT_URL`. Client id = a uuid4 per block or per configuration. Deployment id = always `"1"`. **Exclusive.** | `{lms}/api/lti_consumer/v1/launch/` · `/token/{id}` · `/public_keysets/{id}` (each on the LMS host) | https://github.com/openedx/xblock-lti-consumer · OX1, OX2, OX3, OX4, OX5, OX6 |
| 10 | itslearning | **YES.** It claims LTI Advantage Complete (2022). Directory status: UNVERIFIED. | Partner / App library process through a local office (free for tools that complement itslearning). Admins then add the tool under "Manage apps". Dynamic Registration: UNVERIFIED. | Client id, issuer and endpoints are the "same for all customers". A new deployment id per customer site. **Shared.** | Given at registration. Values UNVERIFIED. | https://developer.itslearning.com/LTI-configuration-information.html · IT1, IT2, IT3, IT6 |
| 11 | Google Classroom | **NO.** Google says add-ons and LTI tools "are not directly compatible". | Classroom add-ons (Workspace Marketplace, Google OAuth, REST API). Not LTI. | — | — | https://developers.google.com/workspace/classroom/add-ons/get-started/addons-lti-comparison · GC1, GC2, GC3 [3rd] |
| 12 | Microsoft Teams / Learning Tools | **NO.** Microsoft documents no LTI launch from Teams. Microsoft 365 LTI is a **tool** inside other LMSs. | Teams app plus Microsoft Graph Education APIs (beta, needs enablement). Not LTI. | — | — | https://learn.microsoft.com/en-us/microsoft-365/lti/index · MS1, MS2, MS3 [3rd] |
| 13 | Docebo | **PARTIAL.** LTI 1.0, 1.1 and 1.3 launch. "Only basic LTI 1.3 content"; no Deep Linking. AGS/NRPS not stated. | Manual: 1 training material per LTI resource in the central repository. | Platform id = the tenant domain. 1 material per domain (inferred: 1 client and 1 deployment per material). **Exclusive.** | Read-only fields in the form. Patterns not published. | https://help.docebo.com/hc/en-us/articles/360020082660 · DO1, DO2 |
| 14 | Absorb LMS | **YES.** "Absorb only supports LTI version 1.3". Core, AGS and Deep Linking. No NRPS. LTI Registration is on by default in every portal since 2026-07-09. | Manual: Client Settings › LTI Registration › Add LTI Tool. The client id comes from the customer success manager. | Issuer = the tenant domain (`https://{x}.myabsorb.com`). Deployment id = any value (GUID recommended). **Exclusive.** | `{tenant}/lti-tool/authenticate` · `{tenant}/lti-tool/token` · `{tenant}/lti-tool/jwks` | https://support.absorblms.com/hc/en-us/articles/34077061848211 · AB1, AB2 |
| 15 | Cornerstone (OnDemand / Learning) | **YES**, set up with the Cornerstone Content Services team. LTI 1.3 with OIDC, AGS and Deep Linking 2.0. NRPS not stated. | Partner-led onboarding. Content comes in by CSV upload or a Deep Linking picker. | Cornerstone gives client id, issuer, endpoints and deployment id. Per tenant: UNVERIFIED. | Not published. | https://csod.dev/guides/connectors/content/lti.html · CS1, CS2, CS3 |
| 16 | SAP SuccessFactors Learning | **NO.** "LTI is not supported", all versions. | — (SAP uses its Open Content Network) | — | — | https://userapps.support.sap.com/sap/support/knowledge/en/2830483 · SF1 |
| 17 | Workday Learning | **NO** LTI found. External Content = a content URL plus a tracking REST API; Cloud Connect for Learning with xAPI. | — | — | — | https://doc.workday.com/admin-guide/en-us/human-capital-management/learning/learning-content/chr1460978659140.html · WD1, WD2 |
| 18 | TalentLMS | **PARTIAL.** LTI 1.3 launch since V6.7 (April 2025). No Deep Linking. AGS and NRPS not documented. | The admin pastes the tool "Registration URL" (inferred: Dynamic Registration). | Not documented. | Not documented. | https://help.talentlms.com/hc/en-us/articles/18600381592476 · TL1, TL2, TL3 |

Note on other corporate products: 360Learning added a tool launch with login URL, redirect URLs and a keyset on 2026-08-31; the LTI version is not stated (OT1). LearnUpon "supports SCORM and xAPI standards only" (OT2): **NO**.

### 2.2 Deep Linking, services, launch, browser storage and claims

| # | LMS | Deep Linking placements | AGS / NRPS and known quirks | Launch | Cookies / platform storage | Claim quirks | Sources |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Moodle | Activity form "Select content" (a required field since 4.3). Many returned items make many activities (since 3.10). Course tools show in the activity chooser (4.3). No editor or assignment placement (MDL-62607 is open). | AGS and NRPS. **A score that is not `FullyGraded` is discarded, but Moodle still answers HTTP 200** (MDL-89973, open). NRPS leaves out custom parameters (MDL-75151). | Embed, Embed without blocks, Existing window, New window (admin and teacher setting). | **No `lti_storage_target`** in `main`. "Cookie shim" MDL-72022 is open since 2021. Moodle reposts its own Lax cookie. | `product_family_code` = `moodle`. `login_hint` = the Moodle user id. `lti_message_hint` = JSON. Name and email follow "Share launcher's name/email". | MD2, MD5, MD6, MD7, MD8, MD9, MD13, MD14 |
| 2 | MoodleCloud | As Moodle. | As Moodle. | As Moodle. | As Moodle. | As Moodle. | MC2 |
| 3 | Canvas cloud | `assignment_selection`, `link_selection`, `editor_button`, `homework_submission`, `migration_selection`. LTI 1.3 only: `course_assignments_menu` and `module_index_menu_modal` accept **1 or many** items; an item with `lineItem` makes an assignment. New: `ActivityAssetProcessor`, `top_navigation`. | AGS with the extension `https://canvas.instructure.com/lti/submission`. Errors: 400 (an older timestamp), 422 (not a student, course concluded, attempt limit), 412 (link not tied to the line item). NRPS for courses and groups, page size 50, adds `canvas_user_id`. | iframe by default. `windowTarget: _blank` only for navigation placements. A `window` hint in a content item opens a new tab (F-CV-11). `document_target` is always `iframe`. | **Platform storage: yes.** `lti_storage_target` in login and launch. Frame name `post_message_forwarding`. The target origin is the OIDC auth host. Not in the mobile apps. | `product_family_code` = `canvas`, `version` = `cloud`. DL `data` is in the query of the return URL (F-CV-21). | CV1, CV2, CV5, CV6, CV7, CV9, CV10, CV11 |
| 4 | Canvas self-hosted | As cloud. | As cloud. | As cloud. | As cloud; the storage origin is the issuer host (inferred from CV8). | `product_family_code` = `canvas` (in code, also self-hosted). | CV7, CV8 |
| 5 | Blackboard | Deep Linking content tool ("Allow student access"; it can import many items). Course content tool: Original content area; Ultra Content Market and course outline ("Allows grading"). LTI 1.3 only: Proctoring, Base navigation, Course navigation, Ultra extension. | AGS and NRPS, each with its own access setting per tool. The user must be enrolled. 1 token works for both services. | iframe by default; a "Launch in new window" checkbox per placement. The sample JWT has no `document_target`. | Platform storage: yes. Frame name `lti_storage_frame`. The 2024 doc says Learn does **not** add `lti_storage_target` to the redirect URL; a tool adds it to its registered redirect URL or uses `lti.capabilities`. Conflicts with F-BB-9. | `product_family_code` = `BlackboardLearn`. Vendor claim `https://blackboard.com/lti/claim/one_time_session_token`. DL response needs `sub` = client id (F-BB-8). | BB4, BB5, BB6, BB7 |
| 6 | D2L Brightspace | Deep Linking Quicklink, Deep Linking Insert Stuff (editor), Content › Add Existing › External Tool Activity. Deep Linking always on since 20.25.11. | AGS: "Auto Create Grade Items", "Include in Final Grade". A score needs a grade item linked to the tool link. A score for a non-gradable user (for example "TestUser") fails (422) [3rd]. NRPS follows the user-information settings; "PreProvisioning" sends unknown users. Rate limits per integration [snippet]. | iframe by default; "Open as External Resource" (`OpenAsExternal`) opens a new window. | Platform storage "since July 2022" [snippet]. The target frame name: UNVERIFIED. D2L recommends a new window for tools without support. | `product_family_code` = `desire2learn` [3rd]. Extension claims `http://www.brightspace.com#username`, `#org_defined_id`. `sub` has a `_NNNN` suffix [3rd]. The "Anonymous" option is gone; always false since 20.26.2. | D3, D6 [3rd], D11 [snippet], D12 |
| 7 | Schoology | Course Materials › Add Materials (links with line item data). Rich text editor (links **without** line item data only). Types: `ltiResourceLink` and HTML link. | AGS 2.0 and NRPS 2.0. NRPS returns at most 100 rows per page. The org sees an alert at install when the app asks for a service. Custom parameter keys must be lower case. | "Launch app in Schoology" on = iframe; off = new window. | **Platform storage: yes** ("LTI OIDC Login with LTI Client Side postMessages"). An older "Cookie Preload URL" workaround also exists. | `product_family_code`: UNVERIFIED. A launch without `deployment_id` was reported once [snippet]. | SC2, SC3 [3rd], SC5 |
| 8 | Sakai | Lessons, assignment types, rich text editor, Common Cartridge, file, site navigation. | "Allow External Tool to return grades", "create grade columns", "Provide Roster". Quirks: UNVERIFIED. | LTI 1.3: UNVERIFIED (LTI 1.1 has `newpage` and `frameheight`). | **Platform storage: yes.** `lti_storage_target` = `_parent`; it supports `put_data` and `get_data`. | `product_family_code` = `sakai`. Role maps are configurable. Name and email follow the `sendname` / `sendemail` flags. | SK3, SK5 |
| 9 | Open edX | Only the course author, in Studio, per component. Types: `ltiResourceLink`, `link`, `html`, `image`. | AGS modes: disabled, declarative (1 line item; default) or programmatic. Without a weight, scores are 0–1. NRPS is a toggle. | Inline, Modal, New Window. Email and username go only with New Window, after an admin allows it. | **No** `lti_storage_target` in the login. | `tool_platform` has only `guid` and `name`: **no `product_family_code`**. | OX5, OX7, OX8 |
| 10 | itslearning | Only `ltiResourceLink`. Apps (course Add page), Plugins (rich text editor; need Deep Linking), Modules (menus; Core only). | AGS progress feeds the student task list; the tool must set a status for every resource. With NRPS, students need a licence before they can launch. | UNVERIFIED. | UNVERIFIED. | Default privacy: Anonymous (id and role). Name and email are optional; a DPA is expected. `product_family_code`: UNVERIFIED. | IT1, IT3, IT5 |
| 11 | Google Classroom | — (add-on attachments) | — (Classroom API grades) | Add-ons open in iframes. | — | — | GC1, GC2 |
| 12 | Microsoft Teams | — | — | — | — | — | MS1, MS2 |
| 13 | Docebo | **None.** | Completion on open, or after "a score from the external tool is received". For LTI 1.3 any score above 0 is accepted with no recalculation. | Inline, theater mode, stand-alone or new window. | Not documented. | **No custom parameters.** A tool must find its content without custom claims. | DO1, DO2 |
| 14 | Absorb | Yes: a Deeplink URI field; content goes into Syllabus › "LTI Learning Objects", 1 item per object. | AGS for grades and completion. Score-to-completion rule: UNVERIFIED. Learners need the same email in Absorb and in the tool. | iframe (inferred). | Not documented. | External id parameter = "Email" for one vendor example. | AB1 |
| 15 | Cornerstone | Yes: the admin opens the tool picker and the items are ingested. A tool can also push a response "without a preceding request". | AGS Score updates completion and the transcript. Mapping: UNVERIFIED. | UNVERIFIED. | UNVERIFIED. | UNVERIFIED. | CS1, CS2 |
| 16 | SAP SuccessFactors | — | — | — | — | — | SF1 |
| 17 | Workday Learning | — | — | — | — | — | WD1 |
| 18 | TalentLMS | **None** ("planned"). A unit needs a manual launch URL plus optional custom properties. | UNVERIFIED. | Pop-up by default, or embedded. | UNVERIFIED. | UNVERIFIED. | TL1 |

### 2.3 Test-site access and market

| # | LMS | How a tool vendor gets a test site (cost if public) | Market relevance | Sources |
| --- | --- | --- | --- | --- |
| 1 | Moodle | Free: open source; a local Docker install (we already use `erseco/alpine-moodle`, `docs/research/inputs.md:96`). Public demo `sandbox.moodledemo.net` resets every hour. | Global. 148,351 registered sites in 237 countries. About 9% of US and Canada higher education by enrollment (end of 2024). The US share is falling (2026). | MD11, MD12, MK1, MK2 |
| 2 | MoodleCloud | 28-day free trial, no card. Starter USD 170/year (50 users) to Standard USD 2,110/year (750 users). LTI per plan: UNVERIFIED. | Small schools and companies (inferred). | MC1, MC2 |
| 3 | Canvas cloud | **Free-for-Teacher is gone.** It ended after the 2026 data breach, with a last export window on 2026-07-27 to 2026-07-29. It never gave admin rights for developer keys. A paid Instructure partnership gives an admin sandbox; no public price. A "Canvas Lite" launch is reported [snippet], UNVERIFIED. | #1 in US higher education and growing (2026). About 30% of North American institutions and about 38% of students (K-12 and higher education, 2023). | CV13, CV14, MK2, MK4 |
| 4 | Canvas self-hosted | Free: Docker development setup (`script/docker_dev_setup.sh`) with `lti_iss` set. | A few large self-hosting schools (inferred). | CV15, CV16 |
| 5 | Blackboard | Community tier: free, with the AMI and API limits. The AMI is now a VMDK from the support portal (a form and EULA, no account); latest `vmdk-4001-0-0-v1`, **expires 2026-12-04**; USD 0.05/hour plus AWS cost. BbDN: USD 3,000/year (1 developer licence, shared SaaS sites). Learn SaaS Starter Site: USD 2,000/year more. The Developer Virtual Machine is deprecated. | #2 in US higher education by institutions, falling; D2L is close to passing it (2026). Anthology filed Chapter 11 in 2025 and now trades as "Blackboard" (March 2026). | BB8, BB9, BB13, MK2 |
| 6 | D2L Brightspace | "Test servers ... through our Partner program". Partners get "full access to a Brightspace Core instance". A "Non-Partner Integrator" tier includes sandbox access. A 30-day free trial exists; LTI admin rights in it: UNVERIFIED. No public price. | #1 in Canadian higher education [snippet]. In US higher education it is close to passing Blackboard for #2 (2026). Also K-12 and corporate (inferred). | D9, D10, D13, MK2 |
| 7 | Schoology | Developer request at `app.schoology.com/apps/developer/request`, then a "test district" install from the App Profile. The free Basic tier is discontinued [snippet]. No public price. | K-12. 22% of US and Canada K-12 implementations, 21% of enrollment (ListEdTech, 2024). | SC2, SC6, MK3 |
| 8 | Sakai | Free: open source. Public nightly server resets every 24 hours (it returned 502 on 2026-10-22). A non-resetting server is available on request. | Very small; "all but nonexistent" in US higher education (2026). | SK6, MK2 |
| 9 | Open edX | Free: Tutor local install (`tutor local launch`, under 10 minutes). | MOOCs, higher education, business, government. 140M+ learners. Share: UNVERIFIED. | OX9, OX10 |
| 10 | itslearning | No public sandbox. Partner process through a local office, usually after a shared customer asks. It suggests saLTIre or the 1EdTech reference implementation first. | K-12 first; higher and vocational education about 12%. Nordics, Netherlands, France, Germany, UK. 4.5M users (2021). Owned by Sanoma. | IT2, IT4, IT7 |
| 11 | Google Classroom | Not applicable (no LTI). Add-ons need a Teaching and Learning or Plus licence. | K-12: 28% of US and Canada implementations (2024). | GC2, MK3 |
| 12 | Microsoft Teams | Not applicable (no LTI). | K-12 and higher education collaboration (inferred). | MS1 |
| 13 | Docebo | 14-day trial [3rd], UNVERIFIED. | Enterprise and extended enterprise (inferred). | DO1 |
| 14 | Absorb | A free trial button on the site; terms UNVERIFIED. | Mid-market and enterprise corporate training (inferred). | AB1 |
| 15 | Cornerstone | No public sandbox. Contact the Content Services team. | Large enterprise L&D (inferred). | CS3 |
| 16 | SAP SuccessFactors | Not applicable (no LTI). | Large enterprise (inferred). | SF1 |
| 17 | Workday Learning | Not applicable (no LTI). | Large enterprise (inferred). | WD1 |
| 18 | TalentLMS | The free plan (5 users, 10 courses) has no confirmed LTI. Core plan USD 119/month. | SMB corporate training (inferred). | TL3 |

## 3. Two platform kinds

The tables show 2 kinds of platform. The kind decides if a generic profile is safe.

| Kind | Issuer | Who makes the client id | LMSs | Profile type |
| --- | --- | --- | --- | --- |
| A. Per-tenant issuer | The site URL of one customer | The customer admin, per registration | Moodle, MoodleCloud, D2L, Sakai, Open edX, Absorb, Docebo, self-hosted Canvas | Generic profile with admin values, or a small named profile |
| B. Fixed vendor issuer | 1 value for every customer of the vendor | The vendor, or the tool vendor in a vendor portal | Canvas cloud, Blackboard, Schoology, itslearning | Named profile with fixed values and a reserved issuer |

Why it matters:

- For kind B, the issuer and the client id do not prove which school sends a launch. ADR-011 reserves these issuers, so a `standard` connect cannot take them (`services/lti-service/src/profiles/index.ts:78-89`, `docs/architecture/adr/ADR-011-multi-lms.md:167`).
- A generic profile must accept only kind A (inferred). Schoology and itslearning are kind B. They need named profiles and reserved issuers. This is the same control as for Blackboard.
- Kind B with 1 shared client id (Blackboard, Schoology, itslearning) uses `sharing: 'shared'` and a site URL on the deployment (`services/lti-service/src/profiles/blackboard.ts:14-20`).

## 4. Our 3 profiles against the public docs

Our profiles: `standard` (Moodle) in `services/lti-service/src/profiles/standard.ts:7-15`, 5 Canvas rows in `services/lti-service/src/profiles/canvas.ts:17-54`, and 2 Blackboard rows in `services/lti-service/src/profiles/blackboard.ts:12-32`. The app side is in `services/cogniate-app/src/providers/{moodle,canvas,blackboard}.ts`.

### 4.1 Facts that still match

| Profile fact (repo evidence) | Public doc today | Status |
| --- | --- | --- |
| `standard`: auth, token and JWKS on the issuer origin; Moodle puts `auth.php`, `token.php`, `certs.php` under `wwwroot` (`services/lti-service/src/lti/platform-rules.ts:23-36`, `docs/architecture/security.md:81`) | The same 3 files are in `public/mod/lti` on `main`. 5.1 moved web files into `/public`, but the URL paths stay the same (inferred). MD3, MD2 | MATCH |
| `standard` Dynamic Registration: Moodle token `scope` = `reg` or `reg-update` (`services/lti-service/src/lti/registration.ts:87-97`) | Moodle Dynamic Registration since 3.10; a new tool waits "pending" until activated. MD9 | MATCH (Moodle only, see §4.3) |
| Check 14 lets `moodle` pass (`services/lti-service/src/lti/checks.ts:240-250`) | Moodle signs `product_family_code` = `moodle`. MD2 | MATCH |
| Score body is `FullyGraded` (`packages/tracking/src/outcome.ts:52`) | Moodle drops a score that is not `FullyGraded` and still answers 200 (MDL-89973). MD6 | MATCH (safe today) |
| Canvas issuers `canvas.instructure.com`, `.beta.`, `.test.` (`services/lti-service/src/profiles/canvas.ts:20,27,34`) | Same. CV1 | MATCH |
| Canvas auth `sso…canvaslms.com/api/lti/authorize_redirect`, JWKS `sso…canvaslms.com/api/lti/security/jwks` (`canvas.ts:21-22,28-29,35-36`) | Same. The old host still works, with no end date. Tools that use platform storage must use the `sso` host. CV1, CV2 | MATCH |
| Canvas token `{serviceUrl}/login/oauth2/token` (`canvas.ts:13`) | `POST /login/oauth2/token` on the account domain. CV3 | MATCH |
| Canvas self-hosted issuer `{siteUrl}` and endpoints on it (`canvas.ts:41-43`) | The issuer is `lti_iss`; the auth host follows the issuer host. CV15, CV8 | MATCH |
| Canvas `productFamily` = `canvas` (`canvas.ts:12`) | `product_family_code` = `canvas` in code. CV7 | MATCH |
| Canvas `minimizeClaims`, `serviceOriginCheck` (`canvas.ts:4-9`) | AGS/NRPS URLs on the account domain, DL return on the browser host (F-CV-18). No newer doc contradicts this. | MATCH (code reading; live check pending) |
| Blackboard issuer `https://blackboard.com` (`blackboard.ts:15`) | Same. BB1, BB5 | MATCH |
| Blackboard auth, token and JWKS on `developer.blackboard.com` (`blackboard.ts:16-18`) | Same paths. BB3 (the auth URL answers 400, so it exists; a sample JWKS URL returns 4 keys) | MATCH |
| `clientAssertionAudArray` (`blackboard.ts:7`) | `aud` = `["…/oauth2/jwttoken"]`; `sub` = Application ID. BB3 | MATCH |
| `deepLinkingResponseSub` (`blackboard.ts:6`) | DL response: `iss` and `sub` = Application ID, `aud` = `https://blackboard.com`, `deployment_id` required, `data` echoed. BB4 | MATCH |
| `sharing: 'shared'`, site URL on the deployment (`blackboard.ts:14,19`) | Register "once"; each Learn site makes its own deployment id. BB1, BB2 | MATCH |
| `productFamily` = `blackboardlearn` (`blackboard.ts:19`) | Sample `BlackboardLearn` (version 3900.93.0). BB5 | MATCH (sample only; live row L-B18) |

### 4.2 What changed

| Item | Repo evidence | What changed | Effect |
| --- | --- | --- | --- |
| Moodle version | Labels "are the Moodle 5.2.4 form labels" (`services/cogniate-app/src/providers/moodle.ts:6,25`); live row on Moodle 5.2.4 (`docs/architecture/adr/ADR-011-multi-lms.md:355`) | 5.3 LTS shipped on 2026-10-05; 5.2 is still supported. 4.5 LTS has security support to 2027-10-04. MD1 | The 16 tool rows are not checked on 5.3 or 4.5: UNVERIFIED. Add a 5.3 LTS regression run. |
| Moodle `core_ltix` | `standard` assumes `/mod/lti/*.php` (`docs/architecture/security.md:81`) | Epic MDL-79109 is still in progress, with no fix version (updated 2026-10-19). MD4 | No change today. Watch it: a move can change the endpoint paths and the admin UI. |
| Canvas Dynamic Registration | Not in this phase, D-1 (`docs/architecture/adr/ADR-011-multi-lms.md:265`) | Dynamic Registration is live through Developer Keys › LTI Registration and through Canvas Apps › "Install a New App". Canvas Apps is root-admin only. A Registration Update Request flow is behind a flag. Extensions: `https://canvas.instructure.com/lti/privacy_level`, `/lti/tool_id`, `/lti/vendor`. The Dynamic Registration `token_endpoint` is on the `sso` host (a code comment; the hosted override is closed source, so UNVERIFIED). CV4, CV8, CV17 | D-1 is now practical. A Canvas Dynamic Registration profile must accept a token endpoint on `sso.canvaslms.com`. This differs from the manual profile (`{serviceUrl}/login/oauth2/token`). |
| Canvas admin path | Tool rows "Key Name", "Redirect URIs", "Method: Paste JSON" (`services/cogniate-app/src/providers/canvas.ts:28-33`) | Developer Keys still exist. The Canvas Apps page (Discover / Manage / Monitor) was rolled out in December 2024 [snippet]. LTI 1.1 installs moved to "Legacy Apps" (May 2025) [snippet]. | Rows still valid (inferred). The guide must show the new Canvas Apps path too. Check it live. |
| Canvas multi-item Deep Linking | Only `assignment_selection` (`docs/architecture/adr/ADR-011-multi-lms.md:263`) | `course_assignments_menu` and `module_index_menu_modal` accept many items. CV6, CV9 | Input to D-11 and multi-item Deep Linking in E3. |
| Canvas score errors | F-CV-19 lists 400 and 422 | Also 422 "course concluded" and 412 "link not tied to the line item". CV10 | Error mapping in the AGS client (E4). |
| Canvas platform storage | D-4 (`docs/architecture/adr/ADR-011-multi-lms.md:429`); cookie only (`services/lti-service/src/lti/login.ts:75`) | Frame `post_message_forwarding`; target origin = OIDC auth host. CV5 | D-4 needs per-profile storage data (§5.2 item 3). |
| Canvas test site | Q19, LA-H3 (`docs/team/ltiaas/plan.md:198`) | Free-for-Teacher is gone. CV13, CV14 | A live Canvas row needs a partner sandbox or a self-hosted Docker Canvas. |
| Blackboard platform storage | F-BB-9: Learn sends `lti_storage_target` at login (`docs/research/multi-lms.md:61`) | The 2024 doc says Learn does **not** add it; the tool puts `&lti_storage_target=lti_storage_frame` in its registered redirect URL, or asks `lti.capabilities`. BB6 | Conflict. A live check must decide it. |
| Blackboard name and course views | Label "Blackboard Learn" (`services/lti-service/src/profiles/blackboard.ts:14`, `services/cogniate-app/src/providers/blackboard.ts:42`); guide steps for Ultra and Original (`docs/guides/blackboard-admin.md:78`) | Product is now "Blackboard LMS" (2026). Original Course View: no teaching after 2026-12-31, read-only from 2027-01-01, converted to Ultra on 2028-01-01. LTI 1.0/1.1: no new registrations from 2027-01-01, off on 2027-09-30. BB11, BB12, BB13 | Labels and guides only. The guides must lead with Ultra. |
| Blackboard developer portal | One application per LTI host (D-6, `docs/architecture/adr/ADR-011-multi-lms.md:431`) | Token-bucket rate limits since June 2024: 429 with `Retry-After`. Default 10,000 REST calls per 24 hours and 6 site registrations per group. BB10 | E4 outbox (plan line 77): honour `Retry-After`. 6 sites per group is a scale limit for the shared platform (ask Blackboard to raise it). |
| Blackboard test site | Q20, LA-H3 | The AWS Marketplace AMI ended in July 2024. The VMDK expires on 2026-12-04. BbDN costs USD 3,000/year. BB8, BB9 | Human decision on cost and timing. |

No fixed URL or flag value in our profiles is wrong today.

### 4.3 Code rules that are stricter than the specs

These rules are correct for Moodle. They block other kind A platforms.

| Rule (repo evidence) | Spec | LMSs that fail it |
| --- | --- | --- |
| `standard`: auth, token and JWKS must be on the issuer origin, else `PLATFORM_URL_NOT_ON_ISSUER_ORIGIN` (`services/lti-service/src/lti/platform-rules.ts:23-36`) | LTI Core and the Security Framework name no host rule (inferred from S-LTI). Dynamic Registration §2.1.1 puts no endpoint on the issuer host. 1E2 | D2L (token on `auth.brightspace.com`). Schoology and Blackboard (but these are kind B). |
| Dynamic Registration: configuration `issuer` must equal the configuration URL origin; every endpoint on that origin (`services/lti-service/src/lti/registration.ts:54-69`) | §3.4: the configuration URL is built from the issuer (same host; a path is allowed). No host rule for the endpoints. 1E2 | D2L (token host, inferred). Canvas (global issuer on a school host, F-CV-15). An issuer with a path. |
| Dynamic Registration: the registration token must be a JWT signed by the platform JWKS, with Moodle `scope` `reg` / `reg-update` (`services/lti-service/src/http/routes/registration.ts:94-106`) | §3.3: `registration_token` is "the registration access token", used as a Bearer token. The format is not defined. It is short-lived and single-use. 1E2 | Any platform whose token is opaque or has no `scope` claim. Canvas, D2L, Sakai, TalentLMS: UNVERIFIED. |
| Check 14 and app family maps know only `canvas` and `blackboardlearn` (`services/lti-service/src/profiles/index.ts:96-107`, `services/cogniate-app/src/providers/index.ts:35-39`) | `product_family_code` is optional; values are vendor text. | Every new named LMS (`desire2learn`, `sakai`) needs a code change. Open edX sends no value. |
| DL response: `iss` = client id, `aud` = issuer; `sub` only with the flag (`services/lti-service/src/lti/deep-linking.ts:96-106`) | DL 2.0 response claims. | No conflict found. Blackboard needs `sub` (flag exists). |

## 5. Answers

### 5.1 (a) What a generic LTI 1.3 profile must make configurable

The generic profile is for kind A platforms (§3). Each item below is a per-platform value, entered by the admin or read from Dynamic Registration.

| # | Property | Why (source) | Today |
| --- | --- | --- | --- |
| 1 | Issuer (https, any path) | Every kind A LMS uses its own site URL (table 2.1). | Admin value, origin only for Dynamic Registration (`registration.ts:62`) |
| 2 | OIDC auth URL, token URL, JWKS URL, **each on its own origin** | D2L token on `auth.brightspace.com` (D5, D7). | Forced on the issuer origin (`platform-rules.ts:32-35`) |
| 3 | Client id and **many** deployment ids per client id | D2L and Canvas: many deployments (D3, CV2). Moodle and Open edX: 1. | `standard` is exclusive; add-deployment is a Canvas capability (`services/cogniate-app/src/providers/types.ts:19-26`) |
| 4 | Client assertion `aud`: token URL (default), a fixed value, or an array | D2L `https://api.brightspace.com/auth/token` (D7, D8). Blackboard array (BB3). Canvas also accepts the auth host (CV3). | Boolean `clientAssertionAudArray` only (`services/lti-service/src/platform/token-client.ts:36-37`) |
| 5 | Site origin (pages, DL return) and service origin (AGS, NRPS), when they differ from the issuer | Canvas (F-CV-18); Blackboard and Schoology serve pages on school hosts. | Profile field `siteUrlOn` (`services/lti-service/src/profiles/types.ts:10-11`) |
| 6 | Registration method: manual, Dynamic Registration, or both | Dynamic Registration in Moodle, D2L, Sakai and Canvas; TalentLMS (inferred). None found in Open edX, Docebo, Absorb. | Moodle-only capability (`services/cogniate-app/src/providers/moodle.ts:35`) |
| 7 | Expected `product_family_code` (or none) | `moodle`, `desire2learn`, `sakai`, `canvas`, `BlackboardLearn`; Open edX sends none. | Hard-coded map (§4.3) |
| 8 | Services: AGS scopes, NRPS on or off | Absorb, Cornerstone: no NRPS. D-8 least privilege. | Fixed scope list (`registration.ts:14-20`) |
| 9 | Deep Linking: supported or not; maximum items per response; `lineItem` accepted | Docebo and TalentLMS: no Deep Linking. Schoology editor: no line item. Canvas, Moodle, Blackboard: many items. | Always 1 item with `lineItem` (`docs/architecture/adr/ADR-011-multi-lms.md:273`) |
| 10 | Learner launch default: frame or new window; send the `window` hint or not | Every LMS has its own setting (table 2.2). | Canvas-only rule in the app (`docs/architecture/adr/ADR-011-multi-lms.md:285`) |
| 11 | Privacy: claim allowlist on or off | itslearning default anonymous; D2L "Anonymous" removed; Moodle unchanged (D-9). | Flag `minimizeClaims` |
| 12 | Platform storage: on or off; frame name; message origin | Canvas `post_message_forwarding` (CV5), Blackboard `lti_storage_frame` (BB6), Sakai `_parent` (SK5), D2L and Schoology yes; Moodle and Open edX no. | Not built (D-4) |

### 5.2 (b) Flags and quirks beyond today's `ProfileFlags`

Today: `deepLinkingResponseSub`, `clientAssertionAudArray`, `minimizeClaims`, `serviceOriginCheck` (`services/lti-service/src/profiles/types.ts:13-22`).

| # | New flag or field (proposed name) | Values | LMSs that need it | Source |
| --- | --- | --- | --- | --- |
| 1 | `clientAssertionAud` (replaces `clientAssertionAudArray`) | `{ value: '{tokenEndpoint}' or a fixed URL, form: 'string' or 'array' }` | D2L (fixed value); Blackboard (array) | D7, D8, BB3 |
| 2 | `endpointOrigins` | `'issuer'` (today's `standard`) or `'any-https'` (each URL passes the site rules and the guarded client) | D2L, and Canvas Dynamic Registration (token on `sso`) | D5, CV8 |
| 3 | `platformStorage` | `null`, or `{ targetFrame: string or 'from-login', origin: '{authOrigin}' or a fixed origin }` | Canvas, Blackboard, Sakai, D2L, Schoology | CV5, BB6, SK5, D11, SC2 |
| 4 | `dynamicRegistration` | `null`, or `{ configurationIssuer: 'url-origin' or 'profile', registrationToken: 'moodle-scope-jwt' or 'opaque-bearer' }` | Moodle (`moodle-scope-jwt`), Canvas (`profile` issuer), D2L, Sakai (UNVERIFIED) | 1E2, F-CV-15 |
| 5 | `deepLinking` | `{ maxItems: 1 or n, lineItem: boolean, windowHint: boolean, dataInReturnUrl: boolean }` | Canvas (`dataInReturnUrl`, F-CV-21; many items in 2 placements); Schoology editor (`lineItem: false`); itslearning (resource links only) | CV6, CV9, SC2, IT1 |
| 6 | `documentTargetTrusted` | boolean. `false` = the LMS always sends `iframe`, so the player checks the real frame. | Canvas (F-CV-17). It replaces the Canvas-only rule in the app (`docs/architecture/adr/ADR-011-multi-lms.md:285`). | CV7 |
| 7 | `scoreRules` | `{ finalOnlyFullyGraded: boolean, newAttemptPerPost: boolean, needsGradableUser: boolean }` | Moodle (MDL-89973), Canvas (F-CV-23 attempts), D2L (TestUser 422) | MD6, CV10, D6 |
| 8 | `nrps` | `{ enabled: boolean, pageSize?: number }` | Absorb and Cornerstone (no NRPS); Schoology 100 rows; Canvas 50 | AB1, SC2, CV11 |
| 9 | `productFamily` as data, plus a family-to-LMS map from the profiles | string or `null`; check 14 and the app read the map | D2L `desire2learn`, Sakai `sakai` | D6, SK5 |
| 10 | `issuerKind` | `'per-tenant'` or `'fixed'` (fixed issuers are reserved and need a named profile) | Schoology, itslearning, Canvas cloud, Blackboard | §3 |
| 11 | `customParameters` | `'allowed'` or `'none'` (information; Cogniate already uses none) | Docebo | DO1, `docs/architecture/adr/ADR-011-multi-lms.md:283` |
| 12 | `rateLimit` | `{ honourRetryAfter: true }` (generic client behaviour; a flag only if a platform differs) | Blackboard 429, D2L per-integration limits | BB10, D11 |

Quirks that need **no** flag (inferred):

- D2L mixed role vocabularies and the `sub` suffix: the role rule already reads full URIs (F-STD-5, `docs/architecture/adr/ADR-011-multi-lms.md:307-319`). `sub` is an opaque string.
- Open edX deployment id `"1"` for every block: the client id is unique per block, so (issuer, client id, deployment id) stays unique.
- Schoology lower-case custom keys: Cogniate sends no custom parameters.

### 5.3 (c) Which new named LMS to add first (E2), and why

**Recommendation: D2L Brightspace.** This confirms the plan candidate (`docs/team/ltiaas/plan.md:60,201`).

| Criterion | D2L Brightspace | Schoology | Sakai | Open edX | Absorb |
| --- | --- | --- | --- | --- | --- |
| Market | #1 Canada higher education; near #2 in US higher education; growing (MK2; Canada [snippet]) | K-12 only, 22% (MK3) | Very small (MK2) | MOOC and government niche (OX10) | Corporate mid-market (inferred) |
| Certification | LTI Advantage Complete 2026-04-10 (D1) | Complete 2026-10-15 (SC1) | 2019 (SK1) | Per release (OX2) | UNVERIFIED |
| Distance from the generic profile | **Small:** kind A, issuer = site, per-school client id, many deployments. Only 2 quirks: token host and `aud` value. Both are generic needs (§5.1 items 2, 4). | **Large:** kind B with a fixed issuer and a shared client id (a Blackboard twin; it proves little new) | **Zero:** fits `standard` today (inferred) | Small, but no family code and no Dynamic Registration | **Zero:** fits `standard` today; endpoints on the tenant (AB1) |
| Dynamic Registration | Yes, since 20.21.4 (D2) | No (inferred) | Yes (SK3) | No | No |
| Test site | Partner program; no public price; trial with LTI rights UNVERIFIED (D9, D10, D13) | Developer request and test district (SC2) | Free (SK6) | Free (OX9) | Trial, terms UNVERIFIED (AB1) |

Why D2L:

1. **Market.** It and Canvas are the 2 growing LMSs in US higher education (MK2). It is #1 in Canadian higher education [snippet] and also sells to K-12 (inferred).
2. **It proves the generic model.** Its 2 quirks are the 2 rules that block other kind A platforms (§4.3). A D2L profile is the generic profile plus 2 values. This meets plan success measure 1, "0 core files" (`docs/team/ltiaas/plan.md:137`).
3. **It exercises more of E2 and E3.** It has non-Moodle Dynamic Registration (token format UNVERIFIED), many deployments per registration, and a non-trivial `aud`. It also has platform storage (D-4) and a new-window option (D-10).
4. **Risk is in the simulator, not the product.** E2 proves the profile on the simulator (`docs/team/ltiaas/plan.md:60`). A real D2L row needs the Partner program. That is a human decision (LA-H3, LA-H6).

Second choices:

- **Sakai and Open edX** are free to run. Use them as live "generic profile" checks in E7, not as named profiles. They give a real non-Moodle platform with no sign-up (Docker or Tutor on a later approved stack).
- **Schoology** is the best K-12 choice. It is a Blackboard-style shared profile. Add it after E1 proves that a shared profile is pure data.
- **Absorb** is the first corporate LTI platform. It fits the generic profile with no code (inferred). It is a product decision for LF, not E2.

### 5.4 D2L facts for the E2 profile (plan risk "Brightspace facts unverified")

The plan v1 risk table names 3 unverified D2L facts (`docs/team/ltiaas/plan.md:214`). This is their status.

| Fact | Value | Evidence | Status |
| --- | --- | --- | --- |
| Issuer | The site URL, `https://{school}.brightspace.com` or a custom domain | Registration field `BrightspaceIssuer` (D3); examples in D5 [3rd] | Confirmed in shape; the exact value comes from the registration page |
| Auth endpoint | `{site}/d2l/lti/authenticate` | D5 [3rd], D6 [3rd]; field `BrightspaceOIDCAuthenticationEndpoint` (D3) | Confirmed by 2 third-party guides |
| Token host | `https://auth.brightspace.com/core/connect/token` (not on the site origin) | D5 [3rd], D2L community thread [snippet]; field `BrightspaceOAuth2AccessTokenUrl` (D3) | Confirmed by third-party guides; D2L shows the value per registration |
| Token audience | `https://api.brightspace.com/auth/token`; not the token URL | Separate field `BrightspaceAudience` (D3); D2L FAQ (D7 [snippet]); constant in D2L's own OAuth2 library (D8) | Confirmed by 3 sources. D2L's general API page says `aud` = the token URL; for LTI, use the registration value |
| JWKS | `{site}/d2l/.well-known/jwks` | D5 [3rd]; field `BrightspaceKeysetUrl` (D3) | Confirmed by third-party guides |
| Product family | `desire2learn` | D6 [3rd] (a launch dump on a public forum) | UNVERIFIED from a D2L page; confirm at the first real launch |
| Deployments | Many per registration; a UUID each; shared to org units | D3, D6 [3rd] | Confirmed |
| Dynamic Registration | Since Suite 20.21.4 | D2 | Confirmed. The registration token format: UNVERIFIED |

Design rule (inferred): the E2 D2L profile must read the token URL and the audience from the admin values on the D2L registration page. Fixed values are only defaults. A simulator run cannot prove them.

## 6. Out of the LTI family

| Product | Why not LTI | Where it belongs |
| --- | --- | --- |
| Google Classroom | Classroom add-ons API, not LTI (GC1) | New channel family "Classroom add-ons" in a backlog milestone (inferred: closest to LD identity plus LB catalog) |
| Microsoft Teams | Teams app plus Graph Education APIs (MS2) | Same as above; Microsoft 365 LTI is a tool, not a platform |
| SAP SuccessFactors Learning | No LTI (SF1); SAP Open Content Network | LF (SAP OCN), LC (records) |
| Workday Learning | No LTI (WD1); Cloud Connect for Learning, xAPI, tracking REST API | LF, LC (xAPI) |
| LearnUpon | SCORM and xAPI only (OT2) | LE (packages), LC (xAPI) |

## 7. Risks and open points

| Id | Risk or open point | Effect | Next step |
| --- | --- | --- | --- |
| R2-1 | Blackboard platform storage: the docs conflict with F-BB-9 (BB6) | D-4 design for Blackboard can be wrong | Live row on a Learn VMDK before the VMDK expires (2026-12-04), or a later image |
| R2-2 | D2L facts come partly from third-party guides (D5, D6) and snippets (D7, D11) | E2 simulator values can be wrong | E2 design marks each D2L value with its source; the first real D2L launch checks them |
| R2-3 | Canvas has no free admin test site (CV13) | No live Canvas row without a partner sandbox | LA-H3: a partner sandbox, or a self-hosted Docker Canvas for the `canvas-self-hosted` profile |
| R2-4 | Moodle `core_ltix` can move the endpoint paths (MD4) | `standard` paths and Moodle tool rows can break in a future Moodle | Watch MDL-79109; add a Moodle 5.3 LTS regression row |
| R2-5 | Moodle drops scores that are not `FullyGraded`, with HTTP 200 (MD6) | A future "in progress" score would look sent but be lost | E4 sends `Pending` scores to Moodle only after a live test, or never |
| R2-6 | Blackboard 6 site registrations per group (BB10) | The shared platform does not scale past 6 schools without a request | Operator runbook item; ask Blackboard before the 7th school |
| R2-7 | Several certification claims are not in the readable directory (1E1) | A "certified" label in the portal could be wrong | Show certification only for the 4 directory pages that we read |

## 8. Sources

All read on 2026-10-22. Short ids are used in the tables above. "[3rd]" = third-party; "[snippet]" = search excerpt only.

| Id | URL |
| --- | --- |
| 1E1 | https://site.imsglobal.org/certifications |
| 1E2 | https://www.imsglobal.org/spec/lti-dr/v1p0 |
| MD1 | https://moodledev.io/general/releases |
| MD2 | https://raw.githubusercontent.com/moodle/moodle/main/public/mod/lti/locallib.php |
| MD3 | https://github.com/moodle/moodle/tree/main/public/mod/lti |
| MD4 | https://moodle.atlassian.net/rest/api/2/issue/MDL-79109 |
| MD5 | https://moodle.atlassian.net/rest/api/2/issue/MDL-72022 |
| MD6 | https://moodle.atlassian.net/rest/api/2/issue/MDL-89973 |
| MD7 | https://moodle.atlassian.net/rest/api/2/issue/MDL-75151 |
| MD8 | https://moodle.atlassian.net/rest/api/2/issue/MDL-62607 |
| MD9 | https://docs.moodle.org/503/en/Managing_LTI_External_tools |
| MD10 | https://docs.moodle.org/503/en/Standards |
| MD11 | https://moodle.org/demo |
| MD12 | https://stats.moodle.org/ |
| MD13 | https://moodle.atlassian.net/rest/api/2/issue/MDL-67473 |
| MD14 | https://docs.moodle.org/503/en/External_tool_settings |
| MC1 | https://www.moodlecloud.com/standard-plans |
| MC2 | https://support.moodle.com/support/solutions/articles/80000836687-moodlecloud-lti-support |
| CV1 | https://github.com/instructure/canvas-lms/blob/master/doc/api/lti_launch_overview.md |
| CV2 | https://github.com/instructure/canvas-lms/blob/master/doc/api/lti_dev_key_config.md |
| CV3 | https://github.com/instructure/canvas-lms/blob/master/doc/api/oauth_endpoints.md |
| CV4 | https://github.com/instructure/canvas-lms/blob/master/doc/api/registration.md |
| CV5 | https://github.com/instructure/canvas-lms/blob/master/doc/api/lti_window_post_message.md |
| CV6 | https://github.com/instructure/canvas-lms/blob/master/doc/api/placements_overview.md |
| CV7 | https://github.com/instructure/canvas-lms/blob/master/lib/lti/messages/jwt_message.rb |
| CV8 | https://github.com/instructure/canvas-lms/blob/master/lib/lti/oidc.rb |
| CV9 | https://canvas.ubc.ca/doc/api/file.content_item.html |
| CV10 | https://canvas.ubc.ca/doc/api/score.html |
| CV11 | https://canvas.ubc.ca/doc/api/names_and_role.html |
| CV12 | https://site.imsglobal.org/certifications/instructure/canvas |
| CV13 | https://gocanvas.stanford.edu/news/canvas-update-summer-2026 |
| CV14 | https://en.wikipedia.org/wiki/2026_Canvas_data_breach |
| CV15 | https://github.com/instructure/canvas-lms/blob/master/config/security.yml.example |
| CV16 | https://github.com/instructure/canvas-lms/blob/master/doc/docker/README.md |
| CV17 | https://lms.griffith.edu.au/doc/api/lti_registrations.html |
| BB1 | https://docs.blackboard.com/docs/blackboard/lti/1.3/register-an-application |
| BB2 | https://github.com/blackboard/anthologydevdocs/blob/main/docs/blackboard/lti/1.3/02-best-practices.md |
| BB3 | https://github.com/blackboard/anthologydevdocs/blob/main/docs/blackboard/lti/1.3/lti-subsystems/01-authenticating-to-ags.md |
| BB4 | https://github.com/blackboard/anthologydevdocs/blob/main/docs/blackboard/lti/1.3/dl/03-building-token.md |
| BB5 | https://github.com/blackboard/anthologydevdocs/blob/main/docs/blackboard/lti/1.3/core/06-jwt-sample.md |
| BB6 | https://github.com/blackboard/anthologydevdocs/blob/main/docs/blackboard/lti/archive/poidc-login-lti_storage_target.md |
| BB7 | https://help.anthology.com/blackboard/administrator/en/integrations/learning-tools-interoperability/set-up-ltis.html |
| BB8 | https://docs.blackboard.com/docs/blackboard/sandbox-envs/ami-config/faq and https://github.com/blackboard/anthologydevdocs/blob/main/docs/blackboard/sandbox-envs/welcome.md |
| BB9 | https://docs.blackboard.com/docs/partners/partners-become_a_partner |
| BB10 | https://github.com/blackboard/anthologydevdocs/blob/main/docs/developer-portal/production-groups-rest-api-and-site-reg-limits.md and https://github.com/blackboard/anthologydevdocs/blob/main/docs/developer-portal/rate-limit-migration.md |
| BB11 | https://community.blackboard.com/home/blogs/retirement-of-lti-11-support-in-blackboard-lms-2026-08-27 |
| BB12 | https://help.anthology.com/blackboard/instructor/en/original-course-view.html |
| BB13 | https://campustechnology.com/Articles/2026/03/03/Anthology-Rebrands-as-Blackboard-Following-Financial-Restructuring.aspx |
| BB14 | https://site.imsglobal.org/certifications/anthology/blackboard-learn |
| D1 | https://site.imsglobal.org/certifications/d2l-corporation/d2l-brightspace |
| D2 | https://docs.valence.desire2learn.com/about.html |
| D3 | https://docs.valence.desire2learn.com/res/ltiadvantage.html |
| D5 | https://docs.skillable.com/docs/d2l-brightspace-lti-integration [3rd] |
| D6 | https://forums.openwebwork.org/mod/forum/discuss.php?d=8607 [3rd] |
| D7 | https://community.d2l.com/brightspace-es-MX/kb/articles/24362-ventaja-de-lti-preguntas-frecuentes-del-desarrollador [snippet] |
| D8 | https://github.com/Brightspace/D2L.Security.OAuth2/blob/main/src/D2L.Security.OAuth2/Constants.cs |
| D9 | https://docs.valence.desire2learn.com/tools/index.html |
| D10 | https://www.d2l.com/partners/integration-partners/ |
| D11 | https://community.d2l.com/brightspace/kb/articles/27427-browser-support [snippet] |
| D12 | https://learn.microsoft.com/en-us/microsoft-365/lti/microsoft-365-lti-brightspace?view=o365-worldwide |
| D13 | https://www.d2l.com/solutions/higher-education/try-now/ |
| SC1 | https://site.imsglobal.org/certifications/powerschool-group-llc/powerschool-schoology-learning |
| SC2 | https://developers.schoology.com/app-platform/lti-apps |
| SC3 | https://ed.link/docs/providers/schoology/schoology-lti-1.3 [3rd] |
| SC4 | https://learn.microsoft.com/en-us/microsoft-365/lti/microsoft-365-lti-schoology |
| SC5 | https://developers.schoology.com/app-platform/allowing-cookies |
| SC6 | https://help.powerschool.com/t5/Community-Forum/Free-Account-vs-District-Account/m-p/471941 [snippet] |
| SK1 | https://www.sakailms.org/post/sakai-achieves-lti-advantage-certification |
| SK3 | https://sakai.screenstepslive.com/s/sakai_help/m/114555/l/1629109-how-do-i-set-up-an-lti-advantage-tool-using-dynamic-registration |
| SK4 | https://raw.githubusercontent.com/sakaiproject/sakai/master/lti/lti-blis/src/java/org/sakaiproject/lti13/LTI13Servlet.java |
| SK5 | https://raw.githubusercontent.com/sakaiproject/sakai/master/lti/lti-common/src/java/org/sakaiproject/lti/util/SakaiLTIUtil.java |
| SK6 | https://sakai.screenstepslive.com/s/sakai_help/m/114555/l/1802308-is-there-a-test-server-i-can-use-to-try-out-sakai-plus |
| SK7 | https://raw.githubusercontent.com/sakaiproject/sakai/master/lti/docs/PROVISION.md |
| OX1 | https://docs.openedx.org/en/latest/educators/concepts/exercise_tools/about_lti_component.html |
| OX2 | https://docs.openedx.org/en/latest/community/release_notes/teak/teak_lti_cert.html |
| OX3 | https://docs.openedx.org/en/latest/community/release_notes/verawood.html |
| OX4 | https://github.com/openedx/xblock-lti-consumer |
| OX5 | https://raw.githubusercontent.com/openedx/xblock-lti-consumer/master/lti_consumer/models.py |
| OX6 | https://raw.githubusercontent.com/openedx/xblock-lti-consumer/master/lti_consumer/utils.py |
| OX7 | https://raw.githubusercontent.com/openedx/xblock-lti-consumer/master/lti_consumer/lti_1p3/consumer.py |
| OX8 | https://docs.openedx.org/en/ulmo/educators/references/course_development/exercise_tools/lti_component_settings.html |
| OX9 | https://docs.tutor.edly.io/gettingstarted/quickstart.html |
| OX10 | https://openedx.org/ |
| IT1 | https://developer.itslearning.com/LTI-1.3-Core-and-LTI-Advantage.html |
| IT2 | https://developer.itslearning.com/Your-tool-in-our-App-library.html |
| IT3 | https://developer.itslearning.com/LTI-configuration-information.html |
| IT4 | https://developer.itslearning.com/LTI-development-sources.html |
| IT5 | https://support.itslearning.com/en/support/solutions/articles/7000030677-manage-apps-adding-modules-apps-and-plugins-sysadmin- |
| IT6 | https://itslearning.com/blog/lti-advantage-transforms-education |
| IT7 | https://nordicedtech.substack.com/p/the-nen-interview-steve-tucker-ceo |
| GC1 | https://developers.google.com/workspace/classroom/add-ons/get-started/addons-lti-comparison |
| GC2 | https://developers.google.com/workspace/classroom/add-ons |
| GC3 | https://ed.link/community/does-google-support-lti-1-3-lti-advantage/ [3rd] |
| MS1 | https://learn.microsoft.com/en-us/microsoft-365/lti/index |
| MS2 | https://learn.microsoft.com/en-us/graph/msgraph-customer-teamsapps |
| MS3 | https://ed.link/community/does-microsoft-teams-support-lti-1-3-and-lti-advantage/ [3rd] |
| DO1 | https://help.docebo.com/hc/en-us/articles/360020082660 |
| DO2 | https://community.docebo.com/integrations-apis-45/adding-moodle-content-to-docebo-using-publish-as-lti-tool-lti-1-3-launch-succeeds-but-published-content-won-t-open-16241 |
| AB1 | https://support.absorblms.com/hc/en-us/articles/34077061848211 |
| AB2 | https://support.absorblms.com/hc/en-us/articles/51882578127763 |
| CS1 | https://csod.dev/guides/connectors/content/lti.html |
| CS2 | https://csod.dev/guides/connectors/content/lti-deeplinking-connector.html |
| CS3 | https://csod.dev/guides/connectors/content/basic-concepts.html |
| SF1 | https://userapps.support.sap.com/sap/support/knowledge/en/2830483 |
| WD1 | https://doc.workday.com/admin-guide/en-us/human-capital-management/learning/learning-content/chr1460978659140.html |
| WD2 | https://learn.microsoft.com/en-us/linkedin/learning/lms-integrations/integration-docs/workday |
| TL1 | https://help.talentlms.com/hc/en-us/articles/18600381592476 |
| TL2 | https://help.talentlms.com/hc/en-us/articles/19425225269404 |
| TL3 | https://www.talentlms.com/prices |
| OT1 | https://support.360learning.com/hc/en-us/articles/37882851435410 |
| OT2 | https://support.learnupon.com/hc/en-us/articles/360004011118 |
| MK1 | https://onedtech.philhillaa.com/p/state-of-higher-ed-lms-market-for-us-and-canada-year-end-2024-edition |
| MK2 | https://edutechnica.com/ |
| MK3 | https://www.listedtech.com/blog/the-state-of-the-lms-market-in-2024-trends-in-k-12/ |
| MK4 | https://www.listedtech.com/blog/an-overview-of-the-north-american-lms-market-k-12-and-highered/ |

Repo fact ids F-STD-*, F-CV-* and F-BB-* are in `docs/research/multi-lms.md:36-102`.

## 9. Recommendations for the LA plan

Plan references are to plan v1 (`docs/team/ltiaas/plan.md`).

1. **E2 (LA-H6):** choose D2L Brightspace as the first new named LMS (plan line 60). Prove it on the simulator with sim hosts for the site and the token host, and a sim audience value. Use the §5.4 table as the profile source. A live row waits for the D2L Partner program (LA-H3).
2. **E2:** define the generic channel as "kind A only" (per-tenant issuer). Kind B platforms (fixed issuer) always need a named profile and a reserved issuer. Add `issuerKind` to the profile data (§5.2 item 10).
3. **E2:** replace the hard-coded issuer-origin rule (`services/lti-service/src/lti/platform-rules.ts:23-36`) with a per-profile `endpointOrigins` policy. Keep `'issuer'` as the default for `standard`, so Moodle does not change. Plan v1 E2 does not list this item yet; D2L needs it.
4. **E2:** the plan "token audience" item (line 59) should be `clientAssertionAud { value, form }`. It replaces `clientAssertionAudArray`. Blackboard maps to `form: 'array'` with no behaviour change. D2L takes its value from the registration page; Dynamic Registration can fill it from `authorization_server` (line 58).
5. **E1 and E2:** the plan "product family for every profile" item (line 59) must also build the check 14 map and the app `lmsOfFamily` map from profile data (`services/lti-service/src/profiles/index.ts:96-107`, `services/cogniate-app/src/providers/index.ts:35-39`). Values: `moodle`, `canvas`, `BlackboardLearn`, `desire2learn`, `sakai`; Open edX sends none.
6. **E2 (and D-1 in E3):** add 2 more generic Dynamic Registration fixes to plan line 58. The registration token format comes from the profile (Moodle keeps `moodle-scope-jwt`; the default is an opaque Bearer token, 1E2 §3.3). The endpoint hosts follow `endpointOrigins`. This also opens Canvas (D-1), D2L and Sakai Dynamic Registration.
7. **E3 (D-4, Must, line 66):** design platform storage as profile data (`targetFrame`, `origin`). Start with Canvas (documented) and D2L. Keep the partitioned cookie as the fallback. Blackboard needs a live check first (R2-1). Moodle and Open edX have no platform storage, so they keep the cookie and the new-window default.
8. **E3 (Deep Linking, Must, line 68):** add `deepLinking.maxItems` and `lineItem` to the profile. Canvas `course_assignments_menu` and `module_index_menu_modal`, Moodle and Blackboard accept many items. The Schoology editor accepts links without line items only.
9. **E3 (D-10, Should):** replace the Canvas-only embedded-page rule (`docs/architecture/adr/ADR-011-multi-lms.md:285`) with the profile flag `documentTargetTrusted`. Record each LMS's new-window setting in its admin guide.
10. **E3 (claim policy, Should, line 71):** give each LMS a default claim policy in its profile data. Examples: itslearning sends only id and role by default; D2L removed "Anonymous"; Moodle follows "Share launcher's name/email".
11. **E4:** add `scoreRules` to the profile. **Caution for the E4 Should "progress states" (line 78):** Moodle discards a score that is not `FullyGraded` and still answers 200 (MDL-89973). So a Moodle progress score looks sent but is lost. Send progress states only to profiles that keep them. Canvas: 1 final score per attempt (F-CV-23); map 412 and 422 "course concluded" to clear sync errors.
12. **E4 (outbox, line 77):** Blackboard (token bucket, `429` with `Retry-After`) and D2L (per-integration limits) confirm the `Retry-After` need.
13. **E5 and E8:** record the Blackboard default of 6 site registrations per group and 10,000 REST calls per 24 hours in the operator runbook (BB10). The shared Blackboard platform needs a raise request before the 7th school.
14. **E7:** add a D2L simulator profile and a generic-provider row to the conformance kit. When a later brief allows a local stack, add a free real "generic profile" row (Sakai or Open edX with Tutor) and a Moodle 5.3 LTS regression row.
15. **E8:** update the guides. Use "Blackboard LMS", lead with Ultra (Original ends 2026-12-31), add the Canvas Apps path, and confirm the 16 Moodle rows on 5.3 LTS.
16. **E7 live rows (human decision LA-H3):** decide the test-site budget. Canvas: partner sandbox (no public price) or self-hosted Docker. Blackboard: VMDK (USD 0.05/hour plus AWS; the current image expires 2026-12-04) or BbDN (USD 3,000/year). D2L: Partner program (no public price).
17. **LF:** split Absorb and Cornerstone. They launch LTI 1.3 with Deep Linking and AGS, so their launch and grades can use the LTI channel (Absorb with the generic profile; Cornerstone through its partner team). LF keeps only their catalog push, as in the DataCamp catalog family (`docs/research/ltiaas/inputs-datacamp.md:24`). SAP SuccessFactors and Workday stay fully in LF (no LTI).
18. **LF:** Docebo and TalentLMS launch LTI 1.3 without Deep Linking. They need a "manual resource link" path: the admin pastes a launch URL that carries the publication id. Docebo allows no custom parameters, so the id must stay in the target link URI (`docs/architecture/adr/ADR-011-multi-lms.md:283`).
19. **LB and LD:** Google Classroom add-ons and Microsoft Teams are not LTI platforms. Plan them as a separate channel family that uses the LB catalog port and the LD identity port. Do not put them in LA.
