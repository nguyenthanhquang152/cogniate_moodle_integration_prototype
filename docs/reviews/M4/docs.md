# M4 documentation and review-pack QA (`docs/reviews/M4/docs.md`)

## 1. Preliminary host-only QA checkpoint — provisional draft `fd87bf7` (2026-10-22)

**Verdict: PRELIMINARY HOST-ONLY CHECKS PASS (0 BLOCKER, 0 MAJOR, 0 MINOR, 2 NIT); OVERALL AC-M4 NOT YET ASSESSED (final runtime, conformance, and source stamps intentionally PENDING).**

- **Role and provenance:** Independent Canvas QA-E2E (`Antigravity Gemini 4 Argon (High)`, model `gemini-4-argon-high`, effort `high`, no subworkers), Orca run `run_ebe671ad72a9`, task `task_1eabbfbed895`, dispatch `ctx_296da6e34f11`, terminal `term_3fd51366-4ec9-4a5c-994d-be6f04a4bcf1`. Independent of the Docs author (`Claude Code Opus 5.5` / retained Codex executor).
- **Authorization:** Lead host-only grant `msg_418765f36a30` (`delivery_1e42dd4d39e5`, 2026-10-22).
- **Reviewed provisional commit:** `fd87bf75f468839062ac41b4594c357d2bfb353b` (draft basis `82aff91`, storage refusal update `5a5453c`, pre-M4 prose baseline `aaa823b25306c5e560f7c4050238b374dec4d4e3`).
- **Report prefix preserved:** `{"exists":false,"bytes":0,"sha":null}`.
- **Private evidence root:** `R=/Users/quangnguyen/cogniate-canvas-qa-runs/verification-bf09cda-Kb7OPU3d` (mode `0700`), subfolder `R/m4-prelim` (mode `0700`, all 13 files mode `0600`), manifest `R/m4-prelim/MANIFEST-m4-prelim.sha256` SHA-256 `01fbe3143cc36d05161b5024d6bdf66220bd0241c07b387fb0cd1c497b7534ad` (`12/12` entries verified). Earlier manifests (`notes/MANIFEST-r1-closeout-v2.sha256` `adc0a74e…` `119/119`, `judge/full2-round1/MANIFEST-full2-round1.sha256` `d8417761…` `17/17`, `judge/full2-round2/MANIFEST-full2-round2.sha256` `82cbc38a…` `23/23`) and the fail-closed Docker stub log (`private/stub-bin/calls.log`, `2` lines / `113` B from initial positive control) are untouched.

### 1.1 Held 10-file input inventory

All 10 held prose files in the workspace match the Lead-supplied SHA-256 hashes and git commit `fd87bf75f468839062ac41b4594c357d2bfb353b` byte for byte (`R/m4-prelim/held-files.sha256`, `R/m4-prelim/audit-m4-prelim.json` `c244cd271910c5c7fe25f13f8b6bedd8ef92a3b765a4975f61d82dfee692d76d`):

| Path | Bytes | SHA-256 | Matches `fd87bf7` |
| --- | ---: | --- | --- |
| `README.md` | 6,419 | `814c32dca7134ff2fff6b2a8c099aadbfd5559b672da8de7da20dd3e11469026` | PASS |
| `docs/guides/blackboard-admin.md` | 7,294 | `6b4c0185f58765e835ccb60c6f419925dc71db7837dbd9acbb918c52532e8efb` | PASS |
| `docs/guides/canvas-admin.md` | 10,690 | `ae9041470087f1fdd3f7dff64d12fff131f53839427edf9a99cacb274e91b4f4` | PASS |
| `docs/guides/operator.md` | 16,696 | `1c40e0e5394050e8484b3bf65181e87b2a0a366eba76ea109cfeb9b4cad3deb8` | PASS |
| `docs/guides/teacher.md` | 10,284 | `35ec285743b3febd80ecd47084e95ff4f2ce1695e901175fb21ee0b4f200dcda` | PASS |
| `docs/guides/troubleshooting.md` | 13,031 | `53e498f3ea3df4e04cc70ebc9b14a492c4c33b61e61789beb84dbb2e6d52ea78` | PASS |
| `docs/human_review/START-HERE.md` | 6,527 | `c50777cf678c69c79b4c3e7c73ecdfd42d63b8f3fc63b11347f5ee17d4060718` | PASS |
| `docs/human_review/canvas-blackboard.html` | 22,070 | `0e021663fbf73c8d906db7596d678e9cc067e1b78f883d00dd064b1bfb1501fa` | PASS |
| `docs/human_review/deferred.md` | 19,839 | `af9e82deb3f327443b9726a34242e193d739cab0e7ebc4790f6b5c7b9adb3463` | PASS |
| `infra/README.md` | 63,323 | `78aecb02dab70c34f9885fda8575b17681116a3ad878a0a6077995e081445fdc` | PASS |

### 1.2 Per-check status summary

