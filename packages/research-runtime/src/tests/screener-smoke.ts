#!/usr/bin/env node
/**
 * 选股器契约烟测（内存 fixture，不依赖外部 feed）。
 * `pnpm run build && pnpm --filter @trade-signal/research-runtime run test:screener`
 */
import { initCliEnv } from "../lib/init-cli-env.js";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ScreenerDiskCache } from "../screener/cache.js";
import { getDefaultScreenerConfig, resolveScreenerConfig, validateScreenerConfig } from "../screener/config.js";
import { fetchScreenerUniverseFromHttp, parseScreenerUniversePayload } from "../screener/http-source.js";
import { tier1FilterCnA } from "../screener/cn-a.js";
import { exportScreenerResultsCsv } from "../screener/export-results.js";
import { buildUniverseCapability } from "../screener/capability.js";
import type { ScreenerRunOutput, ScreenerUniverseRow } from "../screener/types.js";
import { isAfterCnAClose, loadOrFetchUniverseSnapshot } from "../screener/universe-snapshot.js";
import { evaluateTurtlePolicy } from "../strategy/turtle/policy-evaluator.js";
import { bootstrapV2PluginRegistry } from "../bootstrap/v2-plugin-registry.js";
import { resolvePolicyPlugin } from "@trade-signal/research-policy";
import { resolveSelectionPlugin, TURTLE_CN_A_SELECTION_ID } from "@trade-signal/research-selection";
import type { FeatureSet } from "@trade-signal/research-contracts";

