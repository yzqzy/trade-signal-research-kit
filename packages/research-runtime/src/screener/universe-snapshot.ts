import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveOutputPath } from "../crosscut/normalization/resolve-monorepo-path.js";
import { fetchScreenerUniverseFromHttpWithDiagnostics } from "./http-source.js";
import type { ScreenerMarket, ScreenerUniverseRow } from "./types.js";

export type UniverseSnapshotMeta = {
  version: "1.0";
  market: ScreenerMarket;
  date: string;
  generatedAt: string;
  source: "feed:screener-universe";
  count: number;
  reused: boolean;
  fetchDiagnostics?: {
    requestedPages: number;
    expectedTotal?: number;
    receivedCount: number;
    shortfall?: number;
    endedBy: string;
  };
};

export type UniverseSnapshotResult = {
  rows: ScreenerUniverseRow[];
  dataPath: string;
  metaPath: string;
  meta: UniverseSnapshotMeta;
};

export type UniverseSnapshotOptions = {
  market: ScreenerMarket;
  outputRoot: string;
  feedBaseUrl?: string;
  feedApiBasePath?: string;
  feedApiKey?: string;
  pageSize?: number;
  refresh?: boolean;
  now?: Date;
};

function shanghaiParts(now: Date): { date: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

export function isAfterCnAClose(now = new Date()): boolean {
  const p = shanghaiParts(now);
  return p.hour > 15 || (p.hour === 15 && p.minute >= 0);
}

export function currentShanghaiDateKey(now = new Date()): string {
  return shanghaiParts(now).date;
}

export function resolveUniverseSnapshotPaths(input: {
  outputRoot: string;
  market: ScreenerMarket;
  date?: string;
}): { dir: string; dataPath: string; metaPath: string; date: string } {
  const date = input.date ?? currentShanghaiDateKey();
  const root = resolveOutputPath(input.outputRoot.trim() || "output");
  const dir = path.join(root, "screener", "universe", input.market, date);
  return {
    dir,
    date,
    dataPath: path.join(dir, "universe.json"),
    metaPath: path.join(dir, "universe_manifest.json"),
  };
}

async function readSnapshot(input: {
  dataPath: string;
  metaPath: string;
}): Promise<{ rows: ScreenerUniverseRow[]; meta: UniverseSnapshotMeta } | null> {
  try {
    const [rawRows, rawMeta] = await Promise.all([
      readFile(input.dataPath, "utf-8"),
      readFile(input.metaPath, "utf-8"),
    ]);
    return {
      rows: JSON.parse(rawRows) as ScreenerUniverseRow[],
      meta: JSON.parse(rawMeta) as UniverseSnapshotMeta,
    };
  } catch {
    return null;
  }
}

export async function loadOrFetchUniverseSnapshot(
  options: UniverseSnapshotOptions,
): Promise<UniverseSnapshotResult> {
  const now = options.now ?? new Date();
  const paths = resolveUniverseSnapshotPaths({
    outputRoot: options.outputRoot,
    market: options.market,
    date: currentShanghaiDateKey(now),
  });
  const canReuseToday = isAfterCnAClose(now) && !options.refresh;
  if (canReuseToday) {
    const cached = await readSnapshot(paths);
    if (cached) {
      return {
        rows: cached.rows,
        dataPath: paths.dataPath,
        metaPath: paths.metaPath,
        meta: { ...cached.meta, reused: true },
      };
    }
  }

  const fetched = await fetchScreenerUniverseFromHttpWithDiagnostics(
    {
      baseUrl: options.feedBaseUrl ?? process.env.FEED_BASE_URL ?? "",
      apiKey: options.feedApiKey ?? process.env.FEED_API_KEY,
      apiBasePath: options.feedApiBasePath,
      pageSize: options.pageSize ?? 500,
      mode: "all_pages",
    },
    options.market,
  );
  const rows = fetched.items as ScreenerUniverseRow[];
  const meta: UniverseSnapshotMeta = {
    version: "1.0",
    market: options.market,
    date: paths.date,
    generatedAt: now.toISOString(),
    source: "feed:screener-universe",
    count: rows.length,
    reused: false,
    fetchDiagnostics: fetched.diagnostics,
  };
  await mkdir(paths.dir, { recursive: true });
  await writeFile(paths.dataPath, JSON.stringify(rows, null, 2), "utf-8");
  await writeFile(paths.metaPath, JSON.stringify(meta, null, 2), "utf-8");
  return {
    rows,
    dataPath: paths.dataPath,
    metaPath: paths.metaPath,
    meta,
  };
}