| Check / Criterion | Preliminary status at `fd87bf7` | Summary of evidence |
| --- | --- | --- |
| `AC-M4-01` Evidence labels, `UNVERIFIED` real-LMS notes, and `CANVAS-LOCAL` boundary | **PASS (provisional draft; final runtime stamps NOT YET ASSESSED)** | Every new or changed step in the guides names its evidence label (`[SIM …]`, `[MOODLE-LIVE …]`, `[DOC …]`, `[L-… UNVERIFIED]`, `[HOST-QA]`, `[PROCESS]`, `[Not verified by QA]`). All 79 references to the 32 live matrix rows (`L-C01..L-C15`, `L-B01..L-B18`) in the guides carry `"Not yet tested on a real Canvas site."` or `"Not yet tested on a real Blackboard site."` `CANVAS-LOCAL` (`L-C13`) is marked deferred and `UNVERIFIED` (`README.md:20`, `canvas-admin.md:119`, `START-HERE.md:7`, `canvas-blackboard.html:204`) and is never described as hosted Canvas. All 55 referenced `M1-XX.*` case IDs exist in `actual-ids.tsv` (`488` cases), and all 121 `npm run` script references exist in the workspace `package.json` files (`R/m4-prelim/refs-and-tags-check.json` `8dca489a…`). |
| `AC-M4-02` No unsupported live or certification claims; `SIM` labeled as signed simulation | **PASS** | Zero occurrences of `"works with Canvas"`, `"works with Blackboard"`, `"certified"`, or equivalent claims across all 10 held files. `README.md` lines 19–21 and 42 and `canvas-blackboard.html` lines 82 and 217 state `"implemented and tested against a signed simulation"` / `"signed simulation only"`. |
| `AC-M4-03` / `AC-T9-04` Simplified Technical English (STE) measurements | **PASS** | Measured with the T9 method across all M4 changes (`aaa823b..fd87bf7`): `164` Markdown procedure segments (max `19` words `<= 20`, `0` over `20`), `897` Markdown descriptive segments (max `25` words `<= 25`, `0` over `25`), `120` Markdown paragraphs (max `6` sentences `<= 6`, `0` over `6`), and `189` HTML sentences in `147` prose blocks (max `22` words `<= 25`, `11` `<p>` blocks with max `5` sentences `<= 6`). Manual inspection of every segment over `20` words found no misclassified instruction. `NOTE`, `WARNING`, and `CAUTION` follow `inputs.md` §7. |
| `AC-M4-04` Exact provider labels; no DataCamp values or copied prose | **PASS** | Zero `DataCamp` tokens, client IDs, hosts, or case-study-only values (`/blackboard/proxy`, `public_jwk/scope/update`, `1000 × 1300`). All 38 `F-BB-*` / `F-CV-*` citations resolve to `docs/research/multi-lms.md`. Canvas and Blackboard UI/config labels match `docs/research/multi-lms.md` and `tasks/M4.md`. `docs/guides/teacher.md` lines 81 and 121 use `"Publish to an LMS" [SIM AC-M2-10]`, matching D-T6L (`docs/team/t6-label-repair-2026-10-22.md`). |
| `AC-M4-05` Offline `file://` HTML page, 4 scope sections, `B-1..B-3` one-sentence blockers, desktop/mobile/a11y | **PASS (2 visual NITs)** | Opened `file:///.../docs/human_review/canvas-blackboard.html` in headless Chrome (`1440×1000` desktop, `375×812` mobile, and `javaScriptEnabled: false`) with `offline: true` and a route guard aborting any non-`file://` request (`R/m4-prelim/html-offline-check.json` `01178b7f…`): `1` `file://` request, `0` non-file requests, `0` page errors, `0` console errors. Shows all required sections (`#tenancy`, `#grant`, `#profiles`, `#evidence`, `#decisions`), interactive 8-step grant control (`Step 1 of 8` to `Step 8 of 8` and back), `<details>` live row list (`32` IDs), and `B-1` (`22` words), `B-2` (`16` words), `B-3` (`16` words) in one sentence each. Zero document horizontal overflow on desktop and mobile; `@axe-core/playwright` found `0` violations on desktop (`46` passes) and `0` violations on mobile (`47` passes). Two visual wrapping NITs (`Q-M4-P01`, `Q-M4-P02`) are noted below. |
| Local links and `#anchors` across all 10 held files | **PASS** | All `145` links (`139` local file/anchor links and `6` external reference URLs in `START-HERE.md` / `infra/README.md`) resolve; all checked target files and heading/`id` anchors exist (`0` broken). |
| `AC-M4-08` & `Q19–Q22` / `D-1..D-12` / residual race `A-M0-10` (`D-12`) & check 14 limit | **PASS** | `Q19–Q22` links to `decisions-needed.md#e-canvas-and-blackboard-decisions` and `D-1..D-12` defaults in `canvas-blackboard.html` match ADR-011 §15. `deferred.md` (§`A-M0-10 (D-12)`), `operator.md` (§`3a`), `troubleshooting.md` (`PLATFORM_IN_USE` after release), and `canvas-blackboard.html` (`#decisions` note) state the exact scope (`canvas-self-hosted` only; hosted Canvas and Blackboard issuers are reserved with `ISSUER_RESERVED`), impact (setup blocked with `PLATFORM_IN_USE`; no Canvas access because launch check 14 refuses before storage), operator order (issue grant, suspend, release, redeem at once), limit (shortens window, does not close or prevent the race), and enterprise requirement (reserved-identifier or quarantine design first), with no stronger claim. |
| `operation_lock_invalid` STOP/ESCALATE row & `infra/README.md` refusal output updates | **PASS** | `infra/README.md:128`, `docs/guides/operator.md:202,205`, and `docs/guides/troubleshooting.md:86` all instruct the operator to stop, not remove or move the lock folder, and escalate to the engineering owner because no validated manual recovery procedure exists. `infra/README.md:146-157` and `docs/human_review/deferred.md:172` accurately document coded `storage_refused` JSON lines vs text-only stops, the stderr exception for `backup_folder_in_checkout` and `backup_folder_not_empty`, and the `container` field (`5a5453c`). |
| `AC-M4-06` Architect final conformance report | **NOT YET ASSESSED** | Outside this preliminary guide check; awaits final runtime completion and `docs/reviews/M4/architect-conformance.md`. |
| `AC-M4-07` `docs/human_review/decisions-needed.md` (Lead-owned file) | **NOT YET ASSESSED (cross-references PASS)** | `decisions-needed.md` is outside the 10 held paths of this grant; all links and `Q19–Q22` / `D-1..D-12` references from the 10 held files to `decisions-needed.md` were checked and match. |
| Final runtime, D-T6L `C4`/`C5`, M2, T7, and final pack SHA stamps | **NOT YET ASSESSED (intentionally PENDING)** | `fd87bf7` intentionally records `full2` round 1 (`488/488`, `233/233` Canvas) and marks round 2, legacy groups, M2, T7, conformance, and final stamps as pending. Final binding will follow after runtime and conformance gates complete. |

