import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

type CacheEntry<T> = { value: T; expiresAt: number };

export class ScreenerMemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  clear(): void {
    this.store.clear();
  }
}

function safeKeySegment(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 200);
}

/** 磁盘 JSON 缓存：语义对齐 Python `ScreenerCache`（Parquet→JSON）。 */
export class ScreenerDiskCache {
  constructor(private readonly rootDir: string) {}

  private dataPath(key: string): string {
    return path.join(this.rootDir, `${safeKeySegment(key)}.json`);
  }

  private metaPath(key: string): string {
    return path.join(this.rootDir, `${safeKeySegment(key)}.meta.json`);
  }

  async get<T>(key: string, ttlSeconds: number): Promise<T | null> {
    const dp = this.dataPath(key);
    const mp = this.metaPath(key);
    try {
      const [st, rawMeta] = await Promise.all([stat(dp), readFile(mp, "utf-8")]);
      const meta = JSON.parse(rawMeta) as { savedAtMs?: number };
      const savedAt = meta.savedAtMs ?? st.mtimeMs;
      if (Date.now() - savedAt > ttlSeconds * 1000) return null;
      const raw = await readFile(dp, "utf-8");
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async put<T>(key: string, value: T): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
    const dp = this.dataPath(key);
    const mp = this.metaPath(key);
    await writeFile(dp, JSON.stringify(value), "utf-8");
    await writeFile(mp, JSON.stringify({ savedAtMs: Date.now() }), "utf-8");
  }

  async clear(): Promise<void> {
    try {
      await rm(this.rootDir, { recursive: true, force: true });
    } catch {
      /* empty */
    }
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    let names: string[] = [];
    try {
      names = await readdir(this.rootDir);
    } catch {
      return;
    }
    const p = safeKeySegment(prefix);
    for (const name of names) {
      if (name.startsWith(p)) {
        try {
          await rm(path.join(this.rootDir, name), { force: true });
        } catch {
          /* empty */
        }
      }
    }
  }
}

/** 与 Python `_TIER2_TTL_CATEGORY` 对应的秒数选择器。 */
export function tier2TtlSeconds(
  category: "financial" | "market" | "global",
  cfg: {
    cacheTier2FinancialTtlHours: number;
    cacheTier2MarketTtlHours: number;
    cacheTier2GlobalTtlHours: number;
  },
): number {
  if (category === "financial") return cfg.cacheTier2FinancialTtlHours * 3600;
  if (category === "market") return cfg.cacheTier2MarketTtlHours * 3600;
  return cfg.cacheTier2GlobalTtlHours * 3600;
}
