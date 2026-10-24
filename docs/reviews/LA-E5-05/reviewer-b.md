Verdict: APPROVE
Round: 3

# LA-E5-05 review, Reviewer-B2 (lens: "Can a human team own it?")

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22). Diff: `git diff 9cbd043 8706619` limited to `services/lti-service/src/cli`, `infra/scripts/lti-bootstrap.sh`, `infra/scripts/lti-bootstrap.test.mjs`, `infra/scripts/stack-reset.sh` and `services/lti-service/src/http/routes/multi-lms.test.ts` (lane S1 commits `a1b8505`, `0fa5091`, `f0ce5bf`, `e809772`, `18fca25`, `736d4df`; the LA-E5-03 part of merge `8706619` is reviewed separately). Spec: `docs/architecture/ltiaas/tasks/LA-E5-05.md`. Design: LA-ADR-06 D3, D5, D7; operability §2, §6.2; BD-A2-14, -25, -33, -34. I did not open any reviewer-a file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 1 MINOR, 2 NIT.**

The CLIs are now thin API clients, and they read well:
- `cli/operator-client.ts` (53 lines) is the one place that reads the key file, finds the listener, sets a 10 s deadline and refuses redirects. It turns every failure into one stderr line without a stack or a credential (`cliError`).
- `bootstrap.ts` is a short sequence with one comment per design rule (BD-A2-25 keeps the stored URLs and name; BD-A2-33 is one `revokeOthers` call; BD-A2-14 removes the waiting key first; BD-A2-24 means the first key is already active).
- The stdout line keeps today's shape, and the wrapper keeps its flags and its "shown once" lines.
- The wrapper writes the operator-key copy atomically, deletes a stale copy when the original is missing, and `stack:reset` removes the copy.

The tests are good. `lti-bootstrap.test.mjs` runs the real shell wrapper with a fake `lib.sh` (no Docker), in a temporary path with spaces, and checks that the key never appears in a command line. `bootstrap.test.ts` runs against the real operator app, so every change is an audited request. My MINOR is about the one error line whose next step is wrong in one realistic case.

## How I checked

- Scratch clone of `8706619` (private `/tmp` folder, `--no-hardlinks`, `node_modules` copied; deleted after the run). `vitest run services/lti-service/src/cli services/lti-service/src/http/routes/multi-lms.test.ts`: **6 files, 160 tests passed**. `node --test infra/scripts/lti-bootstrap.test.mjs`: **4 of 4 passed**.
- I read every error path of the client, the two CLIs and the wrapper, and followed each "next step" text to see whether it fixes the case it names.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | `cli/bootstrap.ts`, `cli/shared-platform.ts`, `infra/scripts/lti-bootstrap.sh` (the "May edit" list), new `cli/operator-client.ts` and the tests. `stack-reset.sh` gets the one delete line that BD-A2-34 asks for. No change to `http/operator/**`, `seed.sh` or app files. `multi-lms.test.ts` moves its shared-platform setup to the operator endpoint (the test move named in the dispatch). OK. |
| Ownership | Lane S1, B2. OK. |
| No behaviour change outside the spec | The arguments, the JSON stdout line (`apiKey: null` when unchanged) and the wrapper lines stay. A bootstrap of an existing account changes only the name, and only with `--name` (BD-A2-25). OK. |
| No LMS name in core | None added. |
| Operator can run seed, rotation and shared-platform setup from the output | Yes for the normal paths, and for a missing original, an unreachable listener, a missing `PUBLIC_APP_URL`, an unknown account and a refused name. Not for a revoked or expired operator key; see B-LA-E5-05-01. |
| Tests a human can keep | Named cases. The wrapper test proves the security rules of BD-A2-34 (no key in argv, the stale copy deleted, one stderr line) without Docker. OK. |

## Findings

### B-LA-E5-05-01 — MINOR — For a revoked or expired operator key, the error tells the operator to run `npm run seed` again, and that does not fix it

