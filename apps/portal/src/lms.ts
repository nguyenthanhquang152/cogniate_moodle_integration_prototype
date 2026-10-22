import { channelRegistry } from "./channels/registry.ts";
export const lmsNames: Readonly<Record<string, string>> = Object.fromEntries(channelRegistry.channels().map((manifest) => [manifest.id, manifest.names.text]));
export function isLms(value: string): boolean {
  return channelRegistry.channel(value) !== null;
}
