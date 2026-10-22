// npm run app:binding -w services/cogniate-app -- suspend --connection <con_id> --note "<evidence reference>"
// npm run app:binding -w services/cogniate-app -- release --connection <con_id> --note "<evidence reference>"
//     both: [--operator <name>] [--evidence-channel institution-email|support-call|lms-admin-ticket|other] [--evidence-ref <id>]
// Operator containment and recovery (app contract §4.9, ADR-011 §4b). Runs in the app service shell only. The operator
// and evidence flags (LA-ADR-07 D4, D5) are required with STACK_PROFILE=production in this process; else optional.
import { parseArgs } from 'node:util';
import { finish, operatorRuntime } from './operator-runtime.ts';

const [command, ...rest] = process.argv.slice(2);
const { values } = parseArgs({
  args: rest,
  options: {
    connection: { type: 'string' }, note: { type: 'string' },
    operator: { type: 'string' }, 'evidence-channel': { type: 'string' }, 'evidence-ref': { type: 'string' },
  },
});
const usage = 'Usage: app:binding suspend|release --connection <con_id> --note "<evidence reference>" [--operator O] [--evidence-channel E] [--evidence-ref R]';
const flags = { operator: values.operator, evidenceChannel: values['evidence-channel'], evidenceRef: values['evidence-ref'] };
const { db, operator, traceId } = await operatorRuntime();
const close = () => db.close();
if ((command === 'suspend' || command === 'release') && values.connection && values.note !== undefined) {
  finish(await (command === 'suspend' ? operator.suspend(values.connection, values.note, traceId, flags) : operator.release(values.connection, values.note, traceId, flags)), close);
}
finish({ exitCode: 1, lines: [usage] }, close);