- **File:** `services/lti-service/src/cli/operator-client.ts:15-16`, `:37`; `infra/scripts/lti-bootstrap.sh:46-51`.
- **Problem:**
  - A `401` from the operator API gives the same line as a missing or malformed file: "Operator key file /run/secrets/lti/lti-operator-key is missing, invalid or no longer accepted. Run npm run seed again."
  - Operator keys expire, and operators issue and revoke them through `POST /operator/v1/operator-keys` (LA-E5-01). So the key in `infra/.secrets/lti-operator-key` can be revoked or expired while another operator key is active.
  - In that case `npm run seed` runs `lti:operator init --if-none`, which answers "operator key exists". The wrapper then copies the same rejected key again, and the CLI prints the same line. The operator loops.
  - The line also names the container path, not the host file that the operator must change.
- **Evidence:** Wrapper `:46-51` handles only a missing original, and it copies any existing original at `:60`. The client maps every `401` to the one `keyError` text at `:37`, and the unit test asserts that text ("names a rejected operator key file and tells the operator to refresh the copy").
- **Suggested fix:** Give the `401` case its own line, for example: "The operator key in infra/.secrets/lti-operator-key (copied to /run/secrets/lti/lti-operator-key) is revoked or expired. Put the current operator key into that file, or run `lti:operator init --replace --name <you>` and save the printed key there; then run npm run seed again." Keep "Run npm run seed again" for a missing or malformed copy. Add one unit row for each case.

### B-LA-E5-05-02 — NIT — The CLI decides "active API key" by itself

