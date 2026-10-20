import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRuntime, json } from './core/runtime.mjs';

export async function loadProviders(runtime, selection = ['blackboard', 'canvas']) {
  const providers = [];
  for (const name of selection) {
    if (!['blackboard', 'canvas'].includes(name)) throw new Error(`Unknown simulator module: ${name}`);
    let module;
    try { module = await import(`./${name}/index.mjs`); }
    catch (error) { throw new Error(`Required ${name} simulator is unavailable: ${error.message}`); }
    if (typeof module.createProviders !== 'function') throw new Error(`Missing ${name} createProviders(runtime)`);
    const added = module.createProviders(runtime);
    if (!Array.isArray(added) || !added.length) throw new Error(`Empty ${name} simulator`);
    providers.push(...added);
  }
  return providers;
}

export async function main() {
  const ca = fs.readFileSync(process.env.CA_FILE);
  const publicLtiUrl = process.env.PUBLIC_LTI_URL;
  const logDir = process.env.LOG_DIR ?? '/logs';
  fs.mkdirSync(logDir, { recursive: true });
  const fetchJwks = (url) => new Promise((resolve, reject) => {
    const target = new URL(url);
    if (target.href !== `${publicLtiUrl.replace(/\/$/, '')}/lti/keys/cogniate`) return reject(new Error('Unexpected tool JWKS URL'));
    const request = https.get(target, { ca, timeout: 5000 }, (response) => {
      const chunks = []; let size = 0;
      response.on('data', (chunk) => { size += chunk.length; if (size > 65536) response.destroy(new Error('JWKS too large')); else chunks.push(chunk); });
      response.on('error', reject);
      response.on('end', () => {
        if (response.statusCode !== 200) return reject(new Error('Tool JWKS HTTP failure'));
        try { resolve(JSON.parse(Buffer.concat(chunks))); } catch { reject(new Error('Tool JWKS JSON')); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('Tool JWKS timeout')));
    request.on('error', reject);
  });
  const runtime = createRuntime({ publicLtiUrl, fetchJwks,
    log: (event) => fs.appendFileSync(path.join(logDir, 'lms-sim.jsonl'), JSON.stringify(event) + '\n') });
  // The deployed default must have both teams' modules. No automatic partial mode.
  const providers = await loadProviders(runtime);
  const allowedHosts = new Set(['lms-sim.test', ...providers.flatMap((p) => p.hosts)]);
  const server = https.createServer({ key: fs.readFileSync(process.env.KEY_FILE), cert: fs.readFileSync(process.env.CERT_FILE) },
    async (incoming, outgoing) => {
      let request;
      try {
        const host = incoming.headers.host?.toLowerCase();
        if (!allowedHosts.has(host)) { outgoing.writeHead(421); outgoing.end(); return; }
        const chunks = []; let size = 0;
        for await (const chunk of incoming) {
          size += chunk.length;
          if (size > 1_048_576) { outgoing.writeHead(413); outgoing.end(); return; }
          chunks.push(chunk);
        }
        request = { method: incoming.method, host, url: new URL(incoming.url, `https://${host}`),
          headers: incoming.headers, body: Buffer.concat(chunks).toString('utf8') };
        let result;
        if (host === 'lms-sim.test') result = await runtime.control(request);
        else for (const provider of providers) {
          result = await provider.handle(request);
          if (result) break;
        }
        result ??= json(404, { error: 'Unknown simulator route' });
        runtime.logHit(request, result);
        outgoing.writeHead(result.status, result.headers); outgoing.end(result.body);
      } catch {
        const result = json(500, { error: 'Simulator request failure' });
        if (request) runtime.logHit(request, result);
        outgoing.writeHead(result.status, result.headers); outgoing.end(result.body);
      }
    });
  const health = http.createServer((request, response) => {
    const valid = request.method === 'GET' && request.url === '/healthz';
    response.writeHead(valid ? 200 : 404, { 'content-type': 'application/json' });
    response.end(JSON.stringify(valid ? { status: 'ok', providers: providers.map((p) => p.id) } : { error: 'Not found' }));
  });
  server.listen(443, '0.0.0.0'); health.listen(8080, '0.0.0.0');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { process.stderr.write(`Simulator startup failed: ${error.message}\n`); process.exitCode = 1; });
}
