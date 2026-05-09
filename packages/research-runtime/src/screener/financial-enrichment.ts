import type { ScreenerUniverseRow } from "./types.js";

export type FinancialEnrichmentOptions = {
  baseUrl: string;
  apiBasePath?: string;
  apiKey?: string;
  years?: number;
  concurrency?: number;
};

type FinancialHistoryItem = {
  operatingCashFlow?: unknown;
  capitalExpenditure?: unknown;
  revenue?: unknown;
  ebitda?: unknown;
};

type FinancialHistoryPayload = {
  items?: FinancialHistoryItem[];
};

function finite(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function latestFinancials(payload: FinancialHistoryPayload): {
  ocf?: number;
  capex?: number;
  revenue?: number;
  ebitda?: number;
  fcfPositiveYears?: number;
} {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const latest = items[0];
  const positiveYears = items.filter((item) => {
    const ocf = finite(item.operatingCashFlow);
    const capex = finite(item.capitalExpenditure);
    return ocf !== undefined && capex !== undefined && ocf - Math.abs(capex) > 0;
  }).length;
  return {
    ocf: finite(latest?.operatingCashFlow),
    capex: finite(latest?.capitalExpenditure),
    revenue: finite(latest?.revenue),
    ebitda: finite(latest?.ebitda),
    fcfPositiveYears: items.length > 0 ? positiveYears : undefined,
  };
}

async function fetchFinancialHistory(
  code: string,
  options: Required<Pick<FinancialEnrichmentOptions, "baseUrl" | "apiBasePath" | "years">> & Pick<FinancialEnrichmentOptions, "apiKey">,
): Promise<FinancialHistoryPayload | null> {
  const base = options.baseUrl.replace(/\/+$/, "");
  const apiBasePath = options.apiBasePath.replace(/\/+$/, "");
  const params = new URLSearchParams({ reportType: "annual", years: String(options.years) });
  const url = `${base}${apiBasePath}/stock/financial/history/${encodeURIComponent(code)}?${params.toString()}`;
  const headers: Record<string, string> = {};
  if (options.apiKey) headers["x-api-key"] = options.apiKey;
  const resp = await fetch(url, { headers });
  if (!resp.ok) return null;
  const payload = (await resp.json()) as unknown;
  if (payload && typeof payload === "object" && !Array.isArray(payload) && "data" in payload) {
    return (payload as { data?: FinancialHistoryPayload }).data ?? null;
  }
  return payload as FinancialHistoryPayload;
}

export async function enrichUniverseFinancials(
  universe: ScreenerUniverseRow[],
  candidateCodes: string[],
  options: FinancialEnrichmentOptions,
): Promise<{ universe: ScreenerUniverseRow[]; enrichedCount: number; failedCount: number }> {
  if (!options.baseUrl.trim() || candidateCodes.length === 0) {
    return { universe, enrichedCount: 0, failedCount: 0 };
  }

  const apiBasePath = options.apiBasePath ?? "/api/v1";
  const years = Math.max(1, Math.min(10, Math.floor(options.years ?? 5)));
  const concurrency = Math.max(1, Math.min(12, Math.floor(options.concurrency ?? 4)));
  const rowsByCode = new Map(universe.map((row) => [row.code, row]));
  const uniqueCodes = [...new Set(candidateCodes)].filter((code) => rowsByCode.has(code));
  let cursor = 0;
  let enrichedCount = 0;
  let failedCount = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const idx = cursor;
      cursor += 1;
      const code = uniqueCodes[idx];
      if (!code) return;
      try {
        const payload = await fetchFinancialHistory(code, {
          baseUrl: options.baseUrl,
          apiBasePath,
          apiKey: options.apiKey,
          years,
        });
        if (!payload) {
          failedCount += 1;
          continue;
        }
        const f = latestFinancials(payload);
        const row = rowsByCode.get(code);
        if (!row || f.ocf === undefined || f.capex === undefined) {
          failedCount += 1;
          continue;
        }
        row.ocf = f.ocf;
        row.capex = f.capex;
        if (f.revenue !== undefined) row.revenue = f.revenue;
        if (f.ebitda !== undefined) row.ebitda = f.ebitda;
        if (f.fcfPositiveYears !== undefined) row.fcfPositiveYears = f.fcfPositiveYears;
        if (row.marketCap && row.marketCap > 0) {
          row.fcfYield = ((f.ocf - Math.abs(f.capex)) / row.marketCap) * 100;
        }
        enrichedCount += 1;
      } catch {
        failedCount += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, uniqueCodes.length) }, () => worker()));
  return { universe, enrichedCount, failedCount };
}