async function testDiskCache(): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "screener-cache-"));
  try {
    const c = new ScreenerDiskCache(dir);
    assert.equal(await c.get<{ a: number }>("k1", 3600), null);
    await c.put("k1", { a: 1 });
    const v = await c.get<{ a: number }>("k1", 3600);
    assert.deepEqual(v, { a: 1 });
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(await c.get<{ a: number }>("k1", 0), null);
    await c.put("tier2_X_income", { x: 1 });
    await c.put("stock_basic_all", { y: 2 });
    await c.invalidatePrefix("tier2_");
    assert.equal(await c.get("tier2_X_income", 3600), null);
    assert.deepEqual(await c.get<{ y: number }>("stock_basic_all", 3600), { y: 2 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function testConfig(): void {
  const cfg = getDefaultScreenerConfig("CN_A");
  assert.equal(cfg.minTurnoverPct, 0.1);
  assert.equal(cfg.obsChannelLimit, 50);
  assert.equal(cfg.tier2MainLimit, 150);
  assert.equal(cfg.minMarketCapYi, 5);
  assert.equal(cfg.roeAnnualizationFactor, 4);
  assert.deepEqual(validateScreenerConfig(cfg), []);

  const bad = resolveScreenerConfig("CN_A", {
    weightRoe: 0.5,
    weightFcfYield: 0.5,
    weightPenetrationR: 0.5,
    weightEvEbitda: 0,
    weightFloorPremium: 0,
  });
  assert.ok(validateScreenerConfig(bad).length > 0);

  const legacy = resolveScreenerConfig("CN_A", { minMarketCap: 500 });
  assert.equal(legacy.minMarketCapYi, 5);
}

function testTier1Filter(): void {
  const cfg = getDefaultScreenerConfig("CN_A");
  const rows: ScreenerUniverseRow[] = [
    {
      code: "000001.SZ",
      name: "平安银行",
      market: "CN_A",
      industry: "银行Ⅱ",
      listDate: "19910403",
      marketCap: 2000,
      turnover: 1,
      pb: 1,
      pe: 8,
      dv: 3,
    },
    {
      code: "000002.SZ",
      name: "测试科技",
      market: "CN_A",
      industry: "软件",
      listDate: "20180101",
      marketCap: 2000,
      turnover: 1,
      pb: 2,
      pe: 12,
      dv: 2,
    },
    {
      code: "000003.SZ",
      name: "亏损观察",
      market: "CN_A",
      industry: "软件",
      listDate: "20150101",
      marketCap: 9000,
      turnover: 1,
      pb: 3,
      dv: 0,
    },
    {
      code: "000004.SZ",
      name: "PE零排除",
      market: "CN_A",
      industry: "软件",
      listDate: "20150101",
      marketCap: 8000,
      turnover: 1,
      pb: 2,
      pe: 0,
      dv: 1,
    },
  ];

  const out = tier1FilterCnA(rows, cfg);
  const codes = new Set(out.map((r) => r.code));
  assert.ok(!codes.has("000001.SZ"), "银行应被剔除");
  assert.ok(codes.has("000002.SZ"), "主通道应保留");
  assert.ok(codes.has("000003.SZ"), "缺失 PE 应进观察通道");
  assert.ok(!codes.has("000004.SZ"), "PE=0 既非主通道也非观察（与 Python NaN-only 观察一致）");
}

function toFeatureSet(row: ScreenerUniverseRow): FeatureSet {
  return { runId: "test-run", code: row.code, features: { ...row }, sourceRefs: [] };
}

async function testTurtlePolicyAndSelectionUseV2Path(): Promise<void> {
  const base: ScreenerUniverseRow = {
    code: "BASE",
    name: "BASE",
    market: "CN_A",
    industry: "食品",
    listDate: "20100101",
    close: 10,
    marketCap: 500,
    turnover: 1,
    dv: 3,
    grossMargin: 30,
    debtRatio: 30,
    netProfit: 100,
    totalAssets: 1000,
    totalLiabilities: 300,
    payoutRatio: 40,
  };
  const rows = [
    { ...base, code: "GOOD", name: "好公司", pe: 8, pb: 1, roe: 4, ocf: 350, capex: -50 },
    { ...base, code: "WEAK", name: "弱公司", pe: 20, pb: 3, roe: 1, ocf: 180, capex: -40 },
    { ...base, code: "BANK", name: "银行样本", industry: "银行Ⅱ", pe: 5, pb: 0.5, roe: 5, dv: 6, ocf: 350, capex: -50 },
  ];
  bootstrapV2PluginRegistry();
  const policy = resolvePolicyPlugin("policy:turtle");
  const policyResults = await Promise.all(
    rows.map((row) => policy.evaluate({ policyId: "policy:turtle", runId: "test-run", code: row.code, featureSet: toFeatureSet(row) })),
  );
  assert.equal(policyResults.some((it) => (it.payload as { stub?: boolean }).stub), false);
  const goodPayload = policyResults.find((it) => it.code === "GOOD")?.payload as { metrics?: { penetrationR?: number }; passesUniverseGate?: boolean };
  assert.ok(typeof goodPayload.metrics?.penetrationR === "number");
  assert.equal(goodPayload.passesUniverseGate, true);
  const bankPayload = policyResults.find((it) => it.code === "BANK")?.payload as { filterReasons?: string[] };
  assert.ok(bankPayload.filterReasons?.includes("bank_industry_excluded"));

  const selection = await resolveSelectionPlugin(TURTLE_CN_A_SELECTION_ID).compose({
    selectionId: TURTLE_CN_A_SELECTION_ID,
    runId: "test-run",
    universe: "cn_a_universe",
    policyResults,
    maxCandidates: 10,
  });
  assert.ok(selection.candidates.length > 0);
  assert.equal(selection.candidates[0]?.code, "GOOD");
}

async function testUniverseCapabilityHkEmpty(): Promise<void> {
  const cap = buildUniverseCapability("HK", []);
  assert.equal(cap.status, "hk_not_ready");
  assert.ok(cap.reasonCodes.includes("hk_screener_universe_not_implemented"));
}

async function testUniverseCapabilityBlockedMissingMarketCap(): Promise<void> {
  const row: ScreenerUniverseRow = {
    code: "000001.SZ",
    name: "T",
    market: "CN_A",
    industry: "软件",
    listDate: "20180101",
    close: 10,
    pb: 2,
    dv: 2,
    turnover: 1,
  };
  const cap = buildUniverseCapability("CN_A", [row]);
  assert.equal(cap.status, "blocked_missing_required_fields");
}

async function testUniverseCapabilityDegradedTier2(): Promise<void> {
  const row: ScreenerUniverseRow = {
    code: "000002.SZ",
    name: "T",
    market: "CN_A",
    industry: "软件",
    listDate: "20180101",
    close: 10,
    pb: 2,
    dv: 2,
    marketCap: 2000,
    turnover: 1,
    pe: 12,
  };
  const cap = buildUniverseCapability("CN_A", [row]);
  assert.equal(cap.status, "degraded_tier2_fields");
}

function testParseScreenerUniversePayload(): void {
  const url = "http://example/stock/screener/universe";
  assert.throws(() => parseScreenerUniversePayload([], url), /根须为 JSON 对象/);
  assert.throws(() => parseScreenerUniversePayload({ success: true, data: [] }, url), /data 须为对象/);
  assert.throws(
    () => parseScreenerUniversePayload({ success: true, data: { total: 0, page: 1, pageSize: 10 } }, url),
    /缺少 data.items/,
  );
  assert.throws(
    () =>
      parseScreenerUniversePayload(
        { success: true, data: { items: [], page: 1, pageSize: 10 } },
        url,
      ),
    /data.total/,
  );
  const parsed = parseScreenerUniversePayload(
    {
      success: true,
      data: {
        market: "CN_A",
        total: 2,
        page: 1,
        pageSize: 500,
        items: [{ code: "1", name: "A" }],
        capability: "partial",
        degradeReasons: ["x"],
        pagination: { mode: "offset_page" },
      },
    },
    url,
  );
  assert.equal(parsed.total, 2);
  assert.equal(parsed.items.length, 1);
}

async function testFetchScreenerUniversePagesUntilTotal(): Promise<void> {
  const previousFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    urls.push(url);
    const page = Number(new URL(url).searchParams.get("page"));
    const body =
      page === 1
        ? { success: true, data: { total: 3, page: 1, pageSize: 2, items: [{ code: "A" }, { code: "B" }] } }
        : { success: true, data: { total: 3, page: 2, pageSize: 2, items: [{ code: "C" }] } };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  try {
    const rows = await fetchScreenerUniverseFromHttp(
      { baseUrl: "http://feed.example", pageSize: 2 },
      "CN_A",
    );
    assert.equal(rows.length, 3);
    assert.equal(urls.length, 2);
    assert.ok(urls[0]?.includes("page=1"));
    assert.ok(urls[1]?.includes("page=2"));
  } finally {
    globalThis.fetch = previousFetch;
  }
}

async function testFetchScreenerUniverseContinuesWhenTotalLooksLikePageCount(): Promise<void> {
  const previousFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    urls.push(url);
    const page = Number(new URL(url).searchParams.get("page"));
    const items = page <= 3 ? [{ code: `A${page}` }, { code: `B${page}` }] : [];
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          total: 2,
          page,
          pageSize: 2,
          items,
        },
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  try {
    const rows = await fetchScreenerUniverseFromHttp(
      { baseUrl: "http://feed.example", pageSize: 2 },
      "CN_A",
    );
    assert.equal(rows.length, 6);
    assert.equal(urls.length, 4);
  } finally {
    globalThis.fetch = previousFetch;
  }
}

async function testFetchScreenerUniverseDedupAndStagnation(): Promise<void> {
  const previousFetch = globalThis.fetch;
  const previousWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map((a) => String(a)).join(" "));
  };
  let pageCount = 0;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    const page = Number(new URL(url).searchParams.get("page"));
    pageCount = Math.max(pageCount, page);
    const body =
      page === 1
        ? { success: true, data: { total: 9999, page: 1, pageSize: 2, items: [{ code: "A" }, { code: "B" }] } }
        : { success: true, data: { total: 9999, page, pageSize: 2, items: [{ code: "A" }, { code: "B" }] } };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  try {
    const rows = await fetchScreenerUniverseFromHttp(
      { baseUrl: "http://feed.example", pageSize: 2 },
      "CN_A",
    );
    assert.equal(rows.length, 2, "重复条目应被去重");
    assert.equal(pageCount, 2, "停滞退出后不应继续翻页");
    assert.ok(
      warnings.some((w) => w.includes("翻页去重")),
      "应输出去重告警",
    );
    assert.ok(
      warnings.some((w) => w.includes("翻页停滞")),
      "应输出停滞告警",
    );
    assert.ok(
      warnings.some((w) => w.includes("累计与 total 不一致")),
      "应输出 total 不一致告警",
    );
  } finally {
    globalThis.fetch = previousFetch;
    console.warn = previousWarn;
  }
}

