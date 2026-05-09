/**
 * 商业质量页（workflow report-polish）发布前质量门禁：数值密度与商业模式字段。
 */

export type BusinessQualityPublishGateResult = {
  passed: boolean;
  d1SectionCharCount: number;
  d1DigitCount: number;
  numericDensity: number;
  reasons: string[];
};

export type BusinessQualityHardBlockResult = {
  blocked: boolean;
  reasons: string[];
};

function extractMarketPackSection13(md: string): string {
  const headingRe = /^##\s+§13\s+Warnings[^\n]*\n/mu;
  const m = md.match(headingRe);
  if (!m || m.index === undefined) return "";
  const rest = md.slice(m.index);
  const next = rest.slice(m[0].length).search(/^##\s+/mu);
  return (next >= 0 ? rest.slice(0, m[0].length + next) : rest).trim();
}

function extractWarningLinesFromMarketPack(markdown: string): string[] {
  const section = extractMarketPackSection13(markdown);
  return section
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ["))
    .slice(0, 12);
}

export function extractD1Section(markdown: string): string {
  const start = markdown.search(/^##\s*维度一[:：]?\s*商业模式/mu);
  if (start < 0) return "";
  const rest = markdown.slice(start);
  const end = rest.search(/^##\s*维度二/mu);
  return (end >= 0 ? rest.slice(0, end) : rest).trim();
}

function countDigits(s: string): number {
  return (s.match(/\d/g) ?? []).length;
}

export type EvaluateBusinessQualityPublishGateOptions = {
  /** view-model 中应已写入 `businessModel`（编排层） */
  hasBusinessModel?: boolean;
};

/** 与计划一致：D1 段数字符密度、最少数字个数 */
export function evaluateBusinessQualityPublishGate(
  markdown: string,
  opts?: EvaluateBusinessQualityPublishGateOptions,
): BusinessQualityPublishGateResult {
  const d1 = extractD1Section(markdown);
  const d1SectionCharCount = d1.length;
  const d1DigitCount = countDigits(d1);
  const numericDensity = d1SectionCharCount > 0 ? d1DigitCount / d1SectionCharCount : 0;
  const reasons: string[] = [];
  if (d1SectionCharCount < 200) reasons.push("D1 段落过短，可能未生成数据化内容");
  if (d1DigitCount < 8) reasons.push(`D1 数字个数不足（当前 ${d1DigitCount}，门槛 8）`);
  if (numericDensity < 0.05) reasons.push(`D1 数值密度不足（当前 ${(numericDensity * 100).toFixed(2)}%，门槛 5%）`);
  if (!/商业模式判定|收入质量分解|利润质量分解|资本消耗|现金转换|监控阈值/u.test(d1)) {
    reasons.push("D1 缺少计划要求的结构化小节标题");
  }
  const monitorChunk = d1.split(/###\s*监控阈值[^\n]*/u)[1]?.split(/^###\s+/mu)[0] ?? "";
  const monitorDataRows = monitorChunk
    .split(/\r?\n/u)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|") && !/^:?-{2,}/u.test(l) && !/^\|\s*指标\s*\|/u.test(l))
    .filter(
      (l) =>
        /\d/u.test(l) &&
        (/[<>＜＞≥≤]/.test(l) || /连续\s*\d/u.test(l) || /\d+\s*pct/u.test(l) || /倍|×/u.test(l)),
    );
  if (monitorDataRows.length < 3) {
    reasons.push(
      `监控阈值表中带数值门槛的数据行不足（当前 ${monitorDataRows.length}，门槛 3；须含如 <5%、>1.2× 等可执行阈值）`,
    );
  }
  if (opts?.hasBusinessModel === false) {
    reasons.push("report_view_model 缺少 businessModel 字段");
  }
  const passed = reasons.length === 0;
  return { passed, d1SectionCharCount, d1DigitCount, numericDensity, reasons };
}

/**
 * 计划 3.3：多年外推/关键估算或 PDF CRITICAL 时，D1 必须显式降级披露，否则阻断发布。
 */
export function evaluateBusinessQualityPublicationHardBlock(
  markdown: string,
  marketPackMarkdown: string,
  pdfGateVerdict?: string,
): BusinessQualityHardBlockResult {
  const d1 = extractD1Section(markdown);
  const warnings = extractWarningLinesFromMarketPack(marketPackMarkdown);
  const replicated = warnings.some((w) => /外推复制|不足\s*2\s*个独立财年/u.test(w));
  const estimatedByRule = warnings.some((w) =>
    /规则=capex_ocf_20pct|规则=interest_bearing_debt_tl_0_4|规则=cash_and_equiv_ta_0_1/u.test(w),
  );
  const reasons: string[] = [];
  const needsDowngradeNarrative = replicated || estimatedByRule || pdfGateVerdict === "CRITICAL";
  if (!needsDowngradeNarrative) return { blocked: false, reasons: [] };

  const hasExplicitDowngrade =
    /方向性|降级|数据质量|证据边界|谨慎语气|CRITICAL|抽取质量|外推|估算规则|趋势结论降级/u.test(d1);
  if (!hasExplicitDowngrade) {
    reasons.push(
      "命中多年外推复制/关键估算规则或 PDF CRITICAL，但 D1 未写明降级与证据边界（须阻断或重写 D1）",
    );
  }
  return { blocked: reasons.length > 0, reasons };
}
