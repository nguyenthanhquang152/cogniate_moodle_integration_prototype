#!/usr/bin/env bash
# Release checks for a clean clone. This script never starts a stack.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
exec node --input-type=module <<'NODE'
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const root = process.cwd();
const output = path.join(root, '.tmp/ci/sbom.cdx.json');
const networkError = /\b(?:ENOTFOUND|EAI_AGAIN|EAI_FAIL|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ESOCKETTIMEDOUT|ENETUNREACH|EHOSTUNREACH|ENETDOWN|EHOSTDOWN|ERR_SOCKET_TIMEOUT)\b/;
const patterns = [
  ['private_key', /-----BEGIN ((?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?)-----(?:[\s\S]*?-----END \1-----)?/g],
  ['api_key', /ltis_[A-Za-z0-9_-]+/g],
  ['master_key', /(?<![a-fA-F0-9])[a-fA-F0-9]{64}(?![a-fA-F0-9])/g],
];

// Each exception names one file, rule, matched-value digest and non-secret reason.
// Digests use base64, so the allow list does not match the master-key rule.
// New values need review. Stale entries give a note and do not fail the scan.
const allowList = [
  {"file":"infra/compat/storage-compat.sha256","rule":"master_key","fingerprint":"yTq/jUcAStK99OGCHSV2C04C3e1RDOFU3pRXALSOxEw=","reason":"Public fixture or build integrity digest."},
  {"file":"infra/compat/storage-compat.sha256","rule":"master_key","fingerprint":"EbGgo/WkA+2uedx2h8H1YED1pijpDp37B0LIMCPEp1I=","reason":"Public fixture or build integrity digest."},
  {"file":"infra/compat/storage-compat.sha256","rule":"master_key","fingerprint":"Hjzh9EtDIMuPA21qZ3uAuVG1PeiVw78jmE6xSXyxFrI=","reason":"Public fixture or build integrity digest."},
  {"file":"infra/compat/storage-compat.sha256","rule":"master_key","fingerprint":"BCWyo2IddjQefFPOAP8oXT/NAJT1ROLcLazYT/io1PI=","reason":"Public fixture or build integrity digest."},
  {"file":"infra/e2e/Dockerfile","rule":"master_key","fingerprint":"kpVmp/V9QdewgObAS69DxG1nQiI/H7rrluMtMCNsjfo=","reason":"Pinned public container image digest."},
  {"file":"infra/fixtures/courses.sha256","rule":"master_key","fingerprint":"Ch79j4FoyjGZ0dZBSPYd8AOXMIrVBCliaMZhgiYUZQM=","reason":"Public fixture or build integrity digest."},
  {"file":"infra/fixtures/courses.sha256","rule":"master_key","fingerprint":"3lifHXYYjkY2H58lNrvFfHeCvlG2ZtPCJgmh9sOh3Hc=","reason":"Public fixture or build integrity digest."},
  {"file":"infra/moodle/SPIKE-NOTES.md","rule":"master_key","fingerprint":"3lifHXYYjkY2H58lNrvFfHeCvlG2ZtPCJgmh9sOh3Hc=","reason":"Public fixture or build integrity digest."},
  {"file":"packages/shared/src/crypto.test.ts","rule":"master_key","fingerprint":"3+eiP+/upRnpu/3Rpr6UxLLkUp3Wt8vqg/mVnCYhsTw=","reason":"Known SHA-256 test vector for abc."},
  {"file":"packages/shared/src/jobs.test.ts","rule":"api_key","fingerprint":"hwmaD7MBfLTyMs0QVYtzfn1nd7oMXRmT15YRUCwVcbU=","reason":"Fixed fake API key in a unit test."},
  {"file":"packages/shared/src/logger.test.ts","rule":"secret_assignment","fingerprint":"GJ9AA0vnoZnx+piRZo7jq2BJ+C04xovnD1luqy4YV7c=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"packages/shared/src/logger.test.ts","rule":"secret_assignment","fingerprint":"AXrXMyX88Qipcu2sYY+e38lXxbHeEPizcbCov6T1ni0=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"packages/shared/src/logger.test.ts","rule":"api_key","fingerprint":"PxsTXu0iDRRpNt5gYRUuKIyfK46CXEsjqjuq1H42RJQ=","reason":"Fixed fake API key in a unit test."},
  {"file":"services/cogniate-app/src/config.test.ts","rule":"secret_assignment","fingerprint":"X+zrZv/IbzjZUnhsbWlsecLbwjndTpG0ZynXOif7V+k=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"services/cogniate-app/src/config.ts","rule":"secret_assignment","fingerprint":"potBLEKCVV8VVGz24fxCiTt+B/JxVXzrAhghCY3WbBs=","reason":"Comment that describes the master key."},
  {"file":"services/lti-service/src/config.test.ts","rule":"secret_assignment","fingerprint":"X+zrZv/IbzjZUnhsbWlsecLbwjndTpG0ZynXOif7V+k=","reason":"Fixed zero digit used to build the fake master key in config unit tests."},
  {"file":"services/lti-service/src/http/app.ts","rule":"secret_assignment","fingerprint":"fJu+Xsmz+3dOj6D1QkfpPDTd+OXRb+MHNCDeCugaJi0=","reason":"Comment that describes the master key."},
  {"file":"services/lti-service/src/http/auth.test.ts","rule":"api_key","fingerprint":"XnYtKiEixshBkJNFsKt7zF+K+Z8NHT6e/TlwtaI/4Vw=","reason":"Fixed fake API key in a unit test."},
  {"file":"services/lti-service/src/http/routes/platforms-audit.test.ts","rule":"api_key","fingerprint":"F6K1X9rE8/gAVncwpHk7A7qd3Kr/TSQBqpmgNza81Zs=","reason":"Fixed invalid API key for the unauthenticated request test."},
  {"file":"services/lti-service/src/store/audit.test.ts","rule":"api_key","fingerprint":"wcRCf8zAJ7SXyw2wuqrbvOKJoSL4g48Zv46Z3tqPLao=","reason":"Fixed fake API key for the audit redaction test."},
  {"file":"tests/acceptance/M1/common/99-logs.test.ts","rule":"private_key","fingerprint":"MCHZDrlDey2PMOg2NpXEQYteXxhwgBtcMX6TmO4PVy0=","reason":"Private-key header search string in the log safety test."},
  {"file":"tests/acceptance/M1/common/99-logs.test.ts","rule":"private_key","fingerprint":"i8rHkI65UEGVN7keGa3IPOLJy/2s9PgRV/2t/sEfcBc=","reason":"Private-key header search string in the log safety test."},
  {"file":"tests/acceptance/T6/3-courses.spec.ts","rule":"master_key","fingerprint":"3lifHXYYjkY2H58lNrvFfHeCvlG2ZtPCJgmh9sOh3Hc=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/acceptance/lib/course-fixtures.ts","rule":"master_key","fingerprint":"3lifHXYYjkY2H58lNrvFfHeCvlG2ZtPCJgmh9sOh3Hc=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/acceptance/lib/course-fixtures.ts","rule":"master_key","fingerprint":"Ch79j4FoyjGZ0dZBSPYd8AOXMIrVBCliaMZhgiYUZQM=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/e2e/host/run-m2.mjs","rule":"master_key","fingerprint":"3lifHXYYjkY2H58lNrvFfHeCvlG2ZtPCJgmh9sOh3Hc=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/e2e/host/run-m2.mjs","rule":"master_key","fingerprint":"Ch79j4FoyjGZ0dZBSPYd8AOXMIrVBCliaMZhgiYUZQM=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/e2e/host/run-t7.mjs","rule":"master_key","fingerprint":"3lifHXYYjkY2H58lNrvFfHeCvlG2ZtPCJgmh9sOh3Hc=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/e2e/host/run-t7.mjs","rule":"master_key","fingerprint":"Ch79j4FoyjGZ0dZBSPYd8AOXMIrVBCliaMZhgiYUZQM=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/fixtures/multi-lms/provider-sources.json","rule":"master_key","fingerprint":"yPilm3vrTioyCaPyYczQeXsAlz/8yHTtNAVrw/7iba0=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/fixtures/multi-lms/provider-sources.json","rule":"master_key","fingerprint":"mvWtx8rhcntYUDVx5v5G5rpybLJhD8cjyU2f3xiE/7w=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/host/run-m1.mjs","rule":"master_key","fingerprint":"3lifHXYYjkY2H58lNrvFfHeCvlG2ZtPCJgmh9sOh3Hc=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/host/run-m1.mjs","rule":"master_key","fingerprint":"Ch79j4FoyjGZ0dZBSPYd8AOXMIrVBCliaMZhgiYUZQM=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/host/run-t1.mjs","rule":"master_key","fingerprint":"3lifHXYYjkY2H58lNrvFfHeCvlG2ZtPCJgmh9sOh3Hc=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/host/run-t1.mjs","rule":"master_key","fingerprint":"Ch79j4FoyjGZ0dZBSPYd8AOXMIrVBCliaMZhgiYUZQM=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/host/run-t4a.mjs","rule":"master_key","fingerprint":"3lifHXYYjkY2H58lNrvFfHeCvlG2ZtPCJgmh9sOh3Hc=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/host/run-t4a.mjs","rule":"master_key","fingerprint":"Ch79j4FoyjGZ0dZBSPYd8AOXMIrVBCliaMZhgiYUZQM=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/host/run-t4b.mjs","rule":"master_key","fingerprint":"3lifHXYYjkY2H58lNrvFfHeCvlG2ZtPCJgmh9sOh3Hc=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/host/run-t4b.mjs","rule":"master_key","fingerprint":"Ch79j4FoyjGZ0dZBSPYd8AOXMIrVBCliaMZhgiYUZQM=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/host/run-t5.mjs","rule":"master_key","fingerprint":"3lifHXYYjkY2H58lNrvFfHeCvlG2ZtPCJgmh9sOh3Hc=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/host/run-t5.mjs","rule":"master_key","fingerprint":"Ch79j4FoyjGZ0dZBSPYd8AOXMIrVBCliaMZhgiYUZQM=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/host/run-t8.mjs","rule":"master_key","fingerprint":"3lifHXYYjkY2H58lNrvFfHeCvlG2ZtPCJgmh9sOh3Hc=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/host/run-t8.mjs","rule":"master_key","fingerprint":"Ch79j4FoyjGZ0dZBSPYd8AOXMIrVBCliaMZhgiYUZQM=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/host/storage-docker.mjs","rule":"master_key","fingerprint":"gueaWA8jjbT1tB4rotGDVrw8CmEqOqAdE9oL2uOI89c=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/host/storage-docker.mjs","rule":"master_key","fingerprint":"huhSAfJvdw4M/ERWCANkaehjUMcPxJWCzY/jXBxKvdc=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/host/storage-lane.mjs","rule":"secret_assignment","fingerprint":"4c1KyEff694n5U85h9if9MfLD7PLPxWAKbvb0cVW3Ns=","reason":"Ternary expression that selects an environment key name."},
  {"file":"tests/host/storage-lane.selftest.mjs","rule":"secret_assignment","fingerprint":"U7aVFWPWDG8AQdp5JIAvH5gE7BTMMQXBzpVI7XbJ1rk=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"tests/host/storage-private-scan.selftest.mjs","rule":"secret_assignment","fingerprint":"Pz73hrNNbdcW4YEsi3SnoOHwWqXzIwWI9vW80Axsg5I=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"tests/host/storage-rows.selftest.mjs","rule":"secret_assignment","fingerprint":"aKlDn5swN5K1skic7ttFZ0IIZuOwtTb5Iu5gCPbjwDs=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"tests/host/storage-rows.selftest.mjs","rule":"secret_assignment","fingerprint":"jTSQKKXox67xixSrLv3uM0XQ3vLrxZHQy6XijDVMRW0=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"tests/host/storage-rows.selftest.mjs","rule":"secret_assignment","fingerprint":"uAn8Tj+teFTjOZgmcQ2PjglJxPHwGWq+6IG/VWgO0HA=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"tests/host/storage-rows.selftest.mjs","rule":"secret_assignment","fingerprint":"D8dNDyzWQ5RKteaV/Hmf+o/A3PE2tpQ+JhI03P4yAPI=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"tests/host/storage-rows.selftest.mjs","rule":"secret_assignment","fingerprint":"4ZpyHyB3cMii2MdUuabVnJd+cpRfk0C35KBF9v3WaOg=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"tests/host/storage-rows.selftest.mjs","rule":"master_key","fingerprint":"pXtZVtvG4CEnu7QMh8uCRBltbRjg4UGTb/zYz/rUV60=","reason":"Public fixture or build integrity digest."},
  {"file":"tests/host/storage-rows.selftest.mjs","rule":"secret_assignment","fingerprint":"wz+9iL1z8wnjYrf9k2glTBsVELnTlnMNR6NEsuFt+HI=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"tests/host/storage-rows.selftest.mjs","rule":"secret_assignment","fingerprint":"2q30lpIgt0BHhqBIBfA/tP9lClhvP8G/E+DLzSesUzA=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"tests/host/storage-rows.selftest.mjs","rule":"secret_assignment","fingerprint":"Cug9nEVNy+mUQieP00uQYyewh5UOWLjQYaav2jKFEq0=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"tests/host/storage-rows.selftest.mjs","rule":"secret_assignment","fingerprint":"SYxkqsND7jlt+39QUawnKXhVvQP1BXwuYlvsEjShxFo=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"tests/host/storage-rows.selftest.mjs","rule":"secret_assignment","fingerprint":"puq77xXThNpsatlbiTJ7TpXFdOr6MjgscUasEey/FDU=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"tests/host/storage-rows.selftest.mjs","rule":"secret_assignment","fingerprint":"eb7JdI1ETz0+iFZi2LaotKXEzIaInA704Ztjq8ggVQw=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"tests/host/storage-rows.selftest.mjs","rule":"secret_assignment","fingerprint":"pXy/58Rre8/uqj+kl4YsjzPpbO+5NFJOwpdpq0pwsv4=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"tests/host/storage-rows.selftest.mjs","rule":"secret_assignment","fingerprint":"QkXklO1bSaDbHHYoa+dtQZjHKSOf4bg+rYU1Ix1rfdM=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"tests/host/storage-rows.selftest.mjs","rule":"secret_assignment","fingerprint":"J3A8AcgIaPs+MefwiSWqJNlwxhi/r4GsSnTdvH7rvHg=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"tests/host/storage-rows.selftest.mjs","rule":"secret_assignment","fingerprint":"5av42HEi/OwPzCvGlUDX2ICJSK1CYORCUGKzD0LOdNM=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"tests/host/storage-rows.selftest.mjs","rule":"secret_assignment","fingerprint":"cR4ddh0rIwnKH5bT7tiB5wB0GvFwKjovrC6xkiPgpbo=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"tests/host/storage-rows.selftest.mjs","rule":"secret_assignment","fingerprint":"kfUHzWSM18ubk3tlsIxAQ7JeP+ZIqGQ0oo2il0RyFIY=","reason":"Fixed fake credential or assertion in a unit test."},
  {"file":"tests/host/storage-rows.selftest.mjs","rule":"secret_assignment","fingerprint":"OkrZUchH2qYY+3dPwZDpzIt/GjBF7VovhSrdb3M3G+Y=","reason":"Fixed fake credential or assertion in a unit test."},
];

function npm(args, { cwd = root, network = false } = {}) {
  return spawnSync('npm', args, {
    cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      npm_config_audit: 'false', npm_config_fund: 'false',
      npm_config_update_notifier: 'false', npm_config_offline: String(!network),
      npm_config_fetch_retries: '0', npm_config_fetch_timeout: '30000',
    },
  });
}

function commandResult(command, network = false) {
  if (command.status === 0 && !command.error) return { result: 'pass' };
  // Never print raw child output: an error can contain a credential or a URL.
  if (network && networkError.test(`${command.stdout}\n${command.stderr}`)) {
    return { result: 'network_unavailable' };
  }
  const code = String(command.stderr ?? '').match(/npm (?:error|ERR!) code ([A-Z][A-Z0-9_]+)/)?.[1];
  return { result: 'fail', reason: 'command_failed', ...(code ? { code } : {}) };
}

function install() {
  for (const cwd of [root, path.join(root, 'tests')]) {
    const result = commandResult(npm(['ci', '--ignore-scripts'], { cwd, network: true }), true);
    if (result.result !== 'pass') return result;
  }
  return { result: 'pass' };
}

function audit() {
  const command = npm(['audit', '--omit=dev', '--audit-level=high', '--json'], { network: true });
  const result = commandResult(command, true);
  if (result.result === 'network_unavailable') return result;
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

function sbom() {
  const command = npm(['sbom', '--sbom-format', 'cyclonedx', '--omit', 'dev']);
  const result = commandResult(command);
  if (result.result !== 'pass') return result;
  let document;
  try { document = JSON.parse(command.stdout); } catch { return { result: 'fail', reason: 'invalid_sbom' }; }
  if (document.bomFormat !== 'CycloneDX' || !document.specVersion || !Array.isArray(document.components)) {
    return { result: 'fail', reason: 'invalid_sbom' };
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o600 });
  return { result: 'pass', artifact: '.tmp/ci/sbom.cdx.json' };
}

function secretScan() {
  const listed = spawnSync('git', ['ls-files', '-z', '--cached'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (listed.status !== 0 || listed.error) return { result: 'fail', reason: 'tracked_files_unavailable' };
  const files = new Set(listed.stdout.split('\0').filter(Boolean));
  const findings = [];
  const used = new Set();
  function finding(file, line, rule, value) {
    const fingerprint = createHash('sha256').update(value).digest('base64');
    const entry = allowList.find((entry) => entry.file === file && entry.rule === rule && entry.fingerprint === fingerprint && entry.reason);
    if (entry) used.add(entry);
    else if (!findings.some((hit) => hit.file === file && hit.line === line && hit.rule === rule)) findings.push({ file, line, rule });
  }
  let example;
  try {
    if (!files.has('.env.example') || !fs.lstatSync('.env.example').isFile()) throw new Error('missing_example');
    example = fs.readFileSync('.env.example', 'utf8');
  } catch { return { result: 'fail', reason: 'secret_names_unavailable' }; }
  const secretKeys = [];
  let inSecrets = false;
  for (const line of example.split('\n')) {
    if (/^\s*# --- secrets\b/.test(line)) inSecrets = true;
    else if (/^\s*# ---/.test(line)) inSecrets = false;
    const assignment = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (inSecrets && assignment) secretKeys.push(assignment[1]);
  }
  if (secretKeys.length === 0) return { result: 'fail', reason: 'secret_names_unavailable' };
  // The key list is read from the secrets section at run time. Public keys are out of scope.
  const assignmentPattern = new RegExp(String.raw`(?<![A-Za-z0-9_])['"]?(${secretKeys.join('|')})['"]?\s*(?:=(?!=|>)|:(?!:))\s*`, 'g');
  const defaultPattern = new RegExp(String.raw`\$\{(${secretKeys.join('|')})(?::[-=]|[-=])`, 'g');
  const quotedPattern = /^("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/;
  // Keep nested placeholders together, both in a bare value and in a shell default.
  function expansionEnd(text, start) {
    let depth = 1;
    for (let i = start + 2; i < text.length; i += 1) {
      if (text.startsWith('${', i)) { depth += 1; i += 1; }
      else if (text[i] === '}' && --depth === 0) return i;
    }
    return -1;
  }
  function readValue(text) {
    const quoted = text.match(quotedPattern);
    if (quoted) return quoted[0];
    let end = 0;
    while (end < text.length) {
      if (text.startsWith('${', end)) {
        const close = expansionEnd(text, end);
        if (close >= 0) { end = close + 1; continue; }
      }
      if (text[end] === '<') {
        const close = text.indexOf('>', end + 1);
        if (close >= 0) { end = close + 1; continue; }
      }
      if (/[\s,;}\]#"'`]/.test(text[end])) break;
      end += 1;
    }
    return text.slice(0, end);
  }
  function literal(value) {
    if (value.match(quotedPattern)?.[0] === value) value = value.slice(1, -1);
    if (value === '' || /^(?:\$[A-Za-z_][A-Za-z0-9_]*|<[^<>]*>)$/.test(value)) return null;
    if (value.startsWith('${') && expansionEnd(value, 0) === value.length - 1) {
      if (/^\$\{[A-Za-z_][A-Za-z0-9_]*(?:\}|:?\?)/.test(value)) return null;
      const fallback = [...value.matchAll(defaultPattern)][0];
      if (fallback?.index === 0) return literal(value.slice(fallback[0].length, -1));
    }
    return value;
  }
  for (const file of files) {
    const codeFile = /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/.test(file);
    let text;
    try {
      const stat = fs.lstatSync(file);
      // Scan link text without following it outside the checkout. Other types fail closed.
      if (stat.isSymbolicLink()) text = fs.readlinkSync(file);
      else if (stat.isFile()) text = fs.readFileSync(file).toString('utf8');
      else throw new Error('unsupported_file');
    } catch {
      findings.push({ file, line: 1, rule: 'unreadable_file' });
      continue;
    }
    for (const [rule, pattern] of patterns) {
      // A1: documentation contains evidence hashes, but still gets every other rule.
      if (rule === 'master_key' && file.startsWith('docs/')) continue;
      for (const match of text.matchAll(pattern)) {
        finding(file, text.slice(0, match.index).split('\n').length, rule, match[0]);
      }
    }
    text.split('\n').forEach((line, index) => {
      if (file === '.env.example') {
        const assignment = line.match(/^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=(.*)$/);
        if (assignment && !/^(?:""|''|``)?$/.test(assignment[1].trim())) findings.push({ file, line: index + 1, rule: 'example_value' });
      } else {
        for (const match of line.matchAll(assignmentPattern)) {
          // Shell required-value expressions are not assignments.
          if (line.slice(Math.max(0, match.index - 2), match.index) === '${') continue;
          const token = readValue(line.slice(match.index + match[0].length));
          // BD-A1-13: code expressions are not literal credentials. Check only the first quoted token.
          if (codeFile && (!quotedPattern.test(token) || (token.startsWith('`') && token.includes('${')))) continue;
          const value = literal(token);
          if (value !== null) finding(file, index + 1, 'secret_assignment', value);
        }
      }
      // Defaults of secret names are values in every file, even without a secret key on the left.
      for (const match of line.matchAll(defaultPattern)) {
        const end = expansionEnd(line, match.index);
        if (end < 0) continue;
        const value = literal(line.slice(match.index + match[0].length, end));
        if (value !== null) finding(file, index + 1, 'secret_assignment', value);
      }
    });
  }
  const notes = allowList.filter((entry) => !used.has(entry)).map(({ file, rule }) => ({ file, rule, note: 'stale_allow_list_entry' }));
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
  return { result: findings.length ? 'fail' : 'pass', findings, notes };
}

let failed = false;
let offline = false;
let installed = false;
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
  let result;
  try {
    result = offline ? { result: 'skip', reason: 'network_unavailable' }
      : name === 'sbom' && !outputReady ? { result: 'fail', reason: 'artifact_unavailable' } : run();
  } catch { result = { result: 'fail', reason: 'step_failed' }; }
  if (name === 'install') installed = result.result === 'pass';
  if (result.result === 'network_unavailable') offline = true;
  if (result.result !== 'pass') failed = true;
  console.log(JSON.stringify({ step: index + 1, name, ...result, seconds: Number(((performance.now() - start) / 1000).toFixed(3)) }));
}
process.exitCode = offline ? 2 : failed ? 1 : 0;
NODE