### 1.3 STE measurements per held file (`AC-M4-03` / `AC-T9-04`)

Command (`R/m4-prelim/audit-m4-prelim.mjs` SHA-256 `4c9907d8de53be06bd09cb77193ce5e257636c77df1e05953c5947bc5ab87791`):

```sh
R_M4_DIR="$R/m4-prelim" /Users/quangnguyen/.local/share/fnm/node-versions/v24.21.0/installation/bin/node "$R/m4-prelim/audit-m4-prelim.mjs"
```

Method (same as T9): strip Markdown/HTML markup, link URLs, and bracketed evidence tags; count each inline code span (`` `…` `` or `<code>…</code>`) as one technical token; keep decimal and version numbers intact; split prose at sentence-ending punctuation (`.`, `!`, `?`); treat each Markdown table cell, list item, paragraph, and HTML prose element as a separate block. Numbered steps in guide procedures and imperative sentences inside procedure sections are measured against the `<= 20`-word procedure limit; descriptive sentences are measured against the `<= 25`-word descriptive limit; paragraphs are measured against the `<= 6`-sentence limit. Every segment above `20` words was inspected manually to verify that no conditional or unnumbered instruction was classified as descriptive.

| Held file (M4 changes vs `aaa823b`) | Changed lines | Procedure segments | Max procedure words (`<= 20`) | Descriptive segments | Max descriptive words (`<= 25`) | Paragraphs | Max sentences / paragraph (`<= 6`) | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `README.md` | 44 | 0 | 0 | 76 | 18 | 7 | 4 | PASS |
| `docs/guides/blackboard-admin.md` | 110 | 24 | 12 | 108 | 18 | 17 | 4 | PASS |
| `docs/guides/canvas-admin.md` | 154 | 46 | 16 | 109 | 22 | 29 | 6 | PASS |
| `docs/guides/operator.md` | 220 | 68 | 19 | 161 | 22 | 41 | 4 | PASS |
| `docs/guides/teacher.md` | 88 | 26 | 12 | 76 | 19 | 15 | 5 | PASS |
| `docs/guides/troubleshooting.md` | 44 | 0 | 0 | 127 | 17 | 3 | 6 | PASS |
| `docs/human_review/START-HERE.md` | 6 | 0 | 0 | 11 | 15 | 3 | 5 | PASS |
| `docs/human_review/deferred.md` | 74 | 0 | 0 | 206 | 24 | 5 | 4 | PASS |
| `infra/README.md` (M4 diff: L128, L146–157) | 13 | 0 | 0 | 23 | 25 | 0 | 0 | PASS |
| **Markdown total (M4 changes)** | **753** | **164** | **19** | **897** | **25** | **120** | **6** | **PASS** |
| `docs/human_review/canvas-blackboard.html` | 280 | 0 | 0 | 189 | 22 | 11 (`<p>`) | 5 | PASS |

