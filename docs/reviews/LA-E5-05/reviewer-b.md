Verdict: APPROVE
Round: 1

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
