export type FactSource =
  | "data_pack_market"
  | "data_pack_report"
  | "valuation_computed"
  | "phase1b_qualitative"
  | "reference_analysis";

export const FACT_SOURCE_PRIORITY: readonly FactSource[] = [
  "data_pack_market",
  "data_pack_report",
  "valuation_computed",
  "phase1b_qualitative",
  "reference_analysis",
] as const;

export interface ConflictCandidate {
  source: FactSource;
  value: string | number | boolean | null;
}

export interface ReportConflictLogEntry {
  fieldKey: string;
  candidateSources: FactSource[];
  selectedSource: FactSource;
  selectedValue: string | number | boolean | null;
  reason: string;
  checkedAt: string; // ISO-8601
}

function priorityRank(source: FactSource): number {
  const idx = FACT_SOURCE_PRIORITY.indexOf(source);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

export function pickByFactSourcePriority(
  fieldKey: string,
  candidates: ConflictCandidate[],
  reason = "fact-source-priority",
  checkedAt = new Date().toISOString(),
): ReportConflictLogEntry | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort(
    (a, b) => priorityRank(a.source) - priorityRank(b.source),
  );
  const selected = sorted[0]!;
  return {
    fieldKey,
    candidateSources: sorted.map((c) => c.source),
    selectedSource: selected.source,
    selectedValue: selected.value,
    reason,
    checkedAt,
  };
}
