import type { ConfidenceState } from "../types.js";
import type { EvidenceRetrievalSummary } from "./evidence-summary.js";
import type { PdfQualitySummary } from "./pdf-quality.js";
import { businessQualityLabel, evidenceStatusLabel } from "./confidence.js";

export function renderQualitySnapshot(input: {
  confidence: ConfidenceState;
  pdfQuality: PdfQualitySummary;
  evidence: EvidenceRetrievalSummary;
}): string {
  const gate = input.pdfQuality.gateVerdict ?? "UNKNOWN";
  const gateLabel =
    gate === "OK" ? "完整可用" : gate === "DEGRADED" ? "降级可用" : gate === "CRITICAL" ? "关键缺失" : "未识别";
  const low = input.pdfQuality.lowConfidenceCritical?.length
    ? input.pdfQuality.lowConfidenceCritical.join(", ")
    : "无";
  return [
    "## Quality Snapshot",
    "",
    "| 项目 | 状态 |",
    "|:-----|:-----|",
    `| 商业质量 | ${businessQualityLabel(input)} |`,
    `| 最终置信度 | ${input.confidence === "high" ? "高" : input.confidence === "medium" ? "中" : input.confidence === "low" ? "低" : "未知"} |`,
    `| 年报抽取质量 | ${gateLabel}；低置信关键块：${low} |`,
    `| 监管证据状态 | ${evidenceStatusLabel(input.evidence)} |`,
    `| 证据完整度 | ${input.evidence.missingItems.length > 0 ? "存在需补充核验项，详见文末证据质量表" : "关键事项已完成基础核验"} |`,
  ].join("\n");
}

export function renderEvidenceQualitySection(input: {
  pdfQuality: PdfQualitySummary;
  evidence: EvidenceRetrievalSummary;
}): string {
  const rows = [
    "## 证据质量与限制",
    "",
    "| 项目 | 说明 |",
    "|:-----|:-----|",
  ];
  const gate = input.pdfQuality.gateVerdict ?? "UNKNOWN";
  const gateLabel =
    gate === "OK" ? "完整可用" : gate === "DEGRADED" ? "降级可用" : gate === "CRITICAL" ? "关键缺失" : "未识别";
  const low = input.pdfQuality.lowConfidenceCritical?.length ? input.pdfQuality.lowConfidenceCritical.join("、") : "无";
  const missingPdf = input.pdfQuality.missingCritical?.length ? input.pdfQuality.missingCritical.join("、") : "无";
  rows.push(`| 年报抽取 | ${gateLabel}；低置信关键块：${low}；缺失关键块：${missingPdf} |`);
  rows.push(`| 人工复核优先级 | ${input.pdfQuality.humanReviewPriority?.length ? input.pdfQuality.humanReviewPriority.join("、") : "无"} |`);
  rows.push(
    `| 公司监管事件 | ${
      input.evidence.hasConfirmedCriticalEvent
        ? "已形成需跟踪的确认事件。"
        : input.evidence.hasCriticalGap
          ? "关键事项仍需补充核验。"
          : "交易所/巨潮官方源未形成确认事件。"
    } |`,
  );
  rows.push(
    `| 开放信息 | ${
      input.evidence.webSearchUsed
        ? "仅作为背景补充；不作为监管、估值或财务核心证据。"
        : "未启用或未触发。"
    } |`,
  );
  rows.push("| 结论边界 | “未形成确认事件”不是法律尽调结论；若用于合规尽调，应另接专源核验。 |");
  return rows.join("\n");
}
