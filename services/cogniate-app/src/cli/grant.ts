// npm run app:grant -w services/cogniate-app -- issue --library <lib_id> --connection <con_id> --site <origin> [--service-url <origin>]
//     --client-id <id> --deployment-id <id> [--purpose initial|add_deployment] [--ttl-seconds 86400] --note "<evidence reference>"
//     [--operator <name>] [--evidence-channel institution-email|support-call|lms-admin-ticket|other] [--evidence-ref <ticket or message id>]
// npm run app:grant -w services/cogniate-app -- revoke --grant <grt_id> [--operator <name>] [--evidence-channel <c>] [--evidence-ref <r>]
// npm run app:grant -w services/cogniate-app -- list --connection <con_id>
// Operator only (app contract §4.8). Runs in the app service shell; not reachable over HTTP. The operator and evidence
// flags (LA-ADR-07 D4, D5) are required with STACK_PROFILE=production in this process; else optional (M1 commands).
import { parseArgs } from 'node:util';
import { finish, operatorRuntime } from './operator-runtime.ts';

const [command, ...rest] = process.argv.slice(2);
const { values } = parseArgs({
  args: rest,
  options: {
    library: { type: 'string' }, connection: { type: 'string' }, site: { type: 'string' }, 'service-url': { type: 'string' },
    'client-id': { type: 'string' }, 'deployment-id': { type: 'string' }, purpose: { type: 'string' }, 'ttl-seconds': { type: 'string' },
    note: { type: 'string' }, grant: { type: 'string' },
    operator: { type: 'string' }, 'evidence-channel': { type: 'string' }, 'evidence-ref': { type: 'string' },
  },
});
const usage = 'Usage: app:grant issue --library L --connection K --site S [--service-url V] --client-id C --deployment-id D [--purpose initial|add_deployment] [--ttl-seconds N] --note N [--operator O] [--evidence-channel E] [--evidence-ref R] | revoke --grant G [--operator O] [--evidence-channel E] [--evidence-ref R] | list --connection K';
const flags = { operator: values.operator, evidenceChannel: values['evidence-channel'], evidenceRef: values['evidence-ref'] };
const { db, operator, traceId } = await operatorRuntime();
const close = () => db.close();

if (command === 'issue') {
  const purpose = values.purpose ?? 'initial';
  if (!values.library || !values.connection || !values.site || !values['client-id'] || !values['deployment-id'] || values.note === undefined
    || (purpose !== 'initial' && purpose !== 'add_deployment') || (values['ttl-seconds'] !== undefined && !/^\d+$/.test(values['ttl-seconds']))) {
    finish({ exitCode: 1, lines: [usage] }, close);
  }
  finish(await operator.issue({
    library: values.library!, connection: values.connection!, site: values.site!, ...(values['service-url'] ? { serviceUrl: values['service-url'] } : {}),
    clientId: values['client-id']!, deploymentId: values['deployment-id']!, purpose: purpose as 'initial' | 'add_deployment',
    ...(values['ttl-seconds'] ? { ttlSeconds: Number(values['ttl-seconds']) } : {}), note: values.note!, traceId, ...flags,
  }), close);
} else if (command === 'revoke' && values.grant) {
  finish(await operator.revoke(values.grant, traceId, flags), close);
} else if (command === 'list' && values.connection) {
  finish(operator.list(values.connection), close);
} else {
  finish({ exitCode: 1, lines: [usage] }, close);
}
