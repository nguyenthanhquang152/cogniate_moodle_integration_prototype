Verdict: APPROVE
Round: 1

# LA-E5-24 Reviewer A (lens: is it right and is it safe?)

Reviewer: Reviewer-A (Claude Opus 5.5 xhigh), 2026-10-23 (UTC). Scope: `git diff fa3ecc6a^ 29636fae -- tests/e2e/ltiaas docs/reviews/LA-E5-24` (QA-E2E rounds 1-2). I read the four drill files in full, the spec `docs/architecture/ltiaas/tasks/LA-E5-24.md`, `operability.md` §7.2 and §7.3, `qa.md`, and the teardown in `tests/host/core.mjs`. I did not open `reviewer-b.md`. I did not start Docker, a stack or the drill.

## Round 1

### Summary

The drill proves ACs 01-06. Private evidence is owner-only. The drill touches only its own compose project. The r2 fix in the container step is correct, and it makes the check stronger. I found 0 BLOCKER, 0 MAJOR, 0 MINOR and 4 NIT.

### What I checked

| Area | Result | Evidence |
| --- | --- | --- |
| AC-01 | OK | `run-la-e5-24.mjs:431-445`: `stack:down` (never `stack:reset`), then `stack:data-backup -- --out <drillRoot>/db`. `drillRoot` is a `mkdtemp` sibling of the clone (line 388), so it is outside the checkout. `inspectDrillBackup` calls `validateStackBackup` and checks the manifest fields, the size and sha256 of each DB, and the migrations. |
| AC-02 | OK | The record comes from a whitelist (`buildBackupRecord`). `versionIds` come from `GET /operator/v1/key-provider`. The scan covers `backup-record.json` and `manifest.json`. The candidates include `LTI_MASTER_KEY`, `APP_MASTER_KEY`, the operator key and the API key files. The scan also uses 4 patterns. See A-LA-E5-24-02 for the gaps. |
| AC-03 | OK | The marker `drill-<runId>` gets `201`, and the list before the restore shows it. |
| AC-04 | OK | Same clone, same project, `stack:down`, then content restore, then `stack:data-restore -- --from`. The host waits for LTI `/readyz` `ready` and app `/healthz` `ok` (lines 366-380). The container step checks the public and operator readiness of both services (container-step:197-211). The marker is absent from the list, and the direct GET gives `404` (container-step:364-371). |
| AC-05 | OK | A full OIDC launch goes to `/play/ply_…` and then to the player shell. The step then fetches the runtime page, the runtime state and the restored package HTML, with `data-cog-quiz="q0"`. The step commits 9 of 10 answers. A score record of 90/100, `Completed`, `FullyGraded`, appears after a fresh simulator cursor (container-step:374-376). The portal sync shows `sent`. |
| AC-06 | OK | RPO = restore start − manifest `createdAt`. RTO = restore start (before `stack:down`) to LTI and app ready, which is a conservative window. The backup folder is removed (line 575 and in `finally`, line 594). TEARDOWN removes the project. |
| r2 fix (container-step:448-460) | Correct, stronger | The old code asked for `q0` in the `/rt/:token` page, but that page is only the iframe wrapper. The new code keeps both old assertions (status 200 and `q0`) and moves the `q0` check to the package entry `${PUBLIC_CONTENT_URL}${packageBaseUrl}${launchPath}`. It also adds a check for the `id="cogniate-package"` iframe. No check became weaker. |
| Code that ran in r2 | Equal to 29636fae | In `r2/clone-r2`, the staged helpers have sha256 `d1057bda…` (container step) and `ab5cbf98…` (drill lib). These values are the same as the blobs at 29636fae. The r1 clone has the old container step (`d60b6a9b…`, the same as 56038618), which agrees with the r1 ERROR. |
| Owner-only evidence | OK | `drillRoot` is born 0700 (`mkdtemp`). The record is written with mode 0600. Every file in the r1 and r2 artifacts is 0600, and every folder is 0700. `captured-secrets.jsonl` is 0600. No `qa-la-e5-24-backup-*` folder remains. `infra/.data/backups` in the clone is empty. |
| Secrets in logs and git | 0 hits | I ran my own scan (counts only) with all 22 secret values of the r2 clone: all `.env` secrets, including `DB_PASS`, the secret files, the two Moodle WS tokens in `seed.json`, and the 8 captured values. I scanned 124 files (27.8 MB): r1 and r2 artifacts, `boundary/` (including the 23 MB `host-ps-watcher.log`), both stdout logs, the clone state JSON files and `qa.md`. Result: 0 hits. With the 19 values of the r1 clone, the only hits were in the 0600 source file `captured-secrets.jsonl` itself. The committed diff has 0 matches for `ltio_`/`ltis_` keys, PEM private keys, session cookies or JWTs. |
| Project scope | OK | The drill calls only `npm run stack:*` and `dc --profile test run --rm --name "$COMPOSE_PROJECT_NAME-qa-e524-…"`. It calls no `docker volume rm` and no `stack:reset`. TEARDOWN (`core.mjs:378-415`) removes only ledger-recorded lane resources whose fresh inspect matches. QA boundary records show a 0-byte diff on the 32 protected volumes, and the foreign `sto-it-*` containers were not touched. |
| Host self-test | 5/5 PASS | Fresh private clone at 29636fae, Node 24.21.0, umask 022, inside a 0700 temp folder in the user's `$TMPDIR` (group `staff`): `node --test tests/e2e/ltiaas/la-e5-24-drill.selftest.mjs` gives 5 pass, 0 fail. See A-LA-E5-24-04 for a temp-folder trap. |

