import type { ChannelUiModule } from "../sdk/index.ts";
const entries = import.meta.glob<{ default: ChannelUiModule }>("../../../../packages/channels/*/portal/index.tsx", { eager: true });
export const channelModules: ReadonlyMap<string, ChannelUiModule> = new Map(Object.entries(entries).map(([path, entry]) => [path.split("/").at(-3)!, entry.default]));
