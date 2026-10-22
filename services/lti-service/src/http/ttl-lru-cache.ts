export interface TtlLruCache<V> {
  get(key: string, now: number): V | undefined;
  set(key: string, value: V, now: number): void;
  delete(key: string): void;
}

/** A bounded cache. Reading an entry updates its LRU position but does not extend its TTL. */
export function ttlLruCache<V>({ ttlMs, limit }: { ttlMs: number; limit: number }): TtlLruCache<V> {
  const entries = new Map<string, { value: V; expiresAt: number }>();
  return {
    get(key, now) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      entries.delete(key);
      if (entry.expiresAt <= now) return undefined;
      entries.set(key, entry);
      return entry.value;
    },
    set(key, value, now) {
      entries.delete(key);
      if (entries.size >= limit) entries.delete(entries.keys().next().value!);
      entries.set(key, { value, expiresAt: now + ttlMs });
    },
    delete(key) { entries.delete(key); },
  };
}
