# LA terms

Status: v1 (A1, milestone LA, 2026-10-22). Owner: Architect A1. Other workers send term requests to the Lead.

This file adds the terms of milestone LA. The terms of [`../README.md` §2](../README.md#2-terms) and [ADR-011 §3](../adr/ADR-011-multi-lms.md#3-terms) stay valid. Use the same word for the same thing. When an LA term replaces an old term in new text, the column "Existing term or code" names the old one.

## 1. Channel model

| Term | Meaning | Existing term or code |
| --- | --- | --- |
| **Channel** | One kind of external system that receives Cogniate courses, with one adapter folder. LA channels are LTI 1.3 platforms: `moodle`, `canvas`, `blackboard`, `lti-generic` and one new named LMS (E2). | "LMS type" (README §2); `connection.lms`; `LmsType` (`services/cogniate-app/src/providers/types.ts:12`) |
| **Channel id** | The stable, lower-case id of a channel. It is a value in data, never a code branch in core. Pattern `^[a-z][a-z0-9-]{1,31}$`. | the `lms` values `moodle`, `canvas`, `blackboard` |
| **Named channel** | A channel for one LMS product (Moodle, Canvas, Blackboard, the E2 LMS). | — |
| **Generic LTI channel** | The channel `lti-generic`: any LTI 1.3 platform without a named channel. Admin values or Dynamic Registration ([LA-ADR-02](adr/LA-ADR-02-generic-lti-channel.md)). | DataCamp "generic LTI" (inputs-datacamp §1) |
| **Channel family** | The mechanism class of a channel. LA has only `lti13`. Reserved for the backlog: `catalog-file` (LB), `xapi` (LC), `vendor-api` (LF), `package` (LE). | — |
| **Channel folder** | `packages/channels/<channel id>/`. It holds everything that is special to one channel. | `services/cogniate-app/src/providers/<lms>.ts`, `services/lti-service/src/profiles/<lms>.ts`, `apps/portal/src/connect/<lms>/` |
| **Channel manifest** | The pure-data file `manifest.ts` of a channel folder: id, names, family, card, capabilities, setup steps, texts. All three deployables read it. | `ProviderAdapter` data fields (`providers/types.ts:136-148`) |
| **Channel adapter** | The code of one channel folder behind the kernel ports: the app setup adapter, the LTI profiles, the portal module. | "provider adapter" (`providers/types.ts:1-4`) |
| **Channel registry** | The one list of channels. Each deployable builds it by folder discovery of `packages/channels/*/`. No file lists the channel ids. | `providerAdapters()` (`providers/index.ts:13`), `listProfiles()` (`profiles/index.ts:27`), `LMS_TYPES`, `providerWizards` (`apps/portal/src/connect/wizards.ts:7`) |
| **Channel kernel** (kernel) | The core code that runs every channel through ports and capabilities: registry, capability guards, binding authority strategies, launch router, extension mount, dispatch outbox, portal shell. | the "common engine" (`providers/types.ts:3`) |
| **Core** | All product code outside the channel folders. Core must not name a channel (§3). | — |
| **Shared driver** (driver) | A reusable mechanism that many channels use. LA drivers: the **LTI 1.3 driver** (LTI service, app LTI client, tool pages) and the **AGS reporter**. | the LTI service; the score sync worker |
| **Port** | A typed interface between the kernel and a channel adapter or a driver ([LA-ADR-01 D5](adr/LA-ADR-01-channel-kernel.md#decision)). | — |
| **Extension route** | An app API route that a channel folder declares. The kernel mounts it behind a capability guard. | Canvas JSON route (`app/canvas-configuration.ts`), web services route (`app/web-services.ts`) |
| **Canary channel** | A test-only channel folder that QA keeps outside product paths. It proves on every commit that a new channel needs no core change. | — |

## 2. Capabilities and profiles

| Term | Meaning | Existing term or code |
| --- | --- | --- |
| **Capability** | A named, generic feature of a channel or a connection, for example `deployments.multiple`. The id is a dotted string. The value comes from the manifest, the LTI profile, or the connection ([LA-ADR-01 D3](adr/LA-ADR-01-channel-kernel.md#decision)). | "capability" (ADR-011 §11) |
| **Capability set** | All capability values of one channel, or of one connection. Wire name: `channelCapabilities`. | — |
| **Capability guard** | A kernel check that refuses a request for a capability that is false or absent, before any outbound call: `CAPABILITY_NOT_SUPPORTED`. | ADR-011 §11 "Guard when missing" |
| **Legacy capability flags** | The six M1 booleans `dynamicRegistration`, `operatorApproval`, `webServices`, `courseShell`, `addDeployment`, `canvasConfiguration`. LA keeps them as a frozen wire projection of the capability set. | `Capabilities` (`providers/types.ts:19-26`) |
| **Frozen wire name** | A field name, path, code or log name that tests and clients read and that LA keeps byte for byte, even when it names an LMS (for example `canvasConfiguration`, `/canvas-configuration`, `createMoodleCourse`, `score_sync`). Only one kernel file may hold them. | — |
| **LTI profile** (profile) | Same as "provider profile" (ADR-011 §3). Each profile belongs to exactly one channel: the channel whose folder holds it. | `ProviderProfile` (`services/lti-service/src/profiles/types.ts:24`) |
| **Profile trait** | A data field of a profile that the LTI driver reads, for example `endpoints`, `sharing`, `tokenAudience`. The driver never branches on a profile id. | `ProfileFlags` and the profile fields (`profiles/types.ts:13-51`) |
| **Admin-value profile** | A profile with trait `endpoints: 'admin'`: the LMS administrator gives the issuer and the endpoints. `standard` (Moodle) and `lti-generic`. | `isStandardProfile` (`profiles/index.ts:46`) |
| **Fixed-endpoint profile** | A profile with trait `endpoints: 'fixed'`: the issuer and endpoints come from the profile (fixed values or templates). | the Canvas and Blackboard profiles |
| **Guarded product family** | A signed `tool_platform.product_family_code` value that one channel owns. A launch that signs it must use a profile of that channel (generic check 14). | `productFamily` (`profiles/types.ts:45`), check 14 |
| **Simulator profile** | Same as "simulation profile" (ADR-011 §6). It lives in the channel folder next to the real profile. | `blackboard-sim`, `canvas-sim-cloud` |
| **Simulator module** | QA's per-channel module of the signed simulator, under `tests/sim/`. | `tests/sim/blackboard/index.mjs` |

## 3. Connections and binding

| Term | Meaning | Existing term or code |
| --- | --- | --- |
| **Connection** | Unchanged: one link between one library and one LMS installation. LA view: one instance of one channel for one library. | README §2 |
| **Registration method** | `dynamic` or `manual`. Unchanged values. | `connection.method` |
| **Binding authority** | How a connection gets launch and grade authority: `self` (the registration itself proves it) or `operatorGrant` (an operator approval grant, ADR-011 §4a). Reserved third value: `verifiedAdminLaunch` (§6, Could). The manifest fixes it per registration method. The connection stores it at create. | Moodle path (`lms === 'moodle'`) versus the grant path (`lms IN ('canvas','blackboard')`) |
| **Authority strategy** | The kernel code of one binding authority: bind, route launches, disconnect, suspend, release. | `app/redemption.ts`, `app/binding-cleanup.ts`, the Moodle branches in `app/connections.ts` |
| **Target kind** | The remote record kind of a binding: `exclusive_platform`, `platform_deployment`, `shared_deployment`. LA stores it on each binding attempt. | `BindingTarget.kind` (`providers/types.ts:85-99`) |
| **Bound values** | The values that an operator grant binds beyond the M1 columns, for example the issuer and endpoints of an admin-value platform. | — |
| **Behaviour class** (legacy) | The value that LA writes into the frozen `connection.lms` column of a new channel: `moodle` for `self`, `canvas` for `operatorGrant` with an exclusive platform, `blackboard` for `operatorGrant` with a shared platform. It is defence in depth only; core never reads `connection.lms` ([LA-ADR-04 D4](adr/LA-ADR-04-refactor-and-migration.md#decision)). | `connection.lms` |
| **Connection setup** | The onboarding shape of every channel: **show** our values, **collect** their values, **verify**, **enable**. | DataCamp pattern 6 |
| **Setup artifact** | A file that a channel gives to the LMS administrator, for example the Canvas developer key JSON. | `GET …/canvas-configuration` |
| **Text name** | The LMS name that fills `{LMS}` in every text. It comes from the manifest. Moodle texts stay byte for byte. | `LmsName` (`providers/types.ts:16`), `lmsNameOf` |

## 4. Learning records

| Term | Meaning | Existing term or code |
| --- | --- | --- |
| **Placement** | The channel-neutral place where a publication is used in a channel. LTI: one resource link. Table `placement` (E4); its id equals the `resource_link.id` (`rl_…`). | "Resource link" (README §2) |
| **Learner subject** | The pseudonymous learner id that a channel gives. LTI: the `sub` claim. | `attempt.user_sub` |
| **Attempt** | Unchanged: the progress of one learner on one placement and one course version. | README §2 |
| **Learning record** | An immutable, channel-neutral fact about one learner result on one placement: kind, outcome, score, time. Table `learning_record` (E4). | the final outcome inside `attempt` and `score_sync` |
| **Record reporter** (reporter) | A driver that delivers learning records to one target. LA has one: `lti-ags`. Backlog: `xapi` (LC), vendor reporters (LF). | the score sync worker (`worker/score-sync.ts`) |
| **Record dispatch** (dispatch) | One delivery of one learning record by one reporter, with status, tries and delivery state. Table `record_dispatch` (E4). For `lti-ags`, the `score_sync` row stays the delivery row. | "Score sync" (README §2) |
| **Dispatch outbox** (outbox) | The kernel engine that leases due dispatches, calls the reporter and applies the retry and confirmation rules. | `domain/score-syncs.ts` + `worker/score-sync.ts` |
| **Lease** | A time-bounded claim of one dispatch by one worker. Only an expired lease can be taken again. | `send_started_at` (no owner today) |
| **Job runner** | The one kernel interface for background work: named jobs, due rows or schedules, leases, fairness, bounded parallelism, `Retry-After`. The dispatch outbox and the E5 jobs (retention, key re-wrap, signing-key rotation) use it ([LA-ADR-03 D7](adr/LA-ADR-03-learning-record-core.md#decision)). | the score sync timer, the retention timers |
| **Delivery outcome** | The neutral answer of a reporter: `accepted`, `conflict`, `rejected`, `retryable`, `throttled`, `local_failure`. The kernel maps it to the existing status values. | `SendAnswer` (`packages/tracking/src/outcome.ts:99`) |
| **Read-back** | A read of the stored result from the target, for comparison only. LTI: the AGS results read ("Refresh from {LMS}"). | "Refresh from Moodle", `gradebook_read` |
| **Grade policy** | ADR-010, unchanged: final outcomes only, best result, supersede, bounded confirmation, retries, Resend. The outbox applies it for every reporter whose policy is `bestResult`. | ADR-010 |

## 5. Ports reserved for the backlog (names only)

| Term | Meaning | Milestone |
| --- | --- | --- |
| **Package exporter** | Turns one course version into a file for a channel. `.mbz` is the first one. | LE (`.mbz` exists) |
| **Catalog exporter** | Sends catalog items to a channel, full or as changes, on a schedule. | LB |
| **Connection schedule** (the plan's "job scheduler") | A per-connection schedule (full or changes, frequency) that starts catalog jobs on the job runner (§4). | LB |
| **Connection secrets slot** | Encrypted, per-connection credentials of a channel (SFTP keys, vendor OAuth). | LB, LF |
| **Identity resolver** | Maps a channel identity (LTI `sub`, e-mail, SAML NameID) to a Cogniate learner. | LD |

## 6. Tenancy, operations and security (shared with A2)

A2 owns the design of these items ([LA-ADR-05](adr/LA-ADR-05-lti-advantage-completeness.md) to [LA-ADR-08](adr/LA-ADR-08-onboarding-and-connection-health.md)). This table fixes only the words.

| Term | Meaning | Existing term or code |
| --- | --- | --- |
| **Tool account** | Unchanged: the tenant of the LTI service (LTIAAS: one account). | README §2 |
| **Library** | Unchanged: the tenant of the Cogniate app. | README §2 |
| **Operator** | Cogniate staff with operator rights (ADR-011 §3). In LA the operator uses the operator admin API with an operator key; the CLIs become clients of that API. | ADR-011 §3 ("shell access") |
| **Operator key** | The own credential of the operator admin API. It is not a tool account API key. | — |
| **API key scope** | The rights of one tool account API key: `launch` (the launch-side API) or `admin` (platforms, deployments, registrations). | the one API key per account |
| **Key provider** | The port that wraps and unwraps stored secrets with a versioned master key. LA: a local file provider. LG: a cloud KMS. | `APP_MASTER_KEY`, the LTI service master key |
| **Key version**, **key ring** | The id of one master key; the set of key versions that a key provider keeps to unwrap old blobs. | — |
| **Signing key state** | The life of one tool signing key: `next` (in the JWKS, does not sign), `active` (signs), `retired` (in the JWKS until its retention ends; has `retired_at`). | `tool_key` (A-T0-16) |
| **Audit event** | An append-only record of one admin or operator change: actor, tenant, action, target, result, time, trace id. Each service has its own audit table. | — |
| **Rate-limit class** | A group of routes that share one limit bucket, for example protocol login, registration, launch API, admin API. | — |
| **Platform storage launch** | A login and launch that keeps the state and nonce in the platform's client-side storage (LTI postMessages `lti.put_data`, `lti.get_data`) when the state cookie is missing. The **storage check** then replaces cookie check 2. | the partitioned state cookie (security §3) |
| **Claim policy** | A tool account setting: the claims that the LTI service keeps after a launch (custom, lis, names, email). It replaces the LMS-named `minimizeClaims` choice. | `minimizeClaims` flag (`profiles/types.ts:19`) |
| **Privacy floor** | A profile trait: the claim removal that no claim policy can undo for that profile. | — |
| **Scope set** | The service scopes that a channel asks for at registration (Dynamic Registration request, Canvas JSON `scopes`). Capability `registration.scopes`. | ADR-009 scopes; Canvas JSON `scopes` (app contract §4.6) |
| **Verified admin launch** | The reserved third binding authority (`verifiedAdminLaunch`, D-3, Could): an LMS administrator launch with a one-time code proves control of the platform. | ADR-011 D-3 |
| **Connection health** | The view of one connection: last launch, last dispatch, last errors, key state. | `lastLaunchAt`, `lastError` |
| **Connection check** | An active probe of one connection, for example a token request to the platform token endpoint, that shows whether the binding still works. | — |

## 7. Fitness checks

| Term | Meaning |
| --- | --- |
| **Fitness check** | An automatic architecture rule in `npm run check`. |
| **LMS-name lint** | The fitness check "no channel id or LMS name in core code" ([README §4](README.md#4-rules-that-keep-core-channel-neutral)). |
| **Add-channel gate** | The fitness check "an add-channel change touches only allowed paths" (plan §4 measure 1). |
| **Ratchet** | A checked-in count per file that can only go down. |
