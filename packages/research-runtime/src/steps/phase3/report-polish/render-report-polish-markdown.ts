import type { ReportPolishComposeBuffers, ReportViewModelV1 } from "./report-view-model.js";
import { renderValuationComputedMarkdownFromJson } from "../../../reports-site/valuation-computed-markdown.js";

function fmtNum(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const digits = abs >= 100 ? 2 : abs >= 10 ? 2 : 4;
  return n.toLocaleString("zh-CN", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

function decisionZh(d: string): string {
  if (d === "buy") return "买入/关注（buy）";
  if (d === "watch") return "观察（watch）";
  if (d === "avoid") return "回避（avoid）";
  return d;
}

function extractBetweenHeadings(md: string, startRe: RegExp, endRe: RegExp): string | undefined {
  const m = md.match(startRe);
  if (!m || m.index === undefined) return undefined;
  const from = m.index + m[0].length;
  const rest = md.slice(from);
  const end = rest.search(endRe);
  const body = (end >= 0 ? rest.slice(0, end) : rest).trim();
  return body || undefined;
}

function clip(md: string, max: number): string {
  const t = md.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n> …… 已截断；全文见同目录证据文件。`;
}

function evidenceTable(vm: ReportViewModelV1): string {
  const e = vm.evidence;
  const rows: string[] = [
    "| 证据 | 相对路径 |",
    "|:-----|:---------|",
    `| Phase1A 数据包 | \`${e.phase1aJsonRelative}\` |`,
    `| 市场数据包 | \`${e.dataPackMarketMdRelative}\` |`,
    `| Phase1B 外部证据稿 | \`${e.phase1bQualitativeMdRelative}\` |`,
  ];
  if (e.dataPackReportMdRelative) rows.push(`| 年报 data_pack | \`${e.dataPackReportMdRelative}\` |`);
  if (e.dataPackReportInterimMdRelative) rows.push(`| 中报 data_pack | \`${e.dataPackReportInterimMdRelative}\` |`);
  rows.push(`| 估值 JSON | \`${e.valuationComputedJsonRelative}\` |`);
  rows.push(`| Phase3 报告 | \`${e.analysisReportMdRelative}\` |`);
  if (e.phase3PreflightMdRelative) rows.push(`| Phase3 预检 | \`${e.phase3PreflightMdRelative}\` |`);
  return rows.join("\n");
}

function todoBlock(vm: ReportViewModelV1): string {
  if (!vm.todos.length) return "_（本 run 无显式 TODO 缺口项）_";
  return vm.todos.map((t) => `- **${t.id}**：${t.message}${t.suggestedSource ? ` → \`${t.suggestedSource}\`` : ""}`).join("\n");
}

/** 对齐「中国移动 · 龟龟投资策略分析」信息顺序：标题 → 摘要 → 结论 → 证据 → 专题导航 */
export function renderTurtleOverviewMarkdown(vm: ReportViewModelV1, buffers: ReportPolishComposeBuffers): string {
  const name = vm.displayCompanyName ?? vm.market.name ?? vm.normalizedCode;
  const exec = extractBetweenHeadings(
    buffers.analysisReportMarkdown,
    /^##\s*一[、.]\s*Executive Summary/im,
    /^##\s*[二三四五六七八九十]/m,
  );
  const lines = [
    `# ${name}（${vm.normalizedCode}）· 龟龟投资策略分析`,
    "",
    "> **证据同源**：本页仅重组与润色可读性；数值与结论以同 run 下 `analysis_report.md` / `data_pack_*.md` / `valuation_computed.json` 为准，不得超证据扩写。",
    "",
    "## 执行摘要",
    "",
    exec
      ? clip(exec, 12000)
      : "_TODO：未在 `analysis_report.md` 中匹配到「一、Executive Summary」章节，请人工核对标题层级。_",
    "",
    "## 投资结论（结构化）",
    "",
    `- **规则结论（Phase3）**：${decisionZh(vm.phase3.decision)}；**置信度**：${vm.phase3.confidence}；**报告模式**：${vm.phase3.reportMode ?? "full"}`,
    `- **穿透（粗算 R / 精算 GG）**：R=${fmtNum(vm.phase3.factor2?.R)}；II=${fmtNum(vm.phase3.factor2?.II)}；GG=${fmtNum(vm.phase3.factor3?.GG)}；外推信任=${vm.phase3.factor3?.extrapolationTrust ?? "—"}`,
    `- **估值合成（valuation_computed）**：方法数=${vm.valuation.methodCount}；加权=${fmtNum(vm.valuation.weightedAverage)}；CV=${fmtNum(vm.valuation.coefficientOfVariation)}`,
    `- **陷阱风险（因子4）**：${vm.phase3.factor4?.trapRisk ?? "—"}；**仓位建议**：${vm.phase3.factor4?.position ?? "—"}`,
    "",
    "## 证据索引（本 run）",
    "",
    evidenceTable(vm),
    "",
    "## 多页研报导航",
    "",
    "- [商业质量评估](./business_quality.md)",
    "- [穿透回报率定量分析](./penetration_return.md)",
    "- [估值分析](./valuation.md)",
    "",
    "## 缺口与 TODO",
    "",
    todoBlock(vm),
    "",
  ];
  return lines.join("\n");
}

