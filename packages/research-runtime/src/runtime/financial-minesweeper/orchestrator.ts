import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MarketDataProvider } from "@trade-signal/schema-core";
import { createFeedHttpProviderFromEnv } from "@trade-signal/provider-http";
import { normalizeCodeForFeed } from "../../crosscut/normalization/normalize-stock-code.js";
import type { FinancialMinesweeperManifestV1 } from "../../contracts/financial-minesweeper-manifest.js";
import { resolveFinancialMinesweeperDefaultRunDirectory } from "../../contracts/output-layout-v2.js";
import { loadFinancialHistory, normalizeFinancialHistory } from "../../steps/phase1a/financial-history.js";
import { fetchFeedFinancialStatements, type StatementRow } from "./feed-statements-fetch.js";
import { evaluateMinesweeperRules } from "./minesweeper-rules.js";
import type { MinesweeperRuleContext } from "./minesweeper-types.js";
import { renderFinancialMinesweeperMarkdown } from "./report-markdown.js";

function yearFromStatementRow(row: StatementRow): string | undefined {
  const d = row.reportDate?.trim();
  return d?.match(/^(20\d{2})/)?.[1];
}

function mergeStatementRow(row: StatementRow): Record<string, unknown> {
  return { ...(row.camel ?? {}), ...(row.raw ?? {}) };
}

function latestBalanceForYear(
  balanceRows: StatementRow[] | undefined,
  year: string,
): Record<string, unknown> | undefined {
  if (!balanceRows?.length) return undefined;
  const filtered = balanceRows.filter((r) => yearFromStatementRow(r) === year);
  if (filtered.length === 0) return undefined;
  let best = filtered[0]!;
  for (const r of filtered) {
    if (String(r.reportDate ?? "").localeCompare(String(best.reportDate ?? "")) > 0) best = r;
  }
  return mergeStatementRow(best);
}

export type RunFinancialMinesweeperInput = {
  code: string;
  year: string;
  outputDirArg?: string;
  companyName?: string;
};

export type RunFinancialMinesweeperResult = {
  outputDir: string;
  manifestPath: string;
  reportMarkdownPath: string;
  analysisJsonPath: string;
};

export async function runFinancialMinesweeper(input: RunFinancialMinesweeperInput): Promise<RunFinancialMinesweeperResult> {
  const normalizedCode = normalizeCodeForFeed(input.code.trim());
  const anchorYear = Number.parseInt(input.year.trim(), 10);
  if (!Number.isFinite(anchorYear) || anchorYear < 1990 || anchorYear > 2100) {
    throw new Error(`[financial-minesweeper] 无效年份: ${input.year}`);
  }

  const { outputDir, runId, layout } = resolveFinancialMinesweeperDefaultRunDirectory({
    outputDirArg: input.outputDirArg ?? "output",
    stockCode: normalizedCode,
  });

  await mkdir(outputDir, { recursive: true });

  const provider: MarketDataProvider = createFeedHttpProviderFromEnv();
  const instrument = await provider.getInstrument(normalizedCode);
  const companyName = (input.companyName ?? instrument.name ?? normalizedCode).trim();

  const rawHistory = await loadFinancialHistory(provider, normalizedCode, anchorYear, 8);
  const snapshots = rawHistory ? normalizeFinancialHistory(rawHistory) : [];

  let trends =
    (await provider.getFinancialQualityTrends?.(normalizedCode, { years: 10, reportType: "annual" })) ?? [];

  trends = [...trends].sort((a, b) => (b.year ?? "").localeCompare(a.year ?? ""));

  const statements = await fetchFeedFinancialStatements({ code: normalizedCode, years: 10, reportType: "annual" });
  const yKey = String(anchorYear);
  const latestBalance = latestBalanceForYear(statements?.balance, yKey);

  let governanceEvents = await provider.getGovernanceEvents?.(normalizedCode, {
    year: yKey,
    limit: 30,
    timeRange: "3y",
  }).catch(() => undefined);

  const events = governanceEvents?.events ?? [];

  const ctx: MinesweeperRuleContext = {
    code: normalizedCode,
    anchorYear,
    companyName,
    industry: instrument.industry,
    snapshots,
    trends,
    governanceEvents: events,
    latestBalance,
  };

  const evaluation = evaluateMinesweeperRules(ctx);
  const reportMd = renderFinancialMinesweeperMarkdown({
    companyName,
    code: normalizedCode,
    anchorYear,
    evaluation,
  });

  const reportPath = path.join(outputDir, "financial_minesweeper_report.md");
  const analysisPath = path.join(outputDir, "financial_minesweeper_analysis.json");
  const rawPath = path.join(outputDir, "financial_minesweeper_raw.json");

  await writeFile(reportPath, reportMd, "utf-8");
  await writeFile(
    analysisPath,
    JSON.stringify(
      {
        schema: "financial_minesweeper_analysis",
        version: "1.0",
        generatedAt: new Date().toISOString(),
        code: normalizedCode,
        anchorYear,
        evaluation,
      },
      null,
      2,
    ),
    "utf-8",
  );
  await writeFile(
    rawPath,
    JSON.stringify(
      {
        instrument,
        snapshots,
        trends,
        governanceEvents: events,
        statementsPayloadPresent: Boolean(statements),
        latestBalanceKeys: latestBalance ? Object.keys(latestBalance).slice(0, 40) : [],
      },
      null,
      2,
    ),
    "utf-8",
  );

  const manifest: FinancialMinesweeperManifestV1 = {
    manifestVersion: "1.0",
    generatedAt: new Date().toISOString(),
    outputLayout: {
      code: normalizedCode,
      runId: layout.runId || runId,
      area: "financial-minesweeper",
    },
    input: {
      code: normalizedCode,
      year: String(anchorYear),
      companyName,
    },
    outputs: {
      reportMarkdownPath: "financial_minesweeper_report.md",
      analysisJsonPath: "financial_minesweeper_analysis.json",
      rawDataJsonPath: "financial_minesweeper_raw.json",
    },
    summary: {
      totalScore: evaluation.totalScore,
      riskBand: evaluation.riskBand,
      failCount: evaluation.rows.filter((r) => r.verdict === "FAIL").length,
      warnCount: evaluation.rows.filter((r) => r.verdict === "WARN").length,
      skipCount: evaluation.rows.filter((r) => r.verdict === "SKIP").length,
    },
  };

  const manifestPath = path.join(outputDir, "financial_minesweeper_manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  return {
    outputDir,
    manifestPath,
    reportMarkdownPath: reportPath,
    analysisJsonPath: analysisPath,
  };
}
