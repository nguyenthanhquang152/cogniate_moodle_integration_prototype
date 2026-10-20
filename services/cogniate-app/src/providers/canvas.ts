// Canvas provider adapter (ADR-011 §7, app contract §4.4, §4.5): developer key (Paste JSON), client id, deployment id
// and an operator approval grant per binding. Owner after the foundation handoff: the Canvas implementer.
//
// FOUNDATION STUB: `null` means "no Canvas adapter yet". The registry then offers no Canvas LMS type: a Canvas
// connection cannot be made and GET /app-api/lms-providers has no Canvas entry. This is not a working provider.
import type { ProviderAdapter } from './types.ts';

export const canvasProvider: ProviderAdapter | null = null;
