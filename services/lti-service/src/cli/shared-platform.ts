// Shared platform of a shared profile (contract §9.12), through the operator API.
// Same client id: print {platformId, created: false}; another client id: exit 1 with one line.
import { parseArgs } from 'node:util';
import { cliError, createOperatorClient, OperatorApiError } from './operator-client.ts';
import type { OperatorClient } from './operator-client.ts';

export async function runSharedPlatform(input: { account: string; profile: string; clientId: string; name?: string }, client: OperatorClient = createOperatorClient()) {
  const { account, ...body } = input;
  try {
    const result = await client.request<{ id: string }>('POST', `/accounts/${encodeURIComponent(account)}/shared-platforms`, body);
    return { platformId: result.body.id, created: result.status === 201 };
  } catch (error) {
    if (error instanceof OperatorApiError && error.code === 'NOT_FOUND') throw new Error(`Unknown tool account: ${account}.`, { cause: error });
    throw error;
  }
}

if (import.meta.main) {
  try {
    const { values } = parseArgs({ options: { account: { type: 'string' }, profile: { type: 'string' }, 'client-id': { type: 'string' }, name: { type: 'string' } } });
    if (!values.account || !values.profile || !values['client-id']) {
      console.error('Usage: shared-platform.ts --account <id> --profile <shared profile> --client-id <Application ID> [--name <name>]');
      process.exit(2);
    }
    console.log(JSON.stringify(await runSharedPlatform({ account: values.account, profile: values.profile,
      clientId: values['client-id'], ...(values.name ? { name: values.name } : {}) })));
  } catch (error) { console.error(cliError(error)); process.exitCode = 1; }
}
