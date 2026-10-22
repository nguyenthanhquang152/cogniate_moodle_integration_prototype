import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { ChannelRegistry } from "@cogniate/channel-kernel";
import type { ChannelUiModule } from "../sdk/index.ts";
import { channelRegistry } from "./registry.ts";
import { channelModules } from "./modules.ts";
const ChannelContext = createContext({ registry: channelRegistry, modules: channelModules });
export const useChannels = () => useContext(ChannelContext);
export function ChannelProvider({ registry, modules = new Map(), children }: { registry: ChannelRegistry; modules?: ReadonlyMap<string, ChannelUiModule>; children: ReactNode }) {
  return <ChannelContext.Provider value={{ registry, modules }}>{children}</ChannelContext.Provider>;
}
