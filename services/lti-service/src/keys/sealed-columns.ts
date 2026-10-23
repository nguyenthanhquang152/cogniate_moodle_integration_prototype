import type { StoreSource } from '../store/index.ts';
import { storeFor } from '../store/index.ts';
import type { SealedColumn } from '../store/sealed-columns.ts';
export type { SealedColumn } from '../store/sealed-columns.ts';
export { TOOL_KEY_COLUMN, REGISTRATION_TOKEN_COLUMN, SEALED_COLUMNS } from '../store/sealed-columns.ts';

export async function sealedVersionCounts(db: StoreSource, columns?: readonly SealedColumn[]): Promise<Map<string, number>> {
  return storeFor(db).keyProvider.sealedVersionCounts(columns);
}
