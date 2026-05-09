import type { ConfidenceState, RequiredFieldsStatus } from "../types.js";
import type { FinalNarrativeStatus } from "../../runtime/business-analysis/final-narrative-status.js";
import type { EvidenceRetrievalSummary } from "./evidence-summary.js";
import type { PdfQualitySummary } from "./pdf-quality.js";

export function deriveBusinessAnalysisConfidence(input: {
  status: RequiredFieldsStatus;
  finalNarrativeStatus: FinalNarrativeStatus;
  pdfQuality: PdfQualitySummary;
  evidence: EvidenceRetrievalSummary;
}): ConfidenceState {
  if (input.finalNarrativeStatus === "blocked" || input.status === "missing") return "unknown";
  if (input.finalNarrativeStatus !== "complete" || input.status === "degraded") return "low";
  if (input.pdfQuality.gateVerdict === "CRITICAL") return "low";
  if (input.pdfQuality.gateVerdict === "DEGRADED") return "medium";
  if (input.evidence.hasCriticalGap || input.evidence.hasConfirmedCriticalEvent) return "medium";
  return "high";
}

export function evidenceStatusLabel(evidence: EvidenceRetrievalSummary): string {
  if (evidence.webSearchLimited && evidence.missingItems.length > 0) {
    return "官方信息已优先核验；部分开放信息未形成关键反证";
  }
  if (evidence.hasConfirmedCriticalEvent) return "已确认关键监管事件，需跟踪最终结论";
  if (evidence.hasCriticalGap) return "关键合规事项仍需补充核验";
  if (evidence.webSearchUsed) return "官方信息与开放信息已完成交叉核验";
  return "官方信息已完成基础核验";
}

export function businessQualityLabel(input: {
  confidence: ConfidenceState;
  evidence: EvidenceRetrievalSummary;
}): string {
  if (input.evidence.hasConfirmedCriticalEvent) return "偏弱/观察";
  if (input.evidence.hasCriticalGap || input.confidence === "low" || input.confidence === "unknown") return "待验证";
  if (input.confidence === "medium") return "观察";
  return "较强";
}