### Findings

**A-LA-E5-24-01 (NIT): `qa.md` does not record which helper bytes ran in r2.**
- File: `tests/e2e/ltiaas/run-la-e5-24.mjs:396-401`; `docs/reviews/LA-E5-24/qa.md` header ("Commit verified: 56038618").
- Problem: The runner copies `la-e5-24-drill.mjs` and `la-e5-24-container-step.mjs` from its own folder into the clone. In r2, the clone was at 56038618, which has the old container step. The fixed step came from the la-qa working tree. That fix was committed only after the run (`4ec50888` at 20:42Z, and r2 ran 20:36-20:38Z). `qa.md` and `summary.json` record no hash for the staged files. A later reader cannot prove from the evidence which code ran.
- Evidence: I compared the files in `r2/clone-r2/tests/e2e/ltiaas/` with the blobs at 29636fae, and they are equal (hashes in the table above). The result is correct, but only a manual check shows it.
- Suggested fix: In the runner, write the sha256 of each staged helper (and `git rev-parse HEAD` of the runner folder, with a dirty flag) to `summary.json`. In `qa.md`, name the commit that holds the helper code that ran.

**A-LA-E5-24-02 (NIT): The secret-scan candidate list leaves out some live secrets.**
- File: `tests/e2e/ltiaas/run-la-e5-24.mjs:346` and `:355`.
- Problem: `loadCapturedSecrets` skips every `.json` file in `infra/.secrets`, so the two Moodle WS tokens in `seed.json` are not candidates. The env filter `/KEY|SECRET|PASSWORD|TOKEN/i` does not match `DB_PASS`. The same list also feeds `r.redact`.
- Evidence: The r2 clone has 22 distinct secret values, and the drill scan used 12 (`qa.md` AC-02). All key material is in the list (both master keys, the operator key and the API keys). Because of this, and because the record comes from a whitelist, AC-02 is still proven. My full 22-value scan found 0 hits.
- Suggested fix: Parse the `.json` files and add the string leaves under `password`, `token`, `secret` or `key` names. Add `PASS` to the env filter.

**A-LA-E5-24-03 (NIT): The raw `playId` capability is in logs, evidence and git.**
- File: `tests/e2e/ltiaas/la-e5-24-container-step.mjs:439-446` and `:544`; `run-la-e5-24.mjs:569`; `qa.md` AC-05 rows (`ply_x1h--mMDfTIq3vpfDXp-5Q`).
- Problem: The step sends `GET /play/<playId>` with no cookie, and the response gives the runtime URL and token (container-step:441-445). So the `playId` alone opens the player. The step treats the runtime token as a secret (`rememberSecret('runtime_token')`, line 446), but it writes the `playId` that gives that token in clear text. The clone state files are also 0644, but they are inside 0700 folders.
- Evidence: The value is dead because the drill project is removed (TEARDOWN PASS). The risk is low and applies only to test data.
- Suggested fix: Call `rememberSecret('play_id', playId)` and record only a short hash or a `ply_…` prefix in the AC-05 note and in `la-e5-24-post-restore.json`.

**A-LA-E5-24-04 (NIT): The self-test fails when the temp folder group is not the process group.**
- File: `tests/e2e/ltiaas/la-e5-24-drill.selftest.mjs:89`.
- Problem: `ids = { uid: process.getuid(), gid: process.getgid() }`, and `stack-data.mjs` `unpreparedItems` compares the gid of each folder with this gid. On macOS, a new folder gets the group of its parent folder. With `TMPDIR` under `/tmp` (group `wheel`), 2 of 5 tests fail with `backup_source_not_ok:owner_mismatch`. The same tests pass under the default `$TMPDIR` (group `staff`).
- Evidence: My first run with `TMPDIR=/tmp/…` gave 3 pass and 2 fail (AC-01, AC-03/04). The second run with a `$TMPDIR` subfolder gave 5/5.
- Suggested fix: Take `ids` from `fs.statSync(rootDir)` after `mkdtemp`, or `chown` the synthetic folders to `process.getgid()`. As an alternative, document the needed temp folder in the file header.

### Note for A2 and Lead (no finding)

The backup record lists only the LTI key ring (`GET /operator/v1/key-provider`). It does not list the app key ring from LA-E5-22. `operability.md` §7.2 step 5 and AC-02 name only the LTI endpoint, so the drill meets the spec. If the pilot runbook must restore both rings, the architect should add the app ring to §7.2. Also, `r2/dry-run-check/` is 0755 and 0644, but it is inside the 0700 `r2/` folder and holds only synthetic dry-run data.
