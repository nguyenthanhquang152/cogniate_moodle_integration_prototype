// Tool accounts and their API keys (contract §7, §8 D2). Signing keys: tool-keys.ts.
import type { Db } from '../db/index.ts';
import { transaction } from '../db/index.ts';
import { sha256Hex } from '@cogniate/shared';
import { newApiKey } from '../crypto.ts';

export interface ToolAccount {
  id: string;
  name: string;
  launchUrl: string;
  deepLinkingUrl: string;
  registrationUrl: string;
}

interface AccountRow { id: string; name: string; launch_url: string; deep_linking_url: string; registration_url: string }

const toAccount = (r: AccountRow): ToolAccount => ({
  id: r.id, name: r.name, launchUrl: r.launch_url, deepLinkingUrl: r.deep_linking_url, registrationUrl: r.registration_url,
});

export const ACCOUNT_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function getAccount(db: Db, id: string): ToolAccount | null {
  const row = db.prepare('SELECT * FROM tool_account WHERE id = ?').get(id) as AccountRow | undefined;
  return row ? toAccount(row) : null;
}

/** The API key resolves to exactly one tool account (only its SHA-256 hash is stored). */
export function findAccountByApiKey(db: Db, apiKey: string): ToolAccount | null {
  if (!/^ltis_[A-Za-z0-9_-]{43}$/.test(apiKey)) return null;
  const row = db.prepare('SELECT * FROM tool_account WHERE api_key_hash = ?').get(sha256Hex(apiKey)) as AccountRow | undefined;
  return row ? toAccount(row) : null;
}

export interface EnsureAccountInput {
  id: string;
  name: string;
  appUrl: string; // PUBLIC_APP_URL
  rotateApiKey?: boolean;
}

/** Make the account if missing (or update its name and URLs). Returns the API key only when it was made or rotated. */
export function ensureAccount(db: Db, input: EnsureAccountInput): { account: ToolAccount; created: boolean; apiKey: string | null } {
  if (!ACCOUNT_ID.test(input.id)) throw new Error(`invalid account id: ${input.id}`);
  const urls = {
    launch: `${input.appUrl}/tool/launch`, deep: `${input.appUrl}/tool/deep-link`, reg: `${input.appUrl}/tool/register`,
  };
  return transaction(db, () => {
    const existing = getAccount(db, input.id);
    if (!existing) {
      const apiKey = newApiKey();
      db.prepare(`INSERT INTO tool_account (id, name, api_key_hash, launch_url, deep_linking_url, registration_url, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`).run(input.id, input.name, sha256Hex(apiKey), urls.launch, urls.deep, urls.reg, Date.now());
      return { account: getAccount(db, input.id)!, created: true, apiKey };
    }
    db.prepare('UPDATE tool_account SET name = ?, launch_url = ?, deep_linking_url = ?, registration_url = ? WHERE id = ?')
      .run(input.name, urls.launch, urls.deep, urls.reg, input.id);
    let apiKey: string | null = null;
    if (input.rotateApiKey) {
      apiKey = newApiKey();
      db.prepare('UPDATE tool_account SET api_key_hash = ? WHERE id = ?').run(sha256Hex(apiKey), input.id);
    }
    return { account: getAccount(db, input.id)!, created: false, apiKey };
  });
}

// ---------------------------------------------------------------- tool signing keys (RS256, 2048 bit)
