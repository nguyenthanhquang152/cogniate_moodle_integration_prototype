import { buildChannelRegistry, fillText } from "@cogniate/channel-kernel";
import type { ChannelManifest, ChannelRegistry, LoadedChannel } from "@cogniate/channel-kernel";
import type { LmsProvider } from "../types.ts";

const manifests = import.meta.glob<{ default: unknown }>("../../../../packages/channels/*/manifest.ts", { eager: true });
export const discoveredChannels: LoadedChannel[] = Object.entries(manifests).map(([path, entry]) => ({
  folder: path.slice(0, path.lastIndexOf("/")), manifest: entry.default,
}));
export const channelRegistry = buildChannelRegistry(discoveredChannels, { simulations: true });
export function channelText(manifest: ChannelManifest, text: string, libraryName = "", site = ""): string {
  return fillText(text, { LMS: manifest.names.text, tool: `Cogniate (${libraryName})`, site });
}
export function visibleChannels(registry: ChannelRegistry, providers: readonly LmsProvider[] = []): readonly ChannelManifest[] {
  return registry.channels().filter((manifest) => manifest.availability !== "simulation-only" || providers.some((provider) => (provider.channel ?? provider.lms) === manifest.id));
}
export const channelOf = (value: { channel?: string; lms: string }): string => value.channel ?? value.lms;
