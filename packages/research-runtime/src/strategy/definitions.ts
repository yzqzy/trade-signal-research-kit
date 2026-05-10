import { POLICY_IDS } from "@trade-signal/research-policy";
import {
  DEFENSIVE_FACTOR_CN_A_SELECTION_ID,
  DIVIDEND_FACTOR_CN_A_SELECTION_ID,
  HIGH_DIVIDEND_CN_A_SELECTION_ID,
  MULTI_FACTOR_CORE_CN_A_SELECTION_ID,
  QUALITY_FACTOR_CN_A_SELECTION_ID,
  QUALITY_VALUE_CN_A_SELECTION_ID,
  TURTLE_CN_A_SELECTION_ID,
  VALUE_FACTOR_CN_A_SELECTION_ID,
} from "@trade-signal/research-selection";

export type StrategyId =
  | "turtle"
  | "high_dividend"
  | "value_v1"
  | "value_factor"
  | "quality_factor"
  | "dividend_factor"
  | "quality_value"
  | "defensive_factor"
  | "multi_factor_core";
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
    label: "质量价值（Turtle框架）",
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
    label: "红利因子",
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
  value_factor: {
    strategyId: "value_factor",
    label: "价值因子",
    policyId: POLICY_IDS.valueFactor,
    selectionId: VALUE_FACTOR_CN_A_SELECTION_ID,
    universe: "cn_a",
    markets: ["CN_A"],
    requiredEnrichment: [],
    defaultRankingsTopN: 200,
    criteriaSummary: "以低 PE/PB、低 EV/EBITDA 为核心，同时约束流动性与基本财务安全边界。",
    criteriaDetails: [
      "Universe：CN_A，剔除 ST/PT/退市整理和银行股。",
      "核心门槛：PE、PB、EV/EBITDA 处于合理区间，且市值、换手率达标。",
      "质量兜底：负债率、毛利率、年化 ROE 不低于最低阈值，避免“便宜但脆弱”。",
    ],
  },
  quality_factor: {
    strategyId: "quality_factor",
    label: "质量因子",
    policyId: POLICY_IDS.qualityFactor,
    selectionId: QUALITY_FACTOR_CN_A_SELECTION_ID,
    universe: "cn_a",
    markets: ["CN_A"],
    requiredEnrichment: [],
    defaultRankingsTopN: 200,
    criteriaSummary: "以年化 ROE、毛利率、负债率和现金流质量衡量经营质量。",
    criteriaDetails: [
      "Universe：CN_A，剔除 ST/PT/退市整理和银行股。",
      "核心质量：年化 ROE、毛利率、负债率、FCF Yield 共同打分。",
      "风险约束：市值、换手率与估值区间用于剔除极端值样本。",
    ],
  },
  dividend_factor: {
    strategyId: "dividend_factor",
    label: "红利因子",
    policyId: POLICY_IDS.dividendFactor,
    selectionId: DIVIDEND_FACTOR_CN_A_SELECTION_ID,
    universe: "cn_a",
    markets: ["CN_A"],
    requiredEnrichment: [],
    defaultRankingsTopN: 200,
    criteriaSummary: "以股息率为核心，叠加 ROE、负债率与估值安全约束筛选稳健分红资产。",
    criteriaDetails: [
      "Universe：CN_A，剔除 ST/PT/退市整理和银行股。",
      "核心门槛：股息率、PE、PB、年化 ROE、负债率共同过滤。",
      "排序：股息率权重最高，ROE 与估值因子协同，避免单一高股息误判。",
    ],
  },
  quality_value: {
    strategyId: "quality_value",
    label: "质量价值",
    policyId: POLICY_IDS.qualityValue,
    selectionId: QUALITY_VALUE_CN_A_SELECTION_ID,
    universe: "cn_a",
    markets: ["CN_A"],
    requiredEnrichment: [],
    defaultRankingsTopN: 200,
    criteriaSummary: "以价值因子与质量因子等权组合，追求“便宜且稳健”的均衡暴露。",
    criteriaDetails: [
      "Universe：CN_A，剔除 ST/PT/退市整理和银行股。",
      "价值维度：PE、PB、EV/EBITDA、FCF Yield。",
      "质量维度：年化 ROE、毛利率、负债率、现金流质量。",
    ],
  },
  defensive_factor: {
    strategyId: "defensive_factor",
    label: "低波防守",
    policyId: POLICY_IDS.defensiveFactor,
    selectionId: DEFENSIVE_FACTOR_CN_A_SELECTION_ID,
    universe: "cn_a",
    markets: ["CN_A"],
    requiredEnrichment: [],
    defaultRankingsTopN: 200,
    criteriaSummary: "以大市值、低杠杆、稳健盈利和分红能力构建防守型组合。",
    criteriaDetails: [
      "Universe：CN_A，剔除 ST/PT/退市整理和银行股。",
      "防守约束：市值、负债率、毛利率、年化 ROE、股息率协同筛选。",
      "估值过滤：排除极端高估样本，降低估值回撤风险。",
    ],
  },
  multi_factor_core: {
    strategyId: "multi_factor_core",
    label: "综合多因子",
    policyId: POLICY_IDS.multiFactorCore,
    selectionId: MULTI_FACTOR_CORE_CN_A_SELECTION_ID,
    universe: "cn_a",
    markets: ["CN_A"],
    requiredEnrichment: [],
    defaultRankingsTopN: 200,
    criteriaSummary: "价值、质量、红利三因子组合，以稳健权重获取更平衡的横截面收益暴露。",
    criteriaDetails: [
      "Universe：CN_A，剔除 ST/PT/退市整理和银行股。",
      "三因子：价值（PE/PB/EV）、质量（ROE/毛利/负债）、红利（股息率）。",
      "稳健性：统一流动性和财务下限，降低单因子偏移风险。",
    ],
  },
};

function normalizeStrategyId(strategyId: string | undefined): StrategyId {
  const id = strategyId?.trim() || "turtle";
  if (
    id === "turtle" ||
    id === "high_dividend" ||
    id === "value_v1" ||
    id === "value_factor" ||
    id === "quality_factor" ||
    id === "dividend_factor" ||
    id === "quality_value" ||
    id === "defensive_factor" ||
    id === "multi_factor_core"
  ) {
    return id;
  }
  throw new Error(`[strategy] 未注册 strategyId: ${strategyId}`);
}

export function resolveStrategyDefinition(strategyId?: string): StrategyDefinition {
  return STRATEGY_DEFINITIONS[normalizeStrategyId(strategyId)];
}

export function listStrategyDefinitions(): StrategyDefinition[] {
  return Object.values(STRATEGY_DEFINITIONS);
}
