# Docs closing-pass record

Source: commit `6932539`, 2026-10-19.

Docs prepared the guides, review pack and both videos for final artifact review. Final QA-E2E and independent reviews follow this record. This record does not declare T9 complete.

## Evidence used

| Scope | Source | Bounded result |
| --- | --- | --- |
| T4b1, T4b2, P1 | [T4b1 QA](../reviews/T4b1/qa.md#replacement-qa-final-regression--2026-10-19), [T4b2 QA](../reviews/T4b2/qa.md#replacement-qa-final-regression--2026-10-19) | PASS at `a5d9ddcb`. Manual Pending-tool cleanup and URL reuse remain unverified. |
| T5a, T5b, T6 | [T5a QA](../reviews/T5a/qa.md#replacement-qa-final-regression-2026-10-19--d54c607d), [T5b QA](../reviews/T5b/qa.md#replacement-qa-final-regression-2026-10-19--d54c607d), [T6 QA](../reviews/T6/qa.md#replacement-qa-final-regression-2026-10-19--d54c607d) | All 49 ACs and 65 executed tests PASS at `d54c607d`. |
| P2, P5, P11 | [T5b final QA](../reviews/T5b/qa.md#replacement-qa-final-regression-2026-10-19--d54c607d) | P2 restart and 90-second observation PASS. P5 uses an approved fixture. P11 sent, pending and failed variants PASS. |
| Fresh T7 | [T7 QA §10](../reviews/T7/qa.md#10-replacement-qa-e2e-repair-regression--2026-10-19) | All 15 ACs PASS at `c5683f8`. Three runs: 186, 181 and 175 seconds; 17 scenario passes each; no retries. |
| Root checks and demo | [T7 QA §10](../reviews/T7/qa.md#10-replacement-qa-e2e-repair-regression--2026-10-19) | Independent QA passed lint, type checking and 708 tests, with no skips. Refusal checks and both demo launches passed. |
| T8 | [T8 QA round 2](../reviews/T8/qa.md) | AC-T8-02 to AC-T8-10 and both race checks PASS at `8059c31`. No new native-channel run is claimed. |
| AC-T9-01 | [T9 QA](../reviews/T9/qa.md) | Lead accepted QA’s 61-second fresh-clone run. HR-2 unfamiliar-human usability remains open. |
| Conformance | [Architect record](../reviews/T9/architect-conformance.md#10-round-3-p2-late-remote-write) | Accepted prototype scope approved. P2 ordering and upgrade limits remain explicit. |

Historical failures and passes remain in their source reports. This Docs worker did not run product tests or change QA stacks.

## Build and media validation

The complete build source is `6932539d4b44e017dd54acc8dc37c6bb2ba9fed1`. Source stamps name that commit, before generated outputs are committed.

```sh
node docs/human_review/tools/build-md.mjs --stamp
node docs/human_review/tools/build-md.mjs --check
/usr/bin/time -p bash docs/human_review/video/build.sh all
```

All commands exited 0. The combined build took 24.60 seconds. It generated 13 slides per language, using Samantha and Linh.

| Output | Duration | Bytes | Result |
| --- | --- | --- | --- |
| [English MP4](video/explainer-en.mp4) | 182.4 seconds | 2,211,513 | PASS |
| [Vietnamese MP4](video/explainer-vi.mp4) | 212.4 seconds | 2,567,661 | PASS |

Both files are below 240 seconds and 8,000,000 bytes. Both contain 1280×720 H.264 video at 5 fps and mono AAC audio at 44,100 Hz.

Metadata was checked with the pinned ffprobe container. Both complete files decoded with exit 0 and no errors:

```sh
for lang in en vi; do
  docker run --rm --entrypoint ffprobe -v "$PWD/docs/human_review/video:/o:ro" \
    linuxserver/ffmpeg@sha256:742e17516dd4d7b76b939d774bd08f0f6b7cab8bce1c014b95ab2fb992fd0a1f \
    -v error -show_entries format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels,duration \
    -of json "/o/explainer-$lang.mp4"
  docker run --rm -v "$PWD/docs/human_review/video:/o:ro" \
    linuxserver/ffmpeg@sha256:742e17516dd4d7b76b939d774bd08f0f6b7cab8bce1c014b95ab2fb992fd0a1f \
    -hide_banner -v error -i "/o/explainer-$lang.mp4" -map 0 -f null -
done
```

Audio ends at 174.531111 seconds in English and 202.731066 seconds in Vietnamese. The final slide stays visible after narration ends. This technical check does not approve Vietnamese wording or voice quality.

## Visual and document checks

Docs inspected all 26 PNGs under `.tmp/docs/video/{en,vi}/` through contact sheets. Full-size checks covered screenshot slides and the Vietnamese proof, native-channel, limits and decision slides. Text, badges and captions fit without clipping. The screenshots show no visible secret.

Frames extracted from both MP4s show the final source stamp and the P2 limits slide. The Vietnamese machine-translation notice remains visible. Local visual records are in `.tmp/docs/validation/`.

The standalone explainer loaded offline in Playwright. All five tabs worked, with zero script errors, zero HTTP requests and no horizontal overflow. Docs inspected the rendered Start page.

Generated-flow consistency and scoped whitespace checks passed. All 131 local Markdown targets and 63 checked fragments resolved. All 25 decision IDs remain: Q1–Q18, R1–R5, HR-1 and HR-2. Sentence and paragraph scans passed; final independent STE review remains with Reviewer-B.

Routed findings B-T9-05 through B-T9-09 and A-T9-C02 were corrected. These cover procedure length, reset warnings, grade wording, paragraph length and evidence scope.

## Limits retained

The complete list is in [proven / not proven](proven.md). Important boundaries remain:

- P2 cannot guarantee remote ordering after confirmation. Migration 010 cannot recover earlier unrecorded sends. Author upgrade evidence is not independent QA.
- Scoreless and lower-retake conflict P11 variants remain unverified live. Live QA did not observe the full 24-hour retry window.
- T6 covers Chromium at 1440 pixels and five serious/critical axe scans. Untested card states and other accessibility coverage remain unproven.
- MoodleCloud, Moodle-page restore, the portal token form and listed runner hardening paths remain unverified. T8 PASS covers only its listed checks.
- Firefox/Safari teacher paths, other player browsers, mobile, visible video playback and unfamiliar-human use remain unproven. Moodle subfolders remain unsupported.
- HR-1 Vietnamese approval and HR-2 unfamiliar-human follow-up remain open. Q4 remains a human decision; no human approval of the P2 limit is recorded.
- P7/P10 and the other [accepted deferrals](deferred.md) remain. Resolved T8 races are historical findings, not open defects.

## Exact changed paths

These are the Docs-owned changes from the dispatch baseline, including this record. The coordinator owns commits.

- `README.md`
- `docs/guides/learner-view.md`
- `docs/guides/moodle-admin.md`
- `docs/guides/native-channel-moodlecloud.md`
- `docs/guides/run-the-stack.md`
- `docs/guides/teacher.md`
- `docs/guides/troubleshooting.md`
- `docs/human_review/CLOSING-PASS.md`
- `docs/human_review/PLAN.md`
- `docs/human_review/START-HERE.md`
- `docs/human_review/decisions-needed.md`
- `docs/human_review/deferred.md`
- `docs/human_review/explainer.html`
- `docs/human_review/flows.md`
- `docs/human_review/proven.md`
- `docs/human_review/video/explainer-en.mp4`
- `docs/human_review/video/explainer-vi.mp4`
- `docs/human_review/video/script.json`
- `docs/human_review/video/slides.html`
