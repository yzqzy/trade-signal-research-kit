import type {
  FinancialQualityTrend,
  FinancialSnapshot,
  GovernanceNegativeEvent,
  PdfExtractQualitySummary,
  PdfSections,
} from "@trade-signal/schema-core";

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
  /** 多年三张表（按年度聚合后供规则读取） */
  annualMetaByYear: Record<string, AnnualMetaRow>;
  incomeByYear: Record<string, Record<string, unknown>>;
  balanceByYear: Record<string, Record<string, unknown>>;
  cashflowByYear: Record<string, Record<string, unknown>>;
  /** 可选：来自 Phase2 的年报证据 */
  dataPackReportMarkdown?: string;
  dataPackReportSections?: Record<string, string>;
  pdfQuality?: PdfExtractQualitySummary;
  pdfSections?: PdfSections;
};

export type AnnualMetaRow = {
  year: string;
  reportDate?: string;
  annDate?: string;
  auditAgency?: string;
  auditResult?: string;
  topHolderRatio?: number;
};

export type MinesweeperEvaluation = {
  rows: RuleResultRow[];
  totalScore: number;
  riskBand: "低" | "中" | "高" | "极高" | "直接排除";
  layer0Fail: boolean;
  comboBonus: number;
};
