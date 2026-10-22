import { MANUAL_SELF_LEGACY_CHANNELS } from './legacy-wire.ts';
import type { ChannelRegistry } from './registry.ts';

export type FamilyGuardVerdict = { kind: 'pass' }
  | { kind: 'refuse' | 'log'; family: string; guardChannel: string };

/** D6: the caller supplies its phase; the registry supplies the signed family's guard level. No I/O. */
export function familyGuardVerdict(
  registry: ChannelRegistry,
  family: string | null | undefined,
  profileChannel: string | null,
  phase: 'registration' | 'launch',
): FamilyGuardVerdict {
  if (!family) return { kind: 'pass' };
  const normalized = family.toLowerCase();
  const guardChannel = registry.ownerOfFamily(normalized);
  if (guardChannel === null || guardChannel === profileChannel) return { kind: 'pass' };
  const guard = registry.channel(guardChannel)?.lti?.guardedFamilies.find((entry) => entry.family.toLowerCase() === normalized);
  if (!guard) return { kind: 'pass' };
  const refuse = phase === 'registration' || guard.level === 'launch' || MANUAL_SELF_LEGACY_CHANNELS.includes(profileChannel ?? '');
  return { kind: refuse ? 'refuse' : 'log', family: normalized, guardChannel };
}
