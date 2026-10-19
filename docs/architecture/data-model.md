# Data model and state machines

Status: T0 round 2. Storage choice: [ADR-006](adr/ADR-006-storage.md).

Each service has its own SQLite file. Every LTI service row has `tool_account_id` (directly or through its parent). Every Cogniate app row has `library_id` (directly or through its parent). Repository functions take the tenant id as a required argument.

In memory only (lost on restart, no harm): platform access tokens (per platform and scope set), the score timestamp clock (per platform, line item, user), platform JWKS cache.

## 1. LTI service (`lti.db`)

```mermaid
erDiagram
    TOOL_ACCOUNT ||--|| TOOL_KEY : signs_with
    TOOL_ACCOUNT ||--o{ PLATFORM : has
    TOOL_ACCOUNT ||--o{ REGISTRATION_SESSION : starts
    PLATFORM ||--o{ DEPLOYMENT : has
    PLATFORM ||--o{ OIDC_STATE : login
    PLATFORM ||--o{ LAUNCH : receives
    PLATFORM ||--o{ SERVICE_KEY : scopes

    TOOL_ACCOUNT {
      string id PK "for example cogniate"
      string name
      string api_key_hash
      string launch_url
      string deep_linking_url
      string registration_url
    }
    TOOL_KEY {
      string kid PK
      string tool_account_id FK
      json public_jwk
      blob private_jwk_encrypted
    }
    PLATFORM {
      string id PK
      string tool_account_id FK
      string issuer
      string client_id
      string name
      string auth_endpoint
      string token_endpoint
      string jwks_url
      string product_family_code
      bool active
    }
    DEPLOYMENT {
      string platform_id FK
      string deployment_id
    }
    REGISTRATION_SESSION {
      string id PK
      string tool_account_id FK
      string openid_configuration_url
      blob registration_token_encrypted
      json platform_configuration
      string operation "new or update"
      string existing_platform_id
      string privacy_level
      json passthrough_params
      string status "open or completed"
      datetime expires_at
    }
    OIDC_STATE {
      string state_hash PK
      string platform_id FK
      string nonce
      string target_link_uri
      datetime expires_at
      datetime used_at
    }
    LAUNCH {
      string id PK
      string platform_id FK
      string deployment_id
      string message_type
      json claims
      string ltik_hash
      datetime expires_at
    }
    SERVICE_KEY {
      string key_hash PK
      string platform_id FK
      string deployment_id
      string context_id
      string resource_link_id
      json ags_claim
      json nrps_claim
      datetime revoked_at
    }
```

Unique keys:

| Table | Unique key |
| --- | --- |
| `platform` | (`tool_account_id`, `issuer`, `client_id`) |
| `deployment` | (`platform_id`, `deployment_id`) |
| `service_key` | (`platform_id`, `deployment_id`, `context_id`, `resource_link_id`). Later launches return the same key and refresh the claims. |
| `tool_key` | one row per tool account in the prototype (rotation is optional) |

Login and launch URLs carry the tool account (`/lti/login/{toolAccountId}`), so lookups never cross accounts.

## 2. Cogniate app (`cogniate.db`)

```mermaid
erDiagram
    LIBRARY ||--o{ APP_USER : has
    LIBRARY ||--o{ COURSE : owns
    LIBRARY ||--o{ CONNECTION : owns
    COURSE ||--o{ COURSE_VERSION : has
    PACKAGE ||--o{ COURSE_VERSION : stores
    CONNECTION ||--o{ PUBLICATION : offers
    COURSE ||--o{ PUBLICATION : is_offered
    CONNECTION ||--o{ PICKER_SESSION : picks
    CONNECTION ||--o{ RESOURCE_LINK : has
    PUBLICATION ||--o{ RESOURCE_LINK : placed_as
    RESOURCE_LINK ||--o{ ATTEMPT : tracks
    ATTEMPT ||--o{ PLAY_SESSION : runs
    ATTEMPT ||--o{ SCORE_SYNC : sends

    COURSE_VERSION {
      string id PK
      string course_id FK
      int version
      string format "scorm12 or html"
      string package_id FK
      json validation_report
      json tracking_profile
    }
    PACKAGE {
      string id PK "random, in the /pkg URL"
      string sha256
      int total_bytes
      int file_count
      string storage_path
    }
    CONNECTION {
      string id PK
      string library_id FK
      string site_url
      string method "dynamic or manual"
      string status "pending, registered, connected, disabled"
      string lti_platform_id "unique"
      string ref_token_hash
      datetime ref_expires_at
    }
    PUBLICATION {
      string id PK
      string connection_id FK
      string course_id FK
      string current_version_id FK
      string status "available or withdrawn"
    }
    PICKER_SESSION {
      string id_hash PK "SHA-256 of the picker id; the raw id is only in the /tool/picker URL"
      string connection_id FK
      blob ltik_encrypted
      datetime expires_at
      datetime used_at
    }
    HANDOFF {
      string ltik_hash PK "one use of /tool/launch or /tool/deep-link"
      datetime used_at "expires_at is derived: used_at + 24 h"
    }
    RESOURCE_LINK {
      string id PK
      string connection_id FK
      string publication_id FK
      string deployment_id
      string context_id
      string resource_link_id
      string line_item_id
      blob service_key_encrypted
    }
    ATTEMPT {
      string id PK
      string resource_link_id FK
      string user_sub
      string course_version_id FK
      bool preview
      json cmi_or_progress
      int last_seq
      string outcome
      int score_given
      int score_maximum
    }
    PLAY_SESSION {
      string id_hash PK "SHA-256 of the play id; the raw id is only in the /play URL"
      string attempt_id FK
      string runtime_token_hash
      string session_id
      string roles
      string return_url
      datetime expires_at
    }
    SCORE_SYNC {
      string id PK
      string attempt_id FK
      json payload
      string status
      int tries
      datetime created_at
      datetime next_try_at
      string last_error
      datetime send_started_at "unresolved score POST; null when no send is in flight"
      bool delivery_uncertain "earlier send may still write remotely"
      datetime confirmation_after "required confirmation due time; null before first success"
    }
```

