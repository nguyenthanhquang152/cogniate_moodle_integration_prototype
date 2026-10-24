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

---

## 3. Stage 1 host-only QA checkpoint — bounded guide repair `958ee5c` (2026-10-22)

**Verdict: STAGE 1 BOUNDED GUIDE DELTA PASS (`0 BLOCKER, 0 MAJOR, 0 MINOR, 0 new NIT`); STATIC GUIDE TEXT AT `958ee5c` PASSES ALL 7 OPERATIONAL AND STE CHECKS; OVERALL `AC-M4` / FINAL PACK APPROVAL NOT GRANTED (runtime blocked by fresh `AC-T5-36` T5b failure; no human or final pack approval).**

- **Role and provenance:** Independent Docs QA (`Antigravity Gemini 4 Argon (High)`, model `gemini-4-argon-high`, effort `high`, no subworkers), Orca run `run_ebe671ad72a9`, task `task_15d12bf6141c`, dispatch `ctx_12ca9989c76f`, terminal `term_3fd51366-4ec9-4a5c-994d-be6f04a4bcf1`.
- **Scope and independence:** Bounded host-only QA of the committed 4-file guide delta `f18526014c602b4b74484b819097ed9b8b598c20..958ee5c1225addff7dc3d5ea3417b7d17e157bbf` (`32` insertions, `22` deletions). We did not read any author repair report or check notes; every changed workflow was traced directly to product code, QA helpers/tests, and contracts. No Docker, runtime, or installation command was run.
- **Note on prior Stage 0 gap:** Our Stage 0 check (`28102a6`) verified script/link existence on `f185260` but missed two operational defects identified by independent Reviewer-B (`724a08a`): (1) `docker compose … exec` lacked `--workdir /repo`, whereas `cogniate-app` and `lti-service` start in `/repo/services/<service>` (`infra/compose.yaml:123,156`), so `-w services/<service>` fails unless run from `/repo`; and (2) `troubleshooting.md` advised `app:binding suspend` when `deployment_not_approved` persisted, which switches off the entire Canvas platform and breaks an already-approved deployment during `add_deployment`, whereas `app:grant revoke --grant <grt_id>` switches off only unapproved attempt targets. Both defects and five accompanying precision items are verified below against code and QA tests.
- **Report prefix preserved:** `32,034` bytes, SHA-256 `4d4013aa6d33443fbd9d4bf2a95e958e5c50e08eefaee11af89816a1b4649b2c` (`28102a6ac39b92c699316937291f364e71c31158`, §§1–2 above).
- **Private evidence subfolder:** `R/m4-stage1` (mode `0700`, all 6 files mode `0600`), manifest `R/m4-stage1/MANIFEST-m4-stage1.sha256` SHA-256 `c55631e9a528afe9a5d91ccc70ed32aed96e302c99e21a2b5023fd0ca3ad8c33` (`5/5` entries verified). All five earlier manifests (`adc0a74e…`, `d8417761…`, `82cbc38a…`, `01fbe314…`, `38d4668c…`) remain untouched.

### 3.1 Input verification at `958ee5c1225addff7dc3d5ea3417b7d17e157bbf`

All 10 held prose files match the committed `958ee5c` blobs and Lead-supplied byte counts and SHA-256 hashes (`R/m4-stage1/held-files-958ee5c.sha256` `251dc5e6…`, `R/m4-stage1/audit-m4-stage1.json` `953be3d2…`). The four changed files (`32` additions, `22` deletions) and six byte-identical files are:

| Path | `f185260` bytes | `958ee5c` bytes | `958ee5c` SHA-256 | Delta vs `f185260` | Result |
| --- | ---: | ---: | --- | --- | --- |
| `docs/guides/canvas-admin.md` | 10,869 | 11,565 | `bac615e5b02dbe01a3252efe463e72d1efab932661f75598331492d38e18cb30` | `+9 / -6` lines | PASS |
| `docs/guides/operator.md` | 18,502 | 19,229 | `fd2fc3b220a9451e8ccf8416f4d357fe276795a7d04e00a570a0be7bb6638765` | `+13 / -11` lines | PASS |
| `docs/guides/troubleshooting.md` | 14,066 | 14,839 | `33b6f0a20f995cda56168207e24244fd9846d4f969b4994291d9e5e1ed486127` | `+4 / -3` lines | PASS |
| `infra/README.md` | 61,141 | 61,970 | `3c27066a3307922336fbc56c0b91d40f6584fc8793d6a0f1640c6739c103c577` | `+6 / -2` lines | PASS |
| Unchanged 6 files (`README.md` `8,263` B `814c32dc…`, `blackboard-admin.md` `7,294` B `6b4c0185…`, `teacher.md` `10,284` B `35ec2857…`, `START-HERE.md` `6,527` B `c50777cf…`, `canvas-blackboard.html` `22,070` B `0e021663…`, `deferred.md` `25,305` B `f8a15a69…`) | — | — | Byte-identical to `f185260` | `0` lines | PASS |

### 3.2 Per-concern verification against code, QA helpers/tests, and contracts

