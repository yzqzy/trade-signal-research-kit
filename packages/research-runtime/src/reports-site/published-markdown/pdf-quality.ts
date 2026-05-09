export type PdfQualitySummary = {
  gateVerdict?: "OK" | "DEGRADED" | "CRITICAL" | string;
  lowConfidenceCritical?: string[];
  missingCritical?: string[];
  allowsFinalNarrativeComplete?: boolean;
  humanReviewPriority?: string[];
};

export function parsePdfQualitySummary(markdown: string | undefined): PdfQualitySummary {
  if (!markdown?.trim()) return {};
  const m = markdown.match(/<!--\s*PDF_EXTRACT_QUALITY:(\{[\s\S]*?\})\s*-->/u);
  if (m?.[1]) {
    try {
      return JSON.parse(m[1]) as PdfQualitySummary;
    } catch {
      /* fall through */
    }
  }
  const gate = markdown.match(/gateVerdict["`:\s=]+(OK|DEGRADED|CRITICAL)/iu)?.[1]?.toUpperCase();
  return gate ? { gateVerdict: gate } : {};
}
