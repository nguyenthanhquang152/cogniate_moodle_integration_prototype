Verdict: APPROVE
Round: 2

# Reviewer-A: T4a review (lens: "Is it right and is it safe?")

History: the round 1 verdict was APPROVE (findings below). The round 2 verdict is APPROVE (section "Round 2" at the end).

## Round 1

Scope:

- `git diff c3746bb 3ec5222 -- . ':!docs' ':!tests'`: `packages/package-inspector/**`, `services/cogniate-app/**` (session, courses, upload, domain, content-host skeleton, seed), `packages/shared/src/crypto.ts`, and the infra changes.
- Spec: `tasks/T4a.md`, contract `cogniate-app-api.md` §1–§3, `security.md` §6–§7.

Method:

- I read all the code.
- I built 23 crafted zips with Python in a new temp folder and ran them through the real `inspectPackage` and `extractPackage`. My scripts were in a separate folder. I deleted everything afterwards.
- Library versions: `fast-xml-parser` 5.11.2, `yauzl` 3.4.0, `parse5` 8.0.1, `@fastify/multipart` 10.1.4. `npm audit --omit=dev` finds nothing.
- Read-only live checks: requests that the Origin and session rules reject before any write, file modes, and a log scan.
- I did not read `reviewer-b.md`.

Counts: 0 BLOCKER, 0 MAJOR, 1 MINOR, 4 NIT.

## Zip handling (security §7): verified

