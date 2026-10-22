Verdict: CHANGES_REQUESTED
Round: 1

# LA-BREAKDOWN review: Reviewer-A (lens "Is it right and is it safe?")

The verdict above combines both parts. Part 1 (A2's specs): APPROVE. Part 2 (A1's specs): CHANGES_REQUESTED, because of one MAJOR (A-LAB-10).

## Part 1 (A2 specs at ec1afc5927ea34f55bd3f433f550df624e40f111)

- Scope: `docs/architecture/ltiaas/tasks/A2-lanes.md` and the 40 specs `LA-E3-01..13`, `LA-E5-01..24`, `LA-E6-01..03`.
- References: the design at G-DESIGN PASS (`54e8088`) and the spec rules in `docs/team/ltiaas/briefs/_common-P3.md`. Paths without a folder are relative to `docs/architecture/ltiaas/tasks/`.
- Blind review: I did not open another reviewer's file.
- **Verdict (Part 1): APPROVE.** Counts: **0 BLOCKER, 0 MAJOR, 8 MINOR, 1 NIT.** The MINOR and NIT items can go to `docs/team/ltiaas/deferred.md`, or into a small spec edit before P4.

### Checks

| Check | Result |
| --- | --- |
| Every Must acceptance point of LA-ADR-05..08 maps to an AC | Yes. LA-ADR-05: AP-05-01..22 and AP-05-32 are in LA-E3-01..07. LA-ADR-06: AP-06-01..35 are in LA-E5-01..10, -14 and -19; the `/readyz` half of AP-06-26 is in the Should task LA-E5-17, and the Must half (`ready()` fails, log line) is in LA-E5-08 AC-08. LA-ADR-07: AP-07-01, -02, -04, -05, -06 and -09 are in LA-E5-11..13; AP-07-03, -07, -08, -10 and -11 are A1's (A2-lanes §2 note 6). LA-ADR-08 is all Could (LA-E6-01..03). |
| Security and correctness ACs | Strong overall, with negative cases for each control: rate limits (untrusted `X-Forwarded-For`, valid-key ltik `401`s spend no bucket, soft account classes, IPv6 /64), operator and API keys (expiry boundary with a controlled clock, scope `403`, key never shown again), key provider (associated data, legacy blob, missing version), signing keys (lead time, `force`, retention from `retired_at`, migration keeps the published set), platform storage (`Origin`, mismatch, single use, 120 s, bad signature before the page, foreign reply ignored), audit (same transaction, append-only, secret scan). The gaps are below. |
| ACs observable without implementation knowledge | Yes, except two oracles (A-LAB-01, A-LAB-02). |
| Must, Should and Could separable | Yes. No Must task depends on a Should or Could task. The Should and Could tasks are leaves or depend only on Musts. LA-E5-13 AC-05 runs only when LA-E5-15 is built. |
| File tables exclusive per wave | Yes for Part 1. Shared LTI service files have one lane per wave (S for `http/app.ts`, `http/auth.ts`, `config.ts`, `api-errors.ts`; L for `lti/*.ts` and `routes/{protocol,registration}.ts`), and the wave-sliced files are named (A2-lanes §2 note 1). For Part 2: lane K (LA-E3-07, B3) and the R reporter (B2–B3, `throttled` from `429`) may both need `services/cogniate-app/src/clients/lti-client.ts`; the ownership matrix should name one owner. |
| Sizes | Plausible. The five L tasks (LA-E3-02, LA-E5-03, -04, -08, -10) are the largest pieces of the design. |
| No gold-plating (LD-4) | No over-specification found. Each Should and Could task is marked as a cut candidate. |

### Findings

MINOR items, grouped. Each item has one file reference, the problem, and the fix.

- **A-LAB-01 (MINOR): a weak tenant-isolation oracle.** File: `LA-E5-13.md` AC-03.
  - Problem: "`POST /lti/launch/qa-second/storage-check` with a check value that a `cogniate` launch made gives `400 INVALID_STATE`" also passes when the `Origin` rule (LA-E3-02 AC-06) or the empty value refuses the POST, before the account binding is ever reached. So the AC cannot detect a missing account binding.
  - Fix: send `Origin` = the origin of `PUBLIC_LTI_URL` and the right value. Expect the detail `storage_check_unknown_used_or_expired` (not `storage_origin`). Add a control: the same check posted to `/lti/launch/cogniate/storage-check` passes.
