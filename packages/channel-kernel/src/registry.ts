// Channel registry (LA-ADR-01 D4). Each deployable finds its channels by folder discovery: no file in core lists channel
// ids. `loadChannelFolders` reads the folders (Node only); `buildChannelRegistry` is pure: it runs the load checks and
// builds the lookups. Any load-check failure throws RegistryError, and the caller stops its start with one
// `channel_registry_invalid {channel, reason}` log line.
import type { CapabilitySet, CheckProblem, ProfileTraits } from './capabilities.ts';
import { capabilityProblem, computeCapabilities } from './capabilities.ts';
import type { LegacyCapabilities } from './legacy-wire.ts';
import { LAUNCH_GUARD_CHANNELS, MANUAL_SELF_LEGACY_CHANNELS, legacyProjection } from './legacy-wire.ts';
import type { ChannelManifest } from './manifest.ts';
import { parseChannelManifest } from './manifest.ts';

export type RegistrySide = 'lti' | 'app';

/** One channel folder as the loader found it. Every entry file has its value as the default export. */
export interface LoadedChannel {
  /** Absolute path. Its base name must equal `manifest.id` (load check 1). */
  folder: string;
  /** Default export of `manifest.ts`, not validated yet (undefined when the file is missing). */
  manifest: unknown;
  /** Side `lti` only: default export of `lti-profiles.ts` (an empty list when the file is missing). */
  ltiProfiles?: unknown[];
  /** Side `app` only: default export of `app.ts` (optional file). */
  appAdapter?: unknown;
}

export interface RegistryOptions {
  /** Simulations on: `simulation-only` channels load too. */
  simulations: boolean;
}

/** The load checks of D4 (5 and 7 run with the LTI profile data). */
export type LoadCheck = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export class RegistryError extends Error {
  /** The channel (folder name or id), or null when no single channel is at fault. */
  readonly channel: string | null;
  readonly check: LoadCheck;
  /** A stable reason code, for example `manual_self_authority`. */
  readonly reason: string;
  /** Operator detail (paths, ids); never a secret. */
  readonly detail: string;
  constructor(channel: string | null, check: LoadCheck, problem: CheckProblem) {
    super(`Channel registry load check ${check} failed${channel === null ? '' : ` for channel "${channel}"`}: ${problem.reason} (${problem.detail}).`);
    this.name = 'RegistryError';
    this.channel = channel;
    this.check = check;
    this.reason = problem.reason;
    this.detail = problem.detail;
  }
}

export interface ChannelRegistry {
  /** The loaded channels, in registry order (`card.order`, then id). */
  channels(): readonly ChannelManifest[];
  channel(id: string): ChannelManifest | null;
  /** The channel whose folder holds the profile, or null. */
  channelOfProfile(profileId: string): string | null;
  /** The channel that guards a product family (any case; generic check 14), or null. */
  ownerOfFamily(family: string): string | null;
  /** The `{LMS}` text name. Null uses the standard profile's channel; an unknown non-null id uses "your LMS". */
  textName(channelId: string | null): string;
  /** The capability set; an unknown channel gets the empty set (every guard closed). */
  capabilities(channelId: string, profile?: ProfileTraits): CapabilitySet;
  /** The six M1 flags (legacy projection). */
  legacyCapabilities(channelId: string, profile?: ProfileTraits): LegacyCapabilities;
}

/** The profile of the base LTI 1.3 platform (`lms: null` on the wire); `textName(null)` names its channel. */
export const STANDARD_PROFILE_ID = 'standard';
/** The text name for an unknown non-null id, or when no loaded channel owns the standard profile. */
export const GENERIC_TEXT_NAME = 'your LMS';

const ENTRY = { manifest: 'manifest.ts', lti: 'lti-profiles.ts', app: 'app.ts' } as const;

/**
 * Node only (LTI service, app): read each root (in the given order), then import the entry files of that side from
 * each channel folder. A channel folder is a directory whose name does not start with ".". Folders load in name order.
 * Roots come only from this argument: product code passes exactly one constant root; tests may add a second root.
 */
