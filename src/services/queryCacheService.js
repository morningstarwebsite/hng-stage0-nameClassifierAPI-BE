const DEFAULT_TTL_MS = Number(process.env.QUERY_CACHE_TTL_MS || 30_000);
const DEFAULT_MAX_ENTRIES = Number(process.env.QUERY_CACHE_MAX_ENTRIES || 500);

const caches = new Map();

function getCache(namespace) {
  if (!caches.has(namespace)) {
    caches.set(namespace, new Map());
  }

  return caches.get(namespace);
}

function nowMs() {
  return Date.now();
}

function clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function enforceSizeLimit(cache) {
  while (cache.size > DEFAULT_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

export function getCachedValue(namespace, key) {
  const cache = getCache(namespace);
  const record = cache.get(key);

  if (!record) {
    return null;
  }

  if (record.expiresAt <= nowMs()) {
    cache.delete(key);
    return null;
  }

  // Move to the end to keep eviction close to LRU behavior.
  cache.delete(key);
  cache.set(key, record);

  return clone(record.value);
}

export function setCachedValue(namespace, key, value, ttlMs = DEFAULT_TTL_MS) {
  const cache = getCache(namespace);
  cache.set(key, {
    value: clone(value),
    expiresAt: nowMs() + ttlMs,
  });

  enforceSizeLimit(cache);
}

export async function getOrSetCachedValue(namespace, key, load, ttlMs = DEFAULT_TTL_MS) {
  const cached = getCachedValue(namespace, key);

  if (cached !== null) {
    return cached;
  }

  const loadedValue = await load();
  setCachedValue(namespace, key, loadedValue, ttlMs);
  return clone(loadedValue);
}

export function clearCacheNamespace(namespace) {
  caches.delete(namespace);
}
