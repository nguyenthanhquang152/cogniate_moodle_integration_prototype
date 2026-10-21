Verdict: UNVERIFIED — no live LMS run authorized or performed
Round: 3 (2026-10-21; round 2 2026-10-20)
Owner: round 3 by a fresh Claude Canvas QA-E2E session (`claude-opus-5-5`, xhigh; Orca session `c9188d79-d5a7-4ab0-bc62-ac27e61ff412`); round 2 by the original Claude Canvas QA (`claude-opus-5-5`, xhigh), resumed by owner request; round 1 by the independent Codex Canvas QA replacement

# M3 live LMS matrix

All rows inherit this environment record: **no authorized environment; profile not selected; LMS version not measured; browser name/version/OS/cookie setting not measured; no execution date; authorization none**. Matrix preparation date: 2026-10-20. Each row is UNVERIFIED, not FAIL or PASS. Expected steps below are copied from applied M3 §5 at `ccdd9ef67cdd2be4c6af374136777fda4e081943` and are plans only.

The M2 run on `eb43247d02df622d5da72dafac41d919f65a91fe` was signed simulation and failed; it fills no live row. T7 remains held. Local Canvas feasibility and any startup remain after the SIM and Moodle gates and need the required Lead handoff. No Docker Desktop change, public tunnel, account creation or tenant write occurred.

Status today: every row **UNVERIFIED**. Blockers: B-1 (Canvas tenant), B-2 (Blackboard Developer Portal account and Learn instance), B-3 (public HTTPS for our JWKS, needed by Blackboard) — ADR-011 §13. Run order inside each LMS: top to bottom. Common prerequisites: a published test course, one enrolled test learner and one teacher; the learner opens the item from the LMS before any grade check; the operator issues each approval grant after the out-of-band request.

Browser rows (L-C10, L-B10): each run is **observation complete** when the browser name, version, operating system and cookie setting and the outcome are recorded. The row is `PASS` only if the flow succeeds in that recorded setup; an intentionally blocked-cookie run is a separate observation whose expected outcome is the cookie-help error page, not an interoperability result.

### Canvas, hosted (label `CANVAS-HOSTED`; needs B-1)

Setup without public exposure: the tester's browser trusts the dev CA and resolves the `.test` names; the LTI service can reach the Canvas site and `sso.canvaslms.com` over the internet; the developer key uses the `?jwk=inline` JSON (key snapshot; record its `kid`).

| Id | Step | Expected | Status | Evidence label | Authorization |
| --- | --- | --- | --- | --- | --- |
| L-C01 | Developer Keys → + LTI Key → Paste JSON (our JSON), Redirect URIs → Save → turn on | Canvas accepts the JSON; the Assignment Selection placement exists | UNVERIFIED | CANVAS-HOSTED | None |
| L-C02 | Settings → Apps → + App → By Client ID → Install; read the deployment id (View App Configurations / Deployment Id menu) | A deployment id shows | UNVERIFIED | CANVAS-HOSTED | None |
| L-C03 | Portal: Canvas connection with the page host as Canvas URL and the account domain as service URL; operator grant; client id, deployment id, approval code | `registered` | UNVERIFIED | CANVAS-HOSTED | None |
| L-C04 | Teacher (record browser): new assignment → External Tool → Find → Cogniate → pick a course | Picker in the modal; assignment with 100 points, our title, "Load This Tool In A New Tab" selected; the return POST succeeds (Canvas accepts its own `data` query) | UNVERIFIED | CANVAS-HOSTED | None |
| L-C06 | Teacher clears the new-tab setting; learner opens the assignment | The launch stays in Canvas: the embedded page with "Open in a new window" | UNVERIFIED | CANVAS-HOSTED | None |
| L-C07 | Learner opens the assignment with the new-tab setting on | New tab; the embedded page continues to the player without a click | UNVERIFIED | CANVAS-HOSTED | None |
| L-C08 | Learner completes the HTML course in the graded assignment | Grade in the Canvas gradebook = ADR-010 score; portal sync `sent` | UNVERIFIED | CANVAS-HOSTED | None |
| L-C09 | Teacher opens the assignment; Student View learner completes it | Teacher: preview, no score sync row. Student View: graded (F-CV-20) | UNVERIFIED | CANVAS-HOSTED | None |
| L-C10 | Teacher Deep Linking in Safari (record version and cookie setting), then with cross-site cookies blocked | Browser rule above | UNVERIFIED | CANVAS-HOSTED | None |
| L-C11 | Compare the AGS host and the return URL host in a launch (`/api/idtoken?raw=true`, API key holder) with the browser host. If the school has a third host: Deep Linking through it, a framed launch through it, a top-level launch through it | AGS on the service URL, return URL on the page host (F-CV-18). Third host: Deep Linking `SERVICE_ORIGIN_MISMATCH` (`claim=dl_return`); framed page not shown by the browser; top-level launch works and "Back to Canvas" goes to the site URL (ADR-011 §5) | UNVERIFIED | CANVAS-HOSTED | None |
| L-C12 | Inspect `/api/idtoken?raw=true` | Only allowlisted claims; `tool_platform.product_family_code` = `canvas` | UNVERIFIED | CANVAS-HOSTED | None |
| L-C14 | In a test stack with an inline-key install: rotate the Cogniate signing key; restart the LTI service (empties the token cache); try Deep Linking and a grade; then paste a new JSON and repeat | Before the new JSON: Deep Linking and a new token request fail; after: both work. An already issued token can still work until it expires; the row records this | UNVERIFIED | CANVAS-HOSTED | None |
| L-C15 | Assignment with "Allowed Attempts" = 1; the learner improves the score (best-result resend) | The second score gets `422`; the sync row is `failed` (records the attempt-limit behaviour, F-CV-23) | UNVERIFIED | CANVAS-HOSTED | None |