- **File:** `services/lti-service/src/cli/bootstrap.ts:30`.
- **Problem:** The CLI filters the key list with its own rule (`revokedAt === null` and `expiresAt` later than the CLI's `Date.now()`). That rule belongs to the service (LA-E5-07). If the service adds a state (for example a key that is suspended with its account), or if the container clock differs, the CLI and the service disagree on whether to issue a key.
- **Suggested fix:** Use a state field from the list answer (for example an `active` boolean or a `status`, by RQ to the owner of the API-key routes), or a query such as `?active=true`. Until then, add a comment that names the service rule that this copy follows.

### B-LA-E5-05-03 — NIT — The missing-original recovery is a manual two-step command

- **File:** `infra/scripts/lti-bootstrap.sh:49`.
- **Problem:** The line tells the operator to run `docker compose exec lti-service npm run lti:operator -- init --replace --name <you>` and then "write the new key to that file" by hand. A manual copy of a secret is the step that most often goes wrong (a trailing space, the wrong file mode). The wrapper already has the safe write code for the `--if-none` case (`:42-45`).
- **Suggested fix:** Add a wrapper flag, for example `--replace-operator-key`, that runs `init --replace` and writes the key with the same atomic `umask 077` code. Name the flag in the error line.

## Not checked

- K1-SIM ACs (AC-01..08) on a running stack (QA).
- Lens-A items: the multi-call sequences (account, key, signing-key rotation) after a failure between steps, beyond the rotation-failure unit test.

## Round 2

Reviewer: Reviewer-B (same lens B). Verdict for this round: **APPROVE**. This round re-checks the round-1 findings against lane S1's fix round 1, commit `541e13e` (merged in `6ae0ebe`). I did not open any reviewer-a file. I did not run Docker.

Counts (this round): **0 BLOCKER, 0 MAJOR, 1 MINOR (new), 0 NIT.** All three round-1 findings are **closed** or **fixed**.

### How I checked

- Scratch clone of `6ae0ebe` (private `/tmp` folder, `--no-hardlinks`, `node_modules` copied; deleted after the run). `vitest run services/lti-service` (the CLI tests included): **76 files, 956 tests passed**. `node --test infra/scripts/lti-bootstrap.test.mjs infra/scripts/sim-hosts.test.mjs`: **42 of 42**.
- I followed each new error line to its next step. The command in the `401` line exists: `services/lti-service/package.json` maps `lti:bootstrap` to the wrapper, and the wrapper accepts `--account` and `--replace-operator-key` (`lti-bootstrap.sh:7`, `:19`, `:22`).

| Finding | Status | Evidence |
| --- | --- | --- |
| B-LA-E5-05-01 (MINOR) a revoked or expired key is told to "run npm run seed again" | **Closed** | `cli/operator-client.ts:39`: a `401` has its own line. It names the host file `infra/.secrets/lti-operator-key` and gives two real recovery paths. `:18`: a missing or malformed copy keeps "Run npm run seed again." Tests: `operator-client.test.ts:38` ("names the host file and a real recovery path when the server rejects the copied key") and `:47` (missing, malformed). |
| B-LA-E5-05-02 (NIT) the CLI decides "active API key" by itself | **Fixed** | `cli/bootstrap.ts:31`: "Mirrors store/api-keys.ts requireApiKeySlot(): not revoked and not expired (LA-ADR-06 D5)." That is the "until then" fix that I asked for. A state field from the service is still the better long-term fix. |
| B-LA-E5-05-03 (NIT) manual two-step recovery of a missing original | **Fixed** | `lti-bootstrap.sh:22`, `:34-35`: the new flag `--replace-operator-key` runs `init --replace`. `:48` writes the key with `umask 077`, `chmod 600` and an atomic `mv`. `:53` names the flag. Test `lti-bootstrap.test.mjs:94`: "explicit operator-key recovery saves both private files and does not pass the flag to bootstrap". |

Also good: `OperatorTransportError` (`operator-client.ts:11`) lets `bootstrap.ts:43` explain a lost answer during key issuance: "API key issuance or rotation may have committed. Run the same command again with --rotate-api-key to replace the unseen key."

### B-LA-E5-05-04 — MINOR — The new recovery text does not say that `--replace-operator-key` revokes every operator key

- **File:** `services/lti-service/src/cli/operator-client.ts:39` ("…or run npm run lti:bootstrap … --replace-operator-key (init --replace) to save a replacement safely."); `infra/scripts/lti-bootstrap.sh:7` ("revoke old operator keys"), `:53`.
- **Problem:**
  - `init --replace` "revokes every operator key and makes a new one" (`cli/operator.ts:7`). Its own refusal text says so too (`:58`).
  - The `401` case is the case from round 1 where other operator keys can still be active: one key is revoked or expired, but other operators hold valid keys.
  - The `401` line gives the revoke-all action as an equal second choice, and calls it "safely". "Safely" is about the file write, but the reader cannot tell that.
  - An operator who follows the line locks out every other operator and every script that holds an operator key.
  - The wrapper help says "old" keys, which a reader can take as "my old key".
- **Suggested fix:**
  - `401` line: "…Put the current operator key in host file infra/.secrets/lti-operator-key and run npm run seed. If no operator key is available any more, run npm run lti:bootstrap -w services/lti-service -- --account <id> --replace-operator-key. This revokes every operator key, also the keys of other operators."
  - Wrapper help `:7`: "revoke every operator key and save a replacement for OPERATOR_NAME". Add the same clause at `:53`.
  - Change the expected text in `operator-client.test.ts:38`.

## Round 3

Reviewer-B: Codex GPT-6-Astra xhigh, same lens B. Verdict: **APPROVE**. Reviewed `dc88b7d` against the task and round-2 finding B-LA-E5-05-04. Verification used a private `git clone --no-hardlinks` at `c2426eb`. No other reviewer's report was read; no Docker or stack was run.

Counts this round: **0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.** B-LA-E5-05-04 is **closed**.

- `services/lti-service/src/cli/operator-client.ts:39` now orders recovery correctly: use the current key, or ask another operator for a key; only when no operator has a working key should the user run `--replace-operator-key`. The text explicitly says this revokes every operator key, including other operators' and scripts' keys, and drops the misleading word `safely`.
- The wrapper header at `infra/scripts/lti-bootstrap.sh:7` and its missing-original refusal at `:55` give the same last-choice rule and consequence. No execution, key-storage or stdout behavior changed.
- The eight operator-client tests passed within the dispatch's **109-test** focused run. All **five** wrapper tests passed using the fake `lib.sh` transport, with no Docker invocation. Restoring the pre-fix client and wrapper in the private clone caused one expected failure in each suite; the new assertions pin the recovery order and revoke-all consequence. All mutations were restored. Root type checking and focused ESLint passed.
- The four-file diff stays within S1's client, wrapper and colocated tests. No forbidden endpoint, seed, app or QA-owned file changed; no LMS name or branch was added. This closes the text finding; live CLI/seed acceptance and regression evidence remain QA-owned as in earlier rounds.
