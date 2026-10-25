Verdict: APPROVE
Round: 2

# LA-E3-01 review, Reviewer-B2 (lens: "Can a human team own it?")

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22). Diff: `git diff 5ec8a69^1 5ec8a69` (the merge of lane L for LA-E3-01). Spec: `docs/architecture/ltiaas/tasks/LA-E3-01.md`. Design: LA-ADR-05 D1 rules 1–4 and 9; LA-ADR-02 D2; BD-A1-33, BD-A1-34; BD-A2-35. I did not open any reviewer-a file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 1 MINOR, 3 NIT.**

The change is small, and it keeps today's `302` path untouched. One builder makes the auth URL for both answers, so the page and the `302` cannot differ. The page module is separate (`storage-pages.ts`). Its escape runs on the whole JSON text, and a one-line comment says why. The trait follows BD-A1-33: a kernel type, a strict schema with readable messages, and `null` normalization in the registry. The tests are the strongest part of the task. The page script runs in a fake window, and the tests prove the rule-9 reply checks one case at a time: wrong origin, wrong subject, wrong `message_id`, malformed data, an `error` reply, a top-level page and a missing frame. The login tests compare the answer with a rebuilt pre-storage builder that uses the same random values. My MINOR is about following the flow: the storage decision is three dense lines in `login.ts`, and no comment connects the four steps (decide, page, state row, the launch side in LA-E3-02).

## How I checked