| # | Concern | Changed lines in `958ee5c` | Direct trace to code, QA helpers/tests, and contracts | Result |
| --- | --- | --- | --- | --- |
| 1 | Correct Compose project/env/files and `exec -T --workdir /repo` | `operator.md:9,14-15,18,84-85`; `troubleshooting.md:82`; `infra/README.md:69-74` | In `infra/compose.yaml:123,156`, `lti-service` sets `working_dir: /repo/services/lti-service` and `cogniate-app` sets `working_dir: /repo/services/cogniate-app`. Running `npm run <script> -w services/<service>` requires `/repo/package.json` as the working directory. `tests/host/m1-control.mjs:23-27` runs `docker compose -f infra/compose.yaml --env-file .env exec -T --workdir /repo <service> npm run <script> -w services/<service> -- ...` (`docs/reviews/M1/qa.md`, `[SIM AC-M1-28, AC-M1-38, M1-06.blackboard.cli]`), and `infra/scripts/lib.sh:101-106` (`dc()`) supplies `--project-directory infra -p "$COMPOSE_PROJECT_NAME" -f infra/compose.yaml --env-file .env`. Both `operator.md` and `infra/README.md` now state `--workdir /repo` (or `"From /repo inside cogniate-app"`) and label the QA vs helper provenance accurately. | PASS |
| 2 | Safe grant `revoke` preserves approved deployments; exact retry and revocation conditions | `operator.md:84-90`; `troubleshooting.md:82` | In `services/cogniate-app/src/app/binding-cleanup.ts:148-183` (`revokeCleanup`, app contract §4.8), `app:grant revoke --grant <grt_id>` inspects only targets of that grant's attempts (`attemptsOfGrant`), checks `byThisGrant && !approvalOf(db, platformId, deploymentId)`, and switches off only unapproved records written by that grant (`fenced \| absent \| not_owned \| failed`), repeating cleanly if a line is `failed` (`M1-37.canvas.m`, `M1-37.blackboard.m`). By contrast, `app:binding suspend` (`fenceOut`, `:125-141`) switches off the entire Canvas platform. In `tests/acceptance/M1/canvas/51-canvas-races.test.ts:249-262` (`M1-37.canvas.p-activate`), `revoke(grant.id)` fences the unapproved second deployment while `firstWorks(b, pub, key, true)` proves the approved primary deployment and score sync keep working, and a subsequent attempt with the revoked code returns `403 GRANT_INVALID` (so a new code is required after cleanup). | PASS |
| 3 | Distinct initial Canvas Save (`unknown_platform`) vs Blackboard Save / Canvas added deployment (`deployment_not_approved`) | `troubleshooting.md:82-83` | In `services/cogniate-app/src/domain/connections.ts:203-212` (`routeLaunch`) and `services/cogniate-app/src/tool-pages/launch.ts:81`, when no `approved_deployment` row matches `(platformId, deploymentId)`, `routeLaunch` checks `connection.lti_platform_id = ?` and `connection_deployment`. After a lost S3 activation answer on the first Canvas "Save" (`purpose = 'initial'`), `lti_platform_id` is still `NULL` and Canvas uses no `connection_deployment` reservation, so `owner` is `undefined` and `launch_rejected` logs `reason: 'unknown_platform'` (`51-canvas-races.test.ts:53-65,126-132,191-199`, `[SIM M1-37.canvas.c2, M1-37.canvas.i]`). For Blackboard "Save" (which writes a `connection_deployment` reservation in phase 1, `50-races.test.ts:45-50`, `M1-37.blackboard.i`) or Canvas "Add deployment ID" (where the connection already owns `lti_platform_id`, `51-canvas-races.test.ts:66-78,249-262,285-294`, `M1-37.canvas.s-retry, M1-37.canvas.p-activate`), `owner` is found and `launch_rejected` logs `reason: 'deployment_not_approved'`. Both rows now state the exact cause, retry action, and evidence. | PASS |
| 4 | Executable signed-in browser download and `public_jwk.kid` comparison | `canvas-admin.md:127-135` | In `services/cogniate-app/src/app/portal.ts:30`, the signed-in portal connection page is `/integrations/canvas/:connectionId`. In `services/cogniate-app/src/app/canvas-configuration.ts:14-69`, `GET /app-api/connections/:id/canvas-configuration?jwk=inline` sends `Content-Disposition: attachment; filename="cogniate-canvas-lti.json"` and writes `public_jwk.kid: key.kid` equal to `X-Cogniate-Key-Id` (`tests/acceptance/M1/canvas/31-canvas-grants.test.ts:164-173`, `M1-19.canvas.inline-key`). Procedure 6 now gives executable browser steps: copy `<connection id>` after `/integrations/canvas/`, open `{PUBLIC_APP_URL}/app-api/connections/<connection id>/canvas-configuration?jwk=inline` in the same signed-in browser to save `cogniate-canvas-lti.json`, and compare `public_jwk.kid` in the saved file with the operator's `kid` before giving the JSON to the Canvas admin. All live rotation steps keep `[L-C14 UNVERIFIED]` and `"Not yet tested on a real Canvas site."` | PASS |
| 5 | Direct evidence for Canvas disconnect/suspend (`PLATFORM_NOT_ACTIVE`) and reconnect rule | `troubleshooting.md:76`; `canvas-admin.md:143` | `tests/acceptance/M1/canvas/41-canvas-grades.test.ts:157-164` (`M1-18.canvas.disconnect`) proves that `DELETE /app-api/connections/:id` sets `platform.active = false` and subsequent Canvas launches fail with `403 PLATFORM_NOT_ACTIVE`. `tests/acceptance/M1/canvas/61-canvas-containment.test.ts:33-46` (`M1-38.canvas.a`) proves that `app:binding suspend` fences the Canvas platform (`fenced`, `active = false`). `troubleshooting.md:76` now cites `[SIM M1-18.canvas.disconnect, M1-38.canvas.a]`. `canvas-admin.md:143` now states `"A new connection needs a new approval and either a new developer key or an operator release [SIM AC-M1-38]"`, removing any ambiguity that an operator release could bypass a new approval. | PASS |
| 6 | Self-hosted Canvas replacement connection before grant + reuse of valid unused code after `D-12` residual race | `operator.md:146-147,155`; `troubleshooting.md:63`; `canvas-admin.md:145` | In `services/cogniate-app/src/cli/grant.ts:27-30`, `app:grant issue` requires `--connection <con_id>` of the pending connection. In `services/cogniate-app/src/app/redemption.ts:176-181`, when `inUse()` throws `409 PLATFORM_IN_USE`, it clears the connection lease and ends the attempt as `cancelled` without setting `redeemed_at` or `revoked_at` on the grant, so the approval code stays `issued` and valid until it expires. In `tests/acceptance/M1/canvas/61-canvas-containment.test.ts:179-205`, `M1-39.canvas.operator-order` creates the rightful pending connection first, issues its grant, suspends and releases the squatter, and redeems; `M1-39.canvas.residual-race` proves that when a second `standard` connection squats after release (`409 PLATFORM_IN_USE`), suspending and releasing that second Moodle connection lets the rightful library redeem the **same** unused code (`200`). All three files now state this exact workflow and keep the `D-12` non-prevention warning intact. | PASS |
| 7 | Concrete upgrade, rollback, and LTI restart commands and rollback-mode restriction | `operator.md:169,178,182,225` | `operator.md` §4.1 step 5 (`:169`) and §4.2 step 5 (`:182`) now name `npm ci`, then `npm run build`; §4.2 step 1 (`:178`) names `npm run stack:down` (`ADR-011 §14`). In §5 step 3 (`:225`), restarting the LTI service to empty its token cache now specifies `Outside rollback mode, run npm run stack:restart -- lti-service` (`infra/scripts/stack-restart.sh:64`), matching the §4.2 restriction (`operator.md:198`, `tests/host/m1-control.mjs:29-33`, `ADR-012 §12`) that forbids `stack:restart` while the rollback storage-compatibility override is active. | PASS |

### 3.3 Changed-line STE and binding measurements (`f185260..958ee5c`)

Command (`R/m4-stage1/audit-m4-stage1.mjs` SHA-256 `3378c3206cf6ec9d02cd186e653a68a67068225467a2ddda51675969971fcaac`):

```sh
R_ROOT="$R" R_STAGE1_DIR="$R/m4-stage1" /Users/quangnguyen/.local/share/fnm/node-versions/v24.21.0/installation/bin/node "$R/m4-stage1/audit-m4-stage1.mjs"
```

1. **Changed-line STE measurements (`AC-M4-03` / `AC-T9-04`, measured on the `32` changed/added lines across the 4 modified files):**

| Changed file (`f185260..958ee5c`) | Changed lines | Changed line numbers | Procedure segments | Max procedure words (`<= 20`) | Descriptive segments | Max descriptive words (`<= 25`) | Paragraphs | Max sentences / paragraph (`<= 6`) | Result |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `docs/guides/canvas-admin.md` | 9 | `127..131, 135, 143..145` | 15 | 14 | 6 | 17 | 3 | 2 | PASS |
| `docs/guides/operator.md` | 13 | `9, 14, 15, 18, 84, 85, 146, 147, 155, 169, 178, 182, 225` | 11 | 14 | 8 | 16 | 4 | 3 | PASS |
| `docs/guides/troubleshooting.md` | 4 | `63, 76, 82, 83` | 0 | 0 | 24 | 16 | 0 | 0 | PASS |
| `infra/README.md` | 6 | `69..74` | 0 | 0 | 16 | 15 | 2 | 3 | PASS |
| **Stage 1 delta total** | **32** | — | **26** | **14** | **54** | **17** | **9** | **3** | **PASS** |

- Every procedure segment in the delta is `<= 14` words (`<= 20`), and every descriptive segment in the delta is `<= 17` words (`<= 25`, and also `<= 20` even if any table cell or note sentence were counted against the procedure limit). Every changed paragraph has at most `3` sentences (`<= 6`).
2. **Changed-line link, script, case-ID, fact, and live-ID bindings (`R/m4-stage1/audit-m4-stage1.json` `953be3d2…`):**
   - **Links and `#anchors`:** `10/10` links on changed lines (`55/55` across the 4 changed files) resolve to existing target files and heading/`id` anchors (`0` broken), including `../../tests/host/m1-control.mjs`, `../reviews/M1/qa.md`, `../../infra/scripts/lib.sh`, `../../infra/scripts/lti-bootstrap.sh`, `operator.md#23-list-and-revoke`, and `operator.md#3a-accepted-limit-d-12-self-hosted-canvas-after-a-release`.
   - **`npm run` scripts:** `14/14` script references on changed lines (`app:grant`, `app:binding`, `lti:shared-platform`, `lti:bootstrap`, `stack:down`, `stack:up`, `stack:restart`, `build`) exist in workspace `package.json` files (`0` missing).
   - **QA case IDs and research facts:** `15/15` `M1-XX.*` case IDs on changed lines (`M1-19.canvas.inline-key` ×2, `M1-39.canvas.operator-order` ×2, `M1-39.canvas.residual-race` ×2, `M1-18.canvas.disconnect`, `M1-38.canvas.a`, `M1-37.blackboard.i`, `M1-37.canvas.s-retry`, `M1-37.canvas.p-activate`, `M1-37.canvas.c2`, `M1-37.canvas.i`, `M1-06.blackboard.cli`) exist in the `488`-case `actual-ids.tsv` inventory (`0` missing), and `1/1` `F-CV-8` citation exists in `docs/research/multi-lms.md`.
   - **Live rows and preserved boundaries:** `6/6` `L-C14` citations on changed lines include `"Not yet tested on a real Canvas site."` Portal texts without QA coverage (`ISSUER_RESERVED`, `GRANT_IN_USE`, `DEPLOYMENT_FIXED`), `L-C14` rotation, all 32 live rows (`UNVERIFIED`), and `CANVAS-LOCAL` (`L-C13`, `DEFERRED`) remain unchanged. `D-12` residual race, `operation_lock_invalid` STOP/ESCALATE, rollback `UNKNOWN_PLATFORM` warning, and `deferred.md` (`f8a15a69…`) remain intact. `docs/human_review/canvas-blackboard.html` (`0e021663…`) is unchanged, so offline/accessibility proof `R/m4-prelim/html-offline-check.json` (`01178b7f…`) continues to apply.
