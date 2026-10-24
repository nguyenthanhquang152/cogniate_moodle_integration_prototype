import { z } from 'zod';
import type { Db } from '../db/index.ts';
import { RATE_LIMIT_CLASSES } from './accounts.ts';

export type RateLimitClass = typeof RATE_LIMIT_CLASSES[number];
export interface RateLimit { ratePerMinute: number; burst: number }
export interface RateLimitSettings {
  classes?: Partial<Record<RateLimitClass, RateLimit>>;
  registrationSessionsPerAddress?: number;
}

const LimitSchema = z.object({ ratePerMinute: z.number().min(1), burst: z.number().int().min(1) }).strict();
export const RateLimitSettingsSchema = z.object({
  classes: z.partialRecord(z.enum(RATE_LIMIT_CLASSES), LimitSchema).optional(),
  registrationSessionsPerAddress: z.number().int().min(1).max(1000).optional(),
}).strict();
export const RateLimitPatchSchema = z.object({
  classes: z.partialRecord(z.enum(RATE_LIMIT_CLASSES), LimitSchema.nullable()).optional(),
  registrationSessionsPerAddress: z.number().int().min(1).max(1000).nullable().optional(),
}).strict();
export type RateLimitPatch = z.infer<typeof RateLimitPatchSchema>;

export function readRateLimitSettings(db: Db): RateLimitSettings {
  const row = db.prepare("SELECT value FROM service_setting WHERE key = 'rate_limits'").get() as { value: string } | undefined;
  return row ? RateLimitSettingsSchema.parse(JSON.parse(row.value)) : {};
}

/** The caller uses audit.change so storage and the audit event have one commit. */
export function patchRateLimitSettings(db: Db, patch: RateLimitPatch): RateLimitSettings {
  const current = readRateLimitSettings(db);
  const classes = { ...current.classes };
  for (const [name, limit] of Object.entries(patch.classes ?? {})) {
    if (limit === null) delete classes[name as RateLimitClass];
    else classes[name as RateLimitClass] = limit;
  }
  const next: RateLimitSettings = { ...current, classes };
  if (patch.registrationSessionsPerAddress === null) delete next.registrationSessionsPerAddress;
  else if (patch.registrationSessionsPerAddress !== undefined) next.registrationSessionsPerAddress = patch.registrationSessionsPerAddress;
  db.prepare("INSERT INTO service_setting (key, value) VALUES ('rate_limits', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify(next));
  return next;
}

const KeyProviderSettingsSchema = z.object({ legacyBlobs: z.literal('refused').optional() }).loose();
function readKeyProviderSettings(db: Db): z.infer<typeof KeyProviderSettingsSchema> {
  const row = db.prepare("SELECT value FROM service_setting WHERE key = 'key_provider'").get() as { value: string } | undefined;
  return row ? KeyProviderSettingsSchema.parse(JSON.parse(row.value)) : {};
}

/** Read on each open, so every provider sees the committed refusal without a restart. */
export function legacyBlobsRefused(db: Db): boolean {
  return readKeyProviderSettings(db).legacyBlobs === 'refused';
}

/** The re-wrap job calls this in the same transaction as its final scan and audit event. */
export function refuseLegacyBlobs(db: Db): void {
  const current = readKeyProviderSettings(db);
  if (current.legacyBlobs === 'refused') return;
  db.prepare("INSERT INTO service_setting (key, value) VALUES ('key_provider', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify({ ...current, legacyBlobs: 'refused' }));
}
