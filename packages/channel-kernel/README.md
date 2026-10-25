# `@cogniate/channel-kernel`

The channel kernel of LA-ADR-01 (D1–D4, D10): manifest types and schema, capability catalog, registry builder, text fill and the legacy wire projection. The code is pure, with no I/O. The one exception is `loadChannelFolders`, which reads folders in Node only.

## Entry points

| Name | Use |
| --- | --- |
| `loadChannelFolders(roots, side)` | Node only. Reads each root and imports the entry files of each channel folder. Side `app`: `manifest.ts` and `app.ts` (optional). Side `lti`: `manifest.ts` and `lti-profiles.ts`. Each entry file gives its value as the **default export**. |
| `buildChannelRegistry(channels, { simulations })` | Pure. Runs the load checks and returns a `ChannelRegistry`, or throws `RegistryError { channel, check, reason, detail }`. |
| `ChannelRegistry` | `channels()`, `channel(id)`, `channelOfProfile(id)`, `ownerOfFamily(family)`, `textName(id \| null)`, `capabilities(id, profile?)`, `legacyCapabilities(id, profile?)`. |
| `CAPABILITY_CATALOG`, `computeCapabilities` | The D3 catalog. Each capability has one source. A manifest can set only the capabilities with source `manifest`. |
| `legacyProjection` and the lists of `legacy-wire.ts` | The six M1 flags, `MANUAL_SELF_LEGACY_CHANNELS`, `LAUNCH_GUARD_CHANNELS`. |
| `fillText(text, { LMS, tool, site })` | Fills the text placeholders. |
| `parseChannelManifest(value)` | The manifest schema (the shape part of load check 1). |

## Roots

The loader gets its roots only as a function argument. Product code passes exactly one constant root (`packages/channels/`). No environment variable, knob or setting can add a root. Tests can pass a second root.

## Load checks

| Check | Rule | Where |
| --- | --- | --- |
| 1 | The manifest passes the schema; its `id` equals the folder name; ids are unique. Also: a folder without `manifest.ts`, or an entry file that does not import. | kernel |
| 2 | A profile id belongs to one channel only. | kernel |
| 3 | A guarded family belongs to one channel only. | kernel |
| 4 | Every capability is in the catalog, has source `manifest` and a value of its kind; `publish.createCourse` needs `siteApi.token`. | kernel |
| 5 | Every `registration[].profiles` entry is in the channel's own LTI profiles. | kernel, when the LTI profiles are loaded; the app at first use |
| 6 | No `self` authority on a shared platform; no `manual` method with `self`, except on a channel in `MANUAL_SELF_LEGACY_CHANNELS`. | kernel (the shared-platform part needs the LTI profiles) |
| 7 | Every profile passes the `ProviderProfile` schema. | LTI profile registry (`services/lti-service/src/profiles/`) |
| 8 | A `launch`-level guard only on a channel in `LAUNCH_GUARD_CHANNELS`. | kernel |

The registry checks every channel, also a `simulation-only` channel that the options leave out.

## Change rules

- A new capability is a kernel change with a test and an ADR revision (LA-ADR-01 D3).
- `legacy-wire.ts` is the one core file that can hold LMS words. A new entry needs an ADR revision; a new `MANUAL_SELF_LEGACY_CHANNELS` entry also needs a security review.
- `fitness-scope.json` is the machine copy of the scope table in `docs/architecture/ltiaas/README.md` §4. If the two differ, the README wins.
