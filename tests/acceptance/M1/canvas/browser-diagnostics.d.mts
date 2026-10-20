import type { BrowserContext } from '@playwright/test';

export type BrowserSecretKind = 'ltik' | 'id_token' | 'state' | 'nonce' | 'runtime_token' | 'play_id' | 'picker_id';
export function diagnosticUrl(value: string): string;
export function captureBrowserSecrets(context: BrowserContext, record: (kind: BrowserSecretKind, value: string) => void): () => void;
