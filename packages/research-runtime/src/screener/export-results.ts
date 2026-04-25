import type { ScreenerRunOutput, ScreenerScoredResult, ScreenerUniverseRow } from "./types.js";

/** Python `export_html` / 控制台展示列顺序（存在字段则输出）。 */
export const SCREENER_RESULTS_CSV_COLUMNS = [
  "ts_code",
  "name",
  "industry",
  "channel",
  "close",
  "pe_ttm",
  "pb",
  "dv_ttm",
  "roe_waa",
  "gross_margin",
  "debt_to_assets",
  "fcf_yield",
  "fcf_margin",
  "R",
  "ev_ebitda",
  "floor_premium",
  "composite_score",
  "tier1_score",
  "decision",
  "passed",
  "quality_passed",
  "veto_reason",
] as const;

function cell(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return JSON.stringify(String(v));
}

function rowToResultRecord(r: ScreenerScoredResult): Record<string, unknown> {
  const f = r.factors;
  return {
    ts_code: r.code,
    name: r.name,
    industry: r.industry ?? "",
    channel: r.channel,
    close: r.close,
    pe_ttm: r.pe,
    pb: r.pb,
    dv_ttm: r.dv,
    roe_waa: r.roe,
    gross_margin: r.grossMargin,
    debt_to_assets: r.debtRatio,
    fcf_yield: r.fcfYield,
    fcf_margin: undefined,
    R: f.penetrationR,
    ev_ebitda: f.evEbitda,
    floor_premium: f.floorPremium,
    composite_score: r.screenerScore,
    tier1_score: r.tier1Score,
    decision: r.decision,
    passed: r.passed,
    quality_passed: r.qualityPassed,
    veto_reason: r.vetoReason ?? "",
  };
}

/** 输入宇宙快照（Python bulk 导出风格）。 */
export function exportScreenerUniverseCsv(rows: ScreenerUniverseRow[]): string {
  const headers = [
    "code",
    "name",
    "market",
    "industry",
    "list_date",
    "close",
    "pe",
    "pb",
    "dv",
    "market_cap_mm",
    "turnover_pct",
    "pledge_ratio",
    "audit_result",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    const rec: Record<string, unknown> = {
      code: row.code,
      name: row.name,
      market: row.market,
      industry: row.industry ?? "",
      list_date: row.listDate ?? "",
      close: row.close,
      pe: row.pe,
      pb: row.pb,
      dv: row.dv,
      market_cap_mm: row.marketCap,
      turnover_pct: row.turnover,
      pledge_ratio: row.pledgeRatio,
      audit_result: row.auditResult ?? "",
    };
    lines.push(headers.map((h) => cell(rec[h])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function exportScreenerResultsCsv(output: ScreenerRunOutput): string {
  const lines = [([...SCREENER_RESULTS_CSV_COLUMNS] as string[]).join(",")];
  for (const r of output.results) {
    const rec = rowToResultRecord(r);
    lines.push(SCREENER_RESULTS_CSV_COLUMNS.map((c) => cell(rec[c])).join(","));
  }
  return `${lines.join("\n")}\n`;
}
