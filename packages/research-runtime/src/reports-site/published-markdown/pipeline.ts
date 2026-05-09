import type { FinalNarrativeStatus } from "../../runtime/business-analysis/final-narrative-status.js";
import type { ReportPolishComposeBuffers, ReportViewModelV1 } from "../../steps/phase3/report-polish/report-view-model.js";
import type { EvidenceRetrievalSummary } from "./evidence-summary.js";
import type { PdfQualitySummary } from "./pdf-quality.js";

export type PublishContext = {
  pdfQuality: PdfQualitySummary;
  evidence?: EvidenceRetrievalSummary;
  viewModel?: ReportViewModelV1;
  buffers?: ReportPolishComposeBuffers;
  finalNarrativeStatus?: FinalNarrativeStatus;
};

export type MarkdownTransform = (md: string, ctx: PublishContext) => string;

export function applyPipeline(md: string, ctx: PublishContext, steps: MarkdownTransform[]): string {
  return steps.reduce((acc, step) => step(acc, ctx), md);
}
