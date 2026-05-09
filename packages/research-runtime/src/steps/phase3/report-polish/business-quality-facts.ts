/**
 * 从 `data_pack_market.md` 抽取商业质量 D1 所需的多年财务事实（确定性解析）。
 * 与 `market-pack-parser.ts` 的 §3~§5 解析互补：补充 §17/§18/§19 等按年首列表格。
 */
import type { FinancialYearData } from "../types.js";
import { parseDataPackMarket } from "../market-pack-parser.js";

export type YearFinancialExtended = FinancialYearData & {
  fcf?: number;
  netMarginPct?: number;
  payoutPct?: number;
  leveragePct?: number;
  debtToAssetsPct?: number;
  grossMarginPct?: number;
  salesExpenseRatioPct?: number;
  adminExpenseRatioPct?: number;
  rdExpenseRatioPct?: number;
  financialExpenseRatioPct?: number;
  accountsReceivable?: number;
  inventory?: number;
  accountsPayable?: number;
  arDays?: number;
  invDays?: number;
  apDays?: number;
  cccDays?: number;
  ocfToNetProfit?: number;
  fcfMarginPct?: number;
};

export type BusinessSegmentRow = {
  category: string;
  label: string;
  summary: string;
};

export type PeerComparisonRow = {
  code: string;
  name?: string;
  revenueAllYear?: number;
  parentNiAllYear?: number;
};

export type BusinessQualityFacts = {
  /** 合并后的按年数据（降序年） */
  byYear: YearFinancialExtended[];
  /** §20 经营信号摘录（最多 N 条） */
  segmentRows: BusinessSegmentRow[];
  /** 同业可比（来自 Phase1A 摘要，非全市场） */
  peerRows: PeerComparisonRow[];
  /** 原始市场包 industry 行 */
  industryLabel?: string;
  /** §13 是否含外推复制告警 */
  hasReplicatedFinancialHistory: boolean;
  /** §13 是否含关键估算规则 */
  hasCriticalEstimateRules: boolean;
};

function toNumberCell(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replaceAll(",", "").replace(/[\s ]/g, "").replace(/%/g, "");
  const matched = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!matched) return undefined;
  const value = Number(matched[0]);
  return Number.isFinite(value) ? value : undefined;
}

function extractSection(markdown: string, headingRe: RegExp): string {
  const m = markdown.match(headingRe);
  if (!m || m.index === undefined) return "";
  const rest = markdown.slice(m.index);
  const next = rest.slice(m[0].length).search(/^##\s+/mu);
  return (next >= 0 ? rest.slice(0, m[0].length + next) : rest).trim();
}

/**
 * 解析「首列为年度」的多年表：`| 2024 | v1 | v2 |`
 */
function normalizeHeaderKey(h: string): string {
  return h
    .replace(/\(%\)/gu, "")
    .replace(/%/gu, "")
    .replace(/\//gu, "")
    .replace(/\s+/gu, "")
    .trim();
}

function parseYearLeadingTable(section: string): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();
  const lines = section.split(/\r?\n/u);
  let headers: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith("|")) continue;
    if (!line.endsWith("|")) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length < 2) continue;
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
    const y0 = cells[0]?.match(/^20\d{2}$/);
    if (!y0 && headers.length === 0) {
      if (cells[0] !== "年度" && cells[0] !== "年份" && !/^[A-Za-z\u4e00-\u9fa5]/u.test(cells[0] ?? "")) continue;
      headers = cells.map((h) => normalizeHeaderKey(h));
      continue;
    }
    if (headers.length === 0) continue;
    const year = cells[0]?.match(/^20\d{2}$/)?.[0];
    if (!year) continue;
    const row: Record<string, number> = {};
    for (let i = 1; i < cells.length && i < headers.length; i += 1) {
      const key = headers[i] ?? `col${i}`;
      const v = toNumberCell(cells[i]);
      if (v !== undefined) row[key] = v;
    }
    if (Object.keys(row).length > 0) out.set(year, { ...(out.get(year) ?? {}), ...row });
  }
  return out;
}

function mergeYearMaps(
  base: Map<string, YearFinancialExtended>,
  ext: Map<string, Record<string, number>>,
  fieldMap: Record<string, keyof YearFinancialExtended>,
): void {
  for (const [year, row] of ext) {
    const cur = base.get(year) ?? { year };
    for (const [col, key] of Object.entries(fieldMap)) {
      const v = row[col];
      if (v !== undefined) (cur as unknown as Record<string, unknown>)[key as string] = v;
    }
    base.set(year, cur);
  }
}

function parseSection20Rows(markdown: string): BusinessSegmentRow[] {
  const sec = extractSection(markdown, /^##\s+§20\s+主营业务画像[^\n]*\n/mu);
  if (!sec) return [];
  const rows: BusinessSegmentRow[] = [];
  for (const line of sec.split(/\r?\n/u)) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 4) continue;
    if (cells[0] === "类别" || cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
    const [category, label, summary] = [cells[0], cells[1], cells[2]];
    if (category && label && summary && summary.length > 8) {
      rows.push({
        category,
        label,
        summary: summary.replace(/\|/g, "/").slice(0, 280),
      });
    }
  }
  return rows.slice(0, 8);
}