Unique keys and rules:

| Table | Rule |
| --- | --- |
| `connection` | `lti_platform_id` unique. A platform belongs to one connection only. |
| `publication` | (`connection_id`, `course_id`) unique |
| `resource_link` | (`connection_id`, `deployment_id`, `context_id`, `resource_link_id`) unique. `publication_id` comes from the **signed** `launch.target`. If a later signed launch names another publication of the same connection (the teacher selected new content for the activity), the row is updated and the event `resource_link_rebound` is logged. |
| `attempt` | One row per (`resource_link_id`, `user_sub`, `course_version_id`). A launch continues the newest attempt if it is `in_progress` **and** its course version belongs to the course of the resource link's current publication. Otherwise it uses the current version of that publication (new row, or the existing row of that version). After a rebind, an old in-progress attempt stays as it is and shows under its own course's publication. |
| `handoff` | Insert fails if the ltik was used before → error page `HANDOFF_USED`. |
| `play_session` | No ltik. Commits use the runtime token. Score sync uses the service key. Stored by `id_hash` only (A-T4b2-03). |
| `picker_session` | Stored by `id_hash` only (A-T4b2-03). The ltik inside is encrypted. |

Score delivery recovery (P2, app contract §10): SQLite must retain in-flight send state, unresolved delivery uncertainty, and any confirmation requirement and due time. Write the in-flight state before the external POST. After restart, an unresolved send is uncertain; an awaited confirmation stays `pending`. The requirement belongs to the learner and activity and passes to a higher result if its row is superseded. A later acknowledged retry does not erase earlier uncertainty. Public status remains one of the existing values; no `sentAt` is set before required confirmation succeeds. Confirmation uses the existing retry window, including its deadline.

### 2.1 Retention (A-T4b2-02)

A cleanup job in each service runs at start and then every 10 min. It deletes rows that can never be used again and logs `retention_cleanup {table, deleted}` (info) when it deletes something.

| Service | Table | Deleted when |
| --- | --- | --- |
| Cogniate app | `handoff` | `expires_at` (= `used_at` + 24 h, the ltik lifetime) is more than 24 h ago |
| Cogniate app | `picker_session` | `expires_at` is more than 24 h ago, except a used pick not yet matched to a launch (kept, because `stats.activities` counts it) |
| Cogniate app | `play_session` | `expires_at` is more than 24 h ago. The session's largest `session_time` is kept on the attempt first (cogniate-app migration 006), so `total_time` is not lost. |
| LTI service | `oidc_state` | `expires_at` is past (10 min life) |
| LTI service | `launch` | the ltik expired more than 24 h ago |
| LTI service | `registration_session` | older than 24 h |

Not deleted in the prototype: attempts, resource links, score syncs, publications, connections, platforms, service keys (they are the record of results).

`tracking_profile` (made at upload, kept per version):

```json
{
  "format": "html",
  "launchPath": "index.html",
  "pages": ["index", "lesson-ai-web-sprint"],
  "menuPage": "index",
  "questionIds": ["01M2M36Y89M9KPPZENF1ZW4AWJ"],
  "masteryScore": 70,
  "minDwellMs": 10000
}
```

## 3. State machines

```mermaid
stateDiagram-v2
    direction LR
    [*] --> pending: create
    pending --> registered: registration complete or manual values saved
    registered --> connected: first valid launch from this platform
    pending --> disabled: disconnect
    registered --> disabled: disconnect
    connected --> disabled: disconnect
```

Connection. The portal shows "Link expired" when `pending` and `ref_expires_at` is past (derived, not stored).

```mermaid
stateDiagram-v2
    direction LR
    [*] --> not_started
    not_started --> in_progress: first commit
    in_progress --> completed: final, no mastery
    in_progress --> passed: final, score >= mastery
    in_progress --> failed: final, score < mastery
    failed --> passed: better result
```

Attempt outcome. The attempt keeps its best outcome. The portal shows the best outcome of the learner on that activity.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> pending
    pending --> sent: 204, required confirmation complete
    pending --> pending: retry or required confirmation
    pending --> conflict: 409 from Moodle
    pending --> failed: 24 h of retries, or 400 or 404
    pending --> superseded: a better row exists
    failed --> pending: Resend
    conflict --> pending: Resend
```

Score sync. Retry times: 5 s, 30 s, 2 min, 10 min, 30 min, then every 1 h until 24 h after `created_at` (ADR-010).

Publication: `available` ⇄ `withdrawn`. "Selected in Moodle" and "In use" come from `stats`.
