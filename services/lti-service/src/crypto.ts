import { randomToken } from '@cogniate/shared';

// Shared crypto helpers (AES-256-GCM, SHA-256, random tokens, constant-time compare) live in @cogniate/shared
// (ADR-008 `crypto`, B-T4a-01). Only the API key format is specific to the LTI service.

/** API key format (contract §8 D2): "ltis_" + 43 base64url characters. */
export function newApiKey(): string {
  return `ltis_${randomToken()}`;
}