### Canvas, self-hosted or local (label `CANVAS-LOCAL`)

| Id | Step | Expected | Status | Evidence label | Authorization |
| --- | --- | --- | --- | --- | --- |
| L-C13 | A self-hosted Canvas with its own issuer. Lead decision: assess a local Canvas only after the SIM run, without changing Docker Desktop settings and without public exposure | Same as L-C01 to L-C08 with `canvas-self-hosted`; the result never fills a hosted row | UNVERIFIED | CANVAS-LOCAL | None |

### Blackboard (label `BLACKBOARD-LIVE`; needs B-2 and B-3)

| Id | Step | Expected | Status | Evidence label | Authorization |
| --- | --- | --- | --- | --- | --- |
| L-B01 | Operator: Developer Portal application with domain = LTI host, login URL, one redirect URL, JWKS URL, RS256, and the Deep Linking placement "Cogniate" with Target Link URI `{PUBLIC_LTI_URL}/lti/launch/cogniate` and student access off | Application ID issued | UNVERIFIED | BLACKBOARD-LIVE | None |
| L-B02 | `lti:shared-platform` with the Application ID | Shared platform active | UNVERIFIED | BLACKBOARD-LIVE | None |
| L-B03 | Learn admin: register LTI 1.3 tool with the Application ID; compare the 9 rows | Values match; Deployment ID shows; labels match app contract §4.5 | UNVERIFIED | BLACKBOARD-LIVE | None |
| L-B04 | Portal: Blackboard connection with the Learn URL; operator grant; deployment id and approval code | `registered` | UNVERIFIED | BLACKBOARD-LIVE | None |
| L-B05 | Ultra teacher: Content Market → Cogniate → pick | Item and grade column made | UNVERIFIED | BLACKBOARD-LIVE | None |
| L-B06 | Original teacher: Build Content → Cogniate → pick | Item made | UNVERIFIED | BLACKBOARD-LIVE | None |
| L-B07 | Learn accepts our DL response (`sub` set, `data` echoed) and our client assertion (`aud` array) | No Learn error | UNVERIFIED | BLACKBOARD-LIVE | None |
| L-B08 | Learner launch | Record new window or iframe; player opens (directly or through the embedded page) | UNVERIFIED | BLACKBOARD-LIVE | None |
| L-B09 | Learner completes the HTML course | Grade Center shows the ADR-010 score; portal `sent` | UNVERIFIED | BLACKBOARD-LIVE | None |
| L-B10 | Teacher Deep Linking in Safari (record version and cookie setting), then with cross-site cookies blocked | Browser rule above | UNVERIFIED | BLACKBOARD-LIVE | None |
| L-B11 | User fields "Role in Course" only | `/api/idtoken?raw=true` has only allowlisted claims | UNVERIFIED | BLACKBOARD-LIVE | None |
| L-B12 | A second Learn instance (if available) with the same Application ID. Also call the AGS line items URL of site B with a token obtained for a site A call | Its own grant and library; no cross-routing. Record whether the token works at site B (R-M-14) | UNVERIFIED | BLACKBOARD-LIVE | None |
| L-B13 | Disconnect in the portal, then a learner launch | `DEPLOYMENT_NOT_ACTIVE`; other schools unaffected | UNVERIFIED | BLACKBOARD-LIVE | None |
| L-B14 | Teaching assistant: Deep Linking and a learner launch, "Role in Course" only | Record the raw roles; Deep Linking allowed only with a context staff role | UNVERIFIED | BLACKBOARD-LIVE | None |
| L-B15 | Course builder: the same | Record the raw roles and results | UNVERIFIED | BLACKBOARD-LIVE | None |
| L-B16 | Grader: the same | Record the raw roles and results | UNVERIFIED | BLACKBOARD-LIVE | None |
| L-B17 | Guest: the same | Record the raw roles; a guest without a context learner role is a preview | UNVERIFIED | BLACKBOARD-LIVE | None |
| L-B18 | Inspect `/api/idtoken?raw=true` of a Learn launch | Record `tool_platform.product_family_code` (expected `BlackboardLearn`, F-BB-16; another value only weakens check 14 for Blackboard, it does not break launches) | UNVERIFIED | BLACKBOARD-LIVE | None |

