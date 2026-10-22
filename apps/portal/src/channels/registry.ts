import { buildChannelRegistry, fillText } from "@cogniate/channel-kernel";
import type { ChannelManifest, ChannelRegistry, LoadedChannel } from "@cogniate/channel-kernel";
import type { LmsProvider } from "../types.ts";

const manifests = import.meta.glob<{ default: unknown }>("../../../../packages/channels/*/manifest.ts", { eager: true });
export const discoveredChannels: LoadedChannel[] = Object.entries(manifests).map(([path, entry]) => ({
  folder: path.slice(0, path.lastIndexOf("/")), manifest: entry.default,
}));
export const channelRegistry = buildChannelRegistry(discoveredChannels, { simulations: true });
export const toolName = (libraryName: string): string => `Cogniate (${libraryName})`;
export function channelText(manifest: ChannelManifest, text: string, libraryName = "", site = ""): string {
  return fillText(text, { LMS: manifest.names.text, tool: toolName(libraryName), site });
}
export function visibleChannels(registry: ChannelRegistry, providers: readonly LmsProvider[] = []): readonly ChannelManifest[] {
  return registry.channels().filter((manifest) => manifest.availability !== "simulation-only" || providers.some((provider) => (provider.channel ?? provider.lms) === manifest.id));
}
export const channelOf = (value: { channel?: string; lms: string }): string => value.channel ?? value.lms;

/** Public channels remain usable while profile discovery is slow or unavailable. */
export function channelProvider(registry: ChannelRegistry, manifest: ChannelManifest, providers?: readonly LmsProvider[]): LmsProvider | undefined {
  const configured = providers?.find((provider) => channelOf(provider) === manifest.id);
  if (configured || manifest.availability === "simulation-only") return configured;
  // Only offer each method's default until the server supplies profile choices and readiness.
  const profiles = [...new Set(manifest.registration.map((entry) => entry.defaultProfile))];
  return {
    channel: manifest.id, lms: manifest.id, label: manifest.names.label,
    methods: manifest.registration.map((entry) => entry.method),
    capabilities: registry.legacyCapabilities(manifest.id),
    profiles: profiles.map((id) => ({ id, label: id, ready: true, simulation: false, clientId: null })),
  };
}