- **A-LAB-02 (MINOR): an impossible oracle in a Could task.** File: `LA-E6-03.md` AC-09.
  - Problem: for an off-origin `lti-generic` manual connection the record stays **inactive** (LA-ADR-08 D3 rule 6). So an administrator launch is refused at login with `PLATFORM_NOT_ACTIVE` (contract delta §4.5) and never reaches the code page. The text "This connection needs a Cogniate operator approval" cannot be observed on that path.
  - Fix: test the message at `PUT …/platform` (without a grant code), or in the portal verify step. Expect `PLATFORM_NOT_ACTIVE` for the admin launch, and no code row.
  - Also, before this task is built (it waits for my security review, LA-H24): add the rule-2 negatives. These are an admin launch from another deployment of the same platform, an `LtiResourceLinkRequest` with an admin role, and a site mismatch; each must give no code.
- **A-LAB-03 (MINOR): no owner for the status gate of the storage-check route.** Files: `LA-E5-06.md` (Out: "LA-E3-02 adds it") and `LA-E3-02.md`.
  - Problem: LA-E3-02 has no scope line and no AC for it. Contract delta §1.5 requires `403 TOOL_ACCOUNT_SUSPENDED` (no state, no ltik) on the storage check of a suspended account.
  - Impact is small: an ltik made in the 120 s window still fails on `/api/*` (LA-E5-04 AC-05). Still, the required control has no owner.
  - Fix: add the gate to LA-E3-02 scope, with one AC (a storage check of a suspended account gives the `403` page and no `303`). Also add the launch POST of a suspended account to LA-E5-06 (only login and registration start have ACs).
- **A-LAB-04 (MINOR): multi-select is not enforced on the server.** File: `LA-E3-05.md` (scope D3b; AC-01..03).
  - Problem: the spec says when the page shows checkboxes, and that the POST takes 1 to 20 ids. It does not say that a channel without `content.multiple` (Moodle), or a launch with `acceptMultiple` false, accepts **exactly one** id. A crafted POST with several ids would send several items to Moodle (A-T0-11: Moodle then hides the grade settings).
  - Fix: one scope line and one AC: two ids on a Moodle-shaped connection give the `400` page and post nothing.
- **A-LAB-05 (MINOR): missing scheme negatives for API keys.** File: `LA-E5-07.md` AC-02, AC-04, AC-06.
  - Problem: revoke and expiry are proven only on Bearer routes, and the scope check only for a `launch`-only key.
  - Fix: a revoked or expired key also gives the unknown-key `401` on LTIK-AUTH-V2 and SERVICE-AUTH-V1. An `admin`-only key gets `403 API_KEY_SCOPE_MISSING` on `GET /api/idtoken`.
- **A-LAB-06 (MINOR): rate-limit classes without an AC.** File: `LA-E5-03.md`.
  - Problem: the hard classes `keys` (tool JWKS, per address) and `admin` (per API key) have no AC. Nor does the storage-check path in `protocol` (LA-ADR-05 D1 rule 10). A wrong key or route class there would go unseen.
  - Fix: one AC with three cases at low test limits: 4th JWKS fetch from one address; 4th Bearer call of one key; 4th storage-check POST from one address. Each gives `429`.
- **A-LAB-07 (MINOR): B1 ACs that need B2 work.** Files: `LA-E5-02.md` AC-01, `LA-E5-04.md` AC-08, `LA-E5-03.md` AC-01.
  - Problem: LA-E5-02 (B1) expects actor `api_key:<key id>`, but key ids exist only after LA-E5-07 (B2). LA-E5-04 AC-08 (close revokes every API key) runs after LA-E5-07 (B2). LA-E5-03 AC-01 needs LA-E5-04's `limits` column. A B1 task then cannot reach "done" in B1.
  - Fix: define the B1 actor value (for example `api_key:bootstrap-<account>`, replaced by the key id in LA-E5-07). Move the late ACs into the task that makes them true (LA-E5-07), or mark them "runs at B2" in the epic DAG.
