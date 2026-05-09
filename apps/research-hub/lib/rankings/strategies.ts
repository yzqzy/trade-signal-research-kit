import type { RankingItem, RankingMetricMap, RankingMetricValue } from "./types";

export type RankingStrategyMeta = {
  id: string;
  label: string;
  shortDescription: string;
  criteriaSummary: string;
  criteriaDetails: string[];
  methodologyHref?: string;
  metricGroups: Array<{
    label: string;
    keys: string[];
  }>;
  columns: Array<{
    key: string;
    label: string;
    render: (item: RankingItem) => string;
  }>;
  decisionLabel: (decision: string) => string;
};

function formatMetricNumber(value: RankingMetricValue, digits = 2): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function formatMetricPercent(value: RankingMetricValue, digits = 2): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(digits)}%` : "—";
}

function formatMetricMoney(value: RankingMetricValue): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(2)}亿`;
  return `${value.toFixed(2)}百万`;
}

function formatMetricCompact(value: RankingMetricValue): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}亿`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}十亿`;
  return value.toFixed(2);
}

function formatMetricText(value: RankingMetricValue): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "boolean") return value ? "是" : "否";
  return "—";
}

function metric(metrics: RankingMetricMap, key: string): RankingMetricValue {
  return Object.prototype.hasOwnProperty.call(metrics, key) ? metrics[key] : null;
}

function formatIndustry(item: RankingItem): string {
  const sw = ["swLevel1Name", "swLevel2Name", "swLevel3Name"]
    .map((key) => metric(item.metrics, key))
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
  if (sw.length > 0) return sw.join(" / ");

  const group = metric(item.metrics, "industryGroup");
  const raw = item.industry?.trim();
  if (typeof group === "string" && group.trim() && raw && group.trim() !== raw) return `${group.trim()} / ${raw}`;
  return raw || (typeof group === "string" && group.trim() ? group.trim() : "—");
}

function titleCaseDecision(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (!value) return "未定义";
  return value.replace(/_/g, " ");
}