/** 对齐「商业质量评估」：定性证据优先 Phase1B，其次 Phase3 因子1B 摘录 */
export function renderBusinessQualityMarkdown(vm: ReportViewModelV1, buffers: ReportPolishComposeBuffers): string {
  const name = vm.displayCompanyName ?? vm.market.name ?? vm.normalizedCode;
  const f1b = extractBetweenHeadings(
    buffers.analysisReportMarkdown,
    /^##\s*三[、.]\s*因子1B/im,
    /^##\s*[四五六七八九十]/m,
  );
  const p1bBody = clip(buffers.phase1bMarkdown, 45000);
  const lines = [
    `# ${name}（${vm.normalizedCode}）· 商业质量评估`,
    "",
    "> **边界**：商业质量叙事仅基于 `phase1b_qualitative.md` 与 Phase3 报告中因子 1B 摘录；**非** `business-analysis:run` 的六维终稿（`qualitative_report.md`）除非你在同目录自行提供。",
    "",
    "## 数据与门禁摘要",
    "",
    `- **Phase1B 篇幅**：${vm.phase1b.charCount} 字符；首行：${vm.phase1b.leadLine ?? "—"}`,
    `- **年报包**：${vm.dataPackReport.present ? `已挂载；PDF gate=\`${vm.dataPackReport.pdfGateVerdict ?? "未解析"}\`` : "**缺失** — 不得推断章节置信"}`,
    "",
    "## Phase1B：外部证据补充稿",
    "",
    p1bBody || "_（空）_",
    "",
    "## Phase3 · 因子1B（报告内摘录）",
    "",
    f1b
      ? clip(f1b, 20000)
      : "_TODO：未在 `analysis_report.md` 找到「三、因子1B」章节；若策略模板变更请调整 extractor。_",
    "",
    "## 证据路径",
    "",
    evidenceTable(vm),
    "",
    "## TODO",
    "",
    todoBlock(vm),
    "",
  ];
  return lines.join("\n");
}

/** 对齐「穿透回报率定量」：市场表 + Phase3 因子2/3 相关段落 */
export function renderPenetrationReturnMarkdown(vm: ReportViewModelV1, buffers: ReportPolishComposeBuffers): string {
  const name = vm.displayCompanyName ?? vm.market.name ?? vm.normalizedCode;
  const f2 = extractBetweenHeadings(
    buffers.analysisReportMarkdown,
    /^##\s*四[、.]\s*因子2/im,
    /^##\s*[五六七八九十]/m,
  );
  const f3 = extractBetweenHeadings(
    buffers.analysisReportMarkdown,
    /^##\s*五[、.]\s*因子3/im,
    /^##\s*[六七八九十]/m,
  );
  const lines = [
    `# ${name}（${vm.normalizedCode}）· 穿透回报率定量分析`,
    "",
    "> **边界**：粗算与精算口径以 Phase3 规则与 `analysis_report.md` 为准；市场输入引用 `data_pack_market.md`。",
    "",
    "## 市场输入摘要",
    "",
    `- **价格 / 市值 / 股本**：${fmtNum(vm.market.price)} / ${fmtNum(vm.market.marketCap)} / ${fmtNum(vm.market.totalShares)}`,
    `- **无风险利率 rf（解析值）**：${fmtNum(vm.market.riskFreeRate)}`,
    `- **市场警告条数**：${vm.market.warningsCount}`,
    "",
    "## 市场数据包（节选）",
    "",
    clip(buffers.marketPackMarkdown, 25000),
    "",
    "## Phase3 · 因子2（粗算穿透）",
    "",
    f2
      ? clip(f2, 20000)
      : "_TODO：未匹配到「四、因子2」章节。_",
    "",
    "## Phase3 · 因子3（精算穿透）",
    "",
    f3
      ? clip(f3, 20000)
      : "_TODO：未匹配到「五、因子3」章节。_",
    "",
    "## 证据路径",
    "",
    evidenceTable(vm),
    "",
    "## TODO",
    "",
    todoBlock(vm),
    "",
  ];
  return lines.join("\n");
}

