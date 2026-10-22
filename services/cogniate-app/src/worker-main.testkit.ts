// Preloaded only by worker-main.test.ts. Keep the real guarded client and HTTP API, but use a local HTTP
// test server instead of TLS. Refuse every other address so the process tests cannot send external requests.
import { request } from 'node:http';
import https, { type RequestOptions } from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
import type { IncomingMessage } from 'node:http';

// npm wraps the worker in other processes. Signal the service itself to test its shutdown without repeated
// signal forwarding from the wrappers; the test still owns the whole process group for forced cleanup.
if (process.argv[1]?.endsWith('/worker-main.ts') || process.argv[1]?.endsWith('/main.ts')) {
  process.stdout.write(`${JSON.stringify({ event: 'unit_service_pid', pid: process.pid })}\n`);
}

https.request = ((options: RequestOptions, callback: (response: IncomingMessage) => void) => {
  if (options.hostname !== '127.0.0.1') throw new Error('The worker test transport only permits its local LTI server.');
  return request({ ...options, protocol: 'http:', agent: false }, callback);
}) as typeof https.request;
syncBuiltinESMExports();
