// QA observation setup. The gate replaces its rules and records matched calls only.
import { METHODS } from './snapshot-oracle.mjs';

export async function armCapture(control, { faults = [], action = 'pass', idPrefix = 'capture' } = {}) {
  await control.setRules([
    ...faults,
    ...METHODS.map((method) => ({
      id: `${idPrefix}-${method}`, method, pathRegex: '^/', action, times: 100_000,
    })),
  ]);
  // Set all rules before the cursor; callers must re-arm after a gate reset.
  return (await control.readEvents()).at(-1)?.seq ?? 0;
}
