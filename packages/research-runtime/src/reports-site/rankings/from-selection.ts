import type { PolicyResult, SelectionCandidate } from "@trade-signal/research-contracts";

import type { ConfidenceState, RankingMetricMap, RankingViewItem } from "../types.js";

function normalizeDecision(raw: string | undefined): string {
  const v = raw?.trim();
  return v ? v : "unknown";
}

function normalizeConfidence(raw: string | undefined): ConfidenceState {
  if (raw === "high" || raw === "medium" || raw === "low") return raw;
  return "unknown";
}

type PolicyPayload = {
  name?: string;
  industry?: string;
  decision?: string;
  confidence?: string;
  score?: number;
  metrics?: Record<string, unknown>;
};

const ALLOWED_METRIC_KEYS = new Set([
  "industryGroup",
  "dividendYield",
  "pe",
  "pb",
  "annualizedRoe",
  "grossMargin",
  "debtRatio",
  "marketCap",
  "turnover",
  "dividendScore",
  "peScore",
  "pbScore",
  "roeScore",
  "debtScore",
  "penetrationR",
  "refinedPenetrationGG",
  "rf",
  "thresholdII",
  "ownerEarningsI",
  "roe",
  "fcfYield",
  "evEbitda",
  "floorPremium",
  "payoutM",
  "taxQ",
  "buybackO",
  "aa",
  "ocf",
  "capex",
  "safetyMarginPct",
  "metricQuality",
  "classificationProvider",
  "swLevel1Name",
  "swLevel2Name",
  "swLevel3Name",
  "factorValue",
  "factorQuality",
  "factorDividend",
  "factorDefensive",
  "valueFactorScore",
  "qualityFactorScore",
  "dividendFactorScore",
  "qualityValueScore",
  "defensiveFactorScore",
  "multiFactorCoreScore",
]);

function readPayload(policyResults: PolicyResult[] | undefined, code: string): PolicyPayload | undefined {
  const row = policyResults?.find((it) => it.code === code);
  if (!row) return undefined;
  return row.payload as PolicyPayload;
}

function normalizeMetrics(input: Record<string, unknown> | undefined, contributions: Record<string, number> | undefined): RankingMetricMap {
  const out: RankingMetricMap = {};
  for (const [k, v] of Object.entries(input ?? {})) {
    if (!ALLOWED_METRIC_KEYS.has(k)) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null) {
      out[k] = v;
    }
  }
  for (const [k, v] of Object.entries(contributions ?? {})) {
    out[k] = v;
  }
  return out;
}

export function toRankingViewItemsFromSelection(params: {
  strategyId: string;
  candidates: SelectionCandidate[];
  policyResults?: PolicyResult[];
  hrefResolver: (strategyId: string, code: string) => string;
}): RankingViewItem[] {
  return params.candidates.map((candidate, idx) => {
    const payload = readPayload(params.policyResults, candidate.code);
    const metrics = payload?.metrics ?? {};
    return {
      rank: idx + 1,
      code: candidate.code,
      name: payload?.name ?? candidate.code,
      industry: payload?.industry,
      score: typeof candidate.score === "number" ? candidate.score : (payload?.score ?? 0),
      decision: normalizeDecision(candidate.decision ?? payload?.decision),
      confidence: normalizeConfidence(candidate.confidence ?? payload?.confidence),
      href: params.hrefResolver(params.strategyId, candidate.code),
      metrics: normalizeMetrics(metrics, candidate.policyContributions),
    };
  });
}