3. **Gate boundary:** Static guide QA at `958ee5c1225addff7dc3d5ea3417b7d17e157bbf` is **PASS**. Because Common QA reported a fresh `AC-T5-36` T5b failure at C4/C5 (`msg_4cd73ea5bffb`), D-T6L is void for further acceptance; runtime gates (T5b repair/rerun, T6/T8, M2, T7), final source/runtime/conformance stamps, human review (`decisions-needed.md`), and final pack approval remain **NOT GRANTED / PENDING**.

---

## 4. Final M4 prototype guide and review-pack QA — frozen candidate 911219b0 (2026-10-23)

- **Reviewer:** Independent Docs QA (`Antigravity Gemini 4 Argon (High)`, model `gemini-4-argon-high`, effort `high`, no subworkers)
- **Task / Dispatch ID:** `task_ff5344676c4b` / `ctx_df96b9b211e0` (corrective report pass superseding `task_5255dbb803c9` / `ctx_51c9ef567d98`)
- **Frozen candidate under review:** `911219b04ba0c8195e935955094155deac0e9fbb` (branch `nguyenthanhquang152/lti-multi-lms`)
- **Guide delta base:** `958ee5c1225addff7dc3d5ea3417b7d17e157bbf` (Stage-1 M4 guide baseline reviewed in §3; original M4 baseline `aaa823b25306c5e560f7c4050238b374dec4d4e3`)
- **Evidence basis bound in candidate:** `31f4d0bb8afdfeee59ce50e558bb58b49ebc5d54` (2026-10-23)
- **Scope:** Final M4 prototype guide and review-pack gate across all 10 authorized M4 guide paths (`README.md`, `docs/guides/{canvas-admin,blackboard-admin,operator,teacher,troubleshooting}.md`, `docs/human_review/{START-HERE.md,canvas-blackboard.html,deferred.md}`, `infra/README.md`) plus direct assessment of Lead-owned `docs/human_review/decisions-needed.md` (`AC-M4-07` and current `G-1` checkpoint) and `docs/reviews/M4/architect-conformance.md` (`AC-M4-06` Round 7 + `R7.8 Final QA report binding (2026-10-23, about 16:53 UTC)`) against `docs/architecture/tasks/M4.md`, `docs/architecture/tasks/T9.md` §5, `docs/research/inputs.md` §7, `docs/reviews/T7/qa.md`, and `docs/reviews/M3/qa-e2e.md`.
- **Verdict:** **PASS — 0 BLOCKER, 0 MAJOR, 0 MINOR**

### 4.1 Verified Input & Private Evidence Inventory

All 10 authorized M4 guide files and the 5 supporting review/decision artifacts at `HEAD = 911219b04ba0c8195e935955094155deac0e9fbb` match the exact git blobs and byte sizes:

| File | Stage-1 (`958ee5c`) Bytes | Stage-1 (`958ee5c`) SHA-256 | Final (`911219b0`) Bytes | Mode | Final (`911219b0`) SHA-256 | Delta vs `958ee5c` |
| --- | ---: | --- | ---: | --- | --- | --- |
| `README.md` | 8,263 | `814c32dca7134ff2fff6b2a8c099aadbfd5559b672da8de7da20dd3e11469026` | 11,271 | `0644` | `c6b67b6ef4d20003a9fe73ea4e9ad1233d1bcdd25c2d428b100e1b02a1f2638c` | **Modified** (`+3,008` B, 23 lines) |
| `docs/guides/canvas-admin.md` | 11,565 | `bac615e5b02dbe01a3252efe463e72d1efab932661f75598331492d38e18cb30` | 11,757 | `0644` | `9f4caf8a655a5d76c9978e7d607f8322606cf79d5aa05cb2810f28e876c91f23` | **Modified** (`+192` B, 3 lines) |
| `docs/guides/blackboard-admin.md` | 7,294 | `6b4c0185f58765e835ccb60c6f419925dc71db7837dbd9acbb918c52532e8efb` | 7,486 | `0644` | `863843713283d076a37c4ede04d8634779694c9be06e018ae7493598818a3f84` | **Modified** (`+192` B, 3 lines) |
| `docs/guides/operator.md` | 19,229 | `fd2fc3b220a9451e8ccf8416f4d357fe276795a7d04e00a570a0be7bb6638765` | 20,306 | `0644` | `b7cd5c27c7851eca31c9d9f3a5e823dc7ac28cc1a3b40e5a54f4018931239c41` | **Modified** (`+1,077` B, 9 lines) |
| `docs/guides/teacher.md` | 10,284 | `35ec285743b3febd80ecd47084e95ff4f2ce1695e901175fb21ee0b4f200dcda` | 10,992 | `0644` | `6737820630667a6c54682c18d8359501f71700478567303b434ee44b8f19e04c` | **Modified** (`+708` B, 8 lines) |
| `docs/guides/troubleshooting.md` | 14,839 | `33b6f0a20f995cda56168207e24244fd9846d4f969b4994291d9e5e1ed486127` | 15,041 | `0644` | `cc8a93573271396d5225a01d7242cd5d07fdf7f3ef42bb1cb22fa7d817645a12` | **Modified** (`+202` B, 3 lines) |
| `docs/human_review/START-HERE.md` | 6,527 | `c50777cf678c69c79b4c3e7c73ecdfd42d63b8f3fc63b11347f5ee17d4060718` | 7,384 | `0644` | `b7d24a7d969717ee124e75088c66485c5811e02b3db4e9958912c30557ff78a4` | **Modified** (`+857` B, 6 lines) |
| `docs/human_review/canvas-blackboard.html` | 22,070 | `0e021663fbf73c8d906db7596d678e9cc067e1b78f883d00dd064b1bfb1501fa` | 24,366 | `0644` | `836b6072b1ebbc08c2c388d6e7e5c3289d5d055d4f10fbba15a22860f8029d3d` | **Modified** (`+2,296` B, 21 lines) |
| `docs/human_review/deferred.md` | 25,305 | `f8a15a691babc9504392e24a2031fe542936926c62c8c2b74da15d041aaad493` | 30,694 | `0644` | `09b52ae1eac364d9de5db6bedcb21983d228c1a6f773565f40c1c822f4fe9390` | **Modified** (`+5,389` B, 62 lines) |
| `infra/README.md` | 61,970 | `3c27066a3307922336fbc56c0b91d40f6584fc8793d6a0f1640c6739c103c577` | 61,970 | `0644` | `3c27066a3307922336fbc56c0b91d40f6584fc8793d6a0f1640c6739c103c577` | Unchanged |
| `docs/human_review/decisions-needed.md` (Lead) | 27,316 | `e094466c40574a98bc021275df2550a883ab1596071190df5eb167bd3fa17605` | 28,718 | `0644` | `ca3f743088d8ec90260901e62cc04b946a919241f6cbdb3b5d6a493c4399891d` | **Modified** (`+1,402` B, 24 lines in `§G1`) |
| `docs/reviews/M4/architect-conformance.md` | 48,139 | `848f220df6ec66c2276a4b5f9093f974082cb0586d42dc0ab0728f8b4ac6ec89` | 80,674 | `0644` | `71ee98ddd6301dbae0a9a23b49a21810defe6608616a33293aa687abe1553542` | **Modified** (Round 6–7 + R7.8) |
| `docs/reviews/T7/qa.md` | 53,513 | `d281f94b6df7ef140cc95e2310db00178d5789db9eb19d3478ef7dc017309e27` | 92,706 | `0644` | `a1ac1e7f60c1c593a9c6a4422fd54d5a948c1dbd3ed1d59b229c92a149b4cf8d` | **Modified** (C10 accepted run) |
| `docs/reviews/M3/qa-e2e.md` | 73,932 | `8db9a7d66b6b3aa02299924ddfd123523bc430656acddca85d3c5674f51202cb` | 79,705 | `0644` | `0f500cd14b64005919f3c1b4044b90f44d4a20051b333b41242b37975e457855` | **Modified** (E-R6/E-R7/E-R8 ledger) |
| `docs/reviews/M4/docs.md` (prior prefix §§1–3) | 47,271 | `a47a7e52d3ccd56d6595c4b0c5cadbd8e0ec43270a77f40556200c54c43e56a7` | 47,271 | `0644` | `a47a7e52d3ccd56d6595c4b0c5cadbd8e0ec43270a77f40556200c54c43e56a7` | Prefix preserved byte-for-byte |

