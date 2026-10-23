Verdict: APPROVE
Round: 2

# LA-E3-02 review, Reviewer-B2 (lens: "Can a human team own it?")

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22). Diff: `git diff d3c4848^1 d3c4848` (the merge of lane L for LA-E3-02). Spec: `docs/architecture/ltiaas/tasks/LA-E3-02.md`. Design: LA-ADR-05 D1 rules 1a and 5–11; contract delta §1.5, §2.2; BD-A1-33, BD-A1-34. I did not open any reviewer-a file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 1 MINOR, 2 NIT.**

The storage check is easy to follow in the code:
- `handleLaunch` sets one flag, `useStorage`, only for a missing cookie with a stored target. A mismatched cookie still fails, and a comment says so.
- Both bindings finish in one function, `completeLaunch`, so the storage path cannot make a different ltik or redirect.
- The store says what it keeps ("Only checked, minimized launch data reaches this store. No id_token or raw state is stored.").
- `consumeStorageCheck` checks account, time and single use in the one `UPDATE … RETURNING`.
- The route keeps the documented order (account, Origin, consume, compare).
- The Canvas value is one line on the shared Canvas base, with its rule reference, so all five Canvas profiles get it. Another channel's author can copy that line and read the trait comment in the kernel `ProfileSource`.

The route tests cover the order: a wrong Origin leaves the check usable, a mismatch uses it up, an empty value gives the help text, the 121 s expiry, the account gate before the Origin, the cookie path unchanged, a bad signature before any storage check, and the `405`. My MINOR is about the two page scripts, which are two copies of the same untyped `postMessage` handshake.

## How I checked

- Scratch clone of `d3c4848` (private `/tmp` folder, `--no-hardlinks`, `node_modules` copied; deleted after the run). `vitest run services/lti-service/src`: **68 files, 839 tests passed**. `F1 PASS`; `F5 PASS: 3 rules …, 0 hits` (migration `015` passes `sql-portability`).
- I read the two scripts side by side, and I mapped the UNIT AC and the design notes to their tests.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | `lti/launch.ts`, `http/routes/protocol.ts` (launch and storage-check wiring), `lti/storage-pages.ts`, new `store/storage-checks.ts`, migration `015`, `packages/channels/canvas/lti-profiles.ts` (the trait value only). No change to `http/app.ts`, `http/auth.ts`, manifests, `app.ts`, `lti-generic`, app files or `store/retention.ts`. `lti/codes.ts` gets the protocol page code `TOOL_ACCOUNT_SUSPENDED` with the contract delta text. The spec allows `codes.ts` in B2 for "new detail values only", but the scope needs this page code (a suspended account gives the `403` page), so the Lead records it. |
| Ownership | Lane L, B2. The retention call and the `storageValue` redaction are S1's RQ-1 lines (not in this diff). |
| No behaviour change outside the spec | With a cookie, the launch is today's (AC-10 route test). Without a cookie and without a stored target, the launch still gives `STATE_COOKIE_MISSING` with the old help. LA-IC-06 (the Canvas trait value) is the intended change. OK. |
| No LMS name in core | F1 passes. The help text has no LMS name. |
| UNIT AC | AC-04: `store/storage-checks.test.ts` (expiry at 120 s and the 121 s case; cleanup keeps the boundary and newer rows, used or unused) plus the route test with a controlled clock. The design-note `405` has its own route test. The old tree has no table or route, so the tests fail there. OK. |
| A newcomer adds a channel's storage values | Yes, from the trait alone: `{ targetFrame: 'from-login' \| <frame>, origin: 'authOrigin' \| <https origin> }`. Both members are documented in the kernel `ProfileSource` and checked by the schema. |

## Findings

### B-LA-E3-02-01 — MINOR — The login page and the check page carry two copies of the same `postMessage` handshake as untyped script strings

- **File:** `services/lti-service/src/lti/storage-pages.ts:16-44` (`LOGIN_SCRIPT`), `:78-116` (`CHECK_SCRIPT`).
- **Problem:** Both scripts repeat the same parts:
  - the frame lookup (`_parent` or `window.parent.frames[…]`);
  - the reply filter of rule 9 (origin, subject, `message_id`, no `error`, an object);
  - the 1.5 s timer and the run-once `finish` guard;
  - the top-level skip.

  Only the message subject and the finish action differ. The scripts are template strings, so neither the typecheck nor lint reads them. A change to the reply rules (for example a new `error` shape in the LTI client-side storage spec) must be made twice by hand, and a missed copy changes one page only.
