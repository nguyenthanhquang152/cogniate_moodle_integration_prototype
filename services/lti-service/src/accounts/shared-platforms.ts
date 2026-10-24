import type { StoreSource } from '../store/index.ts';
import { storeFor } from '../store/index.ts';
import type { ProfileOptions } from '../profiles/index.ts';
import type { SharedPlatformInput } from '../store/shared-platforms.ts';

export async function checkSharedPlatform(db: StoreSource, opts: ProfileOptions, input: SharedPlatformInput) {
  return (await storeFor(db).sharedPlatforms.checkSharedPlatform(opts, input));
}

export async function provisionSharedPlatform(db: StoreSource, opts: ProfileOptions, input: SharedPlatformInput) {
  return (await storeFor(db).sharedPlatforms.provisionSharedPlatform(opts, input));
}
