#!/usr/bin/env node

import { initCliEnv } from "../lib/init-cli-env.js";
import { strict as assert } from "node:assert";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FIXTURE = {
  instrument: {
    code: "600887",
    secucode: "600887.SH",
    name: "伊利股份",
    currency: "CNY",
    lotSize: 100,
    tickSize: 0.01,
  },
  quote: {
    code: "600887",
    newPrice: 28.5,
    changeRate: 1.2,
    volume: 123456,
    quoteTime: "2026-01-01T10:00:00.000Z",
  },
  klines: {
    code: "600887",
    klines: ["2026-01-01,28,28.5,29,27.5,123456"],
  },
  financial: {
    code: "600887",
    period: "2024",
    revenue: 126_000,
    netProfit: 9_500,
    operatingCashFlow: 13_000,
    totalAssets: 160_000,
    totalLiabilities: 90_000,
  },
  financialHistory: {
    code: "600887",
    reportType: "annual",
    years: 5,
    degradeReasons: ["parent_fields_unavailable"],
    items: [
      {
        code: "600887",
        period: "2024",
        reportDate: "2024-12-31",
        revenue: 126_000,
        netProfit: 9_500,
        operatingCashFlow: 13_000,
        totalAssets: 160_000,
        totalLiabilities: 90_000,
      },
      {
        code: "600887",
        period: "2023",
        reportDate: "2023-12-31",
        revenue: 120_000,
        netProfit: 9_000,
        operatingCashFlow: 12_000,
        totalAssets: 158_000,
        totalLiabilities: 88_000,
      },
    ],
  },
  financialSnapshot: {
    secuCode: "600887.SH",
    code: "600887",
    reportDate: "2024-12-31",
    snapshot: {
      code: "600887",
      period: "2024",
      reportDate: "2024-12-31",
      revenue: 126_000,
      netProfit: 9_500,
      operatingCashFlow: 13_000,
      totalAssets: 160_000,
      totalLiabilities: 90_000,
    },
    degradeReasons: ["parent_fields_unavailable"],
  },
  actions: [
    {
      code: "600887",
      actionType: "dividend",
      exDate: "2025-06-30",
      cashDividendPerShare: 1.8,
    },
  ],
  calendar: [
    {
      market: "CN_A",
      date: "2026-01-02",
      isTradingDay: true,
      sessionType: "full",
    },
  ],
} as const;

function jsonResponse(data: unknown): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function installHttpFetchMock(): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: URL | RequestInfo, _init?: RequestInit) => {
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl);
    const pathname = url.pathname;
    if (pathname.includes("/stock/detail/")) {
      return jsonResponse({ ...FIXTURE.instrument, ...FIXTURE.quote });
    }
    if (pathname.endsWith("/stock/kline")) return jsonResponse(FIXTURE.klines);
    if (pathname.endsWith("/stock/indicator/financial/600887")) return jsonResponse(FIXTURE.financial);
    if (pathname.includes("/stock/financial/snapshot/600887")) return jsonResponse(FIXTURE.financialSnapshot);
    if (pathname.includes("/stock/financial/history/600887")) return jsonResponse(FIXTURE.financialHistory);
    if (pathname.endsWith("/stock/corporate-actions")) return jsonResponse(FIXTURE.actions);
    if (pathname.endsWith("/market/trading-calendar")) return jsonResponse(FIXTURE.calendar);
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

async function main(): Promise<void> {
  initCliEnv();
  const root = path.resolve(process.cwd(), "../..");
  const httpProviderModulePath = path.join(
    root,
    "packages/provider-http/dist/index.js",
  );
  const { FeedHttpProvider } = (await import(pathToFileURL(httpProviderModulePath).href)) as {
    FeedHttpProvider: new (...args: any[]) => any;
  };

  const restore = installHttpFetchMock();
  try {
    const http = new FeedHttpProvider({ baseUrl: "http://fixture-feed.local", apiBasePath: "/api/v1" });
    const instrument = await http.getInstrument("600887");
    assert.equal(instrument.code, "600887");
    assert.equal(instrument.name, "伊利股份");

    const quote = await http.getQuote("600887");
    assert.equal(quote.code, "600887");
    assert.equal(quote.price, 28.5);

    const klines = await http.getKlines({ code: "600887", period: "day" });
    assert.ok(klines.length > 0, "klines should not be empty");

    const financial = await http.getFinancialSnapshot("600887", "2024");
    assert.equal(financial.code, "600887");
    assert.equal(financial.period, "2024");

    const finHist = await http.getFinancialHistory("600887", ["2024", "2023"]);
    assert.ok(finHist.length >= 2, "financial history should include multiple years");

    const actions = await http.getCorporateActions("600887", "2024-01-01", "2024-12-31");
    assert.ok(actions.length > 0, "corporate actions should not be empty");

    const calendar = await http.getTradingCalendar("CN_A", "2026-01-01", "2026-01-31");
    assert.ok(calendar.length > 0, "trading calendar should not be empty");
  } finally {
    restore();
  }

  console.log("[quality] conformance check passed (HTTP-only fixture)");
}

void main();
