// @ts-check
import { spawnSync } from 'node:child_process';
import { secretScan } from './secret-scan.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

/** @typedef {{result: 'pass' | 'fail' | 'skip' | 'network_unavailable', reason?: string, code?: string, advisoryIds?: string[], artifact?: string} & Partial<Pick<Extract<import('./secret-scan.mjs').ScanResult, {notes: unknown}>, 'findings' | 'notes'>>} StepResult */
/** @typedef {{source?: number, url?: string}} Advisory */
/** @typedef {{error?: unknown, vulnerabilities?: Record<string, {via?: Array<string | Advisory>}>, metadata?: {vulnerabilities?: {high: number, critical: number}}}} AuditReport */
/** @typedef {{bomFormat?: string, specVersion?: string, components?: unknown[]}} Sbom */

const root = process.cwd();
const output = path.join(root, '.tmp/ci/sbom.cdx.json');
const networkError = /\b(?:ENOTFOUND|EAI_AGAIN|EAI_FAIL|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ESOCKETTIMEDOUT|ENETUNREACH|EHOSTUNREACH|ENETDOWN|EHOSTDOWN|ERR_SOCKET_TIMEOUT)\b/;
/** @type {number | undefined} */
let stepLog;
/** Child text stays in the private log, never in the summary.
 * @param {string} text
 */
function writeLog(text) {
  if (stepLog === undefined) throw new Error('log_unavailable');
  fs.writeFileSync(stepLog, text);
}
/** @param {string[]} args @param {{cwd?: string, network?: boolean}} [options] */
function npm(args, { cwd = root, network = false } = {}) {
  const command = spawnSync('npm', args, {
    cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      npm_config_audit: 'false', npm_config_fund: 'false',
      npm_config_update_notifier: 'false', npm_config_offline: String(!network),
      npm_config_fetch_retries: '0', npm_config_fetch_timeout: '30000',
    },
  });
  writeLog(`\n$ npm ${args.join(' ')} (cwd: ${path.relative(root, cwd) || '.'})\n${command.stdout ?? ''}\n${command.stderr ?? ''}\n${command.error?.stack ?? ''}\nexit: ${command.status}, signal: ${command.signal}\n`);
  return command;
}

/** @param {import('node:child_process').SpawnSyncReturns<string>} command @param {boolean} [network] @returns {StepResult} */
function commandResult(command, network = false) {
  if (command.status === 0 && !command.error) return { result: 'pass' };
  // Never print raw child output: an error can contain a credential or a URL.
  if (network && networkError.test(`${command.stdout}\n${command.stderr}`)) {
    return { result: 'network_unavailable' };
  }
  const code = String(command.stderr ?? '').match(/npm (?:error|ERR!) code ([A-Z][A-Z0-9_]+)/)?.[1];
  return { result: 'fail', reason: 'command_failed', ...(code ? { code } : {}) };
}

/** @returns {StepResult} */
function install() {
  for (const cwd of [root, path.join(root, 'tests')]) {
    const result = commandResult(npm(['ci', '--ignore-scripts'], { cwd, network: true }), true);
    if (result.result !== 'pass') return result;
  }
  return { result: 'pass' };
}

/** @returns {StepResult} */
function audit() {
  const command = npm(['audit', '--omit=dev', '--audit-level=high', '--json'], { network: true });
  const result = commandResult(command, true);
  if (result.result === 'network_unavailable') return result;
  /** @type {AuditReport} */
  let report;
  try { report = JSON.parse(command.stdout); } catch { return { result: 'fail', reason: 'invalid_audit_report' }; }
  if (report.error || !report.vulnerabilities || !report.metadata?.vulnerabilities) {
    return { result: 'fail', reason: 'invalid_audit_report' };
  }
  const advisoryIds = new Set();
  for (const vulnerability of Object.values(report.vulnerabilities)) {
    for (const via of vulnerability.via ?? []) {
      if (typeof via !== 'object' || via === null) continue;
      if (Number.isSafeInteger(via.source)) advisoryIds.add(String(via.source));
      for (const id of String(via.url ?? '').match(/GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/gi) ?? []) advisoryIds.add(id);
    }
  }
  const counts = report.metadata.vulnerabilities;
  if (counts.high > 0 || counts.critical > 0) result.result = 'fail';
  return { ...result, advisoryIds: [...advisoryIds].sort() };
}

/** @returns {StepResult} */
function sbom() {
  const command = npm(['sbom', '--sbom-format', 'cyclonedx', '--omit', 'dev']);
  const result = commandResult(command);
  if (result.result !== 'pass') return result;
  /** @type {Sbom} */
  let document;
  try { document = JSON.parse(command.stdout); } catch { return { result: 'fail', reason: 'invalid_sbom' }; }
  if (document.bomFormat !== 'CycloneDX' || !document.specVersion || !Array.isArray(document.components)) {
    return { result: 'fail', reason: 'invalid_sbom' };
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o600 });
  return { result: 'pass', artifact: '.tmp/ci/sbom.cdx.json' };
}

let failed = false;
let offline = false;
let installed = false;
/** @type {Array<[string, () => StepResult]>} */
const steps = [
  ['install', install],
  ['check', () => installed ? commandResult(npm(['run', 'check'])) : { result: 'skip', reason: 'install_failed' }],
  ['audit', audit],
  ['sbom', () => installed ? sbom() : { result: 'skip', reason: 'install_failed' }],
  ['secrets', secretScan],
];
// A failed run must not leave a stale SBOM that looks like a new result.
let outputReady = true;
try { fs.rmSync(output, { force: true }); } catch { outputReady = false; }
for (const [index, [name, run]] of steps.entries()) {
  const start = performance.now();
  const log = `.tmp/ci/${name}.log`;
  let logReady = false;
  /** @type {StepResult} */
  let result;
  try {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    // Refuse a link and reset permissions on an existing log before writing child text.
    stepLog = fs.openSync(path.join(root, log), fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_NOFOLLOW, 0o600);
    fs.fchmodSync(stepLog, 0o600);
    logReady = true;
    result = offline ? { result: 'skip', reason: 'network_unavailable' }
      : name === 'sbom' && !outputReady ? { result: 'fail', reason: 'artifact_unavailable' } : run();
    writeLog(`\n${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    result = { result: 'fail', reason: logReady ? 'step_failed' : 'log_unavailable' };
    if (logReady) {
      try { writeLog(`${error instanceof Error ? error.stack : String(error)}\n${JSON.stringify(result)}\n`); }
      catch { result.reason = 'log_unavailable'; logReady = false; }
    }
  }
  if (stepLog !== undefined) {
    try { fs.closeSync(stepLog); }
    catch { result = { result: 'fail', reason: 'log_unavailable' }; logReady = false; }
    stepLog = undefined;
  }
  if (name === 'install') installed = result.result === 'pass';
  if (result.result === 'network_unavailable') offline = true;
  if (result.result !== 'pass') failed = true;
  const { notes, ...summary } = result;
  console.log(JSON.stringify({
    step: index + 1, name, ...summary,
    ...(notes ? { staleEntries: notes.length } : {}),
    ...(logReady && (result.result !== 'pass' || notes?.length) ? { log } : {}),
    seconds: Number(((performance.now() - start) / 1000).toFixed(3)),
  }));
}
process.exitCode = offline ? 2 : failed ? 1 : 0;
