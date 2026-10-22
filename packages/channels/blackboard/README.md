# Channel `blackboard`

Blackboard Learn with LTI 1.3. The manifest is `manifest.ts`. The LTI profiles move into this folder with LA-E1-05; the app adapter with LA-E1-07.

## Facts and sources

| Fact | Value | Source |
| --- | --- | --- |
| LTI profiles | `blackboard` (issuer `https://blackboard.com`, endpoints on `developer.blackboard.com`); simulation copy `blackboard-sim` | ADR-011 §6 (F-BB-3, -4, -5) |
| Platform | one shared platform (the Cogniate Application ID); each Learn site is one deployment | ADR-011 §7 |
| Registration | manual; binds with authority `operatorGrant` (a shared platform never uses `self`) | app contract §4.4; LA-ADR-07 D2 rule A4 |
| Tool registration rows | 9 Learn rows | app contract §4.5 |
| Guarded product family | `blackboardlearn`, at the `launch` level | ADR-011 §6 (F-BB-16); LA-ADR-01 D6 |
| `window` hint in Deep Linking | yes (`launch.windowHint`) | LA-ADR-01 D3 |

## Live status

Simulator only (label `SIM`). Every live row of the M3 live-check matrix is UNVERIFIED (blocker B-2: no Developer Portal account and Learn instance; B-3: public HTTPS for the JWKS).
