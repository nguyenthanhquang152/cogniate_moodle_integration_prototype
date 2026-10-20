// npm run app:binding -w services/cogniate-app -- suspend --connection <con_id> --note "<evidence reference>"
// npm run app:binding -w services/cogniate-app -- release --connection <con_id> --note "<evidence reference>"
// Operator containment and recovery (app contract §4.9, ADR-011 §4b). Runs in the app service shell only.
import { parseArgs } from 'node:util';
import { finish, operatorRuntime } from './operator-runtime.ts';

const [command, ...rest] = process.argv.slice(2);
const { values } = parseArgs({ args: rest, options: { connection: { type: 'string' }, note: { type: 'string' } } });
const usage = 'Usage: app:binding suspend|release --connection <con_id> --note "<evidence reference>"';
const { db, operator, traceId } = operatorRuntime();
const close = () => db.close();
if ((command === 'suspend' || command === 'release') && values.connection && values.note !== undefined) {
  finish(await (command === 'suspend' ? operator.suspend(values.connection, values.note, traceId) : operator.release(values.connection, values.note, traceId)), close);
}
finish({ exitCode: 1, lines: [usage] }, close);
