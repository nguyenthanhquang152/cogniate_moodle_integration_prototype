import type { Db } from '../db/index.ts';
import type { ToolAccount } from '../store/accounts.ts';
import { ACCOUNT_ID, getAccount } from '../store/accounts.ts';

/** The injected process URL is the only protocol URL base in path mode (LA-ADR-06 D2). */
export function createAccountResolver(db: Db, publicLtiUrl: string) {
  return {
    resolveAccount(request: { params: unknown }): ToolAccount | null {
      const params = request.params as { account?: unknown } | null;
      const id = params?.account;
      return typeof id === 'string' && ACCOUNT_ID.test(id) ? getAccount(db, id) : null;
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
