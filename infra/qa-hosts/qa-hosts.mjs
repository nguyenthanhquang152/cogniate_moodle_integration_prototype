// QA helper hosts of the `acceptance` compose profile (T2b, local-stack §3). Test infrastructure, not product code.
//   --mode=sink   (evil.test):        answers 200 to every request; logs sink_hit {host, method, path}
//   --mode=static (qa-platform.test): GET|HEAD https://qa-platform.test/<path> serves <root>/<path>
//                                     (.json as application/json); logs qa_platform_hit {method, path, status}
// HTTPS on :443 with infra/.certs/qa.crt (SAN evil.test, qa-platform.test, signed by the dev CA).
// Plain HTTP /healthz on :8080 for the compose health check; it is NOT logged, so health checks never count as hits.
// Log lines: {ts, level, service, event, trace_id, ...} in $LOG_DIR/<name>.jsonl (same format as the services).
// No dependencies: plain Node, so it runs from the read-only /qa-hosts mount.
import { randomBytes } from 'node:crypto';
import { appendFileSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { extname, join, resolve, sep } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? '']));
const mode = args.mode;
const name = args.name ?? (mode === 'sink' ? 'sink' : 'qa-platform');
if (mode !== 'sink' && mode !== 'static') {
  console.error('usage: node qa-hosts.mjs --mode=sink|static [--name=<log name>] [--root=<folder>]');
  process.exit(2);
}
const logFile = join(process.env.LOG_DIR ?? '/logs', `${name}.jsonl`);
const bootTrace = `boot-${randomBytes(6).toString('hex')}`;
const root = mode === 'static' ? resolve(args.root ?? '/fixtures') : '';

function log(level, event, fields = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, service: name, event, trace_id: fields.trace_id ?? bootTrace, ...fields });
  try {
    appendFileSync(logFile, `${line}\n`);
  } catch {
    /* a missing log folder must not stop the test host */
  }
  process.stdout.write(`${line}\n`);
}

const traceOf = (req) => {
  const t = req.headers['x-trace-id'];
  return typeof t === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(t) ? t : randomBytes(16).toString('hex');
};

// The path as it can go into a log: no query, long token-like segments redacted (like redactPath in the services),
// at most 300 characters.
const logPath = (url) => {
  const p = (url ?? '/').split('?')[0].split('#')[0];
  return p.split('/').map((s) => (/^[A-Za-z0-9_~.%-]{20,}$/.test(s) && !/\.[A-Za-z0-9]{1,8}$/.test(s) ? ':redacted' : s)).join('/').slice(0, 300);
};

const TYPES = { '.json': 'application/json', '.jwks': 'application/json', '.pem': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

/** File inside the root for a request path, or null (bad encoding, traversal, symlink out of the root, not a file). */
function fileFor(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\') || decoded.split('/').includes('..')) return null;
  const target = resolve(root, `.${decoded}`);
  if (!target.startsWith(root + sep)) return null;
  try {
    const real = realpathSync(target);
    const realRoot = realpathSync(root);
    if (!real.startsWith(realRoot + sep) || !statSync(real).isFile()) return null;
    return real;
  } catch {
    return null;
  }
}

function handle(req, res) {
  const trace = traceOf(req);
  const path = logPath(req.url);
  res.setHeader('x-trace-id', trace);
  res.setHeader('cache-control', 'no-store');
  req.resume(); // read and drop any body
  if (mode === 'sink') {
    const host = String(req.headers.host ?? '').slice(0, 100);
    log('info', 'sink_hit', { trace_id: trace, host, method: req.method, path });
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('ok\n');
    return;
  }
  let status = 404;
  let body = 'not found\n';
  let type = 'text/plain; charset=utf-8';
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    status = 405;
    body = 'method not allowed\n';
    res.setHeader('allow', 'GET, HEAD');
  } else {
    const file = fileFor((req.url ?? '/').split('?')[0]);
    if (file) {
      status = 200;
      body = readFileSync(file);
      type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
    }
  }
  log('info', 'qa_platform_hit', { trace_id: trace, method: req.method, path, status });
  res.writeHead(status, { 'content-type': type, 'x-content-type-options': 'nosniff' });
  res.end(req.method === 'HEAD' ? undefined : body);
}

const tls = { key: readFileSync(process.env.TLS_KEY ?? '/certs/qa.key'), cert: readFileSync(process.env.TLS_CERT ?? '/certs/qa.crt') };
const httpsPort = Number(process.env.PORT ?? 443);
const healthPort = Number(process.env.HEALTH_PORT ?? 8080);
createHttpsServer(tls, handle).listen(httpsPort, '0.0.0.0', () => {
  log('info', 'service_started', { mode, port: httpsPort, ...(mode === 'static' ? { root } : {}), node: process.version });
});
createHttpServer((req, res) => {
  const ok = req.url === '/healthz';
  res.writeHead(ok ? 200 : 404, { 'content-type': 'application/json' });
  res.end(ok ? JSON.stringify({ status: 'ok', service: name, mode }) : '{}');
}).listen(healthPort, '0.0.0.0');
for (const sig of ['SIGTERM', 'SIGINT']) process.once(sig, () => { log('info', 'service_stopping', { signal: sig }); process.exit(0); });
