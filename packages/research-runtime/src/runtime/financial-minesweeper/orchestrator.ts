import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MarketDataProvider, PdfSections } from "@trade-signal/schema-core";
import { createFeedHttpProviderFromEnv } from "@trade-signal/provider-http";
import { normalizeCodeForFeed } from "../../crosscut/normalization/normalize-stock-code.js";
import { ensureAnnualPdfOnDisk } from "../../crosscut/preflight/ensure-annual-pdf.js";
import { parsePdfExtractQualityFromReportMarkdown } from "../../crosscut/preflight/phase3-preflight.js";
import type { FinancialMinesweeperManifestV1 } from "../../contracts/financial-minesweeper-manifest.js";
import { resolveFinancialMinesweeperDefaultRunDirectory } from "../../contracts/output-layout-v2.js";
import { loadFinancialHistory, normalizeFinancialHistory } from "../../steps/phase1a/financial-history.js";
import { runPhase2AExtractPdfSections } from "../../steps/phase2a/extractor.js";
import { renderPhase2BDataPackReport } from "../../steps/phase2b/renderer.js";
import { parseDataPackReport } from "../../steps/phase3/report-pack-parser.js";
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

function toYear(input?: string): string | undefined {
  return input?.match(/^(20\d{2})/)?.[1];
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function pickNum(row: Record<string, unknown> | undefined, keys: string[]): number | undefined {
  if (!row) return undefined;
  for (const key of keys) {
    const value = asNumber(row[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function pickText(row: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!row) return undefined;
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
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

function mapByYear(rows: StatementRow[] | undefined): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const row of rows ?? []) {
    const year = toYear(row.reportDate);
    if (!year) continue;
    out[year] = { ...(out[year] ?? {}), ...mergeStatementRow(row), reportDate: row.reportDate };
  }
  return out;
}

function buildAnnualMeta(input: {
  years: string[];
  snapshots: MinesweeperRuleContext["snapshots"];
  balanceByYear: Record<string, Record<string, unknown>>;
}): MinesweeperRuleContext["annualMetaByYear"] {
  const bySnap = new Map<string, (typeof input.snapshots)[number]>();
  for (const s of input.snapshots) {
    const year = toYear(s.period) ?? s.period.slice(0, 4);
    if (year) bySnap.set(year, s);
  }
  const out: MinesweeperRuleContext["annualMetaByYear"] = {};
  for (const year of input.years) {
    const snap = bySnap.get(year);
    const balance = input.balanceByYear[year];
    out[year] = {
      year,
      reportDate: String(balance?.reportDate ?? `${year}-12-31`),
      annDate: pickText(balance, ["ann_date", "annDate", "publishDate", "disclosureDate"]),
      auditAgency: pickText(balance, ["audit_agency", "auditAgency", "auditFirmName"]),
      auditResult: snap?.auditResult ?? pickText(balance, ["audit_result", "auditResult", "audit_opinion"]),
      topHolderRatio: pickNum(balance, ["top_holder_ratio", "topHolderRatio", "hold_ratio", "holdRatio"]),
    };
  }
  return out;
}

export type RunFinancialMinesweeperInput = {
  code: string;
  year: string;
  outputDirArg?: string;
  companyName?: string;
  reportUrl?: string;
};

export type RunFinancialMinesweeperResult = {
  outputDir: string;
  manifestPath: string;
  reportMarkdownPath: string;
  analysisJsonPath: string;
  pdfPath?: string;
  reportUrlResolved?: string;
  fiscalYearResolved?: string;
  phase2aJsonPath?: string;
  phase2bMarkdownPath?: string;
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
  const incomeByYear = mapByYear(statements?.income);
  const balanceByYear = mapByYear(statements?.balance);
  const cashflowByYear = mapByYear(statements?.cashflow);
  const allYears = Array.from(
    new Set([
      ...Object.keys(incomeByYear),
      ...Object.keys(balanceByYear),
      ...Object.keys(cashflowByYear),
      ...snapshots.map((s) => toYear(s.period) ?? s.period.slice(0, 4)).filter(Boolean),
    ]),
  ).sort((a, b) => b.localeCompare(a));
  const annualMetaByYear = buildAnnualMeta({
    years: allYears,
    snapshots,
    balanceByYear,
  });

  let governanceEvents = await provider.getGovernanceEvents?.(normalizedCode, {
    year: yKey,
    limit: 30,
    timeRange: "3y",
  }).catch(() => undefined);

  const events = governanceEvents?.events ?? [];

  const ensurePdf = await ensureAnnualPdfOnDisk({
    normalizedCode,
    fiscalYear: String(anchorYear),
    category: "年报",
    outputRunDir: outputDir,
    reportUrl: input.reportUrl,
    discoverPolicy: "strict",
    allowFiscalYearFallback: false,
    discoveryErrorStyle: "workflow-strict",
  }).catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error);
    const sanitized = detail.replace(/--pdf\s+<path>\s+或\s*/g, "").replace(/\s*或\s*--pdf\s+<path>/g, "");
    throw new Error(`[financial-minesweeper] 年报 PDF 获取失败：${sanitized}。可用 --report-url 指定直链重试。`);
  });
  if (!ensurePdf.pdfPath?.trim()) {
    throw new Error("[financial-minesweeper] 年报 PDF 为必需输入，但未获得可解析 PDF。");
  }

  const resolvedPdfPath = path.resolve(ensurePdf.pdfPath.trim());
  const phase2aJsonPath = path.join(outputDir, "pdf_sections.json");
  const phase2bMarkdownPath = path.join(outputDir, "data_pack_report.md");
  const pdfSections: PdfSections = await runPhase2AExtractPdfSections({
    pdfPath: resolvedPdfPath,
    outputPath: phase2aJsonPath,
    verbose: false,
  });

  const dataPackReportMarkdown = renderPhase2BDataPackReport({
    sections: pdfSections,
    includeMda: true,
    reportKind: "annual",
  });
  await writeFile(phase2bMarkdownPath, dataPackReportMarkdown, "utf-8");

  let pdfQuality: MinesweeperRuleContext["pdfQuality"];
  if (dataPackReportMarkdown) {
    pdfQuality = parsePdfExtractQualityFromReportMarkdown(dataPackReportMarkdown);
  } else if (pdfSections?.metadata.extractQuality) {
    pdfQuality = pdfSections.metadata.extractQuality;
  }
  const reportSections = dataPackReportMarkdown
    ? parseDataPackReport(dataPackReportMarkdown).sections
    : undefined;

  const ctx: MinesweeperRuleContext = {
    code: normalizedCode,
    anchorYear,
    companyName,
    industry: instrument.industry,
    snapshots,
    trends,
    governanceEvents: events,
    latestBalance,
    annualMetaByYear,
    incomeByYear,
    balanceByYear,
    cashflowByYear,
    dataPackReportMarkdown,
    dataPackReportSections: reportSections,
    pdfQuality,
    pdfSections,
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
        annualMetaByYear,
        pdfPath: path.relative(outputDir, resolvedPdfPath),
        reportUrlResolved: ensurePdf.reportUrlResolved,
        fiscalYearResolved: ensurePdf.fiscalYearResolved,
        phase2aJsonPath: phase2aJsonPath ? path.relative(outputDir, phase2aJsonPath) : undefined,
        phase2bMarkdownPath: phase2bMarkdownPath ? path.relative(outputDir, phase2bMarkdownPath) : undefined,
        pdfQuality,
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
      fiscalYearResolved: ensurePdf.fiscalYearResolved,
      reportUrlResolved: ensurePdf.reportUrlResolved,
    },
    outputs: {
      reportMarkdownPath: "financial_minesweeper_report.md",
      analysisJsonPath: "financial_minesweeper_analysis.json",
      rawDataJsonPath: "financial_minesweeper_raw.json",
      pdfPath: path.relative(outputDir, resolvedPdfPath),
      phase2aJsonPath: phase2aJsonPath ? path.relative(outputDir, phase2aJsonPath) : undefined,
      phase2bMarkdownPath: phase2bMarkdownPath ? path.relative(outputDir, phase2bMarkdownPath) : undefined,
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
    pdfPath: resolvedPdfPath,
    reportUrlResolved: ensurePdf.reportUrlResolved,
    fiscalYearResolved: ensurePdf.fiscalYearResolved,
    phase2aJsonPath,
    phase2bMarkdownPath,
  };
}
