import { POLICY_IDS } from "@trade-signal/research-policy";
import { HIGH_DIVIDEND_CN_A_SELECTION_ID, TURTLE_CN_A_SELECTION_ID } from "@trade-signal/research-selection";

export type StrategyId = "turtle" | "high_dividend" | "value_v1";
export type StrategyMarket = "CN_A" | "HK" | "US";
export type StrategyRequiredEnrichment = "financial_history" | "sw_industry";

export type StrategyDefinition = {
  strategyId: StrategyId;
  label: string;
  policyId: string;
  selectionId: string;
  universe: string;
  markets: StrategyMarket[];
  requiredEnrichment: StrategyRequiredEnrichment[];
  defaultRankingsTopN: number;
  criteriaSummary: string;
  criteriaDetails: string[];
};

const STRATEGY_DEFINITIONS: Record<StrategyId, StrategyDefinition> = {
  turtle: {
    strategyId: "turtle",
    label: "龟龟策略",
    policyId: POLICY_IDS.turtle,
    selectionId: TURTLE_CN_A_SELECTION_ID,
    universe: "cn_a_universe",
    markets: ["CN_A"],
    requiredEnrichment: ["financial_history", "sw_industry"],
    defaultRankingsTopN: 200,
    criteriaSummary: "非 ST、非银行、上市满 3 年，满足市值/换手/估值初筛，并要求现金流可计算穿透 R/GG。",
    criteriaDetails: [
      "Universe：CN_A，剔除 ST/PT/退市整理、银行股，上市年限不低于 3 年。",
      "流动性与估值：市值、换手率、PE、PB、股息率必须满足策略门槛。",
      "现金流：OCF、Capex、分红率等核心字段缺失时不得输出 0 或静默降级。",
      "排序：由 policy:turtle 产出的 ROE、FCF Yield、穿透回报、EV/EBITDA 与底价溢价共同决定。",
    ],
  },
  high_dividend: {
    strategyId: "high_dividend",
    label: "高股息策略",
    policyId: POLICY_IDS.highDividend,
    selectionId: HIGH_DIVIDEND_CN_A_SELECTION_ID,
    universe: "cn_a",
    markets: ["CN_A"],
    requiredEnrichment: ["sw_industry"],
    defaultRankingsTopN: 200,
    criteriaSummary: "以股息率、PE、PB、年化 ROE、负债率为核心，过滤低流动性和明显高风险标的。",
    criteriaDetails: [
      "Universe：CN_A，剔除 ST/PT/退市整理和银行股。",
      "核心门槛：股息率、PE、PB、年化 ROE、负债率、毛利率、市值与换手率共同过滤。",
      "排序：股息率 35%、PE 20%、PB 15%、年化 ROE 20%、负债率 10%。",
    ],
  },
  value_v1: {
    strategyId: "value_v1",
    label: "价值策略 V1",
    policyId: POLICY_IDS.valueV1,
    selectionId: "selection:value_v1:cn_a",
    universe: "cn_a",
    markets: ["CN_A"],
    requiredEnrichment: [],
    defaultRankingsTopN: 200,
    criteriaSummary: "样板策略，仅用于 workflow 插件隔离验证，不进入正式榜单。",
    criteriaDetails: ["该策略未注册 Selection 插件，不作为 screener/rankings 可见策略使用。"],
  },
};

function normalizeStrategyId(strategyId: string | undefined): StrategyId {
  const id = strategyId?.trim() || "turtle";
  if (id === "turtle" || id === "high_dividend" || id === "value_v1") return id;
  throw new Error(`[strategy] 未注册 strategyId: ${strategyId}`);
}

export function resolveStrategyDefinition(strategyId?: string): StrategyDefinition {
  return STRATEGY_DEFINITIONS[normalizeStrategyId(strategyId)];
}

export function listStrategyDefinitions(): StrategyDefinition[] {
  return Object.values(STRATEGY_DEFINITIONS);
}
