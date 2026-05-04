export type RankingCapabilityStatus =
  | "ok"
  | "degraded_tier2_fields"
  | "blocked_missing_required_fields"
  | "hk_not_ready";

export type RankingMetricValue = string | number | boolean | null;

export type RankingMetricMap = Record<string, RankingMetricValue>;

export type RankingItem = {
  rank: number;
  code: string;
  name: string;
  industry?: string;
  score: number;
  decision: string;
  confidence: "high" | "medium" | "low" | "unknown";
  href?: string;
  metrics: RankingMetricMap;
};

export type RankingList = {
  listId: string;
  strategyId: string;
  strategyLabel: string;
  market: string;
  mode: string;
  generatedAt: string;
  capabilityStatus?: RankingCapabilityStatus;
  capabilityReasonCodes?: string[];
  topN?: number;
  totalCandidates?: number;
  items: RankingItem[];
};

export type RankingsIndex = {
  version: string;
  generatedAt: string;
  strategyCount: number;
  listCount: number;
  defaultStrategyId?: string;
  lists: RankingList[];
};
