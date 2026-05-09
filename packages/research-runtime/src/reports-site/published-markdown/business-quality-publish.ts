import type { ConfidenceState } from "../types.js";
import type { FinalNarrativeStatus } from "../../runtime/business-analysis/final-narrative-status.js";
import type { EvidenceRetrievalSummary } from "./evidence-summary.js";
import type { PdfQualitySummary } from "./pdf-quality.js";
import { renderEvidenceQualitySection, renderQualitySnapshot } from "./business-quality-views.js";
import { applyPipeline, type MarkdownTransform, type PublishContext } from "./pipeline.js";
import { compactPdfLead } from "./steps/compact-pdf-lead.js";
import { moveEvidenceGapsBeforeAppendix } from "./steps/move-evidence-gaps.js";
import { normalizeRegulatorySection } from "./steps/normalize-regulatory.js";
import { rewriteProse } from "./steps/rewrite-prose.js";
import { stripExistingEvidenceQuality } from "./steps/strip-existing-evidence-quality.js";
import { stripFinalStatus } from "./steps/strip-final-status.js";

export const BUSINESS_QUALITY_PUBLISH_PIPELINE: MarkdownTransform[] = [
  stripFinalStatus,
  compactPdfLead,
  rewriteProse,
  stripExistingEvidenceQuality,
  normalizeRegulatorySection,
  moveEvidenceGapsBeforeAppendix,
];

function splitEvidenceAppendix(markdown: string): { body: string; appendix: string } {
  const idx = markdown.search(/^##\s+附录：证据索引\s*$/imu);
  if (idx < 0) return { body: markdown.trim(), appendix: "" };
  return {
    body: markdown.slice(0, idx).trim(),
    appendix: markdown.slice(idx).trim(),
  };
}

function hasD1D6Sections(markdown: string): boolean {
  return ["D1", "D2", "D3", "D4", "D5", "D6"].every((d) =>
    new RegExp(`^##\\s+${d}\\b`, "imu").test(markdown),
  );
}

function hasQualitySnapshot(markdown: string): boolean {
  return /^##\s+Quality Snapshot\s*$/imu.test(markdown);
}

export function renderBusinessAnalysisPublishedMarkdown(input: {
  qualitativeReportMarkdown: string;
  qualitativeD1D6Markdown: string;
  finalNarrativeStatus: FinalNarrativeStatus;
  confidence: ConfidenceState;
  pdfQuality: PdfQualitySummary;
  evidence: EvidenceRetrievalSummary;
}): string {
  const ctx: PublishContext = {
    pdfQuality: input.pdfQuality,
    evidence: input.evidence,
    finalNarrativeStatus: input.finalNarrativeStatus,
  };

  const q = applyPipeline(input.qualitativeReportMarkdown, ctx, BUSINESS_QUALITY_PUBLISH_PIPELINE);
  const d = applyPipeline(input.qualitativeD1D6Markdown, ctx, BUSINESS_QUALITY_PUBLISH_PIPELINE);
  const qSplit = splitEvidenceAppendix(q);
  const dSplit = splitEvidenceAppendix(d);
  const qBody = hasQualitySnapshot(qSplit.body)
    ? qSplit.body
    : qSplit.body.replace(/^(# .+?\n(?:> .+?\n)?)/u, `$1\n${renderQualitySnapshot(input)}\n`);
  const sections = [qBody];
  if (input.finalNarrativeStatus === "complete" && dSplit.body && !hasD1D6Sections(qSplit.body)) {
    sections.push(["## 六维深度分析", "", dSplit.body].join("\n"));
  }
  sections.push(renderEvidenceQualitySection(input));
  if (qSplit.appendix) {
    sections.push(qSplit.appendix);
  } else if (dSplit.appendix) {
    sections.push(dSplit.appendix);
  }
  return applyPipeline(
    sections
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n\n"),
    ctx,
    [rewriteProse],
  );
}