async function testUniverseSnapshotReusesAfterClose(): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "screener-universe-"));
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          total: 1,
          page: 1,
          pageSize: 500,
          items: [{ code: "000001", name: "测试", market: "CN_A", marketCap: 1000, turnover: 1 }],
        },
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  try {
    assert.equal(isAfterCnAClose(new Date("2026-05-04T06:59:00.000Z")), false);
    assert.equal(isAfterCnAClose(new Date("2026-05-04T07:00:00.000Z")), true);
    const first = await loadOrFetchUniverseSnapshot({
      market: "CN_A",
      outputRoot: dir,
      feedBaseUrl: "http://feed.example",
      now: new Date("2026-05-04T07:01:00.000Z"),
    });
    const second = await loadOrFetchUniverseSnapshot({
      market: "CN_A",
      outputRoot: dir,
      feedBaseUrl: "http://feed.example",
      now: new Date("2026-05-04T07:02:00.000Z"),
    });
    assert.equal(calls, 1);
    assert.equal(first.meta.reused, false);
    assert.equal(second.meta.reused, true);
    assert.equal(second.rows.length, 1);
  } finally {
    globalThis.fetch = previousFetch;
    await rm(dir, { recursive: true, force: true });
  }
}

async function testTier1OnlyPipeline(): Promise<void> {
  const out: ScreenerRunOutput = {
    strategyId: "turtle",
    strategyLabel: "龟龟策略",
    market: "CN_A",
    mode: "standalone",
    generatedAt: "2026-05-09T00:00:00.000Z",
    totalUniverse: 1,
    tier1Count: 1,
    passedCount: 1,
    tier1Only: true,
    results: [{
      code: "000002.SZ",
      name: "测试科技",
      market: "CN_A",
      industry: "软件",
      channel: "main",
      tier1Score: 0.5,
      passed: true,
      qualityPassed: true,
      screenerScore: 0.5,
      totalScore: 0.5,
      decision: "watch",
      confidence: "medium",
      factors: {},
    }],
  };
  const csv = exportScreenerResultsCsv(out);
  assert.ok(csv.includes("ts_code"));
}

async function main(): Promise<void> {
  initCliEnv();
  testConfig();
  testTier1Filter();
  await testTurtlePolicyAndSelectionUseV2Path();
  testParseScreenerUniversePayload();
  await testFetchScreenerUniversePagesUntilTotal();
  await testFetchScreenerUniverseContinuesWhenTotalLooksLikePageCount();
  await testFetchScreenerUniverseDedupAndStagnation();
  await testUniverseSnapshotReusesAfterClose();
  await testUniverseCapabilityHkEmpty();
  await testUniverseCapabilityBlockedMissingMarketCap();
  await testUniverseCapabilityDegradedTier2();
  await testDiskCache();
  await testTier1OnlyPipeline();
  console.log("[test:screener] ok");
}

void main();
