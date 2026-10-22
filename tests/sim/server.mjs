import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRuntime, json } from './core/runtime.mjs';

const SIM_HOST_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.sim\.test$/;
const PROVIDER_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

export function loadHostManifest(manifestPath = fileURLToPath(new URL('./hosts.json', import.meta.url))) {
  let raw;
  try {
    raw = fs.readFileSync(manifestPath, 'utf8');
  } catch (error) {
    throw new Error(`Simulator host manifest unreadable (${manifestPath}): ${error.message}`);
  }
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Simulator host manifest invalid JSON (${manifestPath}): ${error.message}`);
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('Simulator host manifest must be a JSON object');
  }
  const topKeys = Object.keys(manifest);
  if (topKeys.some((key) => key !== 'version' && key !== 'providers')) {
    throw new Error(`Simulator host manifest has unknown top-level keys: ${topKeys.filter((k) => k !== 'version' && k !== 'providers').join(', ')}`);
  }
  if (manifest.version !== 1) {
    throw new Error(`Unsupported simulator host manifest version: ${String(manifest.version)}`);
  }
  if (!Array.isArray(manifest.providers) || manifest.providers.length === 0) {
    throw new Error('Simulator host manifest providers must be a non-empty array');
  }
  const seenIds = new Set();
  const hostOwner = new Map();
  for (const entry of manifest.providers) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Simulator host manifest provider entry must be an object');
    }
    const entryKeys = Object.keys(entry);
    if (entryKeys.some((key) => key !== 'id' && key !== 'aliases' && key !== 'allowlist')) {
      throw new Error(`Simulator host manifest entry has unknown keys: ${entryKeys.filter((k) => k !== 'id' && k !== 'aliases' && k !== 'allowlist').join(', ')}`);
    }
    if (typeof entry.id !== 'string' || !PROVIDER_ID_RE.test(entry.id)) {
      throw new Error(`Simulator host manifest entry has invalid id: ${String(entry.id)}`);
    }
    if (seenIds.has(entry.id)) {
      throw new Error(`Duplicate simulator host manifest provider id: ${entry.id}`);
    }
    seenIds.add(entry.id);
    if (!Array.isArray(entry.aliases) || entry.aliases.length === 0) {
      throw new Error(`Simulator host manifest entry ${entry.id} must have a non-empty aliases array`);
    }
    if (!Array.isArray(entry.allowlist)) {
      throw new Error(`Simulator host manifest entry ${entry.id} must have an allowlist array`);
    }
    const aliasSet = new Set();
    for (const host of entry.aliases) {
      if (typeof host !== 'string' || host === 'lms-sim.test' || !SIM_HOST_RE.test(host)) {
        throw new Error(`Invalid simulator alias host ${String(host)} in ${entry.id}`);
      }
      if (aliasSet.has(host)) {
        throw new Error(`Duplicate simulator alias host ${host} in ${entry.id}`);
      }
      if (hostOwner.has(host)) {
        throw new Error(`Duplicate simulator host ${host} across providers ${hostOwner.get(host)} and ${entry.id}`);
      }
      aliasSet.add(host);
      hostOwner.set(host, entry.id);
    }
    const allowSet = new Set();
    for (const host of entry.allowlist) {
      if (typeof host !== 'string' || host === 'lms-sim.test' || !SIM_HOST_RE.test(host)) {
        throw new Error(`Invalid simulator allowlist host ${String(host)} in ${entry.id}`);
      }
      if (allowSet.has(host)) {
        throw new Error(`Duplicate simulator allowlist host ${host} in ${entry.id}`);
      }
      if (!aliasSet.has(host)) {
        throw new Error(`Simulator allowlist host ${host} in ${entry.id} is not in aliases`);
      }
      allowSet.add(host);
    }
  }
  return manifest;
}

export async function loadProviders(runtime, selection, options = {}) {
  const simDir = options.simDir ?? path.dirname(fileURLToPath(import.meta.url));
  const manifest = loadHostManifest(options.manifestPath ?? path.join(simDir, 'hosts.json'));
  const discovered = fs.readdirSync(simDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'core' && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
  const names = selection ?? discovered;
  if (!Array.isArray(names) || names.length === 0) {
    throw new Error('No simulator provider modules selected');
  }
  const providers = [];
  for (const name of names) {
    if (typeof name !== 'string' || !PROVIDER_ID_RE.test(name) || name === 'core') {
      throw new Error(`Unknown simulator module: ${String(name)}`);
    }
    const modulePath = path.join(simDir, name, 'index.mjs');
    if (!discovered.includes(name) || !fs.existsSync(modulePath)) {
      throw new Error(`Unknown simulator module: ${name}`);
    }
    let module;
    try { module = await import(pathToFileURL(modulePath).href); }
    catch (error) { throw new Error(`Required ${name} simulator is unavailable: ${error.message}`); }
    if (typeof module.createProviders !== 'function') throw new Error(`Missing ${name} createProviders(runtime)`);
    const added = module.createProviders(runtime);
    if (!Array.isArray(added) || !added.length) throw new Error(`Empty ${name} simulator`);
    providers.push(...added);
  }
  const providerByHost = new Map();
  const manifestById = new Map(manifest.providers.map((entry) => [entry.id, entry]));
  for (const provider of providers) {
    if (!Array.isArray(provider.hosts) || provider.hosts.length === 0) {
      throw new Error(`Simulator provider ${provider.id} has no hosts`);
    }
    for (const host of provider.hosts) {
      if (typeof host !== 'string' || host === 'lms-sim.test' || !SIM_HOST_RE.test(host)) {
        throw new Error(`Invalid simulator host ${String(host)} in provider ${provider.id}`);
      }
      if (providerByHost.has(host) && providerByHost.get(host) !== provider.id) {
        throw new Error(`Duplicate simulator host ${host} across providers ${providerByHost.get(host)} and ${provider.id}`);
      }
      providerByHost.set(host, provider.id);
    }
    const entry = manifestById.get(provider.id);
    if (!entry) {
      throw new Error(`Unlisted simulator provider ${provider.id}: missing from hosts.json`);
    }
    const providerHosts = [...new Set(provider.hosts)].sort();
    const entryAliases = [...entry.aliases].sort();
    if (JSON.stringify(providerHosts) !== JSON.stringify(entryAliases)) {
      throw new Error(`Simulator provider ${provider.id} hosts mismatch with hosts.json aliases`);
    }
  }
  if (selection === undefined) {
    const loadedIds = new Set(providers.map((p) => p.id));
    for (const entry of manifest.providers) {
      if (!loadedIds.has(entry.id)) {
        const moduleName = entry.id.replace(/-sim(?:-.*)?$/, '');
        throw new Error(`Required ${moduleName} simulator is unavailable: manifest entry ${entry.id} has no loaded provider`);
      }
    }
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
  // Every provider module discovered on disk must match tests/sim/hosts.json. No automatic partial mode.
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
