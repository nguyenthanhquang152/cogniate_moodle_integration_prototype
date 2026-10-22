# Channel `canvas`

Canvas LMS with LTI 1.3. The manifest is `manifest.ts`. The LTI profiles move into this folder with LA-E1-05; the app adapter with LA-E1-07.

## Facts and sources

| Fact | Value | Source |
| --- | --- | --- |
| LTI profiles | `canvas-cloud-production`, `canvas-cloud-beta`, `canvas-cloud-test` (fixed Instructure issuers), `canvas-self-hosted` (`{siteUrl}` issuer); simulation copy `canvas-sim-cloud` | ADR-011 §6 (F-CV-1, -2, -3, -4, -5, -18) |
| Token endpoint | `{serviceUrl}/login/oauth2/token`; a Canvas platform stores a service URL (default: the site URL) | ADR-011 §6 (F-CV-18) |
| Registration | manual with a developer key; binds with authority `operatorGrant` | app contract §4.4; ADR-011 §7 |
| Several deployments | yes (`deployments.multiple`) | app contract §4.7.2 |
| Developer key JSON | yes (`setup.artifacts: ['developer-key-json']`) | app contract §4.6 |
| Guarded product family | `canvas`, at the `launch` level | ADR-011 §4 rule 4, §6 (F-CV-22); LA-ADR-01 D6 |
| `window` hint, top-level continue | yes (`launch.windowHint`, `launch.topLevelContinue`) | LA-ADR-01 D3, D8 |

## Live status

Simulator only (label `SIM`). Every live row of the M3 live-check matrix is UNVERIFIED (blocker B-1: no Canvas tenant).
