export interface DropRule {
  key: string;
  reason: string;
  when?: (parent: Record<string, unknown>) => boolean;
}

export interface NormalizeContext {
  ids: Map<string, string>;
  dropped: Map<string, number>;
  secrets: number;
}

export const DROP: DropRule[];
export const SECRET_KEYS: Set<string>;
export const ID_KEYS: Set<string>;
export const JWK_MATERIAL: string[];
export const SECRET_PARAMS: string[];

export function createContext(): NormalizeContext;
export function normalizeString(value: string, ctx: NormalizeContext): string;
export function normalize<T = unknown>(value: T, ctx?: NormalizeContext): T;
export function normalizeFile(sections: Record<string, unknown>): {
  data: Record<string, unknown>;
  stats: { ids: number; secrets: number; dropped: Record<string, number> };
};
export function secretScan(files: Array<[string, string]>, secrets?: string[]): Array<{ file: string; kind: string }>;