- **A-LAB-08 (MINOR): Part 1 depends on ADR-012 commands.** File: `LA-E5-24.md` (Should).
  - Problem: the drill uses `stack:data-backup` and `stack:data-restore` of ADR-012. Plan LD-3 says that LA does not build on ADR-012's open runtime gates. The drill also asks for `/readyz` on both services, but the app `/readyz` is only in the app metrics item (Should, app API delta §8a).
  - Fix: the Lead confirms that this Should drill may use the ADR-012 commands (or cuts it with LA-H8 option (b)). Use `/healthz` for the app when its `/readyz` is not built.
- **A-LAB-09 (NIT):**
  - `A2-lanes.md:3` says "Design SHA: `88909be`"; the gate SHA is `54e8088`. The later diff does not touch A2's scope.
  - Some evidence labels are outside the label set:
    - "K1-SIM (K2 U4, QA-E2E)" in LA-E3-02 AC-08 and AC-09 (use K1-SIM and name K2 in the text);
    - "portal Vitest" under UNIT (LA-E6-01 AC-09, LA-E6-02 AC-08);
    - LA-E5-22 AC-01 includes "a Moodle course shell call", which needs MOODLE-LIVE, not K1-SIM.

## Part 2 (A1 specs at 971f1b17c52c38d7825ef563f10905a3281852d5)

- Scope:
  - `docs/architecture/ltiaas/epics.md`: task list, DAG, waves B1–B4, ownership matrix §5, Docker §7, sizes §8, critical path §9, open items §10.
  - `tasks/README.md`.
  - The 48 specs `LA-E0-01..04`, `LA-E1-01..12`, `LA-E2-01..07`, `LA-E4-01..08`, `LA-E7-01..12`, `LA-E8-01..05`.
  - A1's three post-gate design edits: app API delta §5a, data-model §3 `job_instance.role` (OI-6), design README OC-7 and OC-11.
- References:
  - The design at G-DESIGN PASS (`54e8088`), plus the post-gate edits at `971f1b1`.
  - Today's outbox code at `971f1b1` (`services/cogniate-app/src/domain/score-syncs.ts`).
  - Paths without a folder are relative to `docs/architecture/ltiaas/tasks/`.
- I reviewed A1's specs and the matrix as they are at `971f1b1`. A2's open fixes of my Part 1 findings are not part of this review.
- Blind review: I did not open another reviewer's file.
- **Verdict (Part 2): CHANGES_REQUESTED.** Counts: **0 BLOCKER, 1 MAJOR, 7 MINOR, 1 NIT.** The MINOR and NIT items can go to `docs/team/ltiaas/deferred.md`, or into a small spec edit before P4.

### Checks

