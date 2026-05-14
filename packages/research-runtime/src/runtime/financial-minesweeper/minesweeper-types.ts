import type { FinancialQualityTrend, FinancialSnapshot, GovernanceNegativeEvent } from "@trade-signal/schema-core";

export type MinesweeperVerdict = "PASS" | "WARN" | "FAIL" | "SKIP";

export type RuleResultRow = {
  id: string;
  layer: number;
  title: string;
  verdict: MinesweeperVerdict;
  detail: string;
};

export type MinesweeperRuleContext = {
  code: string;
  anchorYear: number;
  companyName: string;
  industry?: string;
  snapshots: FinancialSnapshot[];
  trends: FinancialQualityTrend[];
  governanceEvents: GovernanceNegativeEvent[];
  /** 最新期合并资产负债表（camel+raw 扁平，可选） */
  latestBalance?: Record<string, unknown>;
};

export type MinesweeperEvaluation = {
  rows: RuleResultRow[];
  totalScore: number;
  riskBand: "低" | "中" | "高" | "极高" | "直接排除";
  layer0Fail: boolean;
  comboBonus: number;
};
