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
    label: "质量价值（Turtle框架）",
    shortDescription: "以 ROE、FCF 收益率、穿透回报率与估值因子做质量价值排序。",
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
    label: "红利因子",
    shortDescription: "以股息率、估值安全边际、年化 ROE 与负债约束筛选稳健分红候选。",
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
  {
    id: "value_factor",
    label: "价值因子",
    shortDescription: "以低估值为主，叠加基础质量约束，过滤明显财务脆弱样本。",
    criteriaSummary: "核心看 PE/PB/EV/EBITDA 与 FCF Yield，同时要求流动性与财务安全边界达标。",
    criteriaDetails: [
      "CN_A、非 ST/退市、非银行，市值与换手率达标。",
      "估值：PE、PB、EV/EBITDA 处于合理区间，FCF Yield 越高越优。",
      "质量兜底：ROE、负债率不过于极端。",
    ],
    metricGroups: [
      { label: "核心因子", keys: ["factorValue", "factorQuality"] },
      { label: "估值指标", keys: ["pe", "pb", "evEbitda"] },
      { label: "补充指标", keys: ["fcfYield", "annualizedRoe", "debtRatio"] },
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
      { key: "factorValue", label: "价值因子分", render: (item) => formatMetricNumber(metric(item.metrics, "factorValue"), 3) },
      { key: "factorQuality", label: "质量因子分", render: (item) => formatMetricNumber(metric(item.metrics, "factorQuality"), 3) },
      { key: "pe", label: "PE", render: (item) => formatMetricNumber(metric(item.metrics, "pe")) },
      { key: "pb", label: "PB", render: (item) => formatMetricNumber(metric(item.metrics, "pb")) },
      { key: "evEbitda", label: "EV/EBITDA", render: (item) => formatMetricNumber(metric(item.metrics, "evEbitda")) },
      { key: "fcfYield", label: "FCF Yield", render: (item) => formatMetricPercent(metric(item.metrics, "fcfYield")) },
      { key: "annualizedRoe", label: "年化 ROE", render: (item) => formatMetricPercent(metric(item.metrics, "annualizedRoe")) },
      { key: "debtRatio", label: "负债率", render: (item) => formatMetricPercent(metric(item.metrics, "debtRatio")) },
    ],
  },
  {
    id: "quality_factor",
    label: "质量因子",
    shortDescription: "以 ROE、毛利率、负债率、现金流质量衡量经营稳定性。",
    criteriaSummary: "强调盈利质量与资产负债结构，减少低质量财报标的。",
    criteriaDetails: [
      "CN_A、非 ST/退市、非银行，市值与换手率达标。",
      "核心：年化 ROE、毛利率、负债率、FCF Yield。",
      "极端估值样本按风控门槛过滤。",
    ],
    metricGroups: [
      { label: "核心因子", keys: ["factorQuality", "factorDefensive"] },
      { label: "质量指标", keys: ["annualizedRoe", "grossMargin", "debtRatio", "fcfYield"] },
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
      { key: "factorQuality", label: "质量因子分", render: (item) => formatMetricNumber(metric(item.metrics, "factorQuality"), 3) },
      { key: "factorDefensive", label: "防守因子分", render: (item) => formatMetricNumber(metric(item.metrics, "factorDefensive"), 3) },
      { key: "annualizedRoe", label: "年化 ROE", render: (item) => formatMetricPercent(metric(item.metrics, "annualizedRoe")) },
      { key: "grossMargin", label: "毛利率", render: (item) => formatMetricPercent(metric(item.metrics, "grossMargin")) },
      { key: "debtRatio", label: "负债率", render: (item) => formatMetricPercent(metric(item.metrics, "debtRatio")) },
      { key: "fcfYield", label: "FCF Yield", render: (item) => formatMetricPercent(metric(item.metrics, "fcfYield")) },
    ],
  },
  {
    id: "dividend_factor",
    label: "红利因子",
    shortDescription: "以股息率为主，叠加估值与财务质量约束。",
    criteriaSummary: "优先分红能力，同时要求 ROE、负债率和估值不过于激进。",
    criteriaDetails: [
      "CN_A、非 ST/退市、非银行，市值与换手率达标。",
      "核心：股息率、负债率、年化 ROE 与估值。",
      "过高估值或财务压力样本剔除。",
    ],
    metricGroups: [
      { label: "核心因子", keys: ["factorDividend", "factorQuality"] },
      { label: "红利与质量", keys: ["dividendYield", "annualizedRoe", "debtRatio"] },
      { label: "估值", keys: ["pe", "pb"] },
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
      { key: "factorDividend", label: "红利因子分", render: (item) => formatMetricNumber(metric(item.metrics, "factorDividend"), 3) },
      { key: "factorQuality", label: "质量因子分", render: (item) => formatMetricNumber(metric(item.metrics, "factorQuality"), 3) },
      { key: "dividendYield", label: "股息率", render: (item) => formatMetricPercent(metric(item.metrics, "dividendYield")) },
      { key: "annualizedRoe", label: "年化 ROE", render: (item) => formatMetricPercent(metric(item.metrics, "annualizedRoe")) },
      { key: "debtRatio", label: "负债率", render: (item) => formatMetricPercent(metric(item.metrics, "debtRatio")) },
      { key: "pe", label: "PE", render: (item) => formatMetricNumber(metric(item.metrics, "pe")) },
      { key: "pb", label: "PB", render: (item) => formatMetricNumber(metric(item.metrics, "pb")) },
    ],
  },
  {
    id: "quality_value",
    label: "质量价值",
    shortDescription: "价值与质量等权组合，平衡低估值与经营稳健性。",
    criteriaSummary: "避免单因子偏离，强调“便宜且稳健”的交集。",
    criteriaDetails: [
      "CN_A、非 ST/退市、非银行，市值与换手率达标。",
      "价值：PE/PB/EV/EBITDA/FCF Yield。",
      "质量：年化 ROE、毛利率、负债率。",
    ],
    metricGroups: [
      { label: "核心因子", keys: ["factorValue", "factorQuality"] },
      { label: "价值维度", keys: ["pe", "pb", "evEbitda", "fcfYield"] },
      { label: "质量维度", keys: ["annualizedRoe", "grossMargin", "debtRatio"] },
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
      { key: "factorValue", label: "价值因子分", render: (item) => formatMetricNumber(metric(item.metrics, "factorValue"), 3) },
      { key: "factorQuality", label: "质量因子分", render: (item) => formatMetricNumber(metric(item.metrics, "factorQuality"), 3) },
      { key: "pe", label: "PE", render: (item) => formatMetricNumber(metric(item.metrics, "pe")) },
      { key: "pb", label: "PB", render: (item) => formatMetricNumber(metric(item.metrics, "pb")) },
      { key: "annualizedRoe", label: "年化 ROE", render: (item) => formatMetricPercent(metric(item.metrics, "annualizedRoe")) },
      { key: "grossMargin", label: "毛利率", render: (item) => formatMetricPercent(metric(item.metrics, "grossMargin")) },
      { key: "debtRatio", label: "负债率", render: (item) => formatMetricPercent(metric(item.metrics, "debtRatio")) },
    ],
  },
  {
    id: "defensive_factor",
    label: "低波防守",
    shortDescription: "以大市值、低杠杆、稳定盈利为核心的防守型排序。",
    criteriaSummary: "偏好大盘与稳健财务结构，降低组合脆弱性。",
    criteriaDetails: [
      "CN_A、非 ST/退市、非银行，市值与换手率达标。",
      "核心：市值、负债率、毛利率、年化 ROE、股息率。",
      "估值极端样本过滤，避免防守策略承担过高估值风险。",
    ],
    metricGroups: [
      { label: "核心因子", keys: ["factorDefensive", "factorQuality", "factorDividend"] },
      { label: "防守指标", keys: ["marketCap", "debtRatio", "annualizedRoe", "grossMargin", "dividendYield"] },
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
      { key: "factorDefensive", label: "防守因子分", render: (item) => formatMetricNumber(metric(item.metrics, "factorDefensive"), 3) },
      { key: "factorQuality", label: "质量因子分", render: (item) => formatMetricNumber(metric(item.metrics, "factorQuality"), 3) },
      { key: "factorDividend", label: "红利因子分", render: (item) => formatMetricNumber(metric(item.metrics, "factorDividend"), 3) },
      { key: "marketCap", label: "市值", render: (item) => formatMetricMoney(metric(item.metrics, "marketCap")) },
      { key: "debtRatio", label: "负债率", render: (item) => formatMetricPercent(metric(item.metrics, "debtRatio")) },
      { key: "annualizedRoe", label: "年化 ROE", render: (item) => formatMetricPercent(metric(item.metrics, "annualizedRoe")) },
      { key: "grossMargin", label: "毛利率", render: (item) => formatMetricPercent(metric(item.metrics, "grossMargin")) },
      { key: "dividendYield", label: "股息率", render: (item) => formatMetricPercent(metric(item.metrics, "dividendYield")) },
    ],
  },
  {
    id: "multi_factor_core",
    label: "综合多因子",
    shortDescription: "价值、质量、红利三因子组合，追求更均衡的横截面暴露。",
    criteriaSummary: "在统一风险边界下综合三因子打分，降低单因子失效冲击。",
    criteriaDetails: [
      "CN_A、非 ST/退市、非银行，市值与换手率达标。",
      "价值 + 质量 + 红利三因子加权。",
      "统一估值与财务底线，控制极端样本。",
    ],
    metricGroups: [
      { label: "核心因子", keys: ["factorValue", "factorQuality", "factorDividend", "factorDefensive"] },
      { label: "基础指标", keys: ["pe", "pb", "annualizedRoe", "debtRatio", "dividendYield"] },
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
      { key: "factorValue", label: "价值因子分", render: (item) => formatMetricNumber(metric(item.metrics, "factorValue"), 3) },
      { key: "factorQuality", label: "质量因子分", render: (item) => formatMetricNumber(metric(item.metrics, "factorQuality"), 3) },
      { key: "factorDividend", label: "红利因子分", render: (item) => formatMetricNumber(metric(item.metrics, "factorDividend"), 3) },
      { key: "factorDefensive", label: "防守因子分", render: (item) => formatMetricNumber(metric(item.metrics, "factorDefensive"), 3) },
      { key: "pe", label: "PE", render: (item) => formatMetricNumber(metric(item.metrics, "pe")) },
      { key: "pb", label: "PB", render: (item) => formatMetricNumber(metric(item.metrics, "pb")) },
      { key: "annualizedRoe", label: "年化 ROE", render: (item) => formatMetricPercent(metric(item.metrics, "annualizedRoe")) },
      { key: "debtRatio", label: "负债率", render: (item) => formatMetricPercent(metric(item.metrics, "debtRatio")) },
      { key: "dividendYield", label: "股息率", render: (item) => formatMetricPercent(metric(item.metrics, "dividendYield")) },
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