Private host-only check scripts, outputs, screenshots, and manifests in `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-5561e8f-c8R3Prep/m4-final` (directory mode `0700`, original `MANIFEST-m4-final.sha256` preserved read-only alongside `MANIFEST-m4-final-v2.sha256`):

| Artifact in `$R/m4-final` | Mode | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `audit-m4-final.mjs` | `0700` | 29,788 | `bb683e43bd913e290d4bfb525a0d67e44555ac5ef78f325cdc934cca0826cd6e` |
| `check-html-offline-final.mjs` | `0700` | 8,641 | `4b2593937b627f568f7f87f5cc1281050e1331d6f43e0bff619ff25435624ac8` |
| `check-status-closure-map.mjs` | `0700` | 3,266 | `894296dcb9c6796506cf1917d1024a925e1e30277ff598a1329a7272afa024a8` |
| `check-final-closure-map-v2.mjs` | `0700` | 5,996 | `66eed0711e30a8a01d0b01c49e8dbd01cf0e3da44eded42e754be7854d4e1fc7` |
| `audit-m4-final.json` | `0600` | 44,789 | `a0e0d4fbcff254de9f2f4a8703cb1b299f876a156fd06c591edb465b9d067a5a` |
| `html-offline-check.json` | `0600` | 5,903 | `b8b76892a8c583258c73f943e43eea0723d152c06bddf1e1750c21630eec5f5c` |
| `status-closure-map-check.json` | `0600` | 16,802 | `06051be30ff22e62b0dfd36d702908e98f08393602ca58ecb266c38d018fc9f4` |
| `final-closure-map-v2.json` | `0600` | 12,402 | `a5ecbee54efb3f3d8893c293a8e37cf5be79a2ffba35d8945b53f2d0cfe1f502` |
| `canvas-blackboard-desktop.png` | `0600` | 941,786 | `8496975c0f541129aa28d761ed42a1e2ec2508e4662a02dc376820c7d63bb240` |
| `canvas-blackboard-mobile.png` | `0600` | 905,789 | `56e72c33ca50bff6a75be8cc0a72f9fc50e0fb2b81acff88d00ba21e617c47af` |
| `MANIFEST-m4-final.sha256` (preserved) | `0600` | 738 | `4cb8bbcb93294de7c0ddf14a90159ff7ded8aa0c45f6ffc5fb86ee294eb6e0c3` |
| `MANIFEST-m4-final-v2.sha256` (complete) | `0600` | 1,018 | `014efd189bef20d41fcf49554f7126dd2a37e9bd424a856644f5ab68dce176df` |

### 4.2 File-by-File Verification of the Final Guide Delta (`958ee5c..911219b0`)

1. **`README.md` (`8,263` → `11,271` B, `23` changed lines):**
   - Binds the exact evidence basis `31f4d0bb` (2026-10-23), product `C6` (`4008afb9`), M1 tests `C9` (`9eb504f5`), M2 actual tests `C8` (`5561e8f7`), and T7 actual tests `C10` (`97b68af4`, `tests` tree `ec2d86f5`).
   - Accurately states each accepted evidence family and its limitations without overclaiming:
     - **M2 (`C8`/`C6`, `r7` accepted under `E-R6`):** `64/64` cases, `13` criteria, `7` gates; Attempt 3 remains `NOT ACCEPTED`; missed prelaunch hold, bridge reconciliation, and `256`-event query limit disclosed; later `C9` `tests` equivalence does not change the run identity.
     - **M1 (`C6`/`C9` accepted under `E-R7`):** two equal fresh rounds of `394` `sim` cases each, plus `94` separately carried `C4` (`bf09cda`) rows including `72` storage rows (`2` migration rows + `70` storage rows) — explicitly never relabeled as `488` fresh `C6`/`C9` runs.
     - **Legacy 12 groups (`E-R4`):** `304` raw `PASS` entries; per-subrun unique-ID sum `251` (explicitly noted as not a global distinct count); functional results accepted while the exclusive-host condition failed.
     - **T7 Moodle E2E (`C10` `97b68af4` / `C6` `4008afb9`, run `qa-e2e-m3-r3-97b68af4-2026-10-23T16-26-41-657Z` accepted under `E-R8`):** all `15` criteria `PASS`, `3` cycles of `17 PASS, 0 FAIL, 1 SKIP` (permitted demo skip), demo prepare `11.45 s`, both player launches `PASS`, `4/4` confirmation/refusal checks `PASS`, `51` default tests with `0` viewport click retries, `12/12` PNGs passed judgment, `32/32` complete protected records unchanged, strict secret scan `PASS` (`162` values, `0` shared hits), shared-host attribution not proving exclusivity, snapshot limits, LA watcher restart/replay (`< 2 min` gap), earlier `c5683f8` and `aff4882` passes historical, and prior `C8` attempt + shared-log scan `FAILED`.
     - **Architect conformance (`AC-M4-06`):** `APPROVE` (`docs/reviews/M4/architect-conformance.md#r76-verdict`, `0` BLOCKER, `0` MAJOR); `ADR-011` accepted for design and prototype conformance; `ADR-012` revisions `3.3–3.7` accepted for this prototype only; `G-1` applies only to the measured host/tool identities; no Docker volume generation ID; `c-host-negative` proves fault detection not bind-mount locking; `content_check_failed` has unit evidence only; lost-lock exit has host fault-injection evidence only; `operation_lock_invalid` requires STOP/escalate with no validated manual recovery; all `32` live rows remain `UNVERIFIED` (`CANVAS-LOCAL` `DEFERRED`).
2. **`docs/guides/canvas-admin.md` (`11,565` → `11,757` B, `3` changed lines) and `docs/guides/blackboard-admin.md` (`7,294` → `7,486` B, `3` changed lines):**
   - Both admin guides update their top evidence headers to `31f4d0bb` (2026-10-23), binding `C6`, `C9`, `C8`, `C10` (`97b68af4`), runtime acceptance, and Architect conformance `APPROVE`, while preserving `[SIM]`, `[DOC]`, `[UNVERIFIED]`, and `"Not yet tested on a real Canvas/Blackboard site."` on live matrix references.
3. **`docs/guides/operator.md` (`19,229` → `20,306` B, `9` changed lines):**
   - Updates the header to `31f4d0bb` (`C6`, `C9`, `C8`, `C10` `97b68af4`, conformance `APPROVE`).
   - In `§1.1`, binds the `72` carried `C4` storage rows (`2` migration + `70` storage rows) inside the separate `94`-row ledger under `E-R7`, cites `ADR-012` revisions `3.3–3.7` prototype-only acceptance and Lead-owned `decisions-needed.md` `§G1`, and states all storage limits (`G-1` measured identities only, no volume generation ID, negative host test proves fault detection not bind-mount locking, `content_check_failed` unit-only, lost-lock exit host fault-injection only, `operation_lock_invalid` stop and escalate with no validated manual recovery).
   - In `§4`, marks Moodle upgrade/rollback cases (`M1-11.upgrade-preserves-moodle`, `M1-12.rollback-moodle-only`, `M1-12.rollback-blocks-non-standard`) as `[SIM (carried C4)]` within the separate `94`-row ledger (`E-R7`), explicitly stating they are not fresh `C6`/`C9` runs.
4. **`docs/guides/teacher.md` (`10,284` → `10,992` B, `8` changed lines):**
   - Updates the header and `§1` Moodle live evidence note to bind accepted `T7` (`C10` `97b68af4` / `C6` `4008afb9`, `15/15` criteria `PASS`, `3 × 17 PASS, 0 FAIL, 1 SKIP`, `11.45 s` demo prepare, `51` default tests with `0` viewport click retries, `12/12` PNGs passed, `32/32` protected records unchanged, `162` values / `0` shared scan hits, shared-host limits, historical `c5683f8`/`aff4882`, and failed `C8` attempt), and updates `§2`, `§3`, and `§5` (`MOODLE-LIVE AC-T7-01..06, AC-T7-12`) to cite accepted `C10` `T7`.
