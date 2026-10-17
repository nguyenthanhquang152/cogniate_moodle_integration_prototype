// Helpers for the QA host-side runners. Node built-ins only (the runner starts before `npm ci`).
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';

// ---------------------------------------------------------------- processes

/** Runs a command without a shell. Never rejects. */
export function run(cmd, args, { cwd, env, timeoutMs = 600_000 } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const child = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 10_000).unref();
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: `${stderr}${err}`, durationMs: Date.now() - started, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr, durationMs: Date.now() - started, timedOut });
    });
  });
}

// ---------------------------------------------------------------- secrets in evidence

/** Replaces known secret values with <redacted:N>. Values shorter than 6 chars are ignored. */
export class Redactor {
  #values = new Set();
  add(...values) {
    for (const v of values) if (typeof v === 'string' && v.trim().length >= 6) this.#values.add(v.trim());
  }
  get size() {
    return this.#values.size;
  }
  apply(text) {
    let out = String(text ?? '');
    for (const v of [...this.#values].sort((a, b) => b.length - a.length)) out = out.split(v).join(`<redacted:${v.length}>`);
    return out;
  }
}

// ---------------------------------------------------------------- env files

export function parseEnv(text) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

export function readEnv(file) {
  return fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')) : null;
}

// ---------------------------------------------------------------- HTTPS from the host

/**
 * HTTPS request to a *.test URL from the host. The host has no DNS for *.test, so the
 * socket goes to 127.0.0.1:<url port>, with SNI and Host set to the URL host.
 */
export function httpsLoopback(url, { method = 'GET', headers = {}, body, ca, timeoutMs = 15_000 } = {}) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: '127.0.0.1',
        port: Number(u.port || 443),
        servername: u.hostname,
        path: `${u.pathname}${u.search}`,
        method,
        headers: { host: u.host, ...headers },
        ca,
        agent: false,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error(`timeout ${u.host}${u.pathname}`)));
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

export function flattenParams(params, prefix = '', out = []) {
  for (const [key, value] of Object.entries(params)) {
    const name = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === 'object') flattenParams(item, `${name}[${i}]`, out);
        else out.push([`${name}[${i}]`, String(item)]);
      });
    } else if (typeof value === 'object') flattenParams(value, name, out);
    else out.push([name, String(value)]);
  }
  return out;
}

/** Moodle REST call from the host. Throws Error(errorcode) on a Moodle exception. */
export async function moodleWs(moodleUrl, token, wsfunction, params, ca) {
  const body = new URLSearchParams([
    ['wstoken', token],
    ['wsfunction', wsfunction],
    ['moodlewsrestformat', 'json'],
    ...flattenParams(params ?? {}),
  ]).toString();
  const res = await httpsLoopback(`${moodleUrl}/webservice/rest/server.php`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': String(Buffer.byteLength(body)) },
    body,
    ca,
  });
  if (res.status !== 200) throw new Error(`${wsfunction}: HTTP ${res.status}`);
  const data = JSON.parse(res.body);
  if (data && typeof data === 'object' && 'exception' in data) throw new Error(`${wsfunction}: ${data.errorcode}`);
  return data;
}

/**
 * Moodle web login (login/index.php). Success = redirect to login/index.php?testsession=<user id>
 * (Moodle 5.2.4 login/index.php:284).
 */
export async function moodleWebLogin(moodleUrl, username, password, ca) {
  const page = await httpsLoopback(`${moodleUrl}/login/index.php`, { ca });
  const token = /name="logintoken" value="([^"]+)"/.exec(page.body)?.[1];
  const cookie = [page.headers['set-cookie'] ?? []].flat().map((c) => c.split(';')[0]).join('; ');
  if (!token) return { ok: false, detail: `no logintoken (HTTP ${page.status})` };
  const body = new URLSearchParams({ username, password, logintoken: token, anchor: '' }).toString();
  const res = await httpsLoopback(`${moodleUrl}/login/index.php`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': String(Buffer.byteLength(body)), cookie },
    body,
    ca,
  });
  const location = String(res.headers.location ?? '');
  const id = /[?&]testsession=(\d+)/.exec(location)?.[1];
  return { ok: [301, 302, 303].includes(res.status) && Boolean(id), userId: id ? Number(id) : null, detail: `HTTP ${res.status}` };
}

// ---------------------------------------------------------------- seed.json (same shape rules as acceptance/lib/seed.ts)

export const MOODLE_USERNAMES = ['admin', 'cg_teacher', 'cg_student', 'cg_student2'];
export const COURSE_SHORTNAMES = ['COGNIATE-DEV-101', 'COGNIATE-DEV-102'];

