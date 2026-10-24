// Bootstrap through the operator API (LA-ADR-06 D3). The host wrapper saves a new API key once.
// Prints one JSON line: {account, created, kid, apiKey}; unchanged keys return apiKey: null.
import { parseArgs } from 'node:util';
import { cliError, createOperatorClient, OperatorApiError, OperatorTransportError } from './operator-client.ts';
import type { OperatorClient } from './operator-client.ts';

export interface BootstrapInput { account: string; name?: string | undefined; rotateApiKey: boolean; rotateSigningKey: boolean }
export interface BootstrapResult { account: string; created: boolean; kid: string; apiKey: string | null }
interface ApiKey { id: string; revokedAt: string | null; expiresAt: string | null }
interface SigningKey { kid: string; status: 'active' | 'next' | 'retired' | 'removed' }

export async function runBootstrap(input: BootstrapInput, client: OperatorClient = createOperatorClient()): Promise<BootstrapResult> {
  const path = `/accounts/${encodeURIComponent(input.account)}`;
  let created = false;
  let currentName: string | undefined;
  try { currentName = (await client.request<{ name: string }>('GET', path)).body.name; }
  catch (error) {
    if (!(error instanceof OperatorApiError) || error.status !== 404 || error.code !== 'NOT_FOUND') throw error;
    const app = process.env.PUBLIC_APP_URL?.replace(/\/$/, '');
    if (!app) throw new Error('PUBLIC_APP_URL is required to create a tool account.', { cause: error });
    await client.request('POST', '/accounts', {
      id: input.account, name: input.name ?? input.account, launchUrl: `${app}/tool/launch`,
      deepLinkingUrl: `${app}/tool/deep-link`, registrationUrl: `${app}/tool/register`,
    });
    created = true;
  }
  // BD-A2-25: preserve operator URLs and names omitted from this command.
  if (!created && input.name !== undefined && input.name.trim() !== currentName) await client.request('PATCH', path, { name: input.name });

  const { body: { apiKeys } } = await client.request<{ apiKeys: ApiKey[] }>('GET', `${path}/api-keys`);
  // Mirrors store/api-keys.ts requireApiKeySlot(): not revoked and not expired (LA-ADR-06 D5).
  // The list API has no active/status field; keep this rule aligned until it does.
  const activeKeys = apiKeys.filter((key) => key.revokedAt === null && (key.expiresAt === null || Date.parse(key.expiresAt) > Date.now()));
  let apiKey: string | null = null;
  if (activeKeys.length === 0 || input.rotateApiKey) {
    try {
      const issued = await client.request<{ apiKey: string }>('POST', `${path}/api-keys`, {
        label: 'bootstrap', scopes: ['launch', 'admin'], ...(input.rotateApiKey ? { revokeOthers: true } : {}),
      });
      apiKey = issued.body.apiKey;
    } catch (error) {
      if (error instanceof OperatorTransportError) {
        throw new OperatorTransportError(`${error.message} API key issuance or rotation may have committed. Run the same command again with --rotate-api-key to replace the unseen key.`, { cause: error });
      }
      throw error;
    }
  }

  const { body: { signingKeys } } = await client.request<{ signingKeys: SigningKey[] }>('GET', `${path}/signing-keys`);
  let active = signingKeys.find((key) => key.status === 'active');
  if (input.rotateSigningKey || !active) {
    // BD-A2-14: discard a waiting key before making the emergency replacement.
    const next = signingKeys.find((key) => key.status === 'next');
    if (next) await client.request('POST', `${path}/signing-keys/${encodeURIComponent(next.kid)}/retire`, { immediate: true });
    const issued = await client.request<SigningKey>('POST', `${path}/signing-keys`);
    active = issued.body;
    // BD-A2-24: when no active key exists, create already activates the first key.
    if (active.status === 'next') await client.request('POST', `${path}/signing-keys/${encodeURIComponent(active.kid)}/activate`, { force: true });
  }
  return { account: input.account, created, kid: active.kid, apiKey };
}

if (import.meta.main) {
  try {
    const { values } = parseArgs({ options: {
      account: { type: 'string' }, name: { type: 'string' },
      'rotate-api-key': { type: 'boolean', default: false }, 'rotate-signing-key': { type: 'boolean', default: false },
    } });
    if (!values.account) {
      console.error('Usage: bootstrap.ts --account <id> [--name <name>] [--rotate-api-key] [--rotate-signing-key]');
      process.exit(2);
    }
    console.log(JSON.stringify(await runBootstrap({ account: values.account, name: values.name,
      rotateApiKey: values['rotate-api-key'], rotateSigningKey: values['rotate-signing-key'] })));
  } catch (error) { console.error(cliError(error)); process.exitCode = 1; }
}