5. **`docs/guides/troubleshooting.md` (`14,839` → `15,041` B, `3` changed lines):**
   - Updates the top evidence banner to `31f4d0bb` (`C6`, `C9`, `C8`, `C10` `97b68af4`, conformance `APPROVE`, real Canvas/Blackboard untested).
6. **`docs/human_review/START-HERE.md` (`6,527` → `7,384` B, `6` changed lines):**
   - Updates the header, `§4`, and `§5` to match `README.md` on `C8` M2 (`64/64`), `C9` M1 (`2 × 394` fresh + `94` carried `C4` rows including `72` storage rows), `12` legacy groups (`304` raw `PASS`, `251` per-subrun sum, `E-R4`), `C10` T7 (`15/15` criteria `PASS`, `3 × 17 PASS, 0 FAIL, 1 SKIP`, `11.45 s` prepare, `4/4` confirmations/refusals, `162` values / `0` shared scan hits, shared-host attribution limits, prior `C8` attempt failed), `AC-M4-06 APPROVE`, `G-1` storage limits, and `32` `UNVERIFIED` live rows (`CANVAS-LOCAL` `DEFERRED`).
7. **`docs/human_review/canvas-blackboard.html` (`22,070` → `24,366` B, `21` changed lines):**
   - Updates the header `.lead` banner and `#evidence` table/notes to bind `31f4d0bb`, `C6`, `C9`, `C8`, `C10` (`97b68af4`), `E-R4`, `E-R6`, `E-R7`, `E-R8`, `AC-M4-06 APPROVE`, `decisions-needed.md` `§G1`, shared-host attribution/snapshot/watcher limits, `C8` T7 failure, and M2 Attempt 3 non-acceptance.
8. **`docs/human_review/deferred.md` (`25,305` → `30,694` B, `62` changed lines):**
   - Updates the `§Canvas and Blackboard phase (M4)` header (`lines 106–108`) and `### Guide and source-checkpoint notes` (`line 178`) to `31f4d0bb` (`C6`, `C9`, `C8`, `C10` `97b68af4`, conformance `APPROVE`).
   - Adds `### T7 C10 repair review limits` (`lines 192–208`), recording that the `C8` T7 attempt (`1` screenshot failure causing `7` later failures) and its separate shared-log scan (`1` redaction failure) remain `FAILED`, that `C10` passed independent static/synthetic QA, both source/identity reviews, and the accepted runtime check (`51` default tests with `0` viewport click retries, `12/12` PNGs showing completion controls or full picker), and listing the five nonblocking C10 review findings:
     - `A-T7C10-01` (MINOR): One full-page picker capture remains before later footer actions; the inferred mechanism requires judgment from each runtime trace (`A4`/`B4`/`B5` traces for viewport retries in every run).
     - `A-T7C10-02` (NIT): Import closures exclude the four repair files; M1 and M2 typecheck globs include E2E files; typecheck passed at `C10` (keep precise import-closure wording; do not claim complete executable exclusion).
     - `A-T7C10-03` (NIT): The earlier final-binding checklist named `C8` for T7; `C10` now identifies T7 while M2 remains `C8` (bind final T7 evidence to `C10`; keep actual M2 at `C8`; final document closure remains pending).
     - `B-C10-01` (NIT): The viewport helper copies evidence-name and folder rules; its comment omits the maintenance reason (add a comment in a later authorized test batch; keep `C10` unchanged).
     - `B-C10-02` (NIT): The copied wrapper uses an absolute frozen-source path; it resolves to the intended location without a behavior difference (consider relative notation in a future copy; keep the accepted wrapper unchanged).
   - Adds `### Tracker, focus and verification limits` (`lines 210–249`), listing `A-TR-01`, `A-TR-02 / B-M3TR-01`, `A-TR-04 / B-M3TR-02`, `B-M3TR-03`, `B-M3TR-05`, `A-TR-05 / B-M3TR-06 / B-M3TR-07`, `AR-M3-T609-01/02`, and `A-M4P-R2-01`, plus the retained boundaries on `B-M3TR-04`, `AR-M2-LW-02`, storage-harness MINORs, `A-DH` / `B-M1-DH` / `N1–N7` NITs, nominal `10 ms` and `150 ms` check intervals, post-`SIGKILL` log loss and unmeasured Docker restart behavior, T7 shared-host attribution / snapshot intervals / LA watcher restart (`< 2 min` gap), and `ADR-012` prototype-only acceptance (`72` storage rows carried in the `94`-row ledger, `G-1` measured identities only, no volume generation id, negative host test fault detection vs bind-mount locking, `content_check_failed` unit-only, lost-lock exit host fault-injection only, `operation_lock_invalid` stop and escalate).

### 4.3 Acceptance Criteria Assessment (`docs/architecture/tasks/M4.md` `AC-M4-01` .. `AC-M4-08`)

