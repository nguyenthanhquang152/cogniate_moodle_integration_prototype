// Types of open-world.mjs (LD-1 open-world checks, LA-E0-04).
type Json = Record<string, any>;
export const BASELINE_PROFILES: Json[];
export const BASELINE_REAL_PROFILES: Json[];
export const BASELINE_SIMULATION_PROFILES: string[];
export const BASELINE_LMS: string[];
export const BASELINE_OTHER_CARDS: string[];
export function registeredChannels(lmsProviders: Json): Set<string>;
export function extraChannelNames(lmsProviders: Json): string[];
export function openList<T, B>(actual: T[], baseline: B[], options: {
  matches: (item: T, expected: B) => boolean;
  check?: (item: T, expected: B) => void;
  label: string;
}): T[];
export function sameBaselineFields(actual: Json, expected: Json, label: string): void;
export function checkProfiles(profiles: Json[], baseline: Json[], options: {
  registered: Set<string>; realOnly?: boolean; label?: string;
}): Json[];
export function checkSimulationProfiles(ids: string[], baseline: string[], options: {
  profiles: Json[]; registered: Set<string>; label?: string;
}): string[];
export function checkLmsEntries(entries: Json[], baseline?: string[], options?: { label?: string }): Json[];
export function seedPortalUser(rawSeed: Json, email?: string): { email: string; password: string };
export function appLmsProviders(
  request: (url: string, init: { method?: string; headers?: Record<string, string>; body?: string; ca?: string | null }) =>
    Promise<{ status: number; headers: Record<string, any>; body: string }>,
  options: { appUrl: string; ca?: string | null; user: { email: string; password: string } },
): Promise<Json>;
export interface CardDescriptor {
  text: string;
  channel: string | null;
  loading?: boolean;
}
export type CardInput = string | CardDescriptor;
export function checkCards<T extends CardInput>(
  cards: T[],
  baselineTexts: string[],
  options: { names: string[]; others?: string[]; label?: string },
): T[];
export interface MigrationLedgerMap {
  'lti-service/lti.db': string[];
  'cogniate-app/cogniate.db': string[];
  [db: string]: string[];
}
export function checkMigrationLedgers(
  oldLedger: MigrationLedgerMap,
  newLedger: MigrationLedgerMap,
  options?: { expectedLtiLedger?: string[]; expectedAppLedger?: string[]; label?: string },
): void;
