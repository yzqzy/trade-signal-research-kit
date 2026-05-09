import type { FeatureSet } from "@trade-signal/research-contracts";
type DecisionConfidence = "high" | "medium" | "low";

export type HighDividendPolicyPayload = {
  strategyId: "high_dividend";
  market?: string;
  name?: string;
  industry?: string;
  passesUniverseGate: boolean;
  filterReasons: string[];
  score: number;
  decision: "buy" | "watch" | "avoid";
  confidence: DecisionConfidence;
  metrics: {
    industryGroup: string | null;
    dividendYield: number | null;
    pe: number | null;
    pb: number | null;
    annualizedRoe: number | null;
    grossMargin: number | null;
    debtRatio: number | null;
    marketCap: number | null;
    turnover: number | null;
    dividendScore: number;
    peScore: number;
    pbScore: number;
    roeScore: number;
    debtScore: number;
  };
};

function finiteNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function rangeScore(value: number, min: number, max: number, higherBetter: boolean): number {
  if (!Number.isFinite(value)) return 0;
  if (higherBetter) {
    if (value <= min) return 0;
    if (value >= max) return 1;
    return (value - min) / (max - min);
  }
  if (value <= min) return 1;
  if (value >= max) return 0;
  return 1 - (value - min) / (max - min);
}

function dividendYieldScore(dividendYield: number): number {
  if (!Number.isFinite(dividendYield) || dividendYield <= 0) return 0;
  if (dividendYield < 2) return dividendYield / 2;
  if (dividendYield <= 6) return 0.7 + ((dividendYield - 2) / 4) * 0.3;
  if (dividendYield <= 12) return 1 - ((dividendYield - 6) / 6) * 0.15;
  return 0.5;
}

function resolveHighDividendDecision(params: {
  score: number;
  dividendYield: number;
  annualizedRoe: number;
  pe: number;
  pb: number;
  debtRatio: number;
  grossMargin: number;
}): { decision: "buy" | "watch" | "avoid"; confidence: DecisionConfidence } {
  const { score, dividendYield, annualizedRoe, pe, pb, debtRatio, grossMargin } = params;
  const buy =
    score >= 0.68 &&
    dividendYield >= 4 &&
    dividendYield <= 12 &&
    annualizedRoe >= 12 &&
    annualizedRoe <= 40 &&
    pe >= 5 &&
    pe <= 18 &&
    pb > 0 &&
    pb <= 2.5 &&
    debtRatio <= 55 &&
    grossMargin >= 15;
  if (buy) return { decision: "buy", confidence: dividendYield >= 5 && annualizedRoe >= 15 ? "high" : "medium" };

  const watch = score >= 0.45 && dividendYield >= 3 && annualizedRoe >= 8 && pe > 0 && pe <= 25 && debtRatio <= 70;
  if (watch) return { decision: "watch", confidence: score >= 0.55 ? "medium" : "low" };

  return { decision: "avoid", confidence: "low" };
}

export function mapCnAIndustryGroup(industryRaw: unknown): string | undefined {
  const value = typeof industryRaw === "string" ? industryRaw.trim() : "";
  if (!value) return undefined;
  if (/食品|饮料|白酒|乳制品|啤酒|调味|休闲食品|农副食品/.test(value)) return "消费";
  if (/医药|生物|医疗器械|中药|化学制药/.test(value)) return "医药";
  if (/有色|钢铁|煤炭|石油|化工|建材|化纤/.test(value)) return "周期";
  if (/电力|公用事业|燃气|水务|交通运输|高速公路|港口/.test(value)) return "公用";
  if (/通信|电子|半导体|传媒|互联网/.test(value)) return "科技";
  if (/家电|轻工|纺织服装|商贸零售/.test(value)) return "可选消费";
  if (/房地产|建筑|建筑装饰/.test(value)) return "地产基建";
  if (/证券|保险|多元金融/.test(value)) return "金融";
  if (/银行/.test(value)) return "银行";
  return undefined;
}

export function evaluateHighDividendPolicy(featureSet: FeatureSet): HighDividendPolicyPayload {
  const f = featureSet.features ?? {};
  const name = typeof f.name === "string" ? f.name : undefined;
  const industry = typeof f.industry === "string" ? f.industry : undefined;
  const market = typeof f.market === "string" ? f.market : undefined;

  const dividendYield = finiteNumber(f.dv) ?? 0;
  const pe = finiteNumber(f.pe) ?? 0;
  const pb = finiteNumber(f.pb) ?? 0;
  const annualizedRoe = (finiteNumber(f.roe) ?? 0) * 4;
  const debtRatio = finiteNumber(f.debtRatio) ?? Number.POSITIVE_INFINITY;
  const grossMargin = finiteNumber(f.grossMargin) ?? 0;
  const marketCap = finiteNumber(f.marketCap) ?? 0;
  const turnover = finiteNumber(f.turnover) ?? 0;

  const filterReasons: string[] = [];
  if (market !== "CN_A") filterReasons.push("market_not_cn_a");
  if (/\*ST|ST|PT|退市/u.test(name ?? "")) filterReasons.push("special_treatment_stock");
  if ((industry ?? "").includes("银行")) filterReasons.push("bank_industry_excluded");
  if (dividendYield < 3) filterReasons.push("dividend_yield_below_floor");
  if (pe <= 0 || pe > 25) filterReasons.push("pe_out_of_range");
  if (pb <= 0 || pb > 3) filterReasons.push("pb_out_of_range");
  if (annualizedRoe < 8) filterReasons.push("roe_too_low");
  if (debtRatio > 70) filterReasons.push("debt_too_high");
  if (grossMargin < 10) filterReasons.push("gross_margin_too_low");
  if (marketCap < 5_000) filterReasons.push("market_cap_too_low");
  if (turnover < 0.1) filterReasons.push("turnover_too_low");

  const dividendScore = dividendYieldScore(dividendYield);
  const peScore = rangeScore(pe, 5, 25, false);
  const pbScore = rangeScore(pb, 0.7, 3, false);
  const roeScore = rangeScore(annualizedRoe, 8, 25, true);
  const debtScore = rangeScore(debtRatio, 0, 70, false);
  const score = 0.35 * dividendScore + 0.2 * peScore + 0.15 * pbScore + 0.2 * roeScore + 0.1 * debtScore;
  const verdict = resolveHighDividendDecision({
    score,
    dividendYield,
    annualizedRoe,
    pe,
    pb,
    debtRatio,
    grossMargin,
  });

  return {
    strategyId: "high_dividend",
    market,
    name,
    industry,
    passesUniverseGate: filterReasons.length === 0,
    filterReasons,
    score,
    decision: verdict.decision,
    confidence: verdict.confidence,
    metrics: {
      industryGroup: mapCnAIndustryGroup(industry) ?? null,
      dividendYield: finiteNumber(f.dv) ?? null,
      pe: finiteNumber(f.pe) ?? null,
      pb: finiteNumber(f.pb) ?? null,
      annualizedRoe: Number.isFinite(annualizedRoe) ? annualizedRoe : null,
      grossMargin: finiteNumber(f.grossMargin) ?? null,
      debtRatio: finiteNumber(f.debtRatio) ?? null,
      marketCap: finiteNumber(f.marketCap) ?? null,
      turnover: finiteNumber(f.turnover) ?? null,
      dividendScore,
      peScore,
      pbScore,
      roeScore,
      debtScore,
    },
  };
}
