// The app channel registry (LA-ADR-01 D4): built once at start by folder discovery of the ONE product root. A load-check
// failure logs one `channel_registry_invalid {channel, reason}` line (app API delta §8) and stops the start.
import { fileURLToPath } from 'node:url';
import type { ChannelRegistry } from '@cogniate/channel-kernel';
import { RegistryError, buildChannelRegistry, loadChannelFolders } from '@cogniate/channel-kernel';
import type { Logger } from '@cogniate/shared';

/** The product channel root. A constant: no environment variable, knob or setting adds a root (D4 "Extra root"). */
export const CHANNEL_ROOT = fileURLToPath(new URL('../../../../packages/channels/', import.meta.url));

/**
 * Load and check the channels of `roots` (app side: manifest and `app.ts`). The app loads every channel, also a
 * `simulation-only` one: it lists such a channel only when the LTI service reports simulations on (app API delta §2).
 * Tests pass a second root here; product code calls `loadAppChannelRegistry`.
 */
export async function buildAppChannelRegistry(roots: readonly string[], logger: Logger): Promise<ChannelRegistry> {
  try {
    return buildChannelRegistry(await loadChannelFolders(roots, 'app'), { simulations: true });
  } catch (err) {
    if (err instanceof RegistryError) {
      logger.error('channel_registry_invalid', { channel: err.channel, reason: err.reason, check: err.check, detail: err.detail });
    }
    throw err;
  }
}

/** The registry of the product root (main.ts). */
export function loadAppChannelRegistry(logger: Logger): Promise<ChannelRegistry> {
  return buildAppChannelRegistry([CHANNEL_ROOT], logger);
}