function buildWarningsFlags(markdown: string): { replicated: boolean; criticalEstimate: boolean } {
  const sec = extractSection(markdown, /^##\s+§13\s+Warnings[^\n]*\n/mu);
  const text = sec || markdown;
  return {
    replicated: /外推复制|不足\s*2\s*个独立财年/u.test(text),
    criticalEstimate: /规则=capex_ocf_20pct|规则=interest_bearing_debt_tl_0_4|规则=cash_and_equiv_ta_0_1/u.test(text),
  };
}

/**
 * 从市场包 Markdown + 可选同业列表构建事实包。
 */
export function buildBusinessQualityFacts(
  marketPackMarkdown: string,
  peerRows: PeerComparisonRow[],
): BusinessQualityFacts {
  const parsed = parseDataPackMarket(marketPackMarkdown);
  const baseMap = new Map<string, YearFinancialExtended>();
  for (const row of parsed.financials) {
    baseMap.set(row.year, { ...row });
  }

  const s17 = extractSection(marketPackMarkdown, /^##\s+§17\s+衍生指标[^\n]*\n/mu);
  const map17 = parseYearLeadingTable(s17);
  mergeYearMaps(baseMap, map17, {
    FCF: "fcf",
    净利率: "netMarginPct",
    "DPS/EPS": "payoutPct",
    资产负债率: "leveragePct",
    有息负债总资产: "debtToAssetsPct",
  });

  const s18 = extractSection(marketPackMarkdown, /^##\s+§18\s+费用率趋势[^\n]*\n/mu);
  const map18 = parseYearLeadingTable(s18);
  mergeYearMaps(baseMap, map18, {
    毛利率: "grossMarginPct",
    销售费用率: "salesExpenseRatioPct",
    管理费用率: "adminExpenseRatioPct",
    研发费用率: "rdExpenseRatioPct",
    财务费用率: "financialExpenseRatioPct",
  });

  const s19 = extractSection(marketPackMarkdown, /^##\s+§19\s+营运资本与现金转换周期[^\n]*\n/mu);
  const map19 = parseYearLeadingTable(s19);
  mergeYearMaps(baseMap, map19, {
    应收账款: "accountsReceivable",
    存货: "inventory",
    应付账款: "accountsPayable",
    应收天数: "arDays",
    存货天数: "invDays",
    应付天数: "apDays",
    CCC天数: "cccDays",
    OCF净利润: "ocfToNetProfit",
    FCFMargin: "fcfMarginPct",
  });

  const byYear = [...baseMap.values()].sort((a, b) => String(b.year).localeCompare(String(a.year)));
  const flags = buildWarningsFlags(marketPackMarkdown);

  return {
    byYear,
    segmentRows: parseSection20Rows(marketPackMarkdown),
    peerRows: peerRows.slice(0, 8),
    industryLabel: parsed.industry,
    hasReplicatedFinancialHistory: flags.replicated,
    hasCriticalEstimateRules: flags.criticalEstimate,
  };
}

/** 最近两年营收 YoY（%），缺一则 undefined */
export function revenueYoYPercent(facts: BusinessQualityFacts): number | undefined {
  const ys = facts.byYear;
  if (ys.length < 2) return undefined;
  const [a, b] = [ys[0], ys[1]];
  const r0 = a.revenue;
  const r1 = b.revenue;
  if (r0 === undefined || r1 === undefined || r1 === 0) return undefined;
  return ((r0 - r1) / Math.abs(r1)) * 100;
}

export function netProfitYoYPercent(facts: BusinessQualityFacts): number | undefined {
  const ys = facts.byYear;
  if (ys.length < 2) return undefined;
  const [a, b] = [ys[0], ys[1]];
  const n0 = a.netProfit;
  const n1 = b.netProfit;
  if (n0 === undefined || n1 === undefined || n1 === 0) return undefined;
  return ((n0 - n1) / Math.abs(n1)) * 100;
}

export function ocfToNiForLatest(facts: BusinessQualityFacts): number | undefined {
  const y = facts.byYear[0];
  if (!y) return undefined;
  if (y.ocfToNetProfit !== undefined) return y.ocfToNetProfit;
  const ocf = y.ocf;
  const ni = y.netProfit;
  if (ocf === undefined || ni === undefined || ni === 0) return undefined;
  return ocf / ni;
}

export function capexToDaProxy(facts: BusinessQualityFacts): number | undefined {
  const y = facts.byYear[0];
  if (!y?.capex || !y.netProfit) return undefined;
  const da = Math.max(1, Math.abs(y.netProfit) * 0.15);
  return Math.abs(y.capex) / da;
}
