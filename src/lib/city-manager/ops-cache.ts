const OPS_CACHE_TTL_MS = 12_000;
const opsGetCache = new Map<string, { at: number; payload: any }>();

export function readOpsCache(key: string) {
  const hit = opsGetCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > OPS_CACHE_TTL_MS) {
    opsGetCache.delete(key);
    return null;
  }
  return hit.payload;
}

export function writeOpsCache(key: string, payload: any) {
  opsGetCache.set(key, { at: Date.now(), payload });
}

export function invalidateOpsCache() {
  opsGetCache.clear();
}
