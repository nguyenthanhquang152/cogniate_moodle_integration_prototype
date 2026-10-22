// @cogniate/channel-kernel (LA-ADR-01 D1–D4): manifest types and schema, capability catalog, registry builder, text fill
// and the legacy wire projection. Pure, no I/O, except `loadChannelFolders` (Node only; it imports Node built-ins at
// call time). This entry is the public kernel surface that the QA K0 suite uses.
export * from './capabilities.ts';
export * from './legacy-wire.ts';
export * from './manifest.ts';
export * from './registry.ts';
export * from './text.ts';
export type { ProfileFlags, ProfileSharing, ProfileSource, SiteUrlOn } from './profiles.ts';