export async function loadChannelFolders(roots: readonly string[], side: RegistrySide): Promise<LoadedChannel[]> {
  // Imported here, so that the portal can use this module without Node built-ins.
  const { readdir } = await import('node:fs/promises');
  const { existsSync } = await import('node:fs');
  const { join, resolve } = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const importDefault = async (channel: string, file: string): Promise<unknown> => {
    try {
      const module = (await import(pathToFileURL(file).href)) as { default?: unknown };
      return module.default;
    } catch (err) {
      throw new RegistryError(channel, 1, { reason: 'entry_import_failed', detail: `${file}: ${err instanceof Error ? err.message : String(err)}` });
    }
  };
  const loaded: LoadedChannel[] = [];
  for (const root of roots) {
    const dir = resolve(root);
    let names: string[];
    try {
      names = (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name).sort();
    } catch (err) {
      throw new RegistryError(null, 1, { reason: 'channel_root_unreadable', detail: `${dir}: ${err instanceof Error ? err.message : String(err)}` });
    }
    for (const name of names) {
      const folder = join(dir, name);
      const file = (entry: string) => join(folder, entry);
      const channel: LoadedChannel = {
        folder,
        manifest: existsSync(file(ENTRY.manifest)) ? await importDefault(name, file(ENTRY.manifest)) : undefined,
      };
      if (side === 'lti') {
        const profiles = existsSync(file(ENTRY.lti)) ? await importDefault(name, file(ENTRY.lti)) : [];
        if (!Array.isArray(profiles)) throw new RegistryError(name, 7, { reason: 'lti_profiles_not_list', detail: `${file(ENTRY.lti)} must default-export a list` });
        channel.ltiProfiles = profiles;
      } else if (existsSync(file(ENTRY.app))) {
        channel.appAdapter = await importDefault(name, file(ENTRY.app));
      }
      loaded.push(channel);
    }
  }
  return loaded;
}

/** The base name of a folder path (pure; both separators). */
const folderName = (folder: string): string => folder.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? '';

