#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { emitSiteReportsFromRun, rebuildSiteRankingsIndex } from "../reports-site/emit-site-reports.js";

async function assertScreenerRunPublishesRankings(): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), "rankings-site-"));
  try {
    const runDir = path.join(root, "run");
    const siteDir = path.join(root, "site");
    await mkdir(runDir, { recursive: true });
    await writeFile(
      path.join(runDir, "screener_results.json"),
      JSON.stringify(
        {
          strategyId: "turtle",
          strategyLabel: "龟龟策略",
          market: "CN_A",
          mode: "standalone",
          generatedAt: "2026-05-03T08:00:00.000Z",
          totalUniverse: 2,
          tier1Count: 2,
          passedCount: 1,
          capability: {
            status: "degraded_tier2_fields",
            reasonCodes: ["missing_floor_premium"],
            messages: ["tier2 部分字段缺失"],
            fieldTiers: {
              requiredForRun: { keys: [], missingCountByField: {}, allRowsMissingByField: {} },
              requiredForTier2Main: { keys: [], missingCountByField: {}, allRowsMissingByField: {} },
              optionalEnhancement: { keys: [], missingCountByField: {} },
            },
          },
          results: [
            {
              code: "600887",
              name: "伊利股份",
              market: "CN_A",
              industry: "食品饮料",
              channel: "main",
              tier1Score: 0.8,
              passed: true,
              qualityPassed: true,
              screenerScore: 0.81,
              totalScore: 0.83,
              decision: "buy",
              confidence: "high",
              factors: {
                penetrationR: 12.34,
                evEbitda: 8.91,
                floorPremium: 2.22,
              },
              roe: 18.5,
              fcfYield: 6.8,
            },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );
    await writeFile(
      path.join(runDir, "selection_manifest.json"),
      JSON.stringify(
        {
          manifestVersion: "1.0",
          schema: "selection-result-v2",
          runProfile: "selection_fast",
          strategyId: "turtle",
          strategyLabel: "龟龟策略",
          selectionId: "selection:turtle:cn_a_universe",
          runId: "run-turtle-1",
          universe: "cn_a_standalone",
          generatedAt: "2026-05-03T08:00:00.000Z",
          candidates: [{ code: "600887", score: 0.83, decision: "buy" }],
          policyResults: [
            {
              policyId: "policy:turtle",
              code: "600887",
              payload: {
                name: "伊利股份",
                industry: "食品饮料",
                score: 0.83,
                decision: "buy",
                confidence: "high",
                metrics: {
                  penetrationR: 12.34,
                  evEbitda: 8.91,
                  floorPremium: 2.22,
                  roe: 18.5,
                  fcfYield: 6.8,
                },
              },
            },
          ],
          drillDownTopicIds: ["topic:turtle-strategy-explainer"],
        },
        null,
        2,
      ),
      "utf-8",
    );

    await emitSiteReportsFromRun({ runDir, siteDir });

    const index = JSON.parse(await readFile(path.join(siteDir, "rankings", "index.json"), "utf-8")) as {
      strategyCount: number;
      listCount: number;
      defaultStrategyId: string;
      lists: Array<{
        strategyId: string;
        strategyLabel: string;
        capabilityStatus: string;
        topN?: number;
        totalCandidates?: number;
        items: Array<{ code: string; href?: string; metrics: Record<string, unknown> }>;
      }>;
    };
    assert.equal(index.strategyCount, 1);
    assert.equal(index.listCount, 1);
    assert.equal(index.defaultStrategyId, "turtle");
    assert.equal(index.lists[0]?.strategyId, "turtle");
    assert.equal(index.lists[0]?.strategyLabel, "龟龟策略");
    assert.equal(index.lists[0]?.capabilityStatus, "degraded_tier2_fields");
    assert.equal(index.lists[0]?.items[0]?.code, "600887");
    assert.match(index.lists[0]?.items[0]?.href ?? "", /\/reports\?code=600887&topic=turtle-strategy/);
    assert.equal(index.lists[0]?.items[0]?.metrics?.penetrationR, 12.34);
    assert.equal(index.lists[0]?.topN, 200, "manifest 缺省时应回落 200");
    assert.equal(index.lists[0]?.totalCandidates, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function assertRankingsTruncatedToManifestTopN(): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), "rankings-topn-"));
  try {
    const runDir = path.join(root, "run");
    const siteDir = path.join(root, "site");
    await mkdir(runDir, { recursive: true });
    const candidates = Array.from({ length: 10 }, (_, idx) => ({
      code: `60${String(idx).padStart(4, "0")}`,
      name: `测试${idx}`,
      market: "CN_A",
      industry: "其他",
      channel: "main",
      tier1Score: 0.5,
      passed: true,
      qualityPassed: true,
      screenerScore: 0.6,
      totalScore: 0.9 - idx * 0.05,
      decision: "buy",
      confidence: "medium",
      factors: { penetrationR: 1, evEbitda: 1, floorPremium: 1 },
      roe: 10,
      fcfYield: 1,
    }));
    await writeFile(
      path.join(runDir, "screener_results.json"),
      JSON.stringify(
        {
          strategyId: "turtle",
          strategyLabel: "龟龟策略",
          market: "CN_A",
          mode: "standalone",
          generatedAt: "2026-05-03T08:00:00.000Z",
          totalUniverse: 10,
          tier1Count: 10,
          passedCount: 10,
          results: candidates,
        },
        null,
        2,
      ),
      "utf-8",
    );
    await writeFile(
      path.join(runDir, "selection_manifest.json"),
      JSON.stringify(
        {
          manifestVersion: "1.0",
          schema: "selection-result-v2",
          runProfile: "selection_fast",
          strategyId: "turtle",
          strategyLabel: "龟龟策略",
          selectionId: "selection:turtle:cn_a_universe",
          runId: "run-turtle-topn",
          universe: "cn_a_standalone",
          generatedAt: "2026-05-03T08:00:00.000Z",
          candidates: candidates.map((c) => ({ code: c.code })),
          policyResults: candidates.map((c) => ({
            policyId: "policy:turtle",
            code: c.code,
            payload: {
              name: c.name,
              industry: c.industry,
              score: c.totalScore,
              decision: c.decision,
              confidence: c.confidence,
              metrics: {
                penetrationR: c.factors.penetrationR,
                evEbitda: c.factors.evEbitda,
                floorPremium: c.factors.floorPremium,
                roe: c.roe,
                fcfYield: c.fcfYield,
              },
            },
          })),
          rankingsTopN: 3,
        },
        null,
        2,
      ),
      "utf-8",
    );

    await emitSiteReportsFromRun({ runDir, siteDir });

    const index = JSON.parse(await readFile(path.join(siteDir, "rankings", "index.json"), "utf-8")) as {
      lists: Array<{
        topN?: number;
        totalCandidates?: number;
        items: Array<{ rank: number; code: string }>;
      }>;
    };
    const list = index.lists[0];
    assert.ok(list, "应输出一条榜单");
    assert.equal(list.topN, 3, "manifest.rankingsTopN 应被透传");
    assert.equal(list.totalCandidates, 10, "totalCandidates 应等于 results 长度");
    assert.equal(list.items.length, 3, "items 应被截断到 topN");
    assert.deepEqual(
      list.items.map((it) => it.rank),
      [1, 2, 3],
      "rank 应按截断后重新编号",
    );
    assert.equal(list.items[0]?.code, "600000");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function assertUnknownStrategyOmitsTopicInHref(): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), "rankings-href-"));
  try {
    const runDir = path.join(root, "run");
    const siteDir = path.join(root, "site");
    await mkdir(runDir, { recursive: true });
    await writeFile(
      path.join(runDir, "screener_results.json"),
      JSON.stringify(
        {
          strategyId: "high_dividend",
          strategyLabel: "高股息策略",
          market: "CN_A",
          mode: "standalone",
          generatedAt: "2026-05-03T08:00:00.000Z",
          totalUniverse: 1,
          tier1Count: 1,
          passedCount: 1,
          results: [
            {
              code: "600036",
              name: "招商银行",
              market: "CN_A",
              industry: "银行",
              channel: "main",
              tier1Score: 0.5,
              passed: true,
              qualityPassed: true,
              screenerScore: 0.6,
              totalScore: 0.7,
              decision: "buy",
              confidence: "medium",
              factors: {},
            },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );
    await writeFile(
      path.join(runDir, "selection_manifest.json"),
      JSON.stringify(
        {
          manifestVersion: "1.0",
          schema: "selection-result-v2",
          runProfile: "selection_fast",
          strategyId: "high_dividend",
          strategyLabel: "高股息策略",
          selectionId: "selection:high_dividend:cn_a",
          runId: "run-hd-1",
          universe: "cn_a_standalone",
          generatedAt: "2026-05-03T08:00:00.000Z",
          candidates: [{ code: "600036" }],
          policyResults: [
            {
              policyId: "policy:high_dividend",
              code: "600036",
              payload: {
                name: "招商银行",
                industry: "银行",
                score: 0.7,
                decision: "buy",
                confidence: "medium",
                metrics: {},
              },
            },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );

    await emitSiteReportsFromRun({ runDir, siteDir });

    const index = JSON.parse(await readFile(path.join(siteDir, "rankings", "index.json"), "utf-8")) as {
      lists: Array<{ strategyId: string; items: Array<{ href?: string }> }>;
    };
    const item = index.lists[0]?.items[0];
    assert.ok(item, "应输出一条候选");
    assert.equal(item.href, "/reports?code=600036", "未知策略 href 不应携带 topic 参数");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function assertGenericStrategyListSurvivesReindex(): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), "rankings-reindex-"));
  try {
    const rankingsDir = path.join(root, "site", "rankings", "lists");
    await mkdir(rankingsDir, { recursive: true });
    await writeFile(
      path.join(rankingsDir, "2026-05-03-breakout-cn_a-standalone-demo.json"),
      JSON.stringify(
        {
          listId: "2026-05-03-breakout-cn_a-standalone-demo",
          sourceRunId: "run-breakout-1",
          strategyId: "breakout",
          strategyLabel: "突破策略",
          market: "CN_A",
          mode: "standalone",
          generatedAt: "2026-05-03T09:00:00.000Z",
          capabilityStatus: "ok",
          capabilityReasonCodes: [],
          items: [
            {
              rank: 1,
              code: "300750",
              name: "宁德时代",
              score: 0.77,
              decision: "setup",
              confidence: "medium",
              metrics: {
                breakoutPrice: 265.3,
                pullbackLimit: 5.1,
              },
            },
          ],
        },
        null,
        2,
      ),
      "utf-8",
    );

    await rebuildSiteRankingsIndex(path.join(root, "site"));
    const index = JSON.parse(await readFile(path.join(root, "site", "rankings", "index.json"), "utf-8")) as {
      strategyCount: number;
      listCount: number;
      lists: Array<{ strategyId: string; items: Array<{ metrics: Record<string, unknown> }> }>;
    };
    assert.equal(index.strategyCount, 1);
    assert.equal(index.listCount, 1);
    assert.equal(index.lists[0]?.strategyId, "breakout");
    assert.equal(index.lists[0]?.items[0]?.metrics?.breakoutPrice, 265.3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  await assertScreenerRunPublishesRankings();
  await assertRankingsTruncatedToManifestTopN();
  await assertUnknownStrategyOmitsTopicInHref();
  await assertGenericStrategyListSurvivesReindex();
  console.log("[rankings-site-smoke] ok");
}

void main();