/** 对齐「估值分析」：valuation 表 + 可选中报包节选 */
export function renderValuationTopicMarkdown(vm: ReportViewModelV1, buffers: ReportPolishComposeBuffers): string {
  const name = vm.displayCompanyName ?? vm.market.name ?? vm.normalizedCode;
  const valBlock = renderValuationComputedMarkdownFromJson(buffers.valuationRawJson);
  const interim = buffers.interimDataPackMarkdown?.trim();
  const lines = [
    `# ${name}（${vm.normalizedCode}）· 估值分析`,
    "",
    "> **边界**：估值表由 `valuation_computed.json` 机械渲染；叙事不得引入 JSON 中不存在的假设。",
    "",
    "## 摘要",
    "",
    `- **WACC / Ke**：${fmtNum(vm.valuation.wacc)} / ${fmtNum(vm.valuation.ke)}`,
    `- **公司画像（引擎）**：${vm.valuation.companyType ?? "—"}`,
    `- **方法数 / 加权 / CV**：${vm.valuation.methodCount} / ${fmtNum(vm.valuation.weightedAverage)} / ${fmtNum(vm.valuation.coefficientOfVariation)}`,
    "",
    valBlock,
    "",
    ...(interim
      ? [
          "## 中报证据（节选）",
          "",
          "> 来自 `data_pack_report_interim.md`（若本 run 生成中报流水线）。",
          "",
          clip(interim, 12000),
          "",
        ]
      : [
          "## 中报证据",
          "",
          "_TODO：本 run 未挂载 `data_pack_report_interim.md`；若需要中报对齐，请传入 interim 流水线产物。_",
          "",
        ]),
    "## 证据路径",
    "",
    evidenceTable(vm),
    "",
    "## TODO",
    "",
    todoBlock(vm),
    "",
  ];
  return lines.join("\n");
}

export function renderAllReportPolishMarkdowns(
  vm: ReportViewModelV1,
  buffers: ReportPolishComposeBuffers,
): {
  turtleOverviewMarkdown: string;
  businessQualityMarkdown: string;
  penetrationReturnMarkdown: string;
  valuationMarkdown: string;
} {
  return {
    turtleOverviewMarkdown: renderTurtleOverviewMarkdown(vm, buffers),
    businessQualityMarkdown: renderBusinessQualityMarkdown(vm, buffers),
    penetrationReturnMarkdown: renderPenetrationReturnMarkdown(vm, buffers),
    valuationMarkdown: renderValuationTopicMarkdown(vm, buffers),
  };
}
