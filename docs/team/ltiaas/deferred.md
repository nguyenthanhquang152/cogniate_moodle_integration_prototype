# Milestone LA: deferred findings

Only the Lead edits this file. A finding here is MINOR or NIT, or a deferral that the reviewer accepted (charter-LA §5). Each row names where the work goes.

## G-DESIGN (closed 2026-10-22)

| Id | Severity | Finding | Decision | Goes to |
| --- | --- | --- | --- | --- |
| B-LAD-15 | MINOR | Library staging of manual typed values | Deferred; Reviewer-B accepted (round 2) | E6 with D-3 |
| B-LAD-17(b) | NIT | Rename of the `binding.authority` capability | Deferred; Reviewer-B accepted (round 2) | No rename in LA |
| A-LAD-12 | MINOR | Hot-file sequencing between lanes | Deferred to P3; Reviewer-A accepted (round 2) | P3 ownership matrix (README §6a) |
| A-LAD-17 | MINOR | App CLIs and the operator API | Lead decision OC-9 (E5 Must 3 = LTI service CLIs only) | Closed |
| RA build note | — | `stop()` deletes its heartbeat row only after in-flight runs end | Accepted as an AC | P3 task LA-E4-01 |
| RB note 2 | — | The add-channel guide finds affected Moodle `standard` connections (`platform.productFamilyCode`) | Accepted | E8 guide task |
| RB note 3 | — | A runner that hits `job_instance_conflict` could keep waiting instead of turning off | Design note or Could AC | E4 job-runner task |

## G-BREAKDOWN (closed 2026-10-22)

Open MINOR and NIT items after round 2. The ones marked "before build" are one-line spec edits that the owner makes at the start of P4.

| Id | Severity | Finding | Owner | When |
| --- | --- | --- | --- | --- |
| A-LAB-19 | MINOR | The LA-E4-02 AC-04 rewrite dropped the P2 step of the D5 migration test | A1 | Before build |
| A-LAB-20 | MINOR | Pending AC of LA-E6-02 while LA-E6-06 is deferred | Lead | Closed by LD-16 (deferred-by-default counts as cut) |
| A-LAB-21 | MINOR | No AC proves that the retention job calls the storage_check cleanup | A2 | Before build |
| A-LAB-22 | NIT | Form (g) does not delete the backup folder, which holds secrets | A1 | Before build |
| B-LAB-17 | MINOR | No rule for a partner's pending ACs when its companion is cut | Lead | Closed by LD-16 |
| B-LAB-18 | MINOR | The capacity model leaves out review turnaround (about +7 days) | Lead | Closed: plan LD-17 says about 58 days |
| B-LAB-19 | NIT | LD-13 run sentence replaced by LD-17 | Lead | Closed in plan |
| Q-LAB-19 | MINOR | LA-E5-04 AC-08 has no valid key for its fresh account in B1 | A2 | Before build |
| Q-LAB-20 | MINOR | LD-13 and charter-LA QA rows did not match LD-17 | Lead | Closed in plan and charter |
| Q-LAB-21 | MINOR | tasks README :35/:37 name only QA's own projects | A1 | Before build |
| Q-LAB-22 | NIT | Three evidence labels | A2 | Before build |
| B-LAB-06 (part) | MINOR | Two cross-account cases stay in LA-E5-13, with a reason | A2 | Accepted by Reviewer-B |

## P4 build