Notes on STE inspection:
- All 8 descriptive segments in the `21–25` word range across the 10 held files (`canvas-admin.md:131` `22`w, `operator.md:133` `22`w, `deferred.md:116` `23`w, `deferred.md:137` `23`w, `deferred.md:140` `24`w, `deferred.md:149` `22`w, `infra/README.md:149` `25`w, and `canvas-blackboard.html` `B-1` `22`w) were inspected manually; each is a factual or status description, not a user instruction.
- Six earlier M1 table/bullet lines in `infra/README.md` (`L49`, `L111`, `L141`, `L143`, `L158`, `L397`, committed in M1 before `aaa823b`) contain semicolon- or parenthetical-separated technical inventories of 26–38 tokens if not split on `;` or `:`; they are unchanged in M4.
- `WARNING` precedes destructive resets, rollback write loss, secret-bearing backup/trace folders, permanent Learn tool deletion (`F-BB-15`), and the enterprise `D-12` limit. `CAUTION` marks inline-key non-refresh in Canvas (`canvas-admin.md:65`), macOS root CA trust (`infra/README.md:233`), and Moodle login password-field recreation (`infra/README.md:469`). `NOTE` is used only for informational context and boundaries.

### 1.4 Offline `file://` HTML, desktop/mobile, and accessibility verification (`AC-M4-05`)

Command (`R/m4-prelim/check-html-offline.mjs` SHA-256 `56ca0f025550a8b8c1d7e23d0a04002fd10b72453c4855497e3866ef1b3d2dc8`):

```sh
R_ROOT="$R" R_M4_DIR="$R/m4-prelim" /Users/quangnguyen/.local/share/fnm/node-versions/v24.21.0/installation/bin/node "$R/m4-prelim/check-html-offline.mjs"
```

Measured results (`R/m4-prelim/html-offline-check.json` `01178b7f42d33487bef4ed27b80c67ec42ff74d3beda64f14fe574a74d662a28`, desktop screenshot `R/m4-prelim/canvas-blackboard-desktop.png` `99fd5a24a842e9db295645520ca7df093b4f682f3ce6bc2ba69cd2a2185db714`, mobile screenshot `R/m4-prelim/canvas-blackboard-mobile.png` `4940e0137bc0a66b3a80aa072fc58c7ef46644462c1d636e61a44bb63c5e1705`):

1. **Offline and zero external dependencies:** Opened from `file:///Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/lti-multi-lms/docs/human_review/canvas-blackboard.html` with `offline: true` and a Playwright route interceptor aborting any non-`file://` URL. Recorded `1` `file://` navigation request, `0` non-file requests, `0` page errors, and `0` console errors. The file contains no external script, stylesheet, font, or image URL.
2. **Required sections and one-sentence live blockers:**
   - `#tenancy` ("1. Tenancy: one engine, three LMS types"): inline SVG tenancy diagram (`ADR-011 §4`) + `Exclusive (Moodle, Canvas)` and `Shared (Blackboard)` boxes.
   - `#grant` ("2. Operator approval grant and its trust boundary"): 8-step ordered list (`ADR-011 §4a`), interactive `Previous step` / `Next step` control (`Step 1 of 8` through `Step 8 of 8`, toggling `.on` and `aria-current="step"` and disabling boundary buttons), `Trust boundary` table (`Trusted` vs `Not trusted`), and containment note (`suspend`, `release`, and the 6 per-record outcomes).
   - `#profiles` ("3. Provider profiles"): 6-row table (`standard`, `canvas-cloud-production`, `canvas-cloud-beta`, `canvas-cloud-test`, `canvas-self-hosted`, `blackboard`) + test-only note for `canvas-sim-cloud` and `blackboard-sim`.
   - `#evidence` ("4. Evidence and live status"): 6-row evidence table, `Live rows by group` (`CANVAS-HOSTED` 13 `UNVERIFIED`, `CANVAS-LOCAL` `L-C13` 1 deferred and `UNVERIFIED`, `BLACKBOARD-LIVE` 18 `UNVERIFIED`, expandable `<details>` listing all 32 row IDs), and `The three live blockers` in one sentence each:
     - `B-1` (1 sentence, 22 words): `"B-1: We need a Canvas tenant where we may make a developer key, a published test course and an enrolled test learner."`
     - `B-2` (1 sentence, 16 words): `"B-2: We need a Blackboard Developer Portal account and a Learn test instance with admin rights."`
     - `B-3` (1 sentence, 16 words): `"B-3: Blackboard needs our key URL on public HTTPS, so the owner must authorize public exposure."`
   - `#decisions` ("5. Open decisions"): link to `Q19` to `Q22` in `decisions-needed.md#e-canvas-and-blackboard-decisions`, 12-row table (`D-1` to `D-12` with defaults matching ADR-011 §15), and `D-12 in plain words` note.
