export const SELECTION_MANIFEST_VERSION = "1.0" as const;

/**
 * 站点榜单（Rankings）默认条数：按策略综合分降序后取前 N。
 * 修改本常量会影响所有未显式传入 topN 的调用（manifest builder、emit 默认值、前端兜底）。
 */
export const RANKINGS_DEFAULT_TOP_N = 200 as const;

export type SelectionManifestV1 = {
  manifestVersion: typeof SELECTION_MANIFEST_VERSION;
  schema: "selection-result-v2";
  runProfile: "selection_fast";
  strategyId: string;
  strategyLabel: string;
  selectionId: string;
  runId: string;
  universe: string;
  generatedAt: string;
  candidates: Array<{
    code: string;
    score?: number;
    decision?: string;
    policyContributions?: Record<string, number>;
  }>;
  drillDownTopicIds?: string[];
  /** 站点榜单按策略分数降序后取的前 N 名；未设置时下游按 `RANKINGS_DEFAULT_TOP_N` 兜底 */
  rankingsTopN?: number;
};

export type SelectionSourceLike = {
  strategyId?: string;
  strategyLabel?: string;
  market: string;
  mode: string;
  generatedAt: string;
  results: Array<{
    code: string;
    totalScore?: number;
    decision?: string;
    tier1Score?: number;
    screenerScore?: number;
  }>;
};

export type SelectionManifestBuildOptions = {
  /** 写入 manifest 的 `rankingsTopN`；未传时使用 `RANKINGS_DEFAULT_TOP_N` */
  rankingsTopN?: number;
};

export function buildSelectionManifestV1(
  output: SelectionSourceLike,
  runId: string,
  options: SelectionManifestBuildOptions = {},
): SelectionManifestV1 {
  const selectionId = `selection:screener:${output.market}:${output.mode}`;
  const universe = `${String(output.market).toLowerCase()}_${output.mode}`;
  const topNRaw = options.rankingsTopN;
  const rankingsTopN =
    typeof topNRaw === "number" && Number.isFinite(topNRaw) && topNRaw > 0
      ? Math.floor(topNRaw)
      : RANKINGS_DEFAULT_TOP_N;
  return {
    manifestVersion: SELECTION_MANIFEST_VERSION,
    schema: "selection-result-v2",
    runProfile: "selection_fast",
    strategyId: output.strategyId?.trim() || "turtle",
    strategyLabel: output.strategyLabel?.trim() || "龟龟策略",
    selectionId,
    runId,
    universe,
    generatedAt: output.generatedAt,
    candidates: output.results.map((r) => ({
      code: r.code,
      score: r.totalScore,
      decision: r.decision,
      policyContributions: {
        tier1Score: r.tier1Score ?? 0,
        screenerScore: r.screenerScore ?? 0,
      },
    })),
    drillDownTopicIds: ["topic:business-six-dimension", "topic:turtle-strategy-explainer"],
    rankingsTopN,
  };
}