| Id | Severity | Finding | Owner | When |
| --- | --- | --- | --- | --- |
| B-LA-E1-01 NITs | NIT | Module-level log set (move to the app instance); AC-02 uses the fake client | K | With LA-E1-02 if it fits |
| A-E1-01-01 | NIT | Two type-only lines in connections.ts outside "the builder only" | — | Accepted |
| B-LA-E5-08-02 | NIT | HKDF info prefix comment | S2 | Next S2 task |
| A-LA-E5-01-01 = B-LA-E5-01-01 | NIT / MINOR | LA-ADR-06 D3 says `stack:up` runs `lti:operator init --if-none`; spec and code run it in `lti-bootstrap.sh` (seed) | A2 (text) | Next A2 edit |
| A-LA-E5-01-02 = B-LA-E5-01-02 | NIT / MINOR | `stack:reset` leaves the dead `infra/.secrets/lti-operator-key` | S1 (RQ to the owner of `stack-reset.sh`) | Next S1 task |
| B-LA-E5-01-03 | NIT | An invalid host user name (`id -un`) stops seed with no `OPERATOR_NAME` hint | S1 | Next S1 task |
| B-LA-E1-02-01 | MINOR | AC-05/AC-06 tests start a copy of the main.ts listener, so dropping the main.ts call fails no test | K | LA-E1-03 dispatch |
| B-LA-E1-02-02 = A-LA-E1-02-01 | MINOR / NIT | textName of an unknown channel returns "Moodle", not the neutral "your LMS" | K | LA-E1-03 dispatch |
| B-LA-E1-02 NITs (5) | NIT | hand-kept manifest/capability shape copies, shared type placement, explicit-false rule, missing positive check-6 case, misleading check-5 reason; README §4 F1 test-file exclusion (A1) | K / A1 | Later K task; A1 next edit |
| A2 C5 | MINOR | LA-ADR-06 D4 rule T5: keep the first error on rollback | S1 | **Closed**: built in fd523ce; A2 BD-A2-07 updated D4 T5 |
| A-LA-E5-02-03/-04 | NIT | Reviewer-A NITs on LA-E5-02 (03 = A2 D4 T5) | S1 | With the C1 follow-up |
| A2 FYI (LA-E5-10) | MINOR candidate | removeToolKey uses an X'' literal (LA-ADR-06 D13 rule 2 portability lint forbids it; bind an empty Uint8Array); prepareToolKey uses generateKeyPairSync (blocks the event loop per new key; async generateKeyPair) | S2 | LA-E5-10 fix round (with its review findings) |
| A-LA-E4-01-04 | NIT | Cooling entries for rows moved elsewhere are never pruned and grow the due batch | R | LA-E4-02 |
| A-LA-E5-10-02 | NIT | prepareToolKey uses generateKeyPairSync (blocks both listeners); use async generateKeyPair | S2 | LA-E5-10 fix round |
| A-LA-E5-10-03 | NIT | bootstrap --rotate-signing-key fails while a next key exists | S2 | LA-E5-10 fix round |
| B-LA-E1-03-06/-07 | NIT | Fence messages do not say what is allowed; portal project comment | K | LA-E1-03 fix round (if cheap) |
| A-LA-E1-03-06 | NIT | `new Function` strings can still load modules in channel files: add no-eval, no-implied-eval, no-new-func to the channel fence | K | Next K edit of eslint.config.js |
| A-LA-E5-03-01 | MINOR | While the `proxy` name does not resolve (start race, proxy recreated), proxied clients share the proxy's address buckets for up to 60 s with no log line: retry every 5 s and log | S1 | LA-E5-03 fix round (with Reviewer-B items) |
| A-LA-E5-03-02 | NIT | settings.rate_limits audit event names the changed fields but not the new values | S1 | LA-E5-03 fix round |
| A-LA-E5-14-01 | MINOR | No test checks the platform_rate_limited log line for AGS and NRPS responses (memberships not covered) | L | LA-E3-11 / LA-E3-12 (AGS extras), or the next L dispatch that touches platform/ |
| A-LA-E5-14-02 | NIT | A 400-digit integer Retry-After gives 60, not 3600 | L | Same |
| B-LA-E5-10 R2 NIT | NIT | createNextToolKey can now create an active key (BD-A2-24): rename | S2 | Next S2 edit of tool-keys.ts |
| B-LA-E1-05-04..06 | NIT | Reviewer-B round-2 open NITs | L | Next L edit of profiles |
| B-LA-E5-04 R2 NIT | NIT | audit.change doc comment does not state the BD-A2-29 rules (section-5 action only; refused keeps base action) | S1 | LA-E5-03 fix round |
| B-LA-E7-10 R2 NIT | NIT | A step-5 finding line does not point to the allow-entry procedure | R | Next R edit of ci-local |
| B-LA-E1-10-01 | MINOR | DR help texts use {LMS} but still hold Moodle menu paths (registration.ts:37-41, :197; codes.ts:43); a channel cannot fix them from the manifest | A1 (design) then L | Before LA-E2-02 (frozen Moodle texts + generic text, or a manifest restart-path text, as BD-A1-30) |
| B-LA-E1-10 NITs | NIT | default arguments read the product registry; ISSUER_RESERVED special case in two places; two comments | L | Next L edit |
| B-LA-E1-06-04..07 + R2 NIT | NIT | open lens-B NITs (fixed texts, error order, main.ts registry, type re-export comment) and the unused _channels parameter of publicationResults (results.ts:85) | K | Next K edit of those files |
| B-LA-E3-02-01 | MINOR | login and check page scripts are two hand-kept copies of the same postMessage handshake (storage-pages.ts:16-44, :78-116) | L | Next L edit of storage-pages.ts |
| B-LA-E3-02 NITs | NIT | end-to-end flow map; account gate in launch.ts with an account! assertion | L | Same |
| B-LA-E5-03 R2 NIT | NIT | trusted_proxy_unresolved repeats every 5 s in a long DNS outage; BD-A2-29 audit comment lacks the refused-event rule | S1 | Next S1 edit |
| B-LA-E5-05-01 | MINOR | a 401 (revoked/expired operator key) prints "Run npm run seed again", but seed recopies the rejected key: name the host file and the real fix (put the current key there, or init --replace) | S1 | LA-E5-05 fix round |
| A-LA-E5-05 NITs | NIT | a lost answer to --rotate-api-key says "Cannot reach the operator API" though the rotation may have committed; every seed writes account.update for an unchanged name | S1 | LA-E5-05 fix round |
| A-LA-E5-09 NITs | NIT | the 202 traceId does not join the job-end event; skipped_lease still answers 202; a malformed key_provider setting makes every open throw a parse error | S2 | LA-E5-09 fix round (with Reviewer-B items) |
| BD-A1-60 follow-up (LA-E4-04) | Should | map the stored submission times into the AGS score body (submission { startedAt, submittedAt }); changes every score POST body, so it needs its own LA-IC, a G2/G3 golden update and an LD-9 list (A1 writes the LA-IC and the spec if scheduled) | R | backlog candidate; the Lead schedules it only if capacity remains |
| A-LA-E3-05-01 | NIT | an empty multi-select submit shows the PUBLICATION_NOT_AVAILABLE text, which does not tell the teacher to select an item (a new code or text needs A2, LA-ADR-05 D3b) | L2 | next L2 picker edit |
| B-LA-E2-04-04 / A-LA-E2-04 r2 MINOR | MINOR | a gone staged platform gives 409 PLATFORM_IN_USE with the old "developer key already connected" sentence, not the BD-A1-97 cause text | K | K's next dispatch |
| BD-A1-101 FYI (A1) | MINOR | the channel name 'your LMS' (lti-generic textName) reads badly in about 30 core texts that put {LMS} before a noun or at a sentence start (kernel defaults, app launch/picker/register pages, LTI codes and registration pages, the lti-generic admin step); options: lti-generic names.text 'LMS', lti-generic channel texts, or core rewording (each may touch LD-9 bytes) | A1 call, then K/L/P | before the E8 docs |
| BD-A1-107 FYI (A1 -> A2) | MINOR | Canvas DR: the security §2.5 "same site" proof now comes after complete, so a registration link used on the wrong Canvas site creates a tool there before the app refuses (nothing is stored); hardening: GET /api/registrations/:id gives the configuration URL origin (L + A2 contract delta) | A2, L | after LA |
| LA-E5-22 note (K) | MINOR | a production-profile stack (STACK_PROFILE=production) now refuses an APP_MASTER_KEY env value (app_master_key_in_env, BD-A2-91), like LTI_MASTER_KEY (D12); compose passes both as env values, so a production-profile compose run needs the *_FILE forms; QA stacks use the default and acceptance profiles | S1 (stack), Docs (runbook) | E8 docs / LG |
| LA-E5-22 note (K) | MINOR | readBack (AGS results read-back) still fails its request on a missing key version; BD-A2-97 made only the score dispatch retryable | K | next K edit of the AGS driver |
| A2 BD-A2-100 (LA-E6-02) | Could | connection health disconnect and suspend events: no task owns their K call sites (writer calls in K files), so LA-E6-02 builds without them | K + A1 task row | LG / after E6 |
| Docs LA-E8-01 finding 1 | MAJOR candidate | Kit closed list: kit.k0.test.ts asserts the fixture folder equals ALL_KIT_CHANNEL_IDS (5 ids, lib/fixtures.ts), and QA_KIT_CHANNELS=all means those 5; a sixth fixture (the add-a-channel path, LA-E8-02 walkthrough) fails the kit host check unless lib/fixtures.ts changes, which AC-LA-E8-01-01 does not allow | QA-4 (LA-E7-06) | LA-E7-06 fix round with the A/B review findings (before LA-E8-02) |
| Docs LA-E8-01 finding 2 | MINOR | LA-E7-02 qa.md still lists its five ACs "pending: Docker window" (host-only PASS); the D2L provider served K1 flows in LA-E2-05 (SIM E2-05-04, -10) | QA-E2E | next QA-E2E SIM slot (with the LA-E5-24 drill), or cite existing SIM rows |
| Docs LA-E8-01 finding 3 | MINOR | "the LTI service stores the family at an accepted launch" (LA-E8-01 design note, B-LAB-15) has no QA row; the guide marks it pending | QA | a K1-SIM row in the LA-E8-01 QA check |
| A2 R-LA-9 (BD-A2-108) | residual | the first-party `cogniate` key is shared by all libraries, so its hard `admin` bucket (1,200/min, burst 600) is a platform-wide cap; the operator can raise it (PATCH /operator/v1/accounts/cogniate {limits}); a per-library limit at the app edge is LG | A2 / LG | LG |
| LA-E7-02 r5 (A note, B MINOR x2) | MINOR | qa.md AC-LA-E7-02-01 says PASS while citing M1 sim 376/394 (the 18 WE rows are open under LA-E7-08); B: dot-directory scan parity in verifyOpenWorldSimManifest; a wrong generic SIM artifact pointer and endpoint path in the R5 row map | QA-E2E | QA-E2E prose round after the wave-end re-gate |
| LA-E5-24 r2 (B MINOR, A NIT x2 + note) | MINOR | qa.md overstates host line coverage (B-LA-E5-24-04); the redaction self-test does not pin each of its three layers (A-05); the raw dead r2 playId stays in qa.md:29 and the self-test fixture (A-06); QA rewrote 4 held r2 evidence files at 21:00:48Z to redact the playId and qa.md does not name them (disclose by append: file, time, old and new hash) | QA-E2E | QA-E2E prose round after the wave-end gate |