| Criterion (`docs/architecture/tasks/M4.md`) | Verdict | Verification Summary |
| --- | --- | --- |
| **`AC-M4-01`** Every new or changed guide step names its evidence label. A step from the live matrix that is still `UNVERIFIED` carries `"Not yet tested on a real Canvas site"` or `"Not yet tested on a real Blackboard site"`. A `CANVAS-LOCAL` result is never described as hosted Canvas. | **PASS** | Every new or changed guide step names its evidence label (`[SIM …]`, `[MOODLE-LIVE …]`, `[DOC …]`, `[L-… UNVERIFIED]`, `[HOST-QA]`, `[PROCESS]`, `[Not verified by QA]`). All `130` `npm run` references and all `69` `M1-XX.*` case IDs resolve (`0` missing). Across `docs/guides/*.md`, `65` `L-C*/L-B*` live ID occurrences resolve to `docs/architecture/tasks/M3.md` (`0` missing): `62` carry the literal `"Not yet tested on a real Canvas/Blackboard site."` note on the same line, while the `3` remaining occurrences flagged in `audit-m4-final.json` (`liveIdMissingRealSiteNoteCount = 3`, all `inDelta: false` — `canvas-admin.md:121` `L-C13`, `canvas-admin.md:135` `L-C14`, and `operator.md:239` `L-C14`) are `NOTE:` callouts stating that `L-C13` (`CANVAS-LOCAL`) is deferred/`UNVERIFIED` or that no QA case covers signing-key rotation (`L-C14`), directly adjacent to numbered steps (`canvas-admin.md:129–133, 139`; `operator.md:233–237`) that repeat `"Not yet tested on a real Canvas site."` `CANVAS-LOCAL` (`L-C13`) is never described as hosted Canvas. |
| **`AC-M4-02`** No document says `"works with Canvas"`, `"works with Blackboard"`, `"certified"` or an equivalent, unless the matching live rows are `PASS`. The README table says `"signed simulation"` for `SIM` evidence. | **PASS** | `0` occurrences of `"works with Canvas"`, `"works with Blackboard"`, `"certified"`, or equivalent claims across all 10 M4 guide files and `decisions-needed.md`. `README.md` (`#evidence-labels`, `#supported-lms`) and `canvas-blackboard.html` (`L82, L191–192, L222`) explicitly state `"signed simulation"` for `SIM` evidence and mark all `32` real-LMS rows `UNVERIFIED`. |
| **`AC-M4-03`** Simplified Technical English checks as in `AC-T9-04`: procedure sentences `<= 20` words, descriptive sentences `<= 25` words, paragraphs `<= 6` sentences; measured with the T9 method, results in `docs/reviews/M4/docs.md`. | **PASS** | Measured with the T9 method (`audit-m4-final.json`, full tables in `§4.4`): in the final `958ee5c..911219b0` delta (`117` changed lines across the 9 Markdown guide files), `0` procedural sentences (`max = 0`), `291` descriptive sentences (`max = 16` words `<= 25`, `0 > 20`), and `42` paragraphs (`max = 6` sentences `<= 6`, `0 > 6`); across the cumulative M4 Markdown diff `aaa823b..911219b0` (`900` changed lines), `174` procedural sentences (`max = 19` words `<= 20`, `0 > 20`), `1,295` descriptive sentences (`max = 25` words `<= 25`, `0 > 25`), and `158` paragraphs (`max = 6` sentences `<= 6`, `0 > 6`); in `canvas-blackboard.html`, `218` sentences (`max = 22` words `<= 25`, `0 > 25`) and `25` `<p>` paragraphs (`max = 6` sentences `<= 6`, `0 > 6`). |
| **`AC-M4-04`** The guides contain no `DataCamp` value (client id, host, path) and no copied provider prose; provider facts link to the research file or to the provider page. | **PASS** | Across all 10 M4 guide and review-pack files (`README.md`, `docs/guides/*.md`, `docs/human_review/{START-HERE.md,canvas-blackboard.html,deferred.md}`, `infra/README.md`), there are `0` `DataCamp` tokens, client IDs, hosts, paths, or case-study-only values (`/blackboard/proxy`, `public_jwk/scope/update`). Raw `audit-m4-final.json` records `forbiddenHitsCount = 2` solely in Lead-owned `docs/human_review/decisions-needed.md` (`line 17` `Q3` and `line 21` `Q2`, `inDelta: false`), which are historical Moodle-phase question rows outside the 10 M4 guides. All `38` `F-BB-*` / `F-CV-*` / `F-STD-*` / `F-WK-*` citations resolve to `docs/research/multi-lms.md`, and all `263` checked links/anchors resolve (`0` broken). |
| **`AC-M4-05`** The review page opens from the file system without network access, shows the four items of the scope list, and states the three live blockers (`B-1`, `B-2`, `B-3`) in one sentence each. | **PASS** | `docs/human_review/canvas-blackboard.html` (`24,366` B, `836b6072...`) loads over `file://` with `offline: true` (`1` `file://` request, `0` non-`file://` requests, `0` page/console errors), displays the 4 scope items from `tasks/M4.md:27` (`#tenancy` diagram, `#grant` 8-step approval flow + trust boundary table, `#profiles` 6-row table, and `#evidence` live matrix status + `#decisions` `D-1..D-12` table), and states `B-1` (`22` words), `B-2` (`16` words), and `B-3` (`16` words) in one sentence each (`§4.4.3`). |
| **`AC-M4-06`** The Architect conformance report compares the M1 and M2 code with `ADR-011` and both contracts, lists every deviation with severity (charter §5), and gives `APPROVE` or `CHANGES_REQUESTED`. `APPROVE` needs no open `BLOCKER` or `MAJOR` deviation. | **PASS** | `docs/reviews/M4/architect-conformance.md` (`80,674` B, SHA-256 `71ee98ddd6301dbae0a9a23b49a21810defe6608616a33293aa687abe1553542`) compares M1 and M2 code with `ADR-011`, `ADR-012`, and both contracts, lists all deviations with charter §5 severities (`0 BLOCKER, 0 MAJOR`), gives `AC-M4-06: APPROVE` in `### R7.6 Verdict` (`#r76-verdict`), and in `### R7.8 Final QA report binding (2026-10-23, about 16:53 UTC)` binds `docs/reviews/T7/qa.md` (`92,706` B, `a1ac1e7f...`), `docs/reviews/M3/qa-e2e.md` (`79,705` B, `0f500cd1...`), and `c10-artifact-manifest.json` (`366,538` B, `b0e65ca6...`). All `38` links inside `architect-conformance.md` resolve (`0` broken). |
| **`AC-M4-07`** `docs/human_review/decisions-needed.md` (Lead) lists `Q19` to `Q22` of `open-questions.md` and the follow-up decisions `D-1` to `D-12` with the defaults of `ADR-011` §15. | **PASS** | Direct inspection of Lead-owned `docs/human_review/decisions-needed.md` (`28,718` B, SHA-256 `ca3f743088d8ec90260901e62cc04b946a919241f6cbdb3b5d6a493c4399891d`) confirms: (1) `§E` (`Q19–Q22`) and `§F` (`D-1..D-12`) record options, prototype defaults, blast radii, and owners matching `ADR-011` §15 and `canvas-blackboard.html` `#decisions`; and (2) `§G1` (`lines 126–155`) records the 2026-10-23 checkpoint closing `G-1`'s blocking design findings under prototype-only acceptance (`ADR-012` revisions `3.3–3.7`, `E-R7`, `E-R8`, `architect-conformance.md#r76-verdict`) while preserving historical `G-1` snapshots verbatim below line 152. All `14` links inside `decisions-needed.md` resolve (`0` broken). |
| **`AC-M4-08`** `docs/human_review/deferred.md` (Docs) has an entry for `A-M0-10` (`ADR-011` `D-12`, `R-M-16`): the residual race after a release, its scope (`canvas-self-hosted` only; hosted Canvas and Blackboard issuers are reserved), its impact (setup can be blocked; no Canvas access because check 14 refuses before storage), the operator order, that prompt redemption does not prevent it, and that a reserved-identifier or quarantine design is needed before enterprise use. `operator.md` and `troubleshooting.md` (`PLATFORM_IN_USE` after a release) say the same, with no stronger claim. | **PASS** | `docs/human_review/deferred.md` (`### A-M0-10 (D-12): residual race after a release`, `lines 114–125`), `docs/guides/operator.md` (`§3a`, `lines 169–187`), and `docs/guides/troubleshooting.md` (`PLATFORM_IN_USE` after a release, `line 62`, plus `canvas-blackboard.html` `#decisions` note, `lines 247–250`) all state the exact residual race, scope (`canvas-self-hosted` only; hosted Canvas and Blackboard issuers return `ISSUER_RESERVED`), impact (setup blocked with `PLATFORM_IN_USE`; no Canvas access because launch check 14 refuses before storage), operator order (issue grant, suspend, release, redeem at once), limit (shortens window, does not prevent the race), and enterprise requirement (reserved-identifier or quarantine design first), with no stronger claim. |

### 4.4 STE, Link/Anchor, and Offline HTML + Accessibility Verification

#### 4.4.1 STE Metrics on the Final M4 Delta (`958ee5c..911219b0`)

Automated tokenization (`audit-m4-final.mjs`, T9 §5 method: inline code = `1` word, bracketed evidence tags stripped before word count, headings/tables/fences separated from paragraph sentence counts) on the changed lines in `958ee5c..911219b0` across all 9 Markdown guide files (`117` changed lines total) plus Lead-owned `decisions-needed.md` (`24` changed lines):

| File | Changed Lines (`958ee5c..911219b0`) | Proc Segments | Max Proc Words (`<= 20`) | `> 20`w Proc | Desc Segments | Max Desc Words (`<= 25`) | `> 20`w Desc | `> 25`w Desc | Paragraphs | Max Sent/Para (`<= 6`) | `> 6` Sent/Para |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `README.md` | 23 | 0 | 0 | 0 | 67 | 16 | 0 | 0 | 10 | 6 | 0 |
| `docs/guides/canvas-admin.md` | 3 | 0 | 0 | 0 | 9 | 10 | 0 | 0 | 2 | 5 | 0 |
| `docs/guides/blackboard-admin.md` | 3 | 0 | 0 | 0 | 9 | 10 | 0 | 0 | 2 | 5 | 0 |
| `docs/guides/operator.md` | 9 | 0 | 0 | 0 | 22 | 15 | 0 | 0 | 5 | 6 | 0 |
| `docs/guides/teacher.md` | 8 | 0 | 0 | 0 | 25 | 14 | 0 | 0 | 5 | 5 | 0 |
| `docs/guides/troubleshooting.md` | 3 | 0 | 0 | 0 | 11 | 13 | 0 | 0 | 2 | 6 | 0 |
| `docs/human_review/START-HERE.md` | 6 | 0 | 0 | 0 | 21 | 16 | 0 | 0 | 4 | 6 | 0 |
| `docs/human_review/deferred.md` | 62 | 0 | 0 | 0 | 127 | 14 | 0 | 0 | 12 | 6 | 0 |
| `infra/README.md` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **9 Markdown Guide Files Subtotal** | **117** | **0** | **0** | **0** | **291** | **16** | **0** | **0** | **42** | **6** | **0** |
| `docs/human_review/decisions-needed.md` (Lead `AC-M4-07` register) | 24 | 0 | 0 | 0 | 30 | 15 | 0 | 0 | 8 | 9* | 1* |

*\*Note on Lead-owned `decisions-needed.md` (`AC-M4-07` decision register, `lines 140–144`):* Those 5 consecutive lines in `§G1` form a compact 9-sentence technical limitation block where every sentence is `6–11` words (`max 11` words). `decisions-needed.md` is the Lead-owned decision register governed by `AC-M4-07`; across all 10 M4 guide and review-pack files governed by `AC-M4-03`, `0` paragraphs exceed `6` sentences (`max = 6`).

#### 4.4.2 Cumulative Full-M4 STE Summary (`aaa823b..911219b0`)