export function readSeed(file) {
  const root = JSON.parse(fs.readFileSync(file, 'utf8'));
  const users = {};
  const courses = {};
  const tokens = [];
  const toInt = (v) => (Number.isInteger(v) ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : null);
  const walk = (node, at) => {
    if (Array.isArray(node)) return node.forEach((c, i) => walk(c, [...at, String(i)]));
    if (!node || typeof node !== 'object') return;
    const id = toInt(node.id);
    if (typeof node.username === 'string' && typeof node.password === 'string' && id !== null && MOODLE_USERNAMES.includes(node.username)) {
      users[node.username] = { username: node.username, password: node.password, id };
    }
    if (typeof node.shortname === 'string' && id !== null) courses[node.shortname] = id;
    for (const [k, v] of Object.entries(node)) {
      if (k === 'ltiSeed' || k === 'cmids' || k === 'portal') continue; // cmids: activity ids; portal: app users (T4a)
      if (COURSE_SHORTNAMES.includes(k)) {
        const cid = toInt(v) ?? (v && typeof v === 'object' ? (toInt(v.id) ?? toInt(v.courseid)) : null);
        if (cid !== null) courses[k] = cid;
      }
      if (typeof v === 'string' && /^[0-9a-f]{32}$/.test(v) && !/pass/i.test(k)) {
        // T1.md H2: tokens sit in { service, username, userid, token, functions }; classify by `service` first.
        tokens.push({ path: typeof node.service === 'string' ? `service:${node.service}` : [...at, k].join('.'), value: v });
      }
      walk(v, [...at, k]);
    }
  };
  walk(root, []);
  const uniq = (list) => [...new Map(list.map((t) => [t.value, t])).values()];
  const oracle = uniq(tokens.filter((t) => /oracle/i.test(t.path)));
  const product = uniq(tokens.filter((t) => !/oracle/i.test(t.path)));
  const missing = [
    ...MOODLE_USERNAMES.filter((n) => !users[n]).map((n) => `user ${n}`),
    ...COURSE_SHORTNAMES.filter((s) => !courses[s]).map((s) => `course ${s}`),
    ...(product.length === 1 ? [] : [`one product token (found ${product.length})`]),
    ...(oracle.length === 1 ? [] : [`one oracle token (found ${oracle.length})`]),
  ];
  return { users, courses, productToken: product[0]?.value, oracleToken: oracle[0]?.value, missing, raw: root };
}

/** Every string leaf of a JSON value, with its key. */
export function jsonLeaves(node, key = '', out = []) {
  if (Array.isArray(node)) node.forEach((c) => jsonLeaves(c, key, out));
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) jsonLeaves(v, k, out);
  else if (typeof node === 'string') out.push({ key, value: node });
  return out;
}

// ---------------------------------------------------------------- docker

export async function dockerInspect(ids) {
  if (ids.length === 0) return [];
  const r = await run('docker', ['inspect', ...ids]);
  return r.code === 0 ? JSON.parse(r.stdout) : [];
}

/** All containers (running or not) with full labels. */
export async function allContainers() {
  const r = await run('docker', ['ps', '-aq', '--no-trunc']);
  const ids = r.stdout.split('\n').filter(Boolean);
  return dockerInspect(ids);
}

export async function projectResources(project) {
  const label = `label=com.docker.compose.project=${project}`;
  const ids = async (args) => (await run('docker', [...args, '--filter', label])).stdout.split('\n').filter(Boolean);
  return {
    containers: await ids(['ps', '-aq', '--no-trunc']),
    volumes: await ids(['volume', 'ls', '-q']),
    networks: await ids(['network', 'ls', '-q']),
  };
}

export async function serviceContainer(project, service) {
  const r = await run('docker', [
    'ps', '-q', '--filter', `label=com.docker.compose.project=${project}`, '--filter', `label=com.docker.compose.service=${service}`,
  ]);
  return r.stdout.split('\n').filter(Boolean)[0] ?? null;
}

export async function networkSubnets() {
  const r = await run('docker', ['network', 'ls', '-q']);
  const ids = r.stdout.split('\n').filter(Boolean);
  if (ids.length === 0) return [];
  const info = await run('docker', ['network', 'inspect', ...ids]);
  if (info.code !== 0) return [];
  return JSON.parse(info.stdout).flatMap((n) =>
    (n.IPAM?.Config ?? []).filter((c) => c.Subnet).map((c) => ({ name: n.Name, project: n.Labels?.['com.docker.compose.project'] ?? '', subnet: c.Subnet })),
  );
}

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, octet) => ((acc << 8) + Number(octet)) >>> 0, 0);
}

export function cidrOverlap(a, b) {
  const [ipA, lenA] = a.split('/');
  const [ipB, lenB] = b.split('/');
  if (!ipA?.includes('.') || !ipB?.includes('.')) return false;
  const len = Math.min(Number(lenA), Number(lenB));
  const mask = len === 0 ? 0 : (~0 << (32 - len)) >>> 0;
  return (ipv4ToInt(ipA) & mask) >>> 0 === (ipv4ToInt(ipB) & mask) >>> 0;
}

export function portFree(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(Number(port), host);
  });
}