| Check | Result |
| --- | --- |
| E1: no-behaviour-change proof per step | Yes, with one gap (A-LAB-17). Each E1 task has a golden compare or a regression tier that follows LA-ADR-04 D6. S1 and S2 (LA-E1-01, -02) use R0 and the golden compare. S3–S6 (LA-E1-05..08) use R1 and R2-lite; LA-E1-06 adds migration `013`, U1 and the migration phases. S7 (LA-E1-09) uses golden G4 and R2-lite. S8 (LA-E1-11) uses R1 and K2 U1–U2. S9 (LA-E1-12) uses F1 = 0, F2 and the canary. LA-E1-03 and LA-E1-04 change only build, lint and tool files, so R0 is enough. |
| E2: I-SELF and staged Dynamic Registration | Yes. These ACs cover I-SELF and staged registration: LA-E2-01 AC-04 (an active create off the issuer origin is refused, and a staged create is inactive) and AC-05 (refused hosts). LA-E2-02 AC-03 (I-SELF broken: `endpointsOnIssuerOrigin: false`, `active: false`, `PLATFORM_NOT_ACTIVE`, no token request at any host) and AC-04 (fixed host refused, nothing sent). LA-E2-03 AC-07. LA-E2-04 AC-01..04 (bound values, `--confirm-foreign-hosts`, `GRANT_MISMATCH`, staged flow end to end). One done-order gap: A-LAB-16. |
| E4: lease, one in flight, restart, confirmation | The runner ACs are strong. LA-E4-01 AC-01..07 cover the boot id in `lease_owner`, refusal of a late result, two runners on one file, restart with a controlled clock, and `job_instance_conflict`. My `stop()` build note is AC-06. The P2 rule after a restart is LA-E4-03 AC-05. Recovery of a copied row is LA-E4-02 AC-04. `throttled` is LA-E4-03 AC-01 and AC-03. The production refusal is LA-E4-05 AC-03. Gaps: the app job store that ships has no proof of three controls (A-LAB-10, MAJOR); the recovery of an expired lease of another instance (A-LAB-11); the D7 "Confirmation" row (A-LAB-12). |
| Migrations | `013` (LA-E1-06) and `014` (LA-E4-02 AC-01, -02, -04, -06, -07) have a migration test, U1 and the M1 `migration` and `snapshot-upgrade` phases. The three extra `014` fixtures of LA-ADR-04 D5 are present: a released Blackboard connection (AC-01), a launch of an old resource link (AC-06), a P2 row (AC-04). AC-01 does not check the values that A-LAD-15 fixed (A-LAB-13). |
| Post-gate design edits | App delta §5a: correct, and it agrees with the one-address rule of tasks README §2. But the per-address key can now only be proven in the unit test, and that AC is missing (A-LAB-14). data-model §3 `role` (OI-6): correct. LA-E4-05 AC-03 tests both directions. The check is only a configuration guard: two starts at the same moment can both pass it, so safety still depends on the one-in-flight rule (A-LAB-10). OC-7 and OC-11: correctly closed. In tasks README §2, each of forms (a)–(j) names its AC and a restore step, and runs only on QA's own project. |
| Must, Should and Could separable | Yes. LA-E4-06, -07 and -08 (Should), LA-E2-06 (Should), LA-E2-07 (Could), LA-E7-11 (Should, after LA-H9) and LA-E7-12 (Could) are leaves. No Must task depends on them. |
| ACs observable without implementation knowledge | Yes. Time rules (lease expiry of another instance, heartbeat age) are UNIT tests with a controlled clock (tasks README §5). Each QA command form is named in the AC that uses it. |
| File tables exclusive per wave | Yes, except `store/retention.ts` (A-LAB-15). My Part 1 note is resolved: `clients/lti-client.ts` is "K \| R \| K \| K" in the matrix, and LA-E4-03 names it (R in B2). |
| Sizes and critical path | Plausible. Lane R in B2 (LA-E4-02 → -03 → -05, after K's LA-E1-07) is the B2 critical path at 12.5 days (epics §9). |

### Findings

#### A-LAB-10 (MAJOR): the app job store that ships has no proof of the one-in-flight rule, the late-result refusal, or the recovery rule for a live lease of another instance

- Files:
  - `LA-E4-02.md`: the scope says "the outbox on the job runner with lease, one-in-flight, recovery and fairness"; see AC-01..11.
  - `LA-E4-01.md` AC-01, AC-02.
  - `LA-E4-05.md` AC-04.
- Required outcome (LA-ADR-03 D7, Must). This control closed my design BLOCKER A-LAD-03:
  - "For a `bestResult` reporter, at most one dispatch per (placement, learner subject, reporter) is in flight, across every runner. The lease update succeeds only when no other row with the same key has a live lease or a `send_started_at` value."
  - "Only the lease owner (the same instance id **and** boot id) records a result."
  - "A row with a live lease of another instance is left alone until that lease expires."
- Problem:
  - LA-E4-01 tests these rules with "a temporary SQLite store" of its own. Its scope says that each service implements the store and the one-in-flight condition hook on its own tables. So LA-E4-01 AC-01 and AC-02 prove the runner and a test store. They do not prove the SQL that ships.
  - The app store is LA-E4-02 (`kernel/records/**`). No LA-E4-02 AC checks:
    - the `NOT EXISTS` condition in the lease update;
    - the owner check in the result update;
    - recovery when a row has a live lease of another instance.
  - LA-E4-05 AC-04 checks only "each due row once", that is, one row and one lease. LA-E4-02 AC-04 checks only a copied row with `lease_owner IS NULL`.
  - One runner never reaches this rule: `perPartition` is 1, so the rows of one platform go one at a time. So R1, T5a, T5b and the golden rows cannot find the gap.
- Failure case:
  1. Two runners with distinct ids. This setup is allowed: LA-E4-05 AC-04 tests it, and outside `production` a web runner plus `npm run worker` only logs `job_runner_twice`.
  2. Runner A leases row 1 (score 50) and starts the POST.
  3. The learner commits 80, so row 2 is created and is due.
  4. If the app store's lease update has no `NOT EXISTS` part, runner B leases row 2 and sends 80 at the same time. The lower score can arrive last.
  - The same happens when a runner start recovers row 1 while A's lease is live: the marker goes, and row 2 is free to send.
  - If the owner check is missing, a process that lost its lease writes a late result over the state of the new owner.
- Why not a BLOCKER: the scope line names the control. Only the proof on the code that ships is missing.
- Fix:
  - Make the lease tests of LA-E4-01 a store-contract suite that takes a store as input.
  - Add one LA-E4-02 AC (UNIT). On a database migrated through `014`, with two runners and the app job store:
    1. Two rows of one (placement, learner, reporter) never have a lease or `send_started_at` at the same time. The higher row starts only after the lower row has a recorded result.
    2. A result from another boot id changes no row.
    3. Recovery at start does not change a row with a live lease of another instance. It marks rows with its own lease, an expired lease or a `NULL` lease as uncertain.
  - The LTI service store of A2's LA-E5-19 should run the interval-lease part of the same suite (LA-E4-01 AC-07).

#### MINOR and NIT items, grouped

- **A-LAB-11 (MINOR): an expired lease of another instance is recovered only at a start.** File: `LA-E4-01.md` (scope "recovery hook"; AC-04); LA-ADR-03 D7 "Recovery" row.
  - Problem:
    - The design runs recovery "When the runner may start", and leaves a row with a live lease of another instance "alone until that lease expires". No spec says what happens when that lease expires while the other runners keep running.
    - Suppose runner B crashes and its instance id never starts again (for example, an operator removes a worker). Its in-flight row keeps `send_started_at`. `beginSend` needs `send_started_at IS NULL` (`score-syncs.ts:88-90`), and the one-in-flight rule blocks every higher row of that key.
    - The scores of that learner and placement then stay `pending` until a runner restarts. No grade is wrong, but delivery stops with no error. This needs two runners.
  - Fix: one scope line and one UNIT AC. A running runner also recovers rows whose lease of another instance has expired, for example at each `due` poll. Test with a controlled clock: after `leaseMs` the row becomes uncertain, and the higher row is sent, then confirmed by the P2 rule. The `leaseMs` default (60 s) is above every outbound timeout, so the old POST has ended. The owner check refuses its late result.
- **A-LAB-12 (MINOR): the D7 "Confirmation" rule has no scope line and no AC.** Files: `LA-E4-02.md`, `LA-E4-03.md`; LA-ADR-03 D7 "Confirmation" row ("treats a superseded row of the same key that still has `send_started_at` like an uncertain row").
  - Problem:
    - Today's `needsConfirmation` (`services/cogniate-app/src/domain/score-syncs.ts:72-75`) reads only `delivery_uncertain = 1`. The design changes it.
    - No task names the change, and the ADR test list ("Test impact") has no case for it. So a port that keeps today's query passes every AC.
    - Impact is small: with the one-in-flight rule, the case needs a crash between steps.
  - Fix: one UNIT AC in LA-E4-02. Set up a superseded row of the same key with `send_started_at` set, and a higher row that gets an accepted send. The higher row must stay `pending` with `confirmation_after` at least 5 s later, and become `sent` only after the confirmation.
- **A-LAB-13 (MINOR): the `014` migration AC does not check the record values that A-LAD-15 fixed.** File: `LA-E4-02.md` AC-01; LA-ADR-04 D5 steps 3 and 4.
  - Problem:
    - AC-01 checks that each sync row has one `final` record with the derived id, and that `partition_key` is not `NULL`. It does not check the values.
    - Step 3 values: `outcome` and `course_version_id` come from the row's attempt; `attempt_id`; `placement_id` = `resource_link_id`; `learner_subject` = `user_sub`; the scores; `occurred_at = created_at`.
    - Step 4 values: the `partition_key` branch (platform id; reservation platform + `:` + deployment; `target_platform_id` + `:` + deployment; connection id).
    - The columns are `NOT NULL`, so a wrong source column still passes. No API reads the records in LA, so G3 cannot see a wrong value. The error would stay hidden until LC reads the records, and a wrong `partition_key` breaks the fairness of a shared platform.
  - Fix: AC-01 compares each backfilled record with its source sync row and attempt, column by column. It also checks the expected `partition_key` for each fixture: an exclusive platform, a shared platform with a reservation, and a released Blackboard connection.
- **A-LAB-14 (MINOR): no AC checks that the app-edge limit has one bucket per address.** File: `LA-E4-06.md` AC-01 (Should).
  - Problem:
    - The post-gate edit of app delta §5a moved the "other address" check out of QA, because QA has one client address (tasks README §2). So only the unit test can check it.
    - AC-01 checks the bucket values, the IPv6 /64 grouping and the untrusted forwarded address. It does not check that two addresses get two buckets, so one global bucket passes AC-01 to AC-07.
    - With one global bucket, one sender with random ltiks blocks the launches of every school, one minute at a time.
  - Fix: add to AC-01: when the bucket of one address is empty, a second address (another IPv4 address, or IPv6 in another /64) still gets its full burst.
- **A-LAB-15 (MINOR): `services/lti-service/src/store/retention.ts` has two owners in B2.** Files:
  - `epics.md` §3 row LA-E5-19 ("S1 | B2") and OI-9 ("LA-E5-19 to B2");
  - the §5 matrix row `store/retention.ts` ("S1 | L | S1 | S1", note "S1: retention jobs (B3)");
  - the `LA-E5-19.md` header ("Wave | B3").
  - Problem: the task list moves LA-E5-19 to B2 (LA-E5-09 in B2 depends on it). But the matrix still gives the file to L in B2 (LA-E3-02 AC-11, `storage_check` retention) and to S1 only from B3. With LA-E5-19 in B2, two lanes edit the file in one wave. This breaks the one-lane-per-wave rule (tasks README §4).
  - Fix: order the two edits in B2 (L first, then an RQ-2 handover to S1 for one named commit), and update the matrix note. Or keep LA-E5-19's edit of this file in B3. Align the spec header.
- **A-LAB-16 (MINOR): LA-E2-02 AC-03 needs the app code of LA-E2-04.** Files: `LA-E2-02.md` AC-03; `LA-E2-04.md` ("Depends on LA-E2-02"); LA-ADR-04 D4 rules 1 and 5.
  - Problem:
    - AC-03 expects "the connection DTO shows authority `operatorGrant` and status `pending`". The switch to `operatorGrant` is app work. The transaction that records the staged platform writes `binding_authority` and `lms = 'canvas'`, and the writer test for it is in LA-E2-04 (lane K).
    - LA-E2-04 depends on LA-E2-02. So LA-E2-02 cannot reach done before LA-E2-04 lands, and the DAG has a done-order loop (the same class as A-LAB-07).
    - The state between the two tasks is safe: the platform is inactive, so a launch gets `PLATFORM_NOT_ACTIVE` and nothing requests a token.
  - Fix: LA-E2-02 AC-03 keeps the LTI service parts (`endpointsOnIssuerOrigin: false`, `active: false`, `PLATFORM_NOT_ACTIVE`, no token request). Move the DTO part to LA-E2-04 AC-04, or mark it "runs after LA-E2-04" in the DAG.
- **A-LAB-17 (MINOR): LA-E1-10 changes a runtime path but has no R1.** File: `LA-E1-10.md` ("Regression: R0 + golden + the M1 profile rows; R2-lite"); LA-ADR-04 D6 Tiers.
  - Problem:
    - The task is the LTI service part of S3. It moves the `isStandardProfile` call sites of the platform create plan (`http/routes/platforms.ts:174,177,245`, `http/service-context.ts:40`) to the `endpoints` trait. That path decides whether a create takes admin values or fixed endpoints.
    - D6 asks for R1 "before the QA PASS of each step that changes a runtime path: S3, …". R2-lite runs only on Moodle.
    - The golden script creates one platform for each of Canvas and Blackboard. The M1 platform-create rows of those channels (for example the rest of `11-canvas-platforms`) run only at the B2 wave-end gate. By then A2's lane L tasks have built on the same files.
  - Fix: R1 for LA-E1-10, or at least M1 `--phase sim` for the Canvas and Blackboard platform groups.
- **A-LAB-18 (NIT):**
  - `LA-E4-07.md` AC-01: "a request from another container gets no answer" is labelled UNIT. A container check needs K1-SIM, or else reword the UNIT check as "the listener binds `127.0.0.1` only".
  - `LA-E4-01.md` AC-02: name the race directly: "two runners poll at the same time, with two due rows of one key; exactly one row gets a lease".
