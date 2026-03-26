interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function getCache<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, expiry: Date.now() + ttlMs });
}

export function clearCache(): void {
  store.clear();
}

export function deleteCache(key: string): boolean {
  return store.delete(key);
}

export function deleteCacheByPrefix(prefix: string): number {
  let count = 0;
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) { store.delete(k); count++; }
  }
  return count;
}