- **Evidence:** `:34` and `:104` hold the same filter, apart from the subject (`lti.put_data.response` against `lti.get_data.response`) and one more check (`typeof reply.value === 'string'`). `:38` and `:110` hold the same timer, `:40` and `:112` the same frame lookup. The fake-window tests run both scripts, so behaviour is covered today, but nothing ties the two copies together.
- **Suggested fix:** Build both scripts from one handshake function, for example `storageHandshake({ request: 'lti.put_data' | 'lti.get_data', onReply, onTimeout })` that returns the script text, or one script that reads a `mode` field from the JSON block. Keep the two fake-window test suites as they are; they then test one implementation through two pages.

### B-LA-E3-02-02 — NIT — The storage flow is now complete, but it still has no map

- **File:** `services/lti-service/src/lti/storage-pages.ts:1`; `services/lti-service/src/lti/launch.ts:84`, `:130`; see B-LA-E3-01-01.
- **Problem:** With this task the flow spans six files:
  - `login.ts` decides the target;
  - `storage-pages.ts` builds the two pages;
  - `store/states.ts` keeps the target and the origin;
  - `launch.ts` falls back and builds the check;
  - `store/storage-checks.ts` keeps the prepared launch;
  - `routes/protocol.ts` wires the route.

  Each function has a good local comment, but no place gives the order.
- **Suggested fix:** One header comment, in `storage-pages.ts` or `launch.ts`, listing the steps with their rule numbers: login decides (rules 1–3), launch without cookie checks the token and stores a single-use check (rules 5–6), the page reads storage (rules 7, 9), the check route gates and compares (rule 8), and both bindings finish in `completeLaunch`. This also closes B-LA-E3-01-01's flow note.

### B-LA-E3-02-03 — NIT — The shared account gate lives in `launch.ts` and needs a non-null assertion

- **File:** `services/lti-service/src/lti/launch.ts:68` (`protocolAccountError`, "shared with the later protocol call-site task LA-E5-06"), `:102` (`account!`).
- **Problem:** The login, launch and storage-check routes (and LA-E5-06) all need the protocol account gate. Today it sits in `launch.ts`, so `login.ts` will have to import it from the launch module. Its return value does not narrow `account`, so the storage-check path ends with `account!`.
- **Suggested fix:** Move it to a small `lti/account-gate.ts`. Make it return `{ ok: true; account } | { ok: false; code }`, so the caller gets a narrowed `account` and needs no `!`.

## Not checked

- K1-SIM ACs (AC-01..03, -05..07, -10..12) and the K2 browser cases AC-08 and AC-09 (QA, QA-E2E). The LA-IC-06 test-change list (QA).
- Lens-A items: the CSP, `Referrer-Policy` and the Origin rule beyond the unit rows; whether the prepared launch can grow too large.

## Round 2

Reviewer: Codex GPT-6-Astra, xhigh, 2026-10-23. Lens B: can a human team own it? Scope: CSP fix `2ea1f624` (merge `02f5d420`), tested at `6ee79282dbf2c353791fb254f8cc00c293f66e72`. Read the prior B review, task spec, BD-A2-103, LA-ADR-05 D1 rule 7, security delta §5, and QA-E2E P3. No Reviewer-A file was opened.

**APPROVE. No new findings.** Earlier non-blocking notes are outside this focused fix.

The reason for the extra origin is clear at `lti/storage-pages.ts:83`: the form submission's redirect chain must reach the tool. The comment names BD-A2-103, whose row links to the ADR, security header table, and live failure. `toolUrlOf` in `lti/launch.ts:85` gives the page and redirect one URL-selection rule. The origin guard has a short documented fallback, and the tool URL is removed before building the page's JSON data.

The three cases at `lti/storage-check.test.ts:74` are easy to find by decision id. They use distinct resource-link and Deep Linking origins, plus a second account's operator-set URL, and compare the complete CSP and resulting redirect origin. The page tests cover origin normalization, ports, rejected origin forms, nonce freshness, and existing data escaping. Restoring only the old `form-action 'self'` header in the private clone caused all three cases and the page-header test to fail with assertion errors; the mutation was restored.

Verification: fresh private clone `/tmp/la-review-b-ce92e43aeb32`, its own `npm ci`, and Vitest cache deletion before each run. **48 tests passed in five files**: storage check, storage pages, launch, protocol routes, and storage-check store. This includes the existing UNIT expiry/cleanup criterion and the method-refusal regression. LTI typecheck, lint on all four changed files, F1, and whitespace checks passed. The private clone is clean.

The four-file diff fits the specific lane-L fix routed by BD-A2-103. Protected files and other page policies are unchanged; no core LMS name was added. The remaining acceptance step is QA-E2E's live `U4.platform-storage.positive` rerun (AC-08). No Docker, stack, or commit was used. Only this review file changed in integration.