3. **Desktop (`1440×1000`), mobile (`375×812`), no-JS, and accessibility:**
   - Desktop (`1440×1000`): `scrollWidth = 1440` (`hasHorizontalOverflow: false`); `.two` renders two columns (`499px 499px`); `@axe-core/playwright` reports **`0` violations** (`46` passes, `0` incomplete).
   - Mobile (`375×812`): `scrollWidth = 375` (`hasHorizontalOverflow: false`); `.two` collapses to one column (`283px`); wide tables scroll inside `.scroll` regions (`overflow-x: auto`); `@axe-core/playwright` reports **`0` violations** (`47` passes, `0` incomplete).
   - Keyboard focus: first `Tab` focuses `.skip` (`Skip to content`, `href="#main"`), moving it into view (`left: 292.2px`) with `outline-style: solid`.
   - No-JS (`javaScriptEnabled: false`): `#grant-ctl` stays hidden (`hidden === true`), `<noscript>` note renders, and all 8 steps in `#grant-steps` remain visible.

### 1.5 Preliminary findings (`0 BLOCKER, 0 MAJOR, 0 MINOR, 2 NIT`)

No BLOCKER, MAJOR, or MINOR defect was found in the 10 held prose files at `fd87bf75f468839062ac41b4594c357d2bfb353b`. Two optional visual NITs were observed during inspection of the rendered screenshots (`R/m4-prelim/canvas-blackboard-desktop.png` and `R/m4-prelim/canvas-blackboard-mobile.png`):

| Id | Severity | Where | Observation | Suggested polish (optional) |
| --- | --- | --- | --- | --- |
| `Q-M4-P01` | NIT | `docs/human_review/canvas-blackboard.html:226-239` (`#decisions` table, `Id` column) | The first column (`<td>D-1</td>` … `<td>D-12</td>`) has no `white-space: nowrap`. At `1440×1000` desktop width, `D-10` wraps across two lines at the hyphen (`D-` / `10`); at `375×812` mobile width, `D-1` through `D-12` all wrap across two lines. | Add `td:first-child { white-space: nowrap; }` (or wrap the IDs in `<code>`). |
| `Q-M4-P02` | NIT | `docs/human_review/canvas-blackboard.html:100-127` (`#tenancy` SVG inside `.scroll`) | `<svg viewBox="0 0 900 360" width="100%">` has no `min-width`. At `375×812` mobile width, the 900-unit diagram scales down to `283px` wide instead of scrolling horizontally inside `<div class="scroll">`, making the SVG text very small on narrow screens. | Add `svg { min-width: 640px; display: block; }` so narrow viewports use the surrounding `.scroll` container. |

### 1.6 Items remaining for final M4 QA closure

Final M4 QA acceptance remains open until:
1. Common QA completes the fresh 12-group legacy rerun under D-T6L (`C4` product + `C5` test-only selector update) and independent T6/T8 judgment passes;
2. Fresh M2 (`64` cases) and fresh 3-run T7 pass under separate Lead-granted exclusive Docker windows;
3. Architect final conformance (`docs/reviews/M4/architect-conformance.md`, `AC-M4-06`) and Lead `decisions-needed.md` (`AC-M4-07`) are completed;
4. Docs updates the provisional status/hash stamps in `README.md`, `START-HERE.md`, `canvas-blackboard.html`, `deferred.md`, and the guides to bind the final runtime, conformance, and documentation hashes, followed by a delta recheck of only the changed lines.

---

## 2. Stage 0 host-only QA checkpoint — corrected provisional draft `f185260` (2026-10-22)

**Verdict: STAGE 0 HOST-ONLY DELTA CHECKS PASS (`0 BLOCKER, 0 MAJOR, 0 MINOR, 0 new NIT`; prior visual NITs `Q-M4-P01` and `Q-M4-P02` recorded as deferred in `deferred.md`); OVERALL `AC-M4` NOT YET ASSESSED (final runtime, conformance, and source/doc stamps remain PENDING).**

