import type {
  CorporateAction,
  FinancialSnapshot,
  Instrument,
  KlineBar,
  Market,
  MarketDataProvider,
  Quote,
  TradingCalendar,
} from "@trade-signal/schema-core";

export type McpToolCaller = (toolName: string, args: Record<string, unknown>) => Promise<unknown>;

export interface McpProviderOptions {
  serverName: string;
  transport?: "stdio" | "http";
  callTool: McpToolCaller;
}

type StockInfoPayload = {
  detail?: StockInfoDetail;
  code?: string;
  secucode?: string;
  name?: string;
};

type StockInfoDetail = {
  code?: string;
  secucode?: string;
  name?: string;
  currency?: string;
  lotSize?: number;
  lot_size?: number;
  tickSize?: number;
  tick_size?: number;
};

type StockQuotePayload = {
  code?: string;
  secucode?: string;
  newPrice?: number;
  price?: number;
  latestPrice?: number;
  changeRate?: number;
  changePct?: number;
  volume?: number;
  amount?: number;
  quoteTime?: string;
  updateTime?: string;
  timestamp?: string;
};

type StockKlinePayload = {
  code?: string;
  secucode?: string;
  klines?: Array<string | { date?: string; time?: string; open?: number; high?: number; low?: number; close?: number; volume?: number }>;
  data?: Array<string | { date?: string; time?: string; open?: number; high?: number; low?: number; close?: number; volume?: number }>;
};

type StockFinancialPayload = {
  financial?: {
    code?: string;
    secucode?: string;
    reportDate?: string;
    period?: string;
    revenue?: number;
    operatingRevenue?: number;
    totalRevenue?: number;
    netProfit?: number;
    parentNetProfit?: number;
    operatingCashFlow?: number;
    netCashflowOper?: number;
    totalAssets?: number;
    totalLiabilities?: number;
  };
};

const SUPPORTED_PERIODS = new Set<KlineBar["period"]>(["day", "week", "month"]);
const ADJ_TO_FQT: Record<"none" | "forward" | "backward", "none" | "pre" | "after"> = {
  none: "none",
  forward: "pre",
  backward: "after",
};

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const pickTimestamp = (...values: Array<unknown>): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") return value;
    if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  }
  return new Date().toISOString();
};

const inferMarket = (input: string): Market => {
  const code = input.trim().toUpperCase();
  if (code.endsWith(".HK") || /^\d{5}$/.test(code)) return "HK";
  return "CN_A";
};

const parseKline = (
  item:
    | string
    | { date?: string; time?: string; open?: number; high?: number; low?: number; close?: number; volume?: number },
) => {
  if (typeof item === "string") {
    const parts = item.split(",");
    return {
      ts: parts[0]?.trim(),
      open: asNumber(parts[1]),
      close: asNumber(parts[2]),
      high: asNumber(parts[3]),
      low: asNumber(parts[4]),
      volume: asNumber(parts[5]),
    };
  }
  return {
    ts: typeof item.date === "string" ? item.date : item.time,
    open: asNumber(item.open),
    close: asNumber(item.close),
    high: asNumber(item.high),
    low: asNumber(item.low),
    volume: asNumber(item.volume),
  };
};

export class FeedMcpProvider implements MarketDataProvider {
  constructor(private readonly options: McpProviderOptions) {}

  private async callTool<T>(toolName: string, args: Record<string, unknown>): Promise<T> {
    return (await this.options.callTool(toolName, args)) as T;
  }

  async getInstrument(code: string): Promise<Instrument> {
    const payload = await this.callTool<StockInfoPayload>("get_stock_info", {
      code,
      include: "detail",
    });
    const detail: StockInfoDetail = payload.detail ?? {
      code: payload.code,
      secucode: payload.secucode,
      name: payload.name,
    };
    return {
      code: detail.code ?? detail.secucode ?? code,
      market: inferMarket(detail.code ?? detail.secucode ?? code),
      name: detail.name ?? code,
      currency: detail.currency,
      lotSize: asNumber(detail.lotSize ?? detail.lot_size),
      tickSize: asNumber(detail.tickSize ?? detail.tick_size),
    };
  }

  async getQuote(code: string): Promise<Quote> {
    const payload = await this.callTool<StockQuotePayload>("get_stock_quote", { code });
    return {
      code: payload.code ?? payload.secucode ?? code,
      price: asNumber(payload.newPrice ?? payload.price ?? payload.latestPrice) ?? 0,
      changePct: asNumber(payload.changeRate ?? payload.changePct),
      volume: asNumber(payload.volume ?? payload.amount),
      timestamp: pickTimestamp(payload.quoteTime, payload.updateTime, payload.timestamp),
    };
  }

  async getKlines(input: {
    code: string;
    period: "1m" | "5m" | "15m" | "30m" | "60m" | "day" | "week" | "month";
    from?: string;
    to?: string;
    adj?: "none" | "forward" | "backward";
  }): Promise<KlineBar[]> {
    if (!SUPPORTED_PERIODS.has(input.period)) {
      throw new Error(`Feed MCP tool get_stock_kline does not support period=${input.period}.`);
    }
    const payload = await this.callTool<StockKlinePayload>("get_stock_kline", {
      code: input.code,
      period: input.period,
      fqt: ADJ_TO_FQT[input.adj ?? "forward"],
    });
    const records = payload.klines ?? payload.data ?? [];
    return records
      .map(parseKline)
      .filter((kline) => kline.ts && kline.open !== undefined && kline.close !== undefined)
      .map((kline) => ({
        code: payload.code ?? payload.secucode ?? input.code,
        period: input.period,
        ts: kline.ts as string,
        open: kline.open as number,
        high: kline.high ?? (kline.open as number),
        low: kline.low ?? (kline.close as number),
        close: kline.close as number,
        volume: kline.volume,
      }));
  }

  async getFinancialSnapshot(code: string, period: string): Promise<FinancialSnapshot> {
    const payload = await this.callTool<StockFinancialPayload>("get_stock_financial", { code });
    const financial = payload.financial ?? {};
    return {
      code: financial.code ?? financial.secucode ?? code,
      period: financial.period ?? financial.reportDate ?? period,
      revenue: asNumber(financial.revenue ?? financial.operatingRevenue ?? financial.totalRevenue),
      netProfit: asNumber(financial.netProfit ?? financial.parentNetProfit),
      operatingCashFlow: asNumber(financial.operatingCashFlow ?? financial.netCashflowOper),
      totalAssets: asNumber(financial.totalAssets),
      totalLiabilities: asNumber(financial.totalLiabilities),
    };
  }

  async getCorporateActions(
    _code: string,
    _from?: string,
    _to?: string,
  ): Promise<CorporateAction[]> {
    throw new Error("Feed MCP corporate actions tool not found. Please add get_stock_corporate_actions.");
  }

  async getTradingCalendar(
    _market: Market,
    _from: string,
    _to: string,
  ): Promise<TradingCalendar[]> {
    throw new Error("Feed MCP trading calendar tool not found. Please add get_trading_calendar.");
  }

  getConfig(): McpProviderOptions {
    return this.options;
  }
}
