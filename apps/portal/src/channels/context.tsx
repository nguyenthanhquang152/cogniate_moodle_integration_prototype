import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { ChannelManifest, ChannelRegistry } from "@cogniate/channel-kernel";
import type { ChannelUiModule } from "../sdk/index.ts";
import { channelRegistry } from "./registry.ts";
import { channelModules } from "./modules.ts";
const ChannelContext = createContext({ registry: channelRegistry, modules: channelModules });
export const useChannels = () => useContext(ChannelContext);
export function ChannelProvider({ registry, modules = channelModules, children }: { registry: ChannelRegistry; modules?: ReadonlyMap<string, ChannelUiModule>; children: ReactNode }) {
  return <ChannelContext.Provider value={{ registry, modules }}>{children}</ChannelContext.Provider>;
}
const CurrentChannelContext = createContext<ChannelManifest | null>(null);
/** The channel of the current view; null when no channel is known. Shell texts that depend on a channel read it (BD-A1-63). */
export const useCurrentChannel = () => useContext(CurrentChannelContext);
/** Sets the channel of the current view. The connect routes set the route's channel. */
export function ChannelScope({ manifest, children }: { manifest: ChannelManifest | null; children?: ReactNode }) {
  return <CurrentChannelContext.Provider value={manifest}>{children}</CurrentChannelContext.Provider>;
}
