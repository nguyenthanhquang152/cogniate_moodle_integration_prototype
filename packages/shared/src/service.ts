import type { Server } from 'node:http';
import type { PublicUrls } from './config.ts';
import { loadPublicUrls } from './config.ts';
import { closeOnSignal, listen } from './http.ts';
import type { Knob, KnobSpec, ServiceKnobs } from './knobs.ts';
import { readServiceKnobs } from './knobs.ts';
import { parseAllowlist } from './outbound.ts';
import type { Logger } from './logger.ts';
import { createLogger } from './logger.ts';

export interface ServiceListener {
  /** Logical service name, also the log file name: <LOG_DIR>/<name>.jsonl */
  name: string;
  port: number;
  publicUrl: (urls: PublicUrls) => string;
  /** Make the server (not listening yet). May be async, for example a Fastify app after ready(). */
  build: (deps: {
    logger: Logger; knobs: Knob[]; knobValues: ServiceKnobs['values']; knobStrings: ServiceKnobs['strings']; urls: PublicUrls; profile: string; outboundAllowlist: string[];
  }) => Server | Promise<Server>;
}

export interface StartOptions {
  env?: Record<string, string | undefined>;
  /** Close the servers on SIGTERM / SIGINT. Default true. Tests set false. */
  handleSignals?: boolean;
  /** Log sink (default stdout). */
  write?: (line: string) => void;
}

/**
 * Common start-up for every Node service (one compose service = one process): read config and knobs,
 * start the listeners, log service_started (and test_knob_active per active knob), close on SIGTERM.
 * Every listener of the process reports the knobs of the compose service.
 */
export async function startService(
  service: KnobSpec['service'],
  listeners: ServiceListener[],
  options: StartOptions = {},
): Promise<Server[]> {
  const env = options.env ?? process.env;
  const urls = loadPublicUrls(env);
  const { values: knobValues, strings: knobStrings, active: knobs } = readServiceKnobs(service, env);
  const profile = env.STACK_PROFILE && env.STACK_PROFILE !== '' ? env.STACK_PROFILE : 'default';
  const outboundAllowlist = parseAllowlist(env.OUTBOUND_PRIVATE_HOST_ALLOWLIST);
  const servers: Server[] = [];
  const loggers: Logger[] = [];
  for (const l of listeners) {
    const logger = createLogger({ service: l.name, dir: env.LOG_DIR, ...(options.write ? { write: options.write } : {}) });
    for (const knob of knobs) logger.warn('test_knob_active', { name: knob.name, value: knob.value });
    const server = await l.build({ logger, knobs, knobValues, knobStrings, urls, profile, outboundAllowlist });
    const addr = await listen(server, l.port, '0.0.0.0');
    logger.info('service_started', { port: addr.port, public_url: l.publicUrl(urls), node: process.version, profile, outbound_allowlist: outboundAllowlist, knobs });
    servers.push(server);
    loggers.push(logger);
  }
  if (options.handleSignals ?? true) closeOnSignal(servers, loggers);
  return servers;
}