/** The id and the `sharing` trait of a loaded LTI profile. Other fields belong to load check 7 (LTI profile registry). */
function profileFacts(value: unknown): { id: string; sharing: unknown } | null {
  if (typeof value !== 'object' || value === null) return null;
  const { id, sharing } = value as { id?: unknown; sharing?: unknown };
  return typeof id === 'string' ? { id, sharing } : null;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

interface Checked {
  manifest: ChannelManifest;
  ltiProfiles: Array<{ id: string; sharing: unknown }> | null;
}

/**
 * Pure: run load checks 1–4, 6 and 8 (and 5 and the shared-platform part of 6 when the LTI profiles are loaded), then
 * build the registry. Throws RegistryError at the first failure. Every channel is checked, also a `simulation-only`
 * channel that the options leave out.
 */
export function buildChannelRegistry(channels: readonly LoadedChannel[], opts: RegistryOptions): ChannelRegistry {
  const checked: Checked[] = [];
  // Check 1: the manifest passes the schema; its id equals the folder name; ids are unique.
  for (const c of channels) {
    const name = folderName(c.folder);
    if (c.manifest === undefined) throw new RegistryError(name, 1, { reason: 'manifest_missing', detail: `${c.folder} has no ${ENTRY.manifest}` });
    const parsed = parseChannelManifest(c.manifest);
    if (!parsed.ok) throw new RegistryError(name, 1, parsed.problem);
    if (parsed.manifest.id !== name) throw new RegistryError(name, 1, { reason: 'manifest_id_not_folder', detail: `id "${parsed.manifest.id}" in folder "${name}"` });
    if (checked.some((x) => x.manifest.id === name)) throw new RegistryError(name, 1, { reason: 'channel_id_duplicate', detail: `two folders "${name}"` });
    checked.push({ manifest: parsed.manifest, ltiProfiles: c.ltiProfiles === undefined ? null : c.ltiProfiles.map(profileFacts).filter((p) => p !== null) });
  }
  // Check 2: every profile id belongs to one channel only (its registration lists and, when loaded, its LTI profiles).
  const profileOwner = new Map<string, string>();
  for (const { manifest, ltiProfiles } of checked) {
    const lti = ltiProfiles?.map((p) => p.id) ?? [];
    const dup = lti.find((id, i) => lti.indexOf(id) !== i);
    if (dup !== undefined) throw new RegistryError(manifest.id, 2, { reason: 'profile_id_duplicate', detail: `profile "${dup}" twice in the LTI profiles` });
    for (const id of new Set([...manifest.registration.flatMap((r) => r.profiles), ...lti])) {
      const owner = profileOwner.get(id);
      if (owner !== undefined) throw new RegistryError(manifest.id, 2, { reason: 'profile_in_two_channels', detail: `profile "${id}" is also in channel "${owner}"` });
      profileOwner.set(id, manifest.id);
    }
  }
  // Check 3: every guarded family belongs to one channel only.
  const familyOwner = new Map<string, string>();
  for (const { manifest } of checked) {
    for (const { family } of manifest.lti?.guardedFamilies ?? []) {
      const owner = familyOwner.get(family);
      if (owner !== undefined) throw new RegistryError(manifest.id, 3, { reason: 'family_guarded_twice', detail: `family "${family}" is also guarded by channel "${owner}"` });
      familyOwner.set(family, manifest.id);
    }
  }
  // Check 4: every capability id is in the catalog (source manifest, value of its kind); createCourse needs the token.
  for (const { manifest } of checked) {
    const problem = capabilityProblem(manifest.capabilities as Readonly<Record<string, unknown>>);
    if (problem) throw new RegistryError(manifest.id, 4, problem);
  }
  // Check 5 (LTI side): every registration profile exists in the channel's own LTI profiles.
  for (const { manifest, ltiProfiles } of checked) {
    if (ltiProfiles === null) continue;
    const missing = manifest.registration.flatMap((r) => r.profiles).find((id) => !ltiProfiles.some((p) => p.id === id));
    if (missing !== undefined) throw new RegistryError(manifest.id, 5, { reason: 'profile_not_in_lti_profiles', detail: `profile "${missing}"` });
  }
  // Check 6 (A2 LA-ADR-07 D2 rules A4 and A3): no `self` on a shared platform; no `manual` with `self` outside the frozen list.
  for (const { manifest, ltiProfiles } of checked) {
    for (const r of manifest.registration) {
      if (r.authority !== 'self') continue;
      const shared = r.profiles.find((id) => ltiProfiles?.find((p) => p.id === id)?.sharing === 'shared');
      if (shared !== undefined) throw new RegistryError(manifest.id, 6, { reason: 'shared_platform_self_authority', detail: `method ${r.method}, profile "${shared}"` });
      if (r.method === 'manual' && !MANUAL_SELF_LEGACY_CHANNELS.includes(manifest.id)) {
        throw new RegistryError(manifest.id, 6, { reason: 'manual_self_authority', detail: 'a manual method needs authority operatorGrant' });
      }
    }
  }
  // Check 8: a `launch`-level guard only on a channel of the frozen list.
  for (const { manifest } of checked) {
    const guard = manifest.lti?.guardedFamilies.find((g) => g.level === 'launch');
    if (guard !== undefined && !LAUNCH_GUARD_CHANNELS.includes(manifest.id)) {
      throw new RegistryError(manifest.id, 8, { reason: 'launch_guard_not_allowed', detail: `family "${guard.family}"; new channels guard at the registration level` });
    }
  }

  const visible = checked
    .filter(({ manifest }) => manifest.availability !== 'simulation-only' || opts.simulations)
    .sort((a, b) => a.manifest.card.order - b.manifest.card.order || (a.manifest.id < b.manifest.id ? -1 : a.manifest.id > b.manifest.id ? 1 : 0));
  const manifests = deepFreeze(visible.map((c) => c.manifest));
  const byId = new Map(manifests.map((m) => [m.id, m]));
  const visibleOwner = (owners: Map<string, string>, key: string): string | null => {
    const owner = owners.get(key);
    return owner !== undefined && byId.has(owner) ? owner : null;
  };
  const standardChannel = visibleOwner(profileOwner, STANDARD_PROFILE_ID);
  const noChannel = { registration: [], capabilities: {}, setup: {} };
  const capabilities = (channelId: string, profile?: ProfileTraits): CapabilitySet => computeCapabilities(byId.get(channelId) ?? noChannel, profile);

  return {
    channels: () => manifests,
    channel: (id) => byId.get(id) ?? null,
    channelOfProfile: (profileId) => visibleOwner(profileOwner, profileId),
    ownerOfFamily: (family) => visibleOwner(familyOwner, family.toLowerCase()),
    textName: (channelId) => (channelId === null
      ? (standardChannel === null ? undefined : byId.get(standardChannel)?.names.text)
      : byId.get(channelId)?.names.text) ?? GENERIC_TEXT_NAME,
    capabilities,
    legacyCapabilities: (channelId, profile) => legacyProjection(capabilities(channelId, profile)),
  };
}
