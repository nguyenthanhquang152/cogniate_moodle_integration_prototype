Verdict: APPROVE
Round: 1

# LA-BREAKDOWN review: Reviewer-A (lens "Is it right and is it safe?")

The verdict above is for Part 1 only. Part 2 (A1's specs) follows in its own section.

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
