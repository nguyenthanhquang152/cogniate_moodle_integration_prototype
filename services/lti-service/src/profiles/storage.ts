import type { ProfileSource } from '@cogniate/channel-kernel';

/** LA-ADR-05 D1 rule 1: shared grammar for a profile frame and a login target. */
export const FRAME_NAME = /^[A-Za-z0-9_-]{1,64}$/;

export function storageBindingOf(trait: ProfileSource['platformStorage'], params: Record<string, unknown>, authEndpoint: string): { target: string; origin: string } | null {
  // Rule 1: no trait means cookie-only; from-login reads the request, otherwise the trait supplies the frame.
  if (!trait) return null;
  const target = trait.targetFrame === 'from-login' ? params.lti_storage_target : trait.targetFrame;
  // An absent or invalid request target counts as no target.
  if (typeof target !== 'string' || !FRAME_NAME.test(target)) return null;
  // Rule 2: use the stored authentication endpoint origin, or the fixed origin validated by the schema.
  const origin = trait.origin === 'authOrigin' ? new URL(authEndpoint).origin : trait.origin;
  return { target, origin };
}