// ---------------------------------------------------------------- files

export function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Recursive file list. Skips node_modules and .git. */
export function walkFiles(dir, { skipDirs = ['node_modules', '.git'] } = {}) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirs.includes(entry.name)) out.push(...walkFiles(full, { skipDirs }));
    } else if (entry.isFile()) out.push(full);
  }
  return out;
}

export function walkDirsNamed(dir, name, { skipDirs = ['node_modules', '.git'] } = {}) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || skipDirs.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.name === name) out.push(full);
    else out.push(...walkDirsNamed(full, name, { skipDirs }));
  }
  return out;
}

// ---------------------------------------------------------------- secret candidates (AC-T1-11)

const SECRET_KEY = /(pass|secret|token|api_?key|master|private|salt|credential)|_KEY$/i;

function entropy(s) {
  const freq = {};
  for (const c of s) freq[c] = (freq[c] ?? 0) + 1;
  return -Object.values(freq).reduce((acc, n) => acc + (n / s.length) * Math.log2(n / s.length), 0);
}

function looksRandom(v) {
  if (v.length < 16 || /\s/.test(v)) return false;
  const runs = v.match(/[A-Za-z0-9]{8,}/g) ?? [];
  if (!runs.some((r) => /[A-Za-z]/.test(r) && /\d/.test(r))) return false;
  return entropy(v) >= 3.5;
}

function plainNonSecret(v) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) || v.startsWith('/') || v.startsWith('./') || /^\d+(\.\d+)*$/.test(v) || /^(true|false|yes|no|on|off|null)$/i.test(v);
}

/** True if the value is likely a secret. URLs, paths, numbers, image refs and host names are not. */
export function isSecretCandidate(key, value) {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v || plainNonSecret(v)) return false;
  if (SECRET_KEY.test(key)) return v.length >= 6;
  if (/[/:.]/.test(v)) return false;
  return looksRandom(v);
}

export function isSecretKeyName(key) {
  return SECRET_KEY.test(key);
}

/** Secret candidates in one file: { key, value }[]. Binary and large files are skipped. */
export function secretsInFile(file) {
  const stat = fs.statSync(file);
  if (stat.size > 1_000_000) return { skipped: 'larger than 1 MB', items: [] };
  const buf = fs.readFileSync(file);
  if (buf.subarray(0, 8000).includes(0)) return { skipped: 'binary', items: [] };
  const text = buf.toString('utf8');
  const trimmed = text.trim();
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) {
    const body = text.split(/\r?\n/).filter((l) => l.length >= 40 && !l.startsWith('-----')).slice(0, 3);
    return { items: body.map((value) => ({ key: 'PRIVATE_KEY_PEM', value })) };
  }
  if (/^\s*[[{]/.test(text)) {
    try {
      return { items: jsonLeaves(JSON.parse(text)).filter((l) => isSecretCandidate(l.key, l.value)) };
    } catch {
      // not JSON; continue
    }
  }
  const env = parseEnv(text);
  if (Object.keys(env).length > 0) {
    return { items: Object.entries(env).filter(([k, v]) => isSecretCandidate(k, v)).map(([key, value]) => ({ key, value })) };
  }
  if (!/\s/.test(trimmed) && trimmed.length >= 16) return { items: [{ key: path.basename(file), value: trimmed }] };
  return { items: [] };
}

// ---------------------------------------------------------------- test reports

const ID_RE = /\b(AC-T\d+-\d+|LC-T\d+-\d+|H\d+|SETUP-T\w+)\b/;

/** Per-test results from Vitest JSON and Playwright JSON reports: { id, title, status }[]. */
export function readTestReports(dir) {
  const out = [];
  const vitest = path.join(dir, 'vitest-results.json');
  if (fs.existsSync(vitest)) {
    for (const file of JSON.parse(fs.readFileSync(vitest, 'utf8')).testResults ?? []) {
      for (const t of file.assertionResults ?? []) {
        const status = t.status === 'passed' ? 'PASS' : t.status === 'failed' ? 'FAIL' : 'SKIP';
        out.push({ id: ID_RE.exec(t.title)?.[1] ?? 'UNMAPPED', title: t.title, status, runner: 'vitest' });
      }
    }
  }
  const pw = path.join(dir, 'playwright-results.json');
  if (fs.existsSync(pw)) {
    const walk = (suite) => {
      for (const spec of suite.specs ?? []) {
        for (const t of spec.tests ?? []) {
          const status = t.status === 'expected' ? 'PASS' : t.status === 'skipped' ? 'SKIP' : 'FAIL';
          out.push({ id: ID_RE.exec(spec.title)?.[1] ?? 'UNMAPPED', title: spec.title, status, runner: 'playwright' });
        }
      }
      for (const child of suite.suites ?? []) walk(child);
    };
    for (const s of JSON.parse(fs.readFileSync(pw, 'utf8')).suites ?? []) walk(s);
  }
  return out;
}