| Risk | How the code handles it | My test result |
| --- | --- | --- |
| Zip-slip | `checkEntryName` rejects `..` segments (split on `/` **and** `\`), a leading `/` or `\`, and drive letters. `extractPackage` runs the same checks again, writes only the cleaned path, uses `resolve` + `startsWith(dest + sep)`, and opens files with `wx` (O_EXCL) in a **new** folder. | `../evil.html`, `a/../../evil.html` and `a\..\..\evil.html` → `PATH_TRAVERSAL`. `/abs.html` and `C:/x.html` → `ABSOLUTE_PATH`. No file was written outside the target. |
| Symbolic links | Mode bits `S_IFLNK` in the external attributes. Extraction only ever writes regular files. | `SYMLINK_ENTRY` |
| Duplicates | NFC + case fold, also file versus folder and `./` spellings. | `A.html`/`a.html`, NFC/NFD `café.html`, `x` + `x/y.html`, `a/b.html` + `a/./b.html` → `DUPLICATE_ENTRY` |
| Names | Raw bytes are decoded once (UTF-8 flag → strict UTF-8), and the checks and the extraction use the same string. C0, DEL and C1 controls are rejected. Name and segment lengths are limited. | `a\x07.html` → `INVALID_ENTRY_NAME` |
| Encrypted entries, compression method | GP flag bits `0x1` and `0x40` are rejected; only methods 0 and 8 are allowed. | A really encrypted flag (I patched both headers) → `ZIP_INVALID`. bzip2 → `ZIP_INVALID`. |
| Bomb | Ratio per entry over 100, total over 500 MB, and the entry count read from the EOCD **before** any entry is read (yauzl reads only that many). `validateEntrySizes: true` stops data that is larger than the central directory says. | 5 MB of zeros → `ZIP_BOMB`. A central directory size lie (100 bytes declared, 1 MB data) passes inspection and fails at extraction with `ZIP_INVALID`, and the folder is removed. |
| CRC | Checked when text is read and in the extraction pipeline. | A bad CRC on a binary entry → `ZIP_INVALID` at extraction, no folder left. |
| Upload size | Multipart `fileSize` 200 MB with `throwFileSizeLimit`, 1 file, at most 5 parts. The file is streamed to a `wx`/0600 temp file, never buffered. Cleanup is in `finally`. | (QA tests the 201 MB case.) |
| XXE | `<!DOCTYPE` and `<!ENTITY` are rejected on the **decoded** text (UTF-8, or UTF-16 with a BOM). Then the XML is validated and parsed with `processEntities: false`. Only the five predefined entities and numeric references are decoded. | UTF-8 and UTF-16 XXE manifests → `MANIFEST_DTD_FORBIDDEN` |
| SCORM checks | `schemaversion` is exactly `1.2` (or there is none and the adlcp 1.2 namespace is present). One SCO. `masteryscore` must be 0–100, else null. The SCO `href` is resolved inside the package (`%2e%2e`, absolute paths and schemes are rejected) and must be a file in the zip. | `%2e%2e/%2e%2e/etc/passwd` → `LAUNCH_FILE_MISSING` |

## The app side: verified

- **Origin rule.** It is an `onRequest` hook for every write, the login included, and runs before the body is read. Live: no `Origin`, `Origin: null` and the content origin each get `403 ORIGIN_NOT_ALLOWED`.
- **Session.**
  - `__Host-cog_session`: `Path=/; Max-Age=28800; Secure; HttpOnly; SameSite=Lax`.
  - The token is 32 random bytes, and the table stores only its SHA-256. The life is 8 h, not sliding.
  - Each login makes a new token, so session fixation is not possible.
  - A new password in the seed ends the old sessions.
- **Passwords.**
  - scrypt (N 16384, r 8, p 1, 16-byte salt) with `timingSafeEqual`, and the stored `N` is bounded.
  - An unknown email is checked against a dummy hash, so both cases take the same time and give the same error.
  - The seed passes passwords on stdin.
- **Library isolation.**
  - Every course, version and package query has `library_id`. `addVersion` checks the course's library again.
  - The course is resolved before the multipart body is read, so a foreign course id costs no upload.
  - Package folders are random 128-bit `pkg_` ids under `infra/.data/cogniate-app/packages` (mode 700 live).
- **No path to the app origin.** T4a serves no package file. The content host is only a skeleton (`/healthz`). The report comes back as JSON, and the portal (T6) must render its untrusted strings escaped (security §7 already says so).
- **Logs.** Live: 148 lines, with no `.env` value and no 43-character token. Request paths are route templates (`/app-api/courses/:courseId`), so no ids appear.

## Answers to the Author's questions (for the Architect)

1. **`latestVersion` shape.** Follow the contract: `latestVersion: CourseVersion | null`, the same object as `GET …/versions/:id`. There is no security difference.
2. **`masteryScore` sent with a SCORM package.** Prefer `400 INVALID_REQUEST` (field `masteryScore`, "A SCORM package uses its manifest mastery score"). The package's own `scorm-api.js` decides passed or failed with its baked value (70), and the runtime serves the manifest value. A value that is silently ignored makes the user believe that a different pass mark applies. A report warning (`MASTERY_SCORE_IGNORED`) is also acceptable. A silent ignore is not.
3. **`<base href>` as a resource host.** Yes, count it. A `<base href="https://x/">` makes the browser load **every** relative resource of the page from that host, so it is the most important external host to report.

---

## MINOR

### A-T4a-01 — MINOR — Identifiers from the package have no form or length limit, but later tasks use them as keys

- **Location:**
  - `packages/package-inspector/src/html.ts:90-92` (`data-cog-quiz` values)
  - `inspect.ts:141-144` (page keys from file names)
  - `manifest.ts:155-163` (`title`, `identifier`)
- **Problem:** Question ids, page keys and manifest texts come from untrusted package content and are stored in `tracking_profile` and `report` as they are. T5 uses them as keys of `answers` and `seenPages` and shows them in the portal.
- **Evidence:**
  - A question id is any trimmed attribute value up to the 8 MB file limit. So `__proto__`, `constructor`, a 1 MB string or bidi characters all pass.
  - The manifest `title` can be about 2 MB.
  - Contract §7 (T5a) checks commits against these lists and stores answers keyed by question id.
  - A key like `__proto__` in a plain object is a known source of bugs. Megabyte strings in every RuntimeState and report are a cheap denial of service.
- **Fix:**
  - Accept question ids that match `^[A-Za-z0-9._:-]{1,128}$` (Cogniate uses ULIDs). Ignore others, with a report warning.
  - Cap `title` and `identifier` at 500 characters.
  - Ask T5a to keep answers and pages in a `Map` or an `Object.create(null)` object.
  - Add one unit test with `data-cog-quiz="__proto__"` and one with a very long id.

## NIT

### A-T4a-02 — NIT — The resource-host scan misses some loading attributes (the contract list misses them too)

- **Location:** `packages/package-inspector/src/html.ts:89-103`; contract §3 "Report rules".
- **Problem:** `externalHosts` feeds the privacy and availability warning (Q9), and some external loads do not show in it.
- **Evidence:** My test page had `<svg><image href="https://svg.example/…">`, `<object data="https://obj.example/…">` and `<body background="https://bg.example/…">`. The report listed only `css.example` and `img.example`. Not covered either: `xlink:href` and `<use href>`, `imagesrcset`, `.svg` files themselves, and URLs with a tab or newline inside (browsers remove them).
- **Fix:** Add `object[data]`, SVG `href`/`xlink:href` on `image`, `use` and `feImage`, the `background` attribute, and `imagesrcset` to the contract list and the code. Scan `.svg` files as XML or HTML. Remove ASCII tab and newline from a URL before the host test.

### A-T4a-03 — NIT — Bidi and zero-width characters are allowed in entry names

- **Location:** `packages/package-inspector/src/names.ts:9` (`CONTROL`).
- **Problem:** A name such as `gpj.\u202eexe.html` passed in my test. In the report and in later UI it shows as a different file name.
- **Fix:** Reject `U+200B–U+200F`, `U+202A–U+202E`, `U+2066–U+2069` and `U+FEFF` as `INVALID_ENTRY_NAME`.

### A-T4a-04 — NIT — Original zips are shared by content hash across libraries

- **Location:** `services/cogniate-app/src/app/upload.ts:96` (`uploads/{sha256}.zip`).
- **Problem:** Two libraries that upload the same bytes share one stored file. The rename silently replaces the other library's file, with the same content. A later delete or clean-up feature (T6, T8) can then remove or keep data across libraries.
- **Fix:** Store the original as `uploads/{packageId}.zip`, the package row already has `library_id`. Or count references before any delete.

### A-T4a-05 — NIT — `/app-api/*` responses have no `X-Content-Type-Options: nosniff`

- **Location:** `services/cogniate-app/src/app/server.ts:101-103` (`onSend` sets only `cache-control`).
- **Problem:** Live, `GET /app-api/me` has no `nosniff`. JSON that holds untrusted report text should never be sniffed as another type. The T6 download of the original zip from the app origin must also send `Content-Disposition: attachment`.
- **Fix:** Add `x-content-type-options: nosniff` in the same `onSend` hook. Put the attachment rule in T6.

---

## Round 2

Verdict (round 2): APPROVE

Input: `git diff 3ec5222 9edf5fd -- packages/package-inspector services/cogniate-app infra` (14 files). I ran 12 crafted zips through the real `inspectPackage` (temp folder, deleted afterwards) and made one live header check. I did not read `reviewer-b.md`.

Round 2 counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 2 NIT (A-T4a-06, A-T4a-07).

| Round 1 id | Status | Evidence |
| --- | --- | --- |
| A-T4a-01 (MINOR) | Resolved | `identifiers.ts`: question ids `^[A-Za-z0-9._:-]{1,128}$`, page keys `^[A-Za-z0-9._-]{1,64}$` and unique, `__proto__`, `prototype` and `constructor` reserved in any case, titles 1–255 characters with no C0 or C1. The rules apply to every manifest, organization, item and resource identifier and every title, before anything is stored. Tests: `data-cog-quiz="__proto__"` and `"__PROTO__"` → `INVALID_PACKAGE_IDENTIFIER`; a 129-character id → rejected; `data-lesson-id="constructor"` → rejected; two pages with one key → rejected; the fixture id still passes. No package value can reach an object key outside these rules. |
| A-T4a-02 (NIT) | Resolved | One test page found all of these: SVG `image href`, `use xlink:href`, `feImage href`, `object data`, `table background`, `imagesrcset`, a tab inside `ht\ttps://`, and an `.svg` file with `xlink:href` (8 hosts). |
| A-T4a-03 (NIT) | Resolved, one gap | U+200B–200F, U+202A–202E, U+2066–2069 and U+FEFF are rejected (`a‮b.html` → `INVALID_ENTRY_NAME`). See A-T4a-06. |
| A-T4a-04 (NIT) | Not changed | Accepted as deferred to T6/T8 (download and delete). |
| A-T4a-05 (NIT) | Resolved | Live: `x-content-type-options: nosniff` on `/app-api/me`. It is set in an app-level `onSend` hook, so every response gets it. |
| Author question 2 | Resolved as I suggested | A `masteryScore` with a SCORM package gives `400 MASTERY_SCORE_NOT_ALLOWED`, after inspection and before extraction, so nothing is written. |

No regressions in my lens. The new `REJECT_INFO` title and action text is fixed text. Package values appear only in `path` and `detail`, which never echo a rejected identifier value.

### A-T4a-06 — NIT — The entry-name rule still allows a few invisible or bidi characters

- **Location:** `packages/package-inspector/src/names.ts:9` (`CONTROL`).
- **Problem:** These characters pass the name rule: U+061C (Arabic letter mark, a bidi control), U+2028 and U+2029 (line and paragraph separators), U+2060–U+2064 (word joiner, invisible operators), U+180E and U+00AD.
- **Evidence:** In my tests, root `.html` files with them failed only through the page-key rule. A file in a subfolder (for example `assets/a؜b.png`) has no page key, so it passes.
- **Fix:** Add `­؜᠎  ⁠-⁤` to `CONTROL`.

### A-T4a-07 — NIT — `toString` and other `Object.prototype` names pass as question ids

- **Location:** `packages/package-inspector/src/identifiers.ts` (`FORBIDDEN`).
- **Problem:** `data-cog-quiz="toString"` passes. On a plain object, such a key hides the inherited method. This is harmless where code uses `Map` or `Object.create(null)`, as contract §3.3 requires.
- **Fix:** Either add `hasOwnProperty`, `toString`, `valueOf`, `isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString` and the `__*Getter__`/`__*Setter__` names to `FORBIDDEN`, or keep the list and let Reviewer-A check the `Map` rule in T5a.
