import { fetchScreenerUniverseFromHttp } from "@trade-signal/research-strategies";

export interface WebUniverseRow {
  code: string;
  name: string;
  market: "CN_A" | "HK";
  industry?: string;
  listDate?: string;
  close?: number;
  pe?: number;
  pb?: number;
  dv?: number;
  marketCap?: number;
  turnover?: number;
  debtRatio?: number;
  grossMargin?: number;
  roe?: number;
  fcfYield?: number;
  netProfit?: number;
  ocf?: number;
  capex?: number;
  totalAssets?: number;
  totalLiabilities?: number;
}

export interface UniverseResolveResult {
  rows: WebUniverseRow[];
  source: "feed_http" | "mock_fallback";
  endpoint?: string;
}

const MOCK_UNIVERSE: WebUniverseRow[] = [
  {
    code: "600887",
    name: "伊利股份",
    market: "CN_A",
    industry: "食品饮料",
    listDate: "20010426",
    close: 28.5,
    pe: 18,
    pb: 3.1,
    dv: 4.2,
    marketCap: 180000,
    turnover: 1.1,
    debtRatio: 52,
    grossMargin: 33,
    roe: 16.2,
    fcfYield: 4.8,
    netProfit: 11800,
    ocf: 15400,
    capex: 4200,
    totalAssets: 168000,
    totalLiabilities: 93000,
  },
  {
    code: "000001",
    name: "平安银行",
    market: "CN_A",
    industry: "银行",
    listDate: "19910403",
    close: 11.2,
    pe: 5.2,
    pb: 0.6,
    dv: 5.1,
    marketCap: 210000,
    turnover: 0.8,
    debtRatio: 91,
    grossMargin: 0,
    roe: 11.5,
    fcfYield: 2.1,
    netProfit: 43000,
    ocf: 50000,
    capex: 6000,
    totalAssets: 5500000,
    totalLiabilities: 5000000,
  },
  {
    code: "00700.HK",
    name: "腾讯控股",
    market: "HK",
    industry: "互联网",
    listDate: "20040616",
    close: 380.2,
    pe: 22,
    pb: 3.8,
    dv: 1.0,
    marketCap: 3600000,
    turnover: 120,
    debtRatio: 45,
    grossMargin: 49,
    roe: 22,
    fcfYield: 3.2,
    netProfit: 190000,
    ocf: 270000,
    capex: 38000,
    totalAssets: 1700000,
    totalLiabilities: 760000,
  },
];

export function getMockUniverse(market: "CN_A" | "HK"): WebUniverseRow[] {
  return MOCK_UNIVERSE.filter((x) => x.market === market);
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function asRow(raw: Record<string, unknown>, market: "CN_A" | "HK"): WebUniverseRow | undefined {
  const code =
    (typeof raw.code === "string" && raw.code) ||
    (typeof raw.tsCode === "string" && raw.tsCode) ||
    (typeof raw.secuCode === "string" && raw.secuCode) ||
    (typeof raw.secucode === "string" && raw.secucode) ||
    "";
  const name =
    (typeof raw.name === "string" && raw.name) ||
    (typeof raw.stockName === "string" && raw.stockName) ||
    "";
  if (!code || !name) return undefined;
  return {
    code,
    name,
    market,
    industry: typeof raw.industry === "string" ? raw.industry : undefined,
    listDate: typeof raw.listDate === "string" ? raw.listDate : undefined,
    close: num(raw.close),
    pe: num(raw.pe),
    pb: num(raw.pb),
    dv: num(raw.dv),
    marketCap: num(raw.marketCap),
    turnover: num(raw.turnover),
    debtRatio: num(raw.debtRatio),
    grossMargin: num(raw.grossMargin),
    roe: num(raw.roe),
    fcfYield: num(raw.fcfYield),
    netProfit: num(raw.netProfit),
    ocf: num(raw.ocf),
    capex: num(raw.capex),
    totalAssets: num(raw.totalAssets),
    totalLiabilities: num(raw.totalLiabilities),
  };
}

export async function getUniverseFromFeedOrMock(
  market: "CN_A" | "HK",
  env?: { FEED_BASE_URL?: string; FEED_API_KEY?: string },
): Promise<UniverseResolveResult> {
  const resolvedEnv = env ?? (process.env as { FEED_BASE_URL?: string; FEED_API_KEY?: string });
  const baseUrl = resolvedEnv.FEED_BASE_URL;
  if (!baseUrl) {
    return { rows: getMockUniverse(market), source: "mock_fallback" };
  }
  const base = baseUrl.replace(/\/+$/, "");
  const endpoint = `${base}/api/v1/stock/screener/universe`;
  try {
    const rawItems = await fetchScreenerUniverseFromHttp(
      {
        baseUrl,
        apiKey: resolvedEnv.FEED_API_KEY,
        mode: "all_pages",
      },
      market,
    );
    const rows = rawItems
      .map((x) =>
        x && typeof x === "object" ? asRow(x as Record<string, unknown>, market) : undefined,
      )
      .filter((x): x is WebUniverseRow => Boolean(x));
    return { rows, source: "feed_http", endpoint };
  } catch (e) {
    console.warn("[screener-web] feed universe 契约或网络失败，回退 mock:", e);
    return { rows: getMockUniverse(market), source: "mock_fallback" };
  }
}