- **Role and provenance:** Independent Canvas QA-E2E and final Docs QA (`Antigravity Gemini 4 Argon (High)`, model `gemini-4-argon-high`, effort `high`, no subworkers), Orca run `run_ebe671ad72a9`, task `task_73d57f11a485`, dispatch `ctx_9d09ff03c8e2`, terminal `term_3fd51366-4ec9-4a5c-994d-be6f04a4bcf1`.
- **Authorization:** Lead Stage 0 host-only addendum `msg_00208affed16` (`delivery_fcf52c1bb9c2`, 2026-10-22). No Docker authority accompanied this dispatch, and no Docker command was run.
- **Independence:** We did not read any author repair report or reuse author check results. All checks below were run independently with our M4/T9 scripts and direct inspection of the git diff (`fd87bf75f468839062ac41b4594c357d2bfb353b..f18526014c602b4b74484b819097ed9b8b598c20`), product source files, ADRs, and M1/M4 review reports.
- **Reviewed provisional commit:** `f18526014c602b4b74484b819097ed9b8b598c20` (5 files changed from `fd87bf75f468839062ac41b4594c357d2bfb353b`: `57` insertions, `20` deletions).
- **Report prefix preserved:** `19,224` bytes, SHA-256 `a9b92890714badfebbdb805d0f47e51e1fce4b238ae0f3e50c2341e9e9451d2b` (§1 above).
- **Private evidence subfolder:** `R/m4-stage0` (mode `0700`, all 7 files mode `0600`), manifest `R/m4-stage0/MANIFEST-m4-stage0.sha256` SHA-256 `38d4668c5e8e2b675b305d083016a4cc936001cb0687565557a729f7dc91b925` (`6/6` entries verified). All four earlier manifests (`notes/MANIFEST-r1-closeout-v2.sha256` `adc0a74e…`, `judge/full2-round1/MANIFEST-full2-round1.sha256` `d8417761…`, `judge/full2-round2/MANIFEST-full2-round2.sha256` `82cbc38a…`, and `m4-prelim/MANIFEST-m4-prelim.sha256` `01fbe314…`) remain byte-identical.

### 2.1 Clarification of §1.1 byte metadata and 10-file input inventory at `f185260`

- **Clarification of §1.1 byte counts at `fd87bf7`:** Independent re-verification of `git show fd87bf75f468839062ac41b4594c357d2bfb353b:<path>` and `R/m4-prelim/audit-m4-prelim.json` (`c244cd271910c5c7fe25f13f8b6bedd8ef92a3b765a4975f61d82dfee692d76d`, lines 5 and 77) confirms that at frozen `fd87bf7`, `README.md` is **`8,263` bytes** (transcribed as `6,419` in the §1.1 prose table) and `infra/README.md` is **`61,032` bytes** (transcribed as `63,323` in the §1.1 prose table). All 10 SHA-256 hashes and the remaining 8 byte counts in §1.1 are exact.
- **Stage 0 input verification (`f18526014c602b4b74484b819097ed9b8b598c20`):** All 10 prose files match the Lead-supplied SHA-256 hashes and git commit `f18526014c602b4b74484b819097ed9b8b598c20` byte for byte (`R/m4-stage0/held-files-f185260.sha256` `db3a9227…`, `R/m4-stage0/audit-m4-stage0.json` `e70ff60e…`):

| Path | `fd87bf7` bytes | `f185260` bytes | `f185260` SHA-256 | Delta vs `fd87bf7` | Matches `f185260` |
| --- | ---: | ---: | --- | --- | --- |
| `README.md` | 8,263 | 8,263 | `814c32dca7134ff2fff6b2a8c099aadbfd5559b672da8de7da20dd3e11469026` | Unchanged | PASS |
| `docs/guides/blackboard-admin.md` | 7,294 | 7,294 | `6b4c0185f58765e835ccb60c6f419925dc71db7837dbd9acbb918c52532e8efb` | Unchanged | PASS |
| `docs/guides/canvas-admin.md` | 10,690 | 10,869 | `b4d28c5088994609aed28d2533cdcb0ec5308fa5e21dfcca7bf6133b4154ff12` | `+5 / -4` lines | PASS |
| `docs/guides/operator.md` | 16,696 | 18,502 | `b3c65c4c9c14b509c7e1afa682359898d529836d8fbf23649d802c02ab235fe4` | `+20 / -11` lines | PASS |
| `docs/guides/teacher.md` | 10,284 | 10,284 | `35ec285743b3febd80ecd47084e95ff4f2ce1695e901175fb21ee0b4f200dcda` | Unchanged | PASS |
| `docs/guides/troubleshooting.md` | 13,031 | 14,066 | `d74bcbc78b2cde3ef3d37bf5620b68b8282d5a9a9b410fe7ca7d6a02bad5d039` | `+6 / -4` lines | PASS |
| `docs/human_review/START-HERE.md` | 6,527 | 6,527 | `c50777cf678c69c79b4c3e7c73ecdfd42d63b8f3fc63b11347f5ee17d4060718` | Unchanged | PASS |
| `docs/human_review/canvas-blackboard.html` | 22,070 | 22,070 | `0e021663fbf73c8d906db7596d678e9cc067e1b78f883d00dd064b1bfb1501fa` | Unchanged | PASS |
| `docs/human_review/deferred.md` | 19,839 | 25,305 | `f8a15a691babc9504392e24a2031fe542936926c62c8c2b74da15d041aaad493` | `+25 / -0` lines | PASS |
| `infra/README.md` | 61,032 | 61,141 | `7cdd7440a7428dc3cfd6487343d0fdb0ab77ae8d979e217e82aa911fb17ec087` | `+1 / -1` line | PASS |

### 2.2 Independent verification of the 5 changed files (`R/m4-stage0/diff-fd87bf7-to-f185260.patch`)