Across the entire M4 Markdown diff (`aaa823b..911219b0`, `900` changed lines across all 9 Markdown guide files):
- **Procedural sentences:** `174` segments, max `19` words, **`0 > 20` words**.
- **Descriptive sentences:** `1,295` segments, max `25` words, **`0 > 25` words** (the only `8` segments in the `21–25` word band are the exact `8` non-procedural notes/table/bullet sentences already manually classified in `§1.3` and `§3.3`; `0` new `>20`-word sentences were added in `958ee5c..911219b0`).
- **Paragraph length:** `158` paragraphs, max `6` sentences, **`0 > 6` sentences**.
- **HTML review artifact (`docs/human_review/canvas-blackboard.html`, `24,366` B):** `133` prose blocks (`<p>`, `<li>`, `<td>`, `<caption>`, `<desc>`), `218` sentences, max `22` words (`B-1` live blocker in `#evidence`, `22` words), **`0 > 25` words**; `25` `<p>` paragraphs, max `6` sentences, **`0 > 6` sentences**.

#### 4.4.3 Offline `file://` Browser, Interactive Control, and Automated Axe Check (`canvas-blackboard.html`)

Headless Chromium verification via `check-html-offline-final.mjs` (`html-offline-check.json`, SHA-256 `b8b76892a8c583258c73f943e43eea0723d152c06bddf1e1750c21630eec5f5c`) on `docs/human_review/canvas-blackboard.html` (`24,366` B, SHA-256 `836b6072b1ebbc08c2c388d6e7e5c3289d5d055d4f10fbba15a22860f8029d3d`):

| Check | Result (`html-offline-check.json`) | Verdict |
| --- | --- | --- |
| Offline `file://` load (`offline: true`, route interceptor) | `requests = 1` (`file://.../docs/human_review/canvas-blackboard.html`), `nonFileRequests = 0` | **PASS** |
| Runtime errors | `pageErrors = 0`, `consoleErrors = 0` | **PASS** |
| Desktop layout (`1440×1000`, `canvas-blackboard-desktop.png`) | `scrollWidth = 1440 <= innerWidth = 1440` (`hasHorizontalOverflow = false`); `.two` renders two equal columns (`["485px 485px", "485px 485px"]`); all 5 sections (`#tenancy`, `#grant`, `#profiles`, `#evidence`, `#decisions`), 6 provider profiles, 12 open decisions (`D-1..D-12`), and 3 one-sentence live blockers (`B-1..B-3`) render cleanly | **PASS** |
| Mobile layout (`375×812`, `canvas-blackboard-mobile.png`) | `scrollWidth = 375 <= innerWidth = 375` (`hasHorizontalOverflow = false`); `.two` collapses to single column (`["281px", "281px"]`); all `5` `.scroll` containers (`Tenancy diagram` `281/281`, `Trust boundary table` `281/281`, `Provider profiles table` `281/672`, `Evidence table` `281/283`, `Open decisions table` `281/287`) have `overflow-x: auto` | **PASS** |
| Interactive 8-step grant control (`#grant-ctl`) | `Step 1 of 8` (`#g-prev` disabled) through `Step 8 of 8` (`#g-next` disabled) and back (`Step 7 of 8`), updating `.on` and `aria-current="step"` on `#grant-steps li` | **PASS** |
| No-JavaScript fallback (`javaScriptEnabled: false`) | `#grant-ctl` remains hidden (`ctlHidden = true`) while all `8` `<ol id="grant-steps">` items render in full (`stepsCount = 8`) | **PASS** |
| `<details>` disclosure & observed focus state | Clicking `#evidence details summary` expands `<details>` (`detailsOpenHasAllGroups = true`: `L-C01..L-C15` except unused `L-C05`, `L-B01..L-B18`). Pressing `Tab` after clicking `#evidence details summary` focused the link inside `<details>` (`href = "../architecture/tasks/M3.md#5-live-check-matrix"`, `className = ""`, `left = 292.234375`, `outline = "solid"`); top-of-page initial `.skip` focus was not tested in this run | **PASS (observed focus)** |
| `@axe-core/playwright` scan | Desktop (`1440×1000`, `<details>` expanded): **`0` violations**, `46` passes, **`1` incomplete** (`color-contrast` assessment). Mobile (`375×812`): **`0` violations**, `47` passes, **`1` incomplete** (`color-contrast` assessment). Automated axe checks report `0` violations; `1` `color-contrast` item remains `incomplete` on both viewports, so no full accessibility compliance claim is made | **PASS (`0` violations; `1` incomplete disclosed)** |

### 4.5 Final M4 Gate Verdict

- **Final M4 Docs QA Verdict at `911219b04ba0c8195e935955094155deac0e9fbb`:** **PASS (`0 BLOCKER, 0 MAJOR, 0 MINOR`)**.
- All eight M4 acceptance criteria (`AC-M4-01` through `AC-M4-08` in `docs/architecture/tasks/M4.md`) and T9 STE/offline-HTML checks are **PASS** on frozen candidate `911219b04ba0c8195e935955094155deac0e9fbb`.
- Both independent blind reviewers (`docs/reviews/M4/reviewer-a-final.md` and `docs/reviews/M4/reviewer-b-final.md`) have completed their reports and `APPROVE` substantive `911219b0`; the Lead will record nonblocking deferrals. Human decisions (`Q19–Q22`, `D-1..D-12` in Lead-owned `docs/human_review/decisions-needed.md`) and live tenant/public-HTTPS authorization (`B-1..B-3` for the `32` `UNVERIFIED` live matrix rows) are documented future follow-ups, not unfinished prototype gates.

### 4.6 Independent Assessment of the Final Conditional Post-Gate Closure Plan (`21` Substitutions + `1` Bounded `B-M4F-01 / B-M4F-02` MINOR Block Insertion; `A-SI-05 / B-SI-09` Excluded and Kept Pending)

Per the authoritative coordinator specification and `msg_cf6c37488302` (`check-final-closure-map-v2.mjs` → `final-closure-map-v2.json`, SHA-256 `a5ecbee54efb3f3d8893c293a8e37cf5be79a2ffba35d8945b53f2d0cfe1f502`), Independent Docs QA evaluated the **final closure plan** across the 9 guide files (`README.md`, `docs/guides/{canvas-admin,blackboard-admin,operator,teacher,troubleshooting}.md`, `docs/human_review/{START-HERE.md,canvas-blackboard.html,deferred.md}`; `infra/README.md` has `0` matches and remains byte-identical at `61,970` B `3c27066a...`):

1. **Explicit exclusion of `A-SI-05 / B-SI-09` (`docs/human_review/deferred.md:257`):**
   - The literal sentence `"Independent document closure is pending."` at `docs/human_review/deferred.md:257` (moving to `line 266` after the `B-M4F-01 / B-M4F-02` insertion: `| A-SI-05, B-SI-09 | Text correction committed at 5a5453c: coded refusals, text-only stops, output streams and the container field. Independent document closure is pending. |`) is **excluded** from the final closure map and remains preserved verbatim (`excludedLiteralPreserved` = `1`). `A-SI-05 / B-SI-09` is not closed by this gate and no old build-branch captures are sought.
2. **Exact 12-key (`21`-occurrence) substitution breakdown (`17` status sentences + `4` draft labels = `21` total substitutions):**

| # | Category | Exact Source String | Exact Replacement String | Occurrences |
| ---: | --- | --- | --- | ---: |
| 1 | Status sentence | `"This authored guide candidate awaits independent QA and two blind reviews."` | `"Guide revision 911219b0 passed independent QA and both reviews."` | 1 (`README.md:9`) |
| 2 | Status sentence | `"This guide candidate awaits independent QA and two blind reviews."` | `"Guide revision 911219b0 passed independent QA and both reviews."` | 10 (`canvas-admin.md:5`, `blackboard-admin.md:5`, `operator.md:5`, `teacher.md:78,120`, `troubleshooting.md:48`, `START-HERE.md:5`, `canvas-blackboard.html:10,83`, `deferred.md:108`) |
| 3 | Status sentence | `"Final guide QA and two blind reviews remain pending."` | `"Guide revision 911219b0 passed independent QA and both reviews."` | 1 (`README.md:19`) |
| 4 | Status sentence | `"Final Docs QA and two blind reviews remain pending."` | `"Guide revision 911219b0 passed independent QA and both reviews."` | 1 (`START-HERE.md:11`) |
| 5 | Status sentence | `"Independent document QA and reviews remain pending."` | `"Guide revision 911219b0 passed independent QA and both reviews."` | 1 (`deferred.md:178`) |
| 6 | Status sentence | `"Final guide QA and reviews remain pending."` | `"Guide revision 911219b0 passed independent QA and both reviews."` | 1 (`deferred.md:208`) |
| 7 | Status sentence | `"Independent Docs QA and two blind reviews remain pending."` | `"Guide revision 911219b0 passed independent QA and both reviews."` | 1 (`canvas-blackboard.html:202`) |
| 8 | Status sentence | `"Final document closure remains pending."` | `"Document closure passed at guide revision 911219b0."` | 1 (`deferred.md:202`, `A-T7C10-03`) |
| 9 | Draft label | `"Connect a Canvas site (draft; not yet tested on a real Canvas site)"` | `"Connect a Canvas site (not yet tested on a real Canvas site)"` | 1 (`README.md:87`) |
| 10 | Draft label | `"Connect a Blackboard Learn site (draft; not yet tested on a real Blackboard site)"` | `"Connect a Blackboard Learn site (not yet tested on a real Blackboard site)"` | 1 (`README.md:88`) |
| 11 | Draft label | `"upgrade and rollback (draft)"` | `"upgrade and rollback"` | 1 (`README.md:89`) |
| 12 | Draft label | `"<span class=\"badge\">Draft</span>"` | `"<span class=\"badge\">Prototype</span>"` | 1 (`canvas-blackboard.html:82`) |
| **Total** | | **8 status-sentence keys (`17` hits) + 4 draft-label keys (`4` hits)** | | **21** |

