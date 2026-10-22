# Operator guide: Canvas and Blackboard bindings

Draft basis: `82aff91`, 2026-10-22. Candidate under validation: C4 `bf09cda`. Status: **draft**. Final source stamp, evidence and approval are pending.

This guide is for Cogniate staff with shell access to the Cogniate app service and the LTI service. Design: [ADR-011](../architecture/adr/ADR-011-multi-lms.md) §4a, §4b and §14, and [ADR-012](../architecture/adr/ADR-012-sqlite-volume-storage.md).

Tags: each step names its evidence label, for example `[SIM AC-M1-38]`. The [evidence table](../../README.md#evidence-labels) gives the status of each label.

Run `app:grant`, `app:binding` and `lti:shared-platform` inside their service container, from `/repo`. Run `lti:bootstrap` and every `stack:*` command on the host, in the repository folder.

Run these Compose examples on the host, in the repository folder. Replace `<project-name>` with the `COMPOSE_PROJECT_NAME` value from the root `.env`.

```sh
docker compose --project-directory infra -p "<project-name>" -f infra/compose.yaml --env-file .env exec -T --workdir /repo cogniate-app npm run app:grant -w services/cogniate-app -- list --connection <con_id>
docker compose --project-directory infra -p "<project-name>" -f infra/compose.yaml --env-file .env exec -T --workdir /repo lti-service npm run lti:shared-platform -w services/lti-service -- --account cogniate --profile blackboard --client-id <Application ID>
```

M1 CLI QA uses `exec -T --workdir /repo` with these npm workspace selectors ([QA helper](../../tests/host/m1-control.mjs), [CLI repair record](../reviews/M1/qa.md)) [SIM AC-M1-28, AC-M1-38]. The [Compose helper](../../infra/scripts/lib.sh) supplies the project and file flags. The [bootstrap wrapper](../../infra/scripts/lti-bootstrap.sh) runs on the host.

NOTE: The commands are not reachable over HTTP. Who may run them is a human decision (Q22, [decisions](../human_review/decisions-needed.md#e-canvas-and-blackboard-decisions)).

## 1. Blackboard: one-time setup for each LTI service host

Blackboard needs one Cogniate application in the Blackboard Developer Portal. All schools use it. Making a Developer Portal account is a third-party sign-up, so it needs product owner permission (blocker B-2).

1. Register one application for the host of `PUBLIC_LTI_URL` `[DOC F-BB-10; L-B01 UNVERIFIED]`. Not yet tested on a real Blackboard site.
2. Enter these values `[DOC F-BB-10, F-BB-11; L-B01 UNVERIFIED]`. Not yet tested on a real Blackboard site.

   | Field | Value |
   | --- | --- |
   | Domain | the host of `PUBLIC_LTI_URL` |
   | Login initiation URL | `{PUBLIC_LTI_URL}/lti/login/cogniate` |
   | Tool redirect URL (one only) | `{PUBLIC_LTI_URL}/lti/launch/cogniate` |
   | Tool JWKS URL | `{PUBLIC_LTI_URL}/lti/keys/cogniate` |
   | Signing algorithm | RS256 |
   | Placement | name "Cogniate", type Deep Linking, Target Link URI `{PUBLIC_LTI_URL}/lti/launch/cogniate`, "Allow student access" off |

3. Copy the Application ID that the Developer Portal issues `[DOC F-BB-2; L-B01 UNVERIFIED]`. Not yet tested on a real Blackboard site.
4. Run `lti:shared-platform` with that Application ID (command above) `[SIM M1-06.blackboard.cli; L-B02 UNVERIFIED]`. Not yet tested on a real Blackboard site.

Result: the command prints `{platformId, created}`. The same client ID again changes nothing. Another client ID exits 1 [SIM M1-06.blackboard.cli]. The Blackboard card in the portal then allows "Connect" [SIM AC-M2-02].

NOTE: Use only this one Target Link URI. The login and the launch accept no other path. "Allow student access" off applies to the teacher picker only. Learners open the course items that Deep Linking makes.

NOTE: Learn fetches the JWKS URL, so the LTI service needs public HTTPS (blocker B-3, [F-BB-13](../research/multi-lms.md#3-blackboard-facts)). Two applications cannot share one host. So only the tool account `cogniate` can use Blackboard on a host (D-6).

## 2. Approval grants

Client IDs and deployment IDs are not secrets. A grant is your approval of one exact binding. Issue a grant only after an out-of-band check.

### 2.1 Check the request

1. Get the request from the institution's LMS admin through a channel that you can tie to the institution `[PROCESS Q22]`.
2. Match the library, the connection, the site URL, the Canvas service URL, the client ID and the deployment ID `[PROCESS Q22]`.
3. Write an evidence reference for the note, for example a ticket number. Do not put the approval code in it `[PROCESS Q22]`.

NOTE: The exact evidence policy is a human decision (Q22). Operator error and social engineering stay residual risks (R-M-03). Section 3 limits their damage.

### 2.2 Issue the code

```sh
npm run app:grant -w services/cogniate-app -- issue --library <lib_id> --connection <con_id> \
  --site <origin> [--service-url <origin>] --client-id <id> --deployment-id <id> \
  [--purpose initial|add_deployment] [--ttl-seconds 86400] --note "<evidence reference>"
```

1. Run `issue` with the values from the request `[SIM AC-M1-28]`.
2. Read the printed library name, connection name, profile and values `[SIM AC-M1-28]`.
3. If one value is wrong, do not give the code. Revoke the grant (section 2.3) `[SIM AC-M1-29]`.
4. Give the approval code to the library user through a private channel `[SIM AC-M1-28]`.

The code shows only once. It has 43 characters and works once. It expires after 24 hours by default; `--ttl-seconds` allows 60 seconds to 7 days [SIM AC-M1-28, AC-M1-29].

| Rule | Evidence |
| --- | --- |
| `issue` refuses a value that differs from the connection (library, site, Canvas service URL, Blackboard client ID). It exits 1 and stores nothing. | `[SIM AC-M1-29]` |
| A Blackboard connection that holds a deployment ID refuses a grant for another deployment ID. | `[SIM AC-M1-29]` |
| A new grant for the same connection and purpose revokes the older unused grant. | `[SIM M1-28.blackboard.replacement]` |
| A Canvas second deployment uses `--purpose add_deployment` on a registered connection. | `[SIM AC-M1-20]` |
| A Moodle connection gets no grant. `issue` exits 1. | `[SIM AC-M1-21]` |

### 2.3 List and revoke

1. From `/repo` inside `cogniate-app`, run `npm run app:grant -w services/cogniate-app -- list --connection <con_id>` `[SIM AC-M1-28]`.
2. In the same folder, run `npm run app:grant -w services/cogniate-app -- revoke --grant <grt_id>` to stop that unused code `[SIM AC-M1-29]`.
3. Read one line per record: `fenced`, `absent`, `not_owned` or `failed` `[SIM M1-37.canvas.m, M1-37.blackboard.m]`.
4. If a line is `failed`, run the same `revoke` again `[SIM M1-37.canvas.m, M1-37.blackboard.m]`.

States in `list`: `issued`, `redeeming`, `redeemed`, `expired`, `revoked`. The list never shows the code [SIM AC-M1-28].

`revoke` also switches off what that grant's attempts made without an approval [SIM M1-37.canvas.e, M1-37.canvas.p-create].

If a redemption is running, `revoke` makes no LTI call. It says that the running redemption cancels and switches off its own record. Run `revoke` again after 60 seconds to check [SIM M1-37.canvas.e].

A redeemed grant cannot be revoked. Use `app:binding suspend` (section 3) [SIM AC-M1-29].

## 3. Contain and correct a binding

Use this when a wrong library got a binding, or a site or service URL is wrong. It is not a transfer. Publications, resource links, attempts and grades never move to another library [SIM M1-38.canvas.e, M1-38.blackboard.e].

```sh
npm run app:binding -w services/cogniate-app -- suspend --connection <con_id> --note "<evidence reference>"
npm run app:binding -w services/cogniate-app -- release --connection <con_id> --note "<evidence reference>"
```

Always run `suspend` before `release`. `release` on an active binding exits 1 and changes nothing [SIM M1-38.canvas.b, M1-38.blackboard.b].

Self-hosted Canvas: use the order of [section 3a](#3a-accepted-limit-d-12-self-hosted-canvas-after-a-release). The library makes the new connection first. Issue its grant before you suspend and release `[SIM M1-39.canvas.operator-order]`.

1. Run `suspend`. It needs no library session `[SIM M1-38.canvas.a, M1-38.blackboard.a]`.
2. Read one line per record. If a line is `failed`, run `suspend` again `[SIM AC-M1-38]`.
3. Run `release` `[SIM M1-38.canvas.b, M1-38.blackboard.b]`.
4. Read one line per record. If a line is `failed`, run `suspend` and `release` again `[SIM M1-38.canvas.f-held-delete]`.
5. Issue a new grant for the rightful connection (section 2) `[SIM AC-M1-38]`.

If `release` says "a redemption may still run; retry after <n> s", wait that time, then run it again [SIM M1-37.blackboard.o].

| Line | Meaning | Evidence |
| --- | --- | --- |
| `fenced` | The command switched off a record of this connection, with a new binding ref. | `[SIM M1-38.canvas.a, M1-38.blackboard.a]` |
| `absent` | No record exists. Nothing to do. | `[SIM M1-38.blackboard.g-absent]` |
| `not_owned` | The record belongs to another or newer binding. It stays unchanged. | `[SIM M1-38.blackboard.c]` |
| `deleted` | A Canvas or Moodle `release` deleted the switched-off platform, with its keys. Its client ID is free again. | `[SIM M1-38.canvas.b, M1-38.canvas.f, M1-39.canvas.residual-race]` |
| `kept_inactive` | Blackboard `release` keeps the switched-off deployment. The next binding gets a new generation, so old keys fail. | `[SIM M1-38.blackboard.b, M1-38.blackboard.c]` |
| `failed` | An LTI call failed or timed out. Nothing local changed. Run the command again. | `[SIM M1-38.canvas.f-held-delete]` |

Effects:

- `suspend` sets the connection to `disabled` and revokes its unused grants. A due grade row then fails with `CONNECTION_DISABLED`, without a send [SIM M1-38.canvas.a, M1-38.blackboard.a].
- `release` deletes only this connection's reservation and approvals. The connection keeps its history [SIM M1-38.canvas.b, M1-38.blackboard.b].
- Teacher items of the old connection then show "This course is not available". Teachers add the course again under the new connection [SIM M1-38.blackboard.c].

NOTE: A late record can appear after a cleanup that found nothing. A delayed request of an old attempt can still arrive. It makes only an inactive record without authority. Run the same `suspend` or `release` again: it finds the record through the saved target [SIM M1-38.blackboard.g-absent, M1-38.canvas.g-late-create].

NOTE: To correct a Canvas site or service URL, you do not need a new developer key. For self-hosted Canvas, follow [section 3a](#3a-accepted-limit-d-12-self-hosted-canvas-after-a-release), with the grant first [SIM M1-39.canvas.operator-order]. For hosted Canvas, suspend and release the old binding. Then the library makes a new connection with the right values. It redeems a new grant for the same client ID [SIM M1-38.canvas.f; AC-M1-38].

### 3a. Accepted limit D-12: self-hosted Canvas after a release

A new Canvas or Blackboard binding always needs a grant. A Moodle manual connect does not. So after a release, another signed-in library can make a Moodle connection with the freed self-hosted Canvas issuer and client ID first [SIM M1-39.canvas.residual-race].

- Scope: only `canvas-self-hosted`. Hosted Canvas and Blackboard issuers are reserved, so a Moodle connect with them gets `ISSUER_RESERVED` [SIM AC-M1-03].
- Impact: it can block setup. The rightful redemption then gets `PLATFORM_IN_USE`. It gives no Canvas access, because launch check 14 refuses Canvas-signed launches before storage [SIM M1-39.canvas.squat-refused].

Operator order:

Before you issue the grant, the rightful library makes a new connection with the correct values `[SIM M1-39.canvas.operator-order]`.

1. Issue the rightful grant `[SIM M1-39.canvas.operator-order]`.
2. Suspend the old binding `[SIM M1-39.canvas.operator-order]`.
3. Release the old binding `[SIM M1-39.canvas.operator-order]`.
4. Ask the rightful library to redeem the code at once `[SIM M1-39.canvas.operator-order]`.

This order makes the window short. It does not close it. Prompt redemption narrows the window but cannot prevent the race.

If the race happens, suspend and release the new Moodle connection. The unused code stays valid until it expires. Ask the rightful library to redeem that same code at once after the release [SIM M1-39.canvas.residual-race].

WARNING: An enterprise service must not rely on this workflow before a reserved-identifier or quarantine design exists (D-12, [deferred](../human_review/deferred.md#a-m0-10-d-12-residual-race-after-a-release)).

## 4. Upgrade and rollback

The full sequences are in [ADR-011 §14](../architecture/adr/ADR-011-multi-lms.md#14-compatibility-migration-upgrade-and-rollback). QA ran them on the local Moodle stack [MOODLE-LIVE AC-M1-23, AC-M1-30]. Use the same checkout, compose project, `.env`, keys and data.

### 4.1 Upgrade

1. Stop the Cogniate app and the LTI service with the old revision (`npm run stack:down`) `[MOODLE-LIVE AC-M1-23]`.
2. Make sure that both containers are stopped `[MOODLE-LIVE AC-M1-23]`.
3. Switch the checkout to the new revision. Keep both services stopped `[MOODLE-LIVE AC-M1-23]`.
4. If the storage override was on, run `npm run stack:storage-compat -- disable` `[MOODLE-LIVE AC-M1-23]`.
5. Install and build (`npm ci`, then `npm run build`). Do not start a service `[MOODLE-LIVE AC-M1-23]`.
6. Run `npm run stack:data-backup -- --out <folder outside the checkout>` `[MOODLE-LIVE AC-M1-23]`.
7. Make sure that the command exits 0. It refuses while a service runs `[MOODLE-LIVE AC-M1-23]`.
8. Run `npm run stack:up` `[MOODLE-LIVE AC-M1-23]`.

WARNING: The backup folder contains secrets. Keep it outside the checkout and outside shared evidence.

### 4.2 Rollback

1. Stop the Cogniate app and the LTI service (`npm run stack:down`). Keep the new revision checked out `[MOODLE-LIVE AC-M1-30]`.
2. Run `npm run stack:data-restore -- --from <backup folder>` `[MOODLE-LIVE AC-M1-30]`.
3. Make sure that it exits 0. A damaged backup gives exit 1 and changes nothing `[MOODLE-LIVE AC-M1-30]`.
4. Run `npm run stack:storage-compat -- enable` `[MOODLE-LIVE AC-M1-30]`.
5. Switch the checkout to the old revision. Install and build it (`npm ci`, then `npm run build`) `[MOODLE-LIVE AC-M1-30]`.
6. Start it with `bash .tmp/storage-compat/storage-compat.sh run -- npm run stack:up` `[MOODLE-LIVE AC-M1-30]`.

If a check of step 6 fails, stop. Do not use the old build.

WARNING: Rollback loses every Cogniate write after the backup. This includes connections, grants, launches, attempts, grade rows and publication changes. Revocations and suspensions after the backup are also undone: a revoked approval code is valid again until it expires. After the rollback, revoke and suspend them again.

WARNING: Canvas and Blackboard records made after the upgrade stay configured in the LMS. Their launches fail with `UNKNOWN_PLATFORM` after the restore. This consequence is unmeasured ([ADR-011 §14](../architecture/adr/ADR-011-multi-lms.md#14-compatibility-migration-upgrade-and-rollback)).

QA saw the lost attempt and the kept Moodle grade after a rollback [MOODLE-LIVE AC-M1-30]. The other losses and the launch consequence follow from the same restore ([ADR-011 §14](../architecture/adr/ADR-011-multi-lms.md#14-compatibility-migration-upgrade-and-rollback)). No QA case checked them one by one.

While the override is on (rollback mode):

- Restart only with old `npm run stack:down`, then the `storage-compat.sh run --` command above.
- Do not use old `stack:restart`, `stack:reset`, `e2e:reset`, `test:e2e`, `demo`, `demo:prepare`, `demo:users` or `demo:browser`.
- Never type `docker compose up`, `create`, `run`, `start` or `restart` by hand.
- The next upgrade starts again at section 4.1, step 1.

NOTE: An `enable` keeps a copy of the lock helper. A copy made before a helper repair stays old until you run `disable` and then `enable` from the repaired revision.

WARNING: Never use `npm run stack:reset` as a recovery step. It deletes the content folders, the legacy files, the backups and the Moodle volumes. The non-destructive exit is `npm run stack:data-quarantine -- --out <folder>` (ADR-012 §9).

### 4.3 Storage lock messages

Every storage command takes one lock per checkout. The first three messages are refusals: they change no data [HOST-QA; SIM AC-M1-41 lock rows]. `storage_lock_lost` is not a refusal: your command ran, and it can have changed data ([ADR-012 §7](../architecture/adr/ADR-012-sqlite-volume-storage.md#7-guarded-paths-and-the-operation-lock)).

| Message | Do this |
| --- | --- |
| `operation_in_progress` | Another storage command holds the lock. Wait for it, then run your command again. |
| `storage_writer_active` | A storage container still runs. Wait until it ends, or run `docker stop <name>`. |
| `operation_lock_invalid` | The message says "Follow the manual exit of the operator guide". In this prototype the manual exit is: stop and escalate. No validated manual recovery procedure exists. Do not remove or move the lock folder. Send the message and the folder name to the engineering owner. |
| Exit 1 with only a `storage_lock_lost` line | Another command took the lock. The result of your command is not proven safe. The event in `infra/.logs/storage-lock.jsonl` names the other owner. Check the result before you continue. |

NOTE: ADR-012 §7 (A3) requires that no storage command of this checkout runs before any manual exit. This condition is not a recovery procedure. QA tested the refusal, not a manual exit. Stop and escalate `operation_lock_invalid`; do not change the lock folder.

NOTE: Known limits ([deferred](../human_review/deferred.md#canvas-and-blackboard-phase-m4)): a lost lock prints no plain-text sentence on stderr (B-RR-02). Some lock releases log no `storage_lock_released` line (R1-A QA O-1). After another release error, stderr can show a raw `EACCES` text with a path. The lock folder then stays until a later command reclaims it (O-A2).

## 5. Signing key rotation and inline Canvas keys

Canvas installs that use the key URL need no change. Canvas installs with an inline key do: Canvas does not refresh an inline key [SIM M1-19.canvas.inline-key; DOC F-CV-8].

1. Before the rotation, list the Canvas connections whose admins chose the inline key `[PROCESS]`.
2. On the host, rotate the key: `npm run lti:bootstrap -w services/lti-service -- --account cogniate --name <name> --rotate-signing-key` `[Not verified by QA]`.
3. Outside rollback mode, run `npm run stack:restart -- lti-service` to empty the LTI token cache `[L-C14 UNVERIFIED]`. Not yet tested on a real Canvas site.
4. Give each affected library user and Canvas admin the new key id (`kid=` in the `lti:bootstrap` output) `[L-C14 UNVERIFIED]`. Not yet tested on a real Canvas site.
5. Ask them to complete [Canvas guide, Procedure 6](canvas-admin.md#procedure-6-after-a-cogniate-key-change-inline-key-only) with a new JSON `[L-C14 UNVERIFIED]`. Not yet tested on a real Canvas site.

Until the new JSON is in Canvas, Deep Linking and new grade tokens fail for that install. A token that Canvas already issued can still work until it expires [L-C14 UNVERIFIED]. Not yet tested on a real Canvas site.

NOTE: No QA case covers the rotation itself (deferred A-T0-16). Live row L-C14 checks the full procedure.