## Round 2 — local Canvas feasibility (assessment only, no startup)

The SIM gate (M2 64/64) and the Moodle gate (T7 three default runs, demo and confirmation) passed at `aff48823a4c6206d6314d91a95f5eb0979d3e0e7`. So QA assessed a local Canvas for row L-C13 (`CANVAS-LOCAL`), read-only. Nothing was installed, built, pulled or started. No Docker Desktop setting, host resolver or network exposure changed. All rows stay **UNVERIFIED**.

Sources: canvas-lms at the pinned commit `1c9f0bb8013ed69c4f2efe11fd483025469b7e6c`, files `doc/docker/developing_with_docker.md` and `doc/docker/getting_docker.md`. Host facts were measured on 2026-10-20.

| Need | Fact | Effect under current rules |
| --- | --- | --- |
| Docker memory | canvas-lms recommends a Docker Desktop memory allocation of "at least 8GB". The Docker VM here reports MemTotal `8319238144` bytes, shared by everything that runs in it. | The documented recommendation is an allocation for Canvas alone, not a measured Canvas footprint. Both stacks would share this allocation. Their combined memory demand was not measured. QA must not change Docker Desktop. |
| Concurrent stacks | L-C13 needs Canvas (web, jobs, database, cache, sidecar) and the Cogniate default stack at the same time. | The fleet rule allows one stack. A second stack needs a Lead exception. |
| Transport | The canvas-lms dev site is `http://canvas.docker/` (HTTP), with dory, Dinghy-http-proxy or Traefik for DNS. | The product refuses HTTP platform URLs (the M2 `rule1-http` case). It needs HTTPS with a certificate that the LTI service, the app and the browser trust. A host DNS proxy or resolver change is a host change, so the run would use container-network aliases and a TLS proxy with the dev CA. |
| Outbound guard | The LTI and app services allow private hosts only through `OUTBOUND_PRIVATE_HOST_ALLOWLIST` (`infra/compose.yaml`). | The local Canvas host must be added through a QA-only runtime override. The frozen runs use no overlays, so this needs Lead approval and stays out of the repository. |
| Issuer | A self-hosted Canvas must change its issuer to its own host (F-CV-2). | Canvas configuration in the local instance only. `product_family_code` stays `canvas` (F-CV-22). |
| Accounts and data | Local admin, teacher and learner exist only in the local instance. Images, gems and packages come from public registries; no account is needed. | No third-party sign-up. New images and volumes are QA-owned and must be removed after the run. The seven protected volumes stay unchanged. |
| Time | canvas-lms says only that the first build "will take a while". | QA planning estimate, not measured: allow more than one hour for the first build and setup, before any row runs. |
| Evidence value | L-C13 uses the `canvas-self-hosted` profile. | A local result fills only L-C13 and never a `CANVAS-HOSTED` row. |

**Assessment: not feasible now without Lead decisions.** The current rules block it: one stack only, no Docker Desktop change, and no overlays. These stack and overlay constraints alone defer the run; the memory row adds risk but no measured failure. A run needs, at a minimum:
1. An explicit exception for a second concurrent (local Canvas) stack, and acceptance of the memory risk. Any memory change is the owner's action, not QA's.
2. Approval of a QA-only, uncommitted runtime override: TLS proxy with the dev CA, container DNS aliases, network attachment, and an allowlist entry for the local Canvas host.
3. A time window for the first build.
4. Cleanup of all QA-owned Canvas images, volumes and networks afterwards.

Without these, L-C13 stays UNVERIFIED with the reason "not feasible under the current one-stack and no-Docker-change rules".

## Round 3 — candidate `aaa823b` status (no live run)

Date: 2026-10-21. Candidate `aaa823b25306c5e560f7c4050238b374dec4d4e3`. Task `task_e28388df4dcc`, dispatch `ctx_e7de4ddd7504`.

- All 32 rows stay **UNVERIFIED**. No live LMS run was authorized or performed. No account, sign-up, tunnel, public JWKS exposure, tenant write or Docker Desktop change happened.
- SIM evidence at this candidate (Common's failed full M1 run, round 1 Canvas rows 233/233 PASS) fills no live row.
- L-C13 (`CANVAS-LOCAL`) stays DEFERRED. The SIM and Moodle gates did not pass at this candidate, so no new feasibility assessment or startup happened. The Round 2 assessment above is history at `aff4882`. A `CANVAS-LOCAL` result never fills a `CANVAS-HOSTED` row.
