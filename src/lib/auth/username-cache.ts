import type { UsernameLookupResult } from './lookup-user-by-username';

class PromiseCache<T> {
  private cache = new Map<string, { promise: Promise<T>; expiresAt: number }>();
  private ttl: number;

  constructor(ttlSeconds: number) {
    this.ttl = ttlSeconds * 1000;
  }

  async getOrFetch(key: string, fetchFn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const entry = this.cache.get(key);

    if (entry && now < entry.expiresAt) {
      return entry.promise;
    }

    // Coalesce concurrent lookups by caching the promise
    const promise = fetchFn().catch((err) => {
      this.cache.delete(key);
      throw err;
    });

    this.cache.set(key, {
      promise,
      expiresAt: now + this.ttl,
    });

    return promise;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global server-side cache instance with 30s TTL
export const usernameLookupCache = new PromiseCache<UsernameLookupResult>(30);
