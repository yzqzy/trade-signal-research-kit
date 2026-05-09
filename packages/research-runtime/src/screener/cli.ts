#!/usr/bin/env node

import { initCliEnv } from "../lib/init-cli-env.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveScreenerRunDirectory } from "../contracts/output-layout-v2.js";
import { ScreenerDiskCache } from "./cache.js";
import { tier1FilterCnA } from "./cn-a.js";
import { resolveScreenerConfig, validateScreenerConfig } from "./config.js";
import { exportScreenerResultsCsv, exportScreenerUniverseCsv } from "./export-results.js";
import { enrichUniverseFinancials } from "./financial-enrichment.js";
import { renderScreenerHtml, renderScreenerMarkdown } from "./renderer.js";
import { buildSelectionManifestV1 } from "./selection-manifest-v2.js";
import { buildUniverseCapability } from "./capability.js";
import type { ScreenerCandidate, ScreenerConfigOverrides, ScreenerRunOutput, ScreenerScoredResult, ScreenerUniverseRow } from "./types.js";
import { loadOrFetchUniverseSnapshot } from "./universe-snapshot.js";
import { bootstrapV2PluginRegistry } from "../bootstrap/v2-plugin-registry.js";
import { resolvePolicyPlugin } from "@trade-signal/research-policy";
import { resolveSelectionPlugin } from "@trade-signal/research-selection";
import type { FeatureSet, PolicyResult, SelectionResult } from "@trade-signal/research-contracts";
import { resolveStrategyDefinition } from "../strategy/registry.js";

type CliArgs = {
  market: "CN_A" | "HK";
  mode: "standalone" | "composed";
  inputJsonPath?: string;
  feedBaseUrl?: string;
  feedApiBasePath?: string;
  feedApiKey?: string;
  universePageSize?: number;
  configJsonPath?: string;
  outputDir: string;
  tier1Only: boolean;
  tier2Limit?: number;
  minRoe?: number;
  maxPe?: number;
  minGrossMargin?: number;
  cacheDir?: string;
  cacheRefresh: boolean;
  cacheTier2Refresh: boolean;
  refreshUniverse: boolean;
  skipFinancialEnrichment: boolean;
  financialEnrichmentLimit?: number;
  financialEnrichmentConcurrency?: number;
  csvPath?: string;
  htmlPath?: string;
  skipDefaultCsv: boolean;
  rankingsTopN?: number;
  strategyId?: string;
};

function parseArgs(argv: string[]): CliArgs {
  const flags = new Set<string>();
  const values: Record<string, string> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--") continue;
    if (!key?.startsWith("--")) continue;
    const name = key.slice(2).replaceAll("-", "_");

    const next = argv[i + 1];
    if (
      name === "tier1_only" ||
      name === "cache_refresh" ||
      name === "cache_tier2_refresh" ||
      name === "refresh_universe" ||
      name === "skip_financial_enrichment" ||
      name === "skip_default_csv"
    ) {
      flags.add(name);
      continue;
    }

    if (!next || next.startsWith("--")) {
      throw new Error(`Missing value for argument: ${key}`);
    }
    values[name] = next;
    i += 1;
  }

  return {
    market: (values.market ?? "CN_A") as "CN_A" | "HK",
    mode: (values.mode ?? "standalone") as "standalone" | "composed",
    inputJsonPath: values.input_json,
    feedBaseUrl: values.feed_base_url,
    feedApiBasePath: values.feed_api_base_path,
    feedApiKey: values.feed_api_key,
    universePageSize: values.universe_page_size !== undefined ? Number(values.universe_page_size) : undefined,
    configJsonPath: values.config_json,
    outputDir: values.output_dir ?? values.output ?? "output",
    tier1Only: flags.has("tier1_only"),
    tier2Limit: values.tier2_limit !== undefined ? Number(values.tier2_limit) : undefined,
    minRoe: values.min_roe !== undefined ? Number(values.min_roe) : undefined,
    maxPe: values.max_pe !== undefined ? Number(values.max_pe) : undefined,
    minGrossMargin: values.min_gross_margin !== undefined ? Number(values.min_gross_margin) : undefined,
    cacheDir: values.cache_dir,
    cacheRefresh: flags.has("cache_refresh"),
    cacheTier2Refresh: flags.has("cache_tier2_refresh"),
    refreshUniverse: flags.has("refresh_universe"),
    skipFinancialEnrichment: flags.has("skip_financial_enrichment"),
    financialEnrichmentLimit:
      values.financial_enrichment_limit !== undefined ? Number(values.financial_enrichment_limit) : undefined,
    financialEnrichmentConcurrency:
      values.financial_enrichment_concurrency !== undefined ? Number(values.financial_enrichment_concurrency) : undefined,
    csvPath: values.csv,
    htmlPath: values.html,
    skipDefaultCsv: flags.has("skip_default_csv"),
    rankingsTopN:
      values.rankings_top_n !== undefined ? Number(values.rankings_top_n) : undefined,
    strategyId: values.strategy_id,
  };
}

