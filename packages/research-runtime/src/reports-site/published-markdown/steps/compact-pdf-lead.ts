import type { MarkdownTransform } from "../pipeline.js";

export const compactPdfLead: MarkdownTransform = (markdown, ctx) => {
  const gate = ctx.pdfQuality.gateVerdict;
  if (gate !== "DEGRADED" && gate !== "CRITICAL") return markdown.trim();
  const low = ctx.pdfQuality.lowConfidenceCritical?.length ? ctx.pdfQuality.lowConfidenceCritical.join(", ") : "部分章节";
  const label = gate === "CRITICAL" ? "关键章节缺失" : "降级可用";
  const short = `> 证据质量：年报抽取${label}，${low} 需复核；本文已按较保守口径处理。`;
  return markdown
    .replace(/^>\s*PDF 抽取质量声明：.*(?:\r?\n)?/mu, `${short}\n`)
    .trim();
};
