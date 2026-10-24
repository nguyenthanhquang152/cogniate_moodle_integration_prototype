# Channel `moodle`

Moodle LMS with LTI 1.3 Advantage. The manifest is `manifest.ts`. The LTI profile (`standard`) moves into this folder with LA-E1-05; the app adapter with LA-E1-07.

## Facts and sources

| Fact | Value | Source |
| --- | --- | --- |
| LTI profile | `standard`: the issuer and all endpoints are admin values on the issuer origin; exclusive platform | ADR-011 §6 (security §2.4) |
| Registration | Dynamic Registration and manual connect (six values); both bind with authority `self` | app contract §4; ADR-009; LA-ADR-07 D2 rule A3 (`MANUAL_SELF_LEGACY_CHANNELS`) |
| Guarded product family | none | LA-ADR-01 D6; ADR-011 §6 (`productFamily`: none for `standard`) |
| Tool configuration rows | 16 rows, labels of the Moodle 5.2.4 tool form | app contract §4.1 |
| Site API token, course shell, `.mbz` export | yes (`siteApi.token`, `publish.createCourse`, `export.packages: ['mbz']`) | ADR-011 §11; LA-ADR-01 D8 |
| Several items in one Deep Linking answer | no (`content.multiple: false`): Moodle hides the grade settings for several items | A-T0-11 |
| `window` hint in Deep Linking | no (`launch.windowHint: false`) | LA-ADR-01 D3 (D-10) |

## Live status

Verified on the local Moodle 5.2.4 stack (label `MOODLE-LIVE`, T7). Moodle in a subfolder (Q18) is not verified.