async function loadJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

async function writeText(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}

function toFeatureSet(runId: string, row: ScreenerUniverseRow): FeatureSet {
  return {
    runId,
    code: row.code,
    features: { ...row },
    sourceRefs: [],
  };
}

type PolicyPayloadForAudit = {
  name?: string;
  industry?: string;
  passesUniverseGate?: boolean;
  filterReasons?: string[];
  score?: number;
  decision?: "buy" | "watch" | "avoid";
  confidence?: "high" | "medium" | "low";
  metrics?: Record<string, unknown>;
};

function numberMetric(metrics: Record<string, unknown> | undefined, key: string): number | undefined {
  const v = metrics?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function auditRowsFromPolicyResults(params: {
  market: "CN_A" | "HK";
  mode: "standalone" | "composed";
  generatedAt: string;
  universe: ScreenerUniverseRow[];
  tier1: ScreenerCandidate[];
  strategyId: string;
  strategyLabel: string;
  policyResults: PolicyResult[];
}): ScreenerRunOutput {
  const tier1Scores = new Map(params.tier1.map((row) => [row.code, row.tier1Score]));
  const universeByCode = new Map(params.universe.map((row) => [row.code, row]));
  const results: ScreenerScoredResult[] = params.policyResults.map((policy) => {
    const base = universeByCode.get(policy.code);
    const payload = (policy.payload ?? {}) as PolicyPayloadForAudit;
    const metrics = payload.metrics ?? {};
    const passed = payload.passesUniverseGate === true && payload.decision !== "avoid";
    return {
      code: policy.code,
      name: payload.name ?? base?.name ?? policy.code,
      market: params.market,
      industry: payload.industry ?? base?.industry,
      listDate: base?.listDate,
      close: base?.close,
      pe: numberMetric(metrics, "pe") ?? base?.pe,
      pb: numberMetric(metrics, "pb") ?? base?.pb,
      dv: numberMetric(metrics, "dividendYield") ?? base?.dv,
      marketCap: numberMetric(metrics, "marketCap") ?? base?.marketCap,
      turnover: numberMetric(metrics, "turnover") ?? base?.turnover,
      debtRatio: numberMetric(metrics, "debtRatio") ?? base?.debtRatio,
      grossMargin: numberMetric(metrics, "grossMargin") ?? base?.grossMargin,
      roe: numberMetric(metrics, "roe") ?? base?.roe,
      fcfYield: numberMetric(metrics, "fcfYield") ?? base?.fcfYield,
      channel: "main",
      tier1Score: tier1Scores.get(policy.code) ?? 0,
      passed,
      vetoReason: payload.filterReasons?.join("; "),
      qualityPassed: payload.passesUniverseGate === true,
      screenerScore: payload.score ?? 0,
      totalScore: payload.score ?? 0,
      decision: payload.decision ?? (passed ? "watch" : "avoid"),
      confidence: payload.confidence ?? (passed ? "medium" : "low"),
      factors: {
        penetrationR: numberMetric(metrics, "penetrationR"),
        thresholdII: numberMetric(metrics, "thresholdII"),
        rf: numberMetric(metrics, "rf"),
        evEbitda: numberMetric(metrics, "evEbitda"),
        floorPremium: numberMetric(metrics, "floorPremium"),
        payoutM: numberMetric(metrics, "payoutM"),
        aa: numberMetric(metrics, "aa"),
      },
    };
  });
  const sorted = results.sort((a, b) => Number(b.passed) - Number(a.passed) || b.totalScore - a.totalScore);
  return {
    strategyId: params.strategyId,
    strategyLabel: params.strategyLabel,
    market: params.market,
    mode: params.mode,
    generatedAt: params.generatedAt,
    totalUniverse: params.universe.length,
    tier1Count: params.tier1.length,
    passedCount: sorted.filter((row) => row.passed && row.decision !== "avoid").length,
    results: sorted,
  };
}

async function main(): Promise<void> {
  initCliEnv();
  const args = parseArgs(process.argv.slice(2));

  const universe = args.inputJsonPath
    ? await loadJson<ScreenerUniverseRow[]>(args.inputJsonPath)
    : (
        await loadOrFetchUniverseSnapshot({
          market: args.market,
          outputRoot: args.outputDir,
          feedBaseUrl: args.feedBaseUrl,
          feedApiBasePath: args.feedApiBasePath,
          feedApiKey: args.feedApiKey,
          pageSize: args.universePageSize ?? 500,
          refresh: args.refreshUniverse,
        })
      ).rows;
  if (!Array.isArray(universe)) throw new Error("[screener] universe 须为数组");
  const fileCfg = args.configJsonPath ? await loadJson<ScreenerConfigOverrides>(args.configJsonPath) : {};

  const cliOverrides: ScreenerConfigOverrides = { ...fileCfg };
  if (args.minRoe !== undefined) cliOverrides.minRoe = args.minRoe;
  if (args.maxPe !== undefined) cliOverrides.maxPe = args.maxPe;
  if (args.minGrossMargin !== undefined) cliOverrides.minGrossMargin = args.minGrossMargin;
  if (args.cacheDir !== undefined) cliOverrides.cacheDir = args.cacheDir;

  const cfg = resolveScreenerConfig(args.market, cliOverrides);
  const verr = validateScreenerConfig(cfg);
  if (verr.length) throw new Error(`ScreenerConfig invalid: ${verr.join("; ")}`);

  const cacheRoot = path.resolve(cfg.cacheDir);
  const disk = new ScreenerDiskCache(cacheRoot);
  if (args.cacheRefresh) {
    await disk.clear();
    console.log(`[screener] cache cleared -> ${cacheRoot}`);
  } else if (args.cacheTier2Refresh) {
    await disk.invalidatePrefix("tier2_");
    await disk.invalidatePrefix("global_");
    console.log(`[screener] tier2/global cache invalidated -> ${cacheRoot}`);
  }

  let enrichedUniverse = universe;
  const strategy = resolveStrategyDefinition(args.strategyId);

  if (args.market === "CN_A" && !args.tier1Only && !args.skipFinancialEnrichment && strategy.requiredEnrichment.includes("financial_history")) {
    const feedBaseUrl = args.feedBaseUrl ?? process.env.FEED_BASE_URL ?? "";
    const limitRaw = args.financialEnrichmentLimit;
    const tier1Rows = tier1FilterCnA(universe, cfg);
    const limit = typeof limitRaw === "number" && Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : tier1Rows.length;
    const tier1Codes = tier1Rows.slice(0, limit).map((row) => row.code);
    if (feedBaseUrl.trim()) {
      const enriched = await enrichUniverseFinancials(universe, tier1Codes, {
        baseUrl: feedBaseUrl,
        apiBasePath: args.feedApiBasePath,
        apiKey: args.feedApiKey,
        years: 5,
        concurrency: args.financialEnrichmentConcurrency,
      });
      enrichedUniverse = enriched.universe;
      console.log(
        `[screener] financial enrichment: requested=${tier1Codes.length} enriched=${enriched.enrichedCount} failed=${enriched.failedCount}`,
      );
      if (enriched.enrichedCount === 0) {
        throw new Error("[screener] financial enrichment required for Turtle penetration R, but no rows were enriched");
      }
    } else {
      throw new Error("[screener] financial enrichment requires FEED_BASE_URL or --feed-base-url; use --skip-financial-enrichment only for diagnostics");
    }
  }

  const capability = buildUniverseCapability(args.market, enrichedUniverse);
  const generatedAt = new Date().toISOString();
  const tier1Rows = args.market === "CN_A" ? tier1FilterCnA(enrichedUniverse, cfg) : [];
  const runDirectory = resolveScreenerRunDirectory({
    outputRootArg: args.outputDir,
    market: args.market,
    mode: args.mode,
  });
  const runIdForPolicy = runDirectory.runId;
  let result: ScreenerRunOutput;
  let policyResults: PolicyResult[] = [];
  let selectionResult: SelectionResult | undefined;

  if (capability.status === "hk_not_ready" || capability.status === "blocked_missing_required_fields") {
    result = {
      strategyId: strategy.strategyId,
      strategyLabel: strategy.label,
      market: args.market,
      mode: args.mode,
      generatedAt,
      totalUniverse: enrichedUniverse.length,
      tier1Count: 0,
      passedCount: 0,
      tier1Only: args.tier1Only,
      results: [],
      capability,
    };
  } else {
    bootstrapV2PluginRegistry();
    const policyPlugin = resolvePolicyPlugin(strategy.policyId);
    const featureSetRows = enrichedUniverse.map((row) => toFeatureSet(runIdForPolicy, row));
    policyResults = await Promise.all(
      featureSetRows.map((featureSet) =>
        Promise.resolve(
          policyPlugin.evaluate({
            policyId: strategy.policyId,
            runId: runIdForPolicy,
            code: featureSet.code,
            featureSet,
          }),
        ),
      ),
    );
    const rankingsTopNRaw = args.rankingsTopN;
    const rankingsTopNForSelection =
      typeof rankingsTopNRaw === "number" && Number.isFinite(rankingsTopNRaw) && rankingsTopNRaw > 0
        ? Math.floor(rankingsTopNRaw)
        : strategy.defaultRankingsTopN;
    const selectionPlugin = resolveSelectionPlugin(strategy.selectionId);
    selectionResult = await selectionPlugin.compose({
      selectionId: strategy.selectionId,
      runId: runIdForPolicy,
      universe: strategy.universe,
      policyResults,
      maxCandidates: rankingsTopNForSelection,
    });
    result = auditRowsFromPolicyResults({
      market: args.market,
      mode: args.mode,
      generatedAt,
      universe: enrichedUniverse,
      tier1: tier1Rows,
      strategyId: strategy.strategyId,
      strategyLabel: strategy.label,
      policyResults,
    });
    result.capability = capability;
    result.tier1Only = args.tier1Only;
  }
  const cap = result.capability;

  if (cap?.status === "hk_not_ready") {
    const msg = cap.messages.join(" ");
    console.error(`[screener] HK_UNIVERSE_NOT_READY: ${msg}`);
    console.error(
      JSON.stringify({
        screenerExit: { status: cap.status, reasonCodes: cap.reasonCodes },
      }),
    );
    process.exitCode = 2;
  } else if (cap?.status === "blocked_missing_required_fields") {
    const msg = cap.messages.join(" ");
    console.error(`[screener] BLOCKED: ${msg}`);
    console.error(
      JSON.stringify({
        screenerExit: { status: cap.status, reasonCodes: cap.reasonCodes },
      }),
    );
    process.exitCode = 1;
  } else if (cap?.status === "degraded_tier2_fields") {
    console.warn(`[screener] DEGRADED_TIER2: ${cap.messages.join(" ")}`);
    console.warn(
      JSON.stringify({
        screenerWarning: { status: cap.status, reasonCodes: cap.reasonCodes },
      }),
    );
  }

  const { outputDir: outDir } = runDirectory;
  await mkdir(outDir, { recursive: true });
  await writeText(path.join(outDir, "screener_results.json"), JSON.stringify(result, null, 2));
  await writeText(path.join(outDir, "screener_universe.json"), JSON.stringify(enrichedUniverse, null, 2));
  const runId = path.basename(outDir);

  const topNRaw = args.rankingsTopN;
  const rankingsTopN =
    typeof topNRaw === "number" && Number.isFinite(topNRaw) && topNRaw > 0
      ? Math.floor(topNRaw)
      : strategy.defaultRankingsTopN;
  const manifest = buildSelectionManifestV1(result, runId, { rankingsTopN });
  manifest.strategyId = strategy.strategyId;
  manifest.strategyLabel = strategy.label;
  manifest.selectionId = strategy.selectionId;
  manifest.universe = strategy.universe;
  manifest.candidates = (selectionResult?.candidates ?? []).map((it) => ({
    code: it.code,
    score: it.score,
    decision: it.decision ?? (policyResults.find((pr) => pr.code === it.code)?.payload?.decision as string | undefined) ?? "watch",
    confidence: it.confidence,
    policyContributions: it.policyContributions,
  }));
  manifest.drillDownTopicIds = selectionResult?.drillDownTopicIds ?? [];
  manifest.policyResults = policyResults.map((it) => ({
    policyId: it.policyId,
    code: it.code,
    payload: it.payload,
  }));
  await writeText(
    path.join(outDir, "selection_manifest.json"),
    JSON.stringify(manifest, null, 2),
  );

  const passedRanking = result.results.filter((r) => r.passed && r.decision !== "avoid").length;
  console.log(
    `[screener] summary: market=${result.market} mode=${result.mode} ` +
      `universe=${result.totalUniverse} tier1=${result.tier1Count} ` +
      `passed=${passedRanking}/${result.passedCount} results=${result.results.length} ` +
      `rankingsTopN=${rankingsTopN} capability=${result.capability?.status ?? "n/a"}`,
  );
  await writeText(path.join(outDir, "screener_input.csv"), exportScreenerUniverseCsv(enrichedUniverse));
  await writeText(path.join(outDir, "screener_report.md"), renderScreenerMarkdown(result));
  await writeText(path.join(outDir, "screener_report.html"), renderScreenerHtml(result));

  if (args.csvPath) {
    await writeText(path.resolve(args.csvPath), exportScreenerResultsCsv(result));
    console.log(`[screener] csv -> ${path.resolve(args.csvPath)}`);
  }
  if (!args.tier1Only && !args.skipDefaultCsv && !args.csvPath) {
    const defaultCsv = path.join(outDir, "screener_results.csv");
    await writeText(defaultCsv, exportScreenerResultsCsv(result));
    console.log(`[screener] csv -> ${defaultCsv}`);
  }
  if (args.htmlPath) {
    await writeText(path.resolve(args.htmlPath), renderScreenerHtml(result));
    console.log(`[screener] html(extra) -> ${path.resolve(args.htmlPath)}`);
  }

  console.log(`[screener] json -> ${path.join(outDir, "screener_results.json")}`);
  console.log(`[screener] md -> ${path.join(outDir, "screener_report.md")}`);
  console.log(`[screener] html -> ${path.join(outDir, "screener_report.html")}`);
}

void main();
