import { storeFor } from '../store/index.ts';
import type { StoreSource as Db } from '../store/index.ts';
import type { ToolAccount } from '../store/accounts.ts';
import { ACCOUNT_ID } from '../store/accounts.ts';

/** The injected process URL is the only protocol URL base in path mode (LA-ADR-06 D2). */
export function createAccountResolver(db: Db, publicLtiUrl: string) {
  return {
    async resolveAccount(request: { params: unknown }): Promise<ToolAccount | null> {
      const params = request.params as { account?: unknown } | null;
      const id = params?.account;
      return typeof id === 'string' && ACCOUNT_ID.test(id) ? (await storeFor(db).accounts.getAccount(id)) : null;
    },
    protocolUrls(account: ToolAccount) {
      if (account.publicBaseUrl !== null) throw new Error('Host mode is not available in LA.');
      return {
        login: `${publicLtiUrl}/lti/login/${account.id}`, launch: `${publicLtiUrl}/lti/launch/${account.id}`,
        keys: `${publicLtiUrl}/lti/keys/${account.id}`, register: `${publicLtiUrl}/lti/register/${account.id}`,
      };
    },
  };
}
