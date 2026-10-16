// Vitest setup file: applies the knob guard of lib/knobs.ts to every API test.
import { beforeEach } from 'vitest';
import { activeKnobs, knobSkipReason } from '../lib/knobs';

beforeEach(async (ctx) => {
  const reason = knobSkipReason(ctx.task.name, await activeKnobs());
  if (reason) ctx.skip(reason);
});