- Scratch clone of `5ec8a69` (private `/tmp` folder, `--no-hardlinks`, `node_modules` copied; deleted after the run). `vitest run services/lti-service/src`: **66 files, 814 tests passed**. `F1 PASS: 32 files with hits, 184 hits`; `F5 PASS: 3 rules …, 0 hits` (migration `014` passes `sql-portability`).
- I mapped each UNIT AC to its test, and I read the page HTML, the headers and the script against rules 2, 3 and 9.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | `lti/login.ts`, new `lti/storage-pages.ts`, `store/states.ts`, `profiles/schema.ts`, migration `014`, and the kernel `profiles.ts` lines (RQ-2, BD-A1-33). `http/routes/protocol.ts` gets exactly one line in the login handler (BD-A1-34). No change to `lti/launch.ts`, `packages/channels/**`, `http/app.ts`, `http/auth.ts`, `config.ts` or app files. `profiles/registry.ts` and `profiles/types.ts` change for the `null` normalization (`profiles/**` is lane L's). OK. |
| Ownership | Lane L, B2; kernel lines by RQ-2. OK. |
| No behaviour change outside the spec | No baseline profile has the trait, so every product login still answers the `302`. AC-01 compares status, `Location` and `Set-Cookie` with the rebuilt old builder, and the body is empty. OK. |
| No LMS name in core | F1 passes. The new texts are neutral ("Cogniate sign-in"). |
| UNIT ACs | AC-01, -02, -05 (`login.test.ts`; `undefined`, `''`, 65 characters and `a b`), AC-03, -04, -08 (GET and POST), AC-06 (a) builder escapes and (b) hostile `login_hint` (BD-A2-35), AC-07 (`storage-pages.test.ts` with the real script, `_parent` and a named frame; the login test with a fixed origin), AC-08 (`states.test.ts`), AC-09 (migration test on copied M1 states). The old tree has no page, no trait and no columns, so each new test fails there. OK. |

## Findings

### B-LA-E3-01-01 — MINOR — The storage decision is three dense lines, and nothing maps the four steps of the flow

- **File:** `services/lti-service/src/lti/login.ts:65-68`, `:81`; `services/lti-service/src/lti/storage-pages.ts:1`; `services/lti-service/src/profiles/schema.ts:17` (the same frame-name regex).
- **Problem:**
  - Rule 1 (the trigger: `from-login` reads `lti_storage_target`, a frame name in the trait is the target) and rule 2 (the origin: `authOrigin` or the fixed origin) are three chained ternaries with no rule reference. An invalid request target becomes `null` by a regex inline.
  - The same regex `^[A-Za-z0-9_-]{1,64}$` is also in the schema (`schema.ts:17`), so the rule for a valid frame name lives in two places.
  - A newcomer who follows the storage flow must collect it from four places: `login.ts` decides, `storage-pages.ts` builds the page, `states.ts` stores target and origin, and the launch side (LA-E3-02) reads the state back. The only comment says "Platform storage pages (LA-ADR-05 D1)".
- **Suggested fix:** Extract one function, for example `storageBindingOf(trait, params, authEndpoint): { target, origin } | null`, with a one-line comment per rule ("rule 1: the trigger …", "rule 2: the storage origin …", "an invalid target counts as no target"). Export one `FRAME_NAME` pattern and use it in the schema and in this function. Add a short flow note at the top of `storage-pages.ts`: login decides → page posts `lti.put_data` → the state row keeps target and origin → the launch side (LA-E3-02) reads the state from storage when the cookie is missing.

### B-LA-E3-01-02 — NIT — The login tests switch the trait on by spying on `profileDefinition`, not through the registry seam

- **File:** `services/lti-service/src/lti/login.test.ts:17-21`.
- **Problem:** The test replaces the module export `profileDefinition` for one profile. Since LA-E1-05 the code has one seam for test data (`ProfileOptions.registry`), and LA-E1-10 added `testProfileRegistry`. The spy works today, but it depends on how the module binding is imported, and it changes every `profileDefinition` call in the request, not only the login decision.
- **Suggested fix:** Build a test registry with one profile whose trait is set (extend `testProfileRegistry` with an optional `platformStorage`), and pass it to the harness as the profile options. If the harness cannot take a registry yet, add that option once; later tasks (LA-E3-02) need it too.

### B-LA-E3-01-03 — NIT — The login page shows nothing to the learner (route to A2)

- **File:** `services/lti-service/src/lti/storage-pages.ts:58-65` (the HTML body holds only the two scripts).
- **Problem:** In a frame, the page waits up to 1.5 s for the storage reply, and the learner sees a blank frame during that time. If the script does not run (for example a proxy that rewrites the CSP), the learner sees a blank frame and no next step. A static line that holds no request value fits the page rule ("no request value in HTML").
- **Suggested fix:** A2 decides a static text, for example `<p>Opening the activity…</p>`. Without a script there is no safe way to continue, because the auth URL holds request values that must stay in the JSON block. So the line is only a status message.

### B-LA-E3-01-04 — NIT — The two state fields are optional only for old test callers

- **File:** `services/lti-service/src/store/states.ts:14-16` (`storageTarget?`, `storageOrigin?`, "omitted values in older callers are stored as null").
- **Problem:** The only product caller of `saveState` (`login.ts:69`) always passes both fields, and `consumeState` always returns them. The `?` exists so that the test callers do not need an edit. Readers of `StateRecord` must then handle `undefined` as well as `null`, and a future product caller can forget the fields without a type error.
- **Suggested fix:** Make both fields required (`string | null`), and pass `null` in the test fixtures.

## Not checked

- K1-SIM AC-10 (QA). The launch side, the storage-check page and the trait values (LA-E3-02).
- Lens-A items: the CSP and `frame-ancestors` choice, the 1.5 s wait, and the reply checks beyond the unit cases.

## Round 2

Verdict for this round: **APPROVE**. Reviewer: Reviewer-B (the same lens B as Reviewer-B2 in round 1). This is a bounded re-check of the round-1 MINOR and NITs against lane L's fix commits `23a736e` (static login text, A2 BD-A2-41), `5fecc58` (S1 `http/app.ts` registry seam, RQ-2), `db1038f` (`storageBindingOf` and `FRAME_NAME`, registry-based tests) and `f09c3ea` (collision regression, BD-A2-44), in merge `3344520` (`git diff 3344520^1 3344520` on the LA-E3-01 files). I did not open any reviewer-a file. I did not run Docker.

Counts (this round): **0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT (new).** The round-1 MINOR and all three NITs are **closed**.

### How I checked

- Scratch clone of `3344520` in a private `/tmp` folder (`--no-hardlinks`, `node_modules` copied; removed after the run). The shared LA worktree did not change.
- `vitest run` on `services/lti-service/src/lti`, `profiles`, `store/states.test.ts` and `http/routes/compat.test.ts`: **18 files, 288 tests passed**. `tsc --noEmit -p services/lti-service/tsconfig.json`: exit 0. `eslint services/lti-service/src`: exit 0.

### Round-1 findings

| Finding | Status | Evidence |
| --- | --- | --- |
| B-LA-E3-01-01 (MINOR) dense storage decision, no flow map | **Closed** | `profiles/storage.ts` has `storageBindingOf(trait, params, authEndpoint)`, with one comment per rule: "Rule 1: no trait means cookie-only; from-login reads the request …", "An absent or invalid request target counts as no target", "Rule 2: use the stored authentication endpoint origin, or the fixed origin …". `login.ts` now has one call (`:66`) and builds the page from the result. The frame-name grammar is one export, `FRAME_NAME`, and `profiles/schema.ts:18` uses it. The top of `storage-pages.ts` maps the flow: "login chooses the binding; the page posts lti.put_data; the state row keeps target and origin; the LA-E3-02 launch side reads platform storage only when the state cookie is missing." |
| B-LA-E3-01-02 (NIT) spy on `profileDefinition` | **Fixed** | `login.test.ts` builds `testProfileRegistry('Unit LMS', storage)`, passes it with `harness({ profiles: { simulation: false, registry } })`, and points the test platform at the `zz-admin` profile. The `vi.spyOn` is gone. `http/app.ts` takes an optional `profileRegistry` (RQ-2 seam), which LA-E3-02 can reuse. |
| B-LA-E3-01-03 (NIT) blank login page (A2) | **Fixed** (BD-A2-41) | The page shows the static `<p>Opening the activity. Please wait.</p>`, and `<noscript>This activity needs JavaScript. Turn on JavaScript in your browser, then open the activity again from your course.</noscript>`. Neither line holds a request value. Test: "shows the static waiting text and JavaScript help (BD-A2-41)". |
| B-LA-E3-01-04 (NIT) optional state fields | **Fixed** | `StateRecord.storageTarget` and `storageOrigin` are `string \| null`, required. The state test passes explicit `null` values ("stores and returns storage metadata or explicit nulls…"). |

### Note (not a finding)

`storageBindingOf` reads request parameters, but it lives in `profiles/` next to the profile schema, because it shares `FRAME_NAME` with it. That is fine. If the storage launch side (LA-E3-02) grows more request logic, an `lti/storage-binding.ts` that imports `FRAME_NAME` would keep `profiles/` to profile data only.