3. **Required bounded MINOR register insertion in `docs/human_review/deferred.md` (`msg_cf6c37488302`):**
   - Pursuant to charter §5 and Reviewer-B (`docs/reviews/M4/reviewer-b-final.md` §6 condition 4), the final closure plan inserts the following exact 9-line (`606`-byte) block immediately before `### Not open deferrals (for clarity)` in `docs/human_review/deferred.md`:
     ```markdown
     ### Final guide review follow-ups

     These two findings are safe to defer. They do not change the verified prototype scope. See [Reviewer-B](../reviews/M4/reviewer-b-final.md).

     | Id | Severity | Finding | Later action |
     | --- | --- | --- | --- |
     | B-M4F-01 | MINOR | C10 T7 guide claims link through the Lead record. The direct QA link is missing. | Add a direct link to the C10 QA record in a later guide update. |
     | B-M4F-02 | MINOR | Internal commit labels and QA terms are not defined for new readers. | Define the labels and move process details into the evidence reference in a later guide update. |
     ```
   - **STE and link check on the inserted block:** The introductory paragraph has `3` sentences (`<= 6` sentences/paragraph) of `7`, `8`, and `2` words (`<= 25` words); the `B-M4F-01` and `B-M4F-02` table cells have sentences of `9`, `6`, `14`, `12`, and `16` words (`max = 16` words `<= 25` descriptive, `<= 20` imperative); and `[Reviewer-B](../reviews/M4/reviewer-b-final.md)` resolves to `docs/reviews/M4/reviewer-b-final.md` (`reviewerBFileExists = true`).
4. **STE, link/anchor, and structural invariance across all `21` substitutions + `1` block insertion:**
   - Every status-sentence replacement substitutes one single declarative sentence (`7` or `9` words, `<= 25` words) for one single sentence (`6–11` words), and every draft-label replacement removes `draft; ` / ` (draft)` or replaces badge text `Draft` with `Prototype` (`1` word), preserving all paragraph sentence counts (`max = 6`), all links/anchors, all HTML structure, all code blocks, all `"not yet tested on a real Canvas/Blackboard site"` qualifiers, and the preserved `"Independent document closure is pending."` cell (`A-SI-05, B-SI-09`).

| File | Frozen `911219b0` Bytes | Frozen `911219b0` SHA-256 | Closure Edits (`21` Substitutions + `1` Insertion) | Post-Closure Bytes | Exact Post-Closure SHA-256 (Conditional) |
| --- | ---: | --- | --- | ---: | --- |
| `README.md` | 11,271 | `c6b67b6ef4d20003a9fe73ea4e9ad1233d1bcdd25c2d428b100e1b02a1f2638c` | 5 (`L9, L19, L87, L88, L89`) | 11,249 | `045eee6e0e3afbd076ccd9947ef526685e592c75b17c98f47242fd232d7c5caa` |
| `docs/guides/canvas-admin.md` | 11,757 | `9f4caf8a655a5d76c9978e7d607f8322606cf79d5aa05cb2810f28e876c91f23` | 1 (`L5`) | 11,755 | `a7d2f6838784e933e8a5ab9fc8cb19a12dc575208aab24e14665eb80b4fc6741` |
| `docs/guides/blackboard-admin.md` | 7,486 | `863843713283d076a37c4ede04d8634779694c9be06e018ae7493598818a3f84` | 1 (`L5`) | 7,484 | `73577ba6db9a6f75e9673511ae54b46f3d4e8d5c6703d0d1e24b2174b74a5410` |
| `docs/guides/operator.md` | 20,306 | `b7cd5c27c7851eca31c9d9f3a5e823dc7ac28cc1a3b40e5a54f4018931239c41` | 1 (`L5`) | 20,304 | `36ba709d7eb7a192b01de27562377ee9012c96edcb3e004fb01f700020363b47` |
| `docs/guides/teacher.md` | 10,992 | `6737820630667a6c54682c18d8359501f71700478567303b434ee44b8f19e04c` | 2 (`L78, L120`) | 10,988 | `94a6ec2b3380c1a8cee2e70ac60dfc9b764b34437a9b8fd8419d39450de8f7bb` |
| `docs/guides/troubleshooting.md` | 15,041 | `cc8a93573271396d5225a01d7242cd5d07fdf7f3ef42bb1cb22fa7d817645a12` | 1 (`L48`) | 15,039 | `0534118354b27b070f8e7ff258a4ebad99e6b224fe9977787733adc671eb6012` |
| `docs/human_review/START-HERE.md` | 7,384 | `b7d24a7d969717ee124e75088c66485c5811e02b3db4e9958912c30557ff78a4` | 2 (`L5, L11`) | 7,394 | `c4bc804df7588da6eee9e13d025b1c4249b7b9bae7dcee1a80dc6258e12c8107` |
| `docs/human_review/canvas-blackboard.html` | 24,366 | `836b6072b1ebbc08c2c388d6e7e5c3289d5d055d4f10fbba15a22860f8029d3d` | 4 (`L10, L82, L83, L202`) | 24,372 | `2d7c9741ed47c6b85541f36192151dd8df60918754b524355347320d97f7b60b` |
| `docs/human_review/deferred.md` (`4` substitutions + `B-M4F-01/02` insertion) | 30,694 | `09b52ae1eac364d9de5db6bedcb21983d228c1a6f773565f40c1c822f4fe9390` | 4 (`L108, L178, L202, L208`) + `1` block insertion before `### Not open deferrals (for clarity)` (`A-SI-05/B-SI-09` preserved at `L266`) | 31,343* | `37a505e748115db675cc00b002d76c3a4536e525b357087821417ce8cf005c94`* |

*\*Note on `docs/human_review/deferred.md`:* With the `4` status substitutions alone (before inserting the `### Final guide review follow-ups` block), `deferred.md` is `30,737` bytes with SHA-256 `5171b88bd9c8e87a8062dc4ec4b23f44664e66e6e496e15b2752d11548762ced`; with the required `### Final guide review follow-ups` (`B-M4F-01`, `B-M4F-02`) block inserted immediately before `### Not open deferrals (for clarity)`, `deferred.md` is `31,343` bytes with SHA-256 `37a505e748115db675cc00b002d76c3a4536e525b357087821417ce8cf005c94`.

- **Conditional Closure-Plan Verdict:** **ACCEPTABLE**, strictly conditional on:
  1. Applying the exact 12-key (`21`-substitution) map plus the single bounded `### Final guide review follow-ups` (`B-M4F-01`, `B-M4F-02`) block insertion in `deferred.md` only after this corrected Independent Docs QA `PASS` (with both independent blind reviews `docs/reviews/M4/reviewer-a-final.md` and `docs/reviews/M4/reviewer-b-final.md` already `APPROVE` on substantive `911219b04ba0c8195e935955094155deac0e9fbb`);
  2. Preserving `"Independent document closure is pending."` (`A-SI-05, B-SI-09`) unchanged in `deferred.md` and making zero other byte edits outside those `21` substitutions + `1` block insertion (producing the exact post-closure byte sizes and SHA-256 digests recorded above); and
  3. Lead exact-map verification and report linkage in the final handover.

