import type { Server } from 'node:http';
import type { PublicUrls } from './config.ts';
import { loadPublicUrls } from './config.ts';
import { closeOnSignal, listen } from './http.ts';
import type { Knob, KnobSpec, ServiceKnobs } from './knobs.ts';
import { readServiceKnobs } from './knobs.ts';
import type { Logger } from './logger.ts';
import { createLogger } from './logger.ts';

export interface ServiceListener {
  /** Logical service name, also the log file name: <LOG_DIR>/<name>.jsonl */
  name: string;
  port: number;
  publicUrl: (urls: PublicUrls) => string;
  build: (deps: { logger: Logger; knobs: Knob[]; knobValues: ServiceKnobs['values']; urls: PublicUrls }) => Server;
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
  const { values: knobValues, active: knobs } = readServiceKnobs(service, env);
  const servers: Server[] = [];
  const loggers: Logger[] = [];
  for (const l of listeners) {
    const logger = createLogger({ service: l.name, dir: env.LOG_DIR, ...(options.write ? { write: options.write } : {}) });
    for (const knob of knobs) logger.warn('test_knob_active', { name: knob.name, value: knob.value });
    const server = l.build({ logger, knobs, knobValues, urls });
    const addr = await listen(server, l.port, '0.0.0.0');
    logger.info('service_started', { port: addr.port, public_url: l.publicUrl(urls), node: process.version });
    servers.push(server);
    loggers.push(logger);
  }
  if (options.handleSignals ?? true) closeOnSignal(servers, loggers);
  return servers;
}