export const RANKING_STRATEGIES: RankingStrategyMeta[] = [
  {
    id: "turtle",
    label: "龟龟策略",
    shortDescription: "以 ROE、FCF 收益率、穿透回报率与估值因子做综合排序。",
    criteriaSummary: "非 ST、非银行、上市满 3 年，满足市值/换手/估值初筛，并要求现金流可计算穿透 R。",
    criteriaDetails: [
      "初筛：CN_A、非 ST/退市、非银行、上市年限 >= 3 年、市值 >= 5 亿、换手率 >= 0.1%、PB 在 0-10。",
      "主通道：PE 在 0-50 且股息率可用；观察通道仅保留少量 PE 缺失的大市值样本。",
      "财报要求：必须拉取 OCF、Capex 与真实分红率 M，FCF Yield、穿透 R/GG 不允许用 0 或静默降级值代替。",
      "硬门槛：穿透 R/GG 必须真实可算，并与当期 rf、II 门槛比较；财务质量需满足 ROE、毛利率、负债率等策略阈值。",
      "排序权重：ROE 20%、FCF Yield 20%、穿透回报 25%、EV/EBITDA 15%、地板溢价 20%。",
      "结论：综合分 >= 0.65 为候选，>= 0.45 为观察，其余为回避。",
    ],
    methodologyHref: "/reports/methodology",
    metricGroups: [
      { label: "核心评分", keys: ["roe", "fcfYield", "penetrationR", "refinedPenetrationGG"] },
      { label: "回报门槛", keys: ["rf", "thresholdII", "payoutM", "taxQ", "safetyMarginPct"] },
      { label: "估值", keys: ["pe", "pb", "evEbitda", "floorPremium", "marketCap"] },
      { label: "现金质量", keys: ["ownerEarningsI", "aa", "ocf", "capex", "metricQuality"] },
    ],
    decisionLabel(decision) {
      if (decision === "buy") return "候选";
      if (decision === "watch") return "观察";
      if (decision === "avoid") return "回避";
      return titleCaseDecision(decision);
    },
    columns: [
      { key: "rank", label: "排名", render: (item) => String(item.rank) },
      { key: "security", label: "代码 / 名称", render: (item) => `${item.code} ${item.name}` },
      { key: "industry", label: "行业", render: formatIndustry },
      { key: "decision", label: "策略结论", render: (item) => (item.decision ? item.decision : "—") },
      { key: "score", label: "综合分", render: (item) => item.score.toFixed(4) },
      { key: "roe", label: "ROE", render: (item) => formatMetricPercent(metric(item.metrics, "roe")) },
      { key: "fcfYield", label: "FCF Yield", render: (item) => formatMetricPercent(metric(item.metrics, "fcfYield")) },
      {
        key: "penetrationR",
        label: "穿透 R",
        render: (item) => formatMetricPercent(metric(item.metrics, "penetrationR")),
      },
      {
        key: "refinedPenetrationGG",
        label: "精算 GG",
        render: (item) => formatMetricPercent(metric(item.metrics, "refinedPenetrationGG")),
      },
      { key: "rf", label: "rf", render: (item) => formatMetricPercent(metric(item.metrics, "rf")) },
      { key: "thresholdII", label: "II门槛", render: (item) => formatMetricPercent(metric(item.metrics, "thresholdII")) },
      { key: "payoutM", label: "分配率 M", render: (item) => formatMetricPercent(metric(item.metrics, "payoutM")) },
      { key: "taxQ", label: "税率 Q", render: (item) => formatMetricPercent(metric(item.metrics, "taxQ")) },
      { key: "safetyMarginPct", label: "安全边际", render: (item) => formatMetricNumber(metric(item.metrics, "safetyMarginPct")) },
      { key: "pe", label: "PE", render: (item) => formatMetricNumber(metric(item.metrics, "pe")) },
      { key: "pb", label: "PB", render: (item) => formatMetricNumber(metric(item.metrics, "pb")) },
      { key: "evEbitda", label: "EV/EBITDA", render: (item) => formatMetricNumber(metric(item.metrics, "evEbitda")) },
      { key: "floorPremium", label: "底价溢价", render: (item) => formatMetricPercent(metric(item.metrics, "floorPremium")) },
      { key: "dividendYield", label: "股息率", render: (item) => formatMetricPercent(metric(item.metrics, "dividendYield")) },
      { key: "grossMargin", label: "毛利率", render: (item) => formatMetricPercent(metric(item.metrics, "grossMargin")) },
      { key: "debtRatio", label: "负债率", render: (item) => formatMetricPercent(metric(item.metrics, "debtRatio")) },
      { key: "marketCap", label: "市值", render: (item) => formatMetricMoney(metric(item.metrics, "marketCap")) },
      { key: "turnover", label: "换手", render: (item) => formatMetricPercent(metric(item.metrics, "turnover")) },
      { key: "ownerEarningsI", label: "Owner Earnings", render: (item) => formatMetricCompact(metric(item.metrics, "ownerEarningsI")) },
      { key: "ocf", label: "OCF", render: (item) => formatMetricCompact(metric(item.metrics, "ocf")) },
      { key: "capex", label: "Capex", render: (item) => formatMetricCompact(metric(item.metrics, "capex")) },
      { key: "metricQuality", label: "指标质量", render: (item) => formatMetricText(metric(item.metrics, "metricQuality")) },
    ],
  },
  {
    id: "high_dividend",
    label: "高股息策略",
    shortDescription: "以股息率、估值安全边际、年化 ROE 与负债约束筛选现金回报型候选。",
    criteriaSummary: "股息率 >= 3%，ROE、估值、负债、毛利率、市值和流动性共同约束，极端值封顶处理。",
    criteriaDetails: [
      "硬筛：CN_A、非 ST/退市、非银行、股息率 >= 3%、PE 在 0-25、PB 在 0-3、年化 ROE >= 8%。",
      "质量约束：负债率 <= 70%、毛利率 >= 10%、市值 >= 50 亿、换手率 >= 0.1%。",
      "排序权重：股息率 35%、PE 20%、PB 15%、年化 ROE 20%、负债率 10%。",
      "评分处理：股息率、ROE 使用目标区间/封顶，避免异常高股息或一次性 ROE 把榜单顶歪。",
      "候选：score >= 0.68，股息率 4%-12%，年化 ROE 12%-40%，PE 5-18，PB <= 2.5，负债率 <= 55%，毛利率 >= 15%。",
      "观察：score >= 0.45，股息率 >= 3%，年化 ROE >= 8%，PE <= 25，负债率 <= 70%；其他为回避。",
    ],
    metricGroups: [
      { label: "核心打分", keys: ["dividendYield", "annualizedRoe", "score"] },
      { label: "估值约束", keys: ["pe", "pb", "marketCap"] },
      { label: "质量与流动性", keys: ["grossMargin", "debtRatio", "turnover"] },
      { label: "分项得分", keys: ["dividendScore", "peScore", "pbScore", "roeScore", "debtScore"] },
    ],
    decisionLabel(decision) {
      if (decision === "buy") return "候选";
      if (decision === "watch") return "观察";
      if (decision === "avoid") return "回避";
      return titleCaseDecision(decision);
    },
    columns: [
      { key: "rank", label: "排名", render: (item) => String(item.rank) },
      { key: "security", label: "代码 / 名称", render: (item) => `${item.code} ${item.name}` },
      { key: "industry", label: "行业", render: formatIndustry },
      { key: "decision", label: "策略结论", render: (item) => (item.decision ? item.decision : "—") },
      { key: "score", label: "综合分", render: (item) => item.score.toFixed(4) },
      { key: "dividendYield", label: "股息率", render: (item) => formatMetricPercent(metric(item.metrics, "dividendYield")) },
      { key: "pe", label: "PE", render: (item) => formatMetricNumber(metric(item.metrics, "pe")) },
      { key: "pb", label: "PB", render: (item) => formatMetricNumber(metric(item.metrics, "pb")) },
      { key: "annualizedRoe", label: "年化 ROE", render: (item) => formatMetricPercent(metric(item.metrics, "annualizedRoe")) },
      { key: "grossMargin", label: "毛利率", render: (item) => formatMetricPercent(metric(item.metrics, "grossMargin")) },
      { key: "debtRatio", label: "负债率", render: (item) => formatMetricPercent(metric(item.metrics, "debtRatio")) },
      { key: "marketCap", label: "市值", render: (item) => formatMetricMoney(metric(item.metrics, "marketCap")) },
      { key: "turnover", label: "换手", render: (item) => formatMetricPercent(metric(item.metrics, "turnover")) },
      { key: "dividendScore", label: "股息分", render: (item) => formatMetricNumber(metric(item.metrics, "dividendScore"), 3) },
      { key: "peScore", label: "PE分", render: (item) => formatMetricNumber(metric(item.metrics, "peScore"), 3) },
      { key: "pbScore", label: "PB分", render: (item) => formatMetricNumber(metric(item.metrics, "pbScore"), 3) },
      { key: "roeScore", label: "ROE分", render: (item) => formatMetricNumber(metric(item.metrics, "roeScore"), 3) },
      { key: "debtScore", label: "负债分", render: (item) => formatMetricNumber(metric(item.metrics, "debtScore"), 3) },
    ],
  },
];

const STRATEGY_META_MAP = new Map(RANKING_STRATEGIES.map((item) => [item.id, item]));

export function getRankingStrategyMeta(strategyId: string): RankingStrategyMeta {
  return (
    STRATEGY_META_MAP.get(strategyId) ?? {
      id: strategyId,
      label: strategyId,
      shortDescription: "该策略尚未配置专属展示器，当前按通用榜单方式展示。",
      criteriaSummary: "通用榜单：按统一榜单协议展示，具体筛选条件由策略发布产物提供。",
      criteriaDetails: ["该策略尚未配置专属筛选说明；请查看策略产物或方法论。"],
      metricGroups: [{ label: "核心指标", keys: ["score"] }],
      decisionLabel: titleCaseDecision,
      columns: [
        { key: "rank", label: "排名", render: (item) => String(item.rank) },
        { key: "security", label: "代码 / 名称", render: (item) => `${item.code} ${item.name}` },
        { key: "industry", label: "行业", render: formatIndustry },
        { key: "decision", label: "策略结论", render: (item) => titleCaseDecision(item.decision) },
        { key: "score", label: "综合分", render: (item) => item.score.toFixed(4) },
      ],
    }
  );
}