| File | Changed lines | What changed | Independent verification against source, ADRs, and reviews | Result |
| --- | --- | --- | --- | --- |
| `docs/guides/operator.md` | `:9-18`, `:63-65`, `:80`, `:92`, `:185-187`, `:201`, `:207`, `:220-225` | Clarifies host vs container execution context and full `docker compose` host invocation; adds self-hosted Canvas grant-first order (`D-12`) to §3; includes Moodle in `deleted` cleanup row; adds `UNKNOWN_PLATFORM` post-rollback launch warning; distinguishes `storage_lock_lost` from lock refusals and quotes `"Follow the manual exit of the operator guide"` in `operation_lock_invalid`; specifies host context and `kid=` handoff in §5 key rotation. | Verified against `services/cogniate-app/package.json` (`app:grant`, `app:binding` run `node src/cli/*.ts` in container), `services/lti-service/package.json` (`lti:shared-platform` runs in container; `lti:bootstrap` calls `bash ../../infra/scripts/lti-bootstrap.sh` on host), `infra/scripts/lib.sh:101-106` (`dc()` uses `--project-directory "$INFRA_DIR" -p "$COMPOSE_PROJECT_NAME" -f "$INFRA_DIR/compose.yaml" --env-file "$ENV_FILE"`, labeled `source inspection only`), `ADR-011 §14` (`UNKNOWN_PLATFORM` after rollback, labeled unmeasured), `ADR-012 §7` and `infra/scripts/storage-oplock.sh:114,158-165` (`operation_lock_invalid` text and `storage_lock_lost` post-execution semantics), and `infra/scripts/lti-bootstrap.sh:27` (`kid=${o.kid}` summary output). | PASS |
| `docs/guides/canvas-admin.md` | `:125-130` | Splits Procedure 6 (inline-key rotation) into explicit `Library user` steps 1–3 (`GET .../canvas-configuration?jwk=inline` in a signed-in portal session, compare `X-Cogniate-Key-Id` with the operator's `kid`, give JSON to Canvas admin) and `Canvas admin` step 4 (paste new JSON into the same developer key). | Verified against `operator.md` §5, `M1-19.canvas.inline-key` in `actual-ids.tsv`, and `F-CV-8` in `docs/research/multi-lms.md`. Steps 2–4 carry `[L-C14 UNVERIFIED]` and `"Not yet tested on a real Canvas site."` | PASS |
| `docs/guides/troubleshooting.md` | `:71`, `:73-74`, `:76`, `:79`, `:86` | Links `SERVICE_ORIGIN_MISMATCH` and `PROVIDER_PROFILE_MISMATCH` recovery to `operator.md` §3 and §3a (grant first for self-hosted Canvas); separates `PLATFORM_NOT_ACTIVE` (Canvas) from `DEPLOYMENT_NOT_ACTIVE` (Blackboard); adds `UNKNOWN_PLATFORM` with `reason: deployment_not_approved`; aligns `operation_lock_invalid` manual-exit text. | Verified against `services/lti-service/src/lti/login.ts:50,55`, `launch.ts:91`, and `checks.ts:161` (`PLATFORM_NOT_ACTIVE` for inactive platform vs `DEPLOYMENT_NOT_ACTIVE` for inactive deployment), `services/cogniate-app/src/domain/connections.ts:195-211` and `tool-pages/launch.ts:81` (`deployment_not_approved` returns `UNKNOWN_PLATFORM`, covered by `[SIM AC-M1-37 (c2)]`), and `infra/scripts/storage-oplock.sh:114`. | PASS |
| `docs/human_review/deferred.md` | `:144-145`, `:166-190` | Adds `A-CR-01` and `A-CR-04` to Storage implementation; adds `B-BM-01`, `A-CR-02 (= B-CRR-02)`, `A-CR-03`, `B-CRR-01`, `A-SOR-01 (= B-SOR-01)`, `B-SRP-03 (coverage part)`, and `A-SRR-01` to Storage harness; adds `### Guide and source-checkpoint notes` with `Q-M4-P01`, `Q-M4-P02`, `AR-M4-01..AR-M4-06`, and `A-CR-05, B-CRR-06`. | Verified all 18 added deferral rows (IDs, severities, summaries, and relative links) against `docs/reviews/M1/content-refusal-reviewer-{a,b}.md`, `backup-manifest-reviewer-b.md`, `storage-oracle-repair-reviewer-{a,b}.md`, `storage-reset-parent-reviewer-b.md`, `storage-repair-reviewer-a.md`, `docs/reviews/M4/docs.md` §1.5, and `docs/reviews/M4/architect-conformance.md` §4 (`AR-M4-01..AR-M4-06`). States that these entries authorize no source, architecture, or cosmetic change and that final conformance and document approval remain pending. | PASS |
| `infra/README.md` | `:128` | Updates only the `operation_lock_invalid` table cell to quote `"Follow the manual exit of the operator guide"` and state that in this prototype the manual exit is stop and escalate. | Verified against `infra/scripts/storage-oplock.sh:114` and `docs/guides/operator.md#43-storage-lock-messages`. | PASS |

### 2.3 Stage 0 STE, link, and reference measurements (`AC-M4-01` .. `AC-M4-05`, `AC-T9-04`)

Command (`R/m4-stage0/audit-m4-stage0.mjs` SHA-256 `ce96593031ef9602d649f41e54b600a6694bbddd7f5fd50f6ec0ee817f48f5de`):

```sh
R_STAGE0_DIR="$R/m4-stage0" /Users/quangnguyen/.local/share/fnm/node-versions/v24.21.0/installation/bin/node "$R/m4-stage0/audit-m4-stage0.mjs"
```

1. **Stage 0 delta STE measurements (`fd87bf7..f185260`, 5 changed files, `57` changed/added lines):**

| Changed file (`fd87bf7..f185260`) | Changed lines | Procedure segments | Max procedure words (`<= 20`) | Descriptive segments | Max descriptive words (`<= 25`) | Paragraphs | Max sentences / paragraph (`<= 6`) | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `docs/guides/canvas-admin.md` | 5 | 7 | 13 | 2 | 22 | 1 | 2 | PASS |
| `docs/guides/operator.md` | 20 | 7 | 17 | 29 | 16 | 9 | 5 | PASS |
| `docs/guides/troubleshooting.md` | 6 | 0 | 0 | 31 | 19 | 1 | 5 | PASS |
| `docs/human_review/deferred.md` | 25 | 0 | 0 | 124 | 15 | 1 | 3 | PASS |
| `infra/README.md` (L128) | 1 | 0 | 0 | 6 | 12 | 0 | 0 | PASS |
| **Stage 0 delta total** | **57** | **14** | **17** | **192** | **22** | **12** | **5** | **PASS** |

- Across the full M4 Markdown diff (`aaa823b..f185260`, `790` changed/added lines across the 9 Markdown files): `169` procedure segments (max `19` words `<= 20`, `0` over `20`), `1,043` descriptive segments (max `25` words `<= 25`, `0` over `25`), and `125` paragraphs (max `6` sentences `<= 6`, `0` over `6`).
- Only one new descriptive segment in the Stage 0 delta exceeds `20` words (`docs/guides/canvas-admin.md:125`, `22` words: `"The operator tells the library user and Canvas admin when the key changes, and gives them the new key id (operator guide)."`). Manual inspection confirms it is a factual description of who notifies whom, not a user instruction.
2. **Links, anchors, and reference tags (`R/m4-stage0/audit-m4-stage0.json` `e70ff60e…`, `R/m4-stage0/refs-and-tags-check.json` `bb50a328…`):**
   - **Links and anchors:** `175` total links across the 10 files (`169` local file/anchor links, including `30` new links in `deferred.md`, `operator.md`, and `troubleshooting.md`, plus `6` external reference URLs); **`0` broken** (`175/175` resolve to existing files and heading/`id` anchors).
   - **Script, case-ID, fact, and live-ID bindings:** `121/121` `npm run` script references exist in workspace `package.json` files (`0` missing); `60/60` `M1-XX.*` case ID references exist in the `488`-case `actual-ids.tsv` inventory (`0` missing); `38/38` `F-*` citations exist in `docs/research/multi-lms.md` (`0` missing); `81/81` `L-C*`/`L-B*` references (`63` in the 5 guides) resolve to the `32` live rows in `docs/architecture/tasks/M3.md`, and every guide step or troubleshooting entry citing a live row includes `"Not yet tested on a real Canvas site."` or `"Not yet tested on a real Blackboard site."`
   - **No forbidden claims (`AC-M4-02`, `AC-M4-04`):** `0` hits for `DataCamp`, `"works with Canvas"`, `"works with Blackboard"`, `"certified"`, `/blackboard/proxy`, or `public_jwk/scope/update`. All 32 live rows remain `UNVERIFIED` and `CANVAS-LOCAL` (`L-C13`) remains deferred.
   - **Offline HTML/accessibility reuse (`AC-M4-05`):** `docs/human_review/canvas-blackboard.html` is byte-identical between `fd87bf7` and `f185260` (`22,070` bytes, SHA-256 `0e021663fbf73c8d906db7596d678e9cc067e1b78f883d00dd064b1bfb1501fa`), so the §1.4 offline `file://`, desktop/mobile, no-JS, and `@axe-core/playwright` verification (`R/m4-prelim/html-offline-check.json` `01178b7f…`) applies unchanged.
3. **Remaining gates for final M4 QA closure:** Same as §1.6 — final runtime gates (Common 12-group legacy rerun under D-T6L + independent T6/T8 judgment, fresh M2, fresh 3-run T7), final Architect conformance (`AC-M4-06`), `decisions-needed.md` (`AC-M4-07`), and final runtime/conformance/pack hash stamps remain **PENDING**.
