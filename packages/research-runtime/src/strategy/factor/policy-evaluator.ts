import type { FeatureSet } from "@trade-signal/research-contracts";
import { mapCnAIndustryGroup } from "../high-dividend/plugin.js";

type DecisionConfidence = "high" | "medium" | "low";
type FactorDecision = "buy" | "watch" | "avoid";

type FactorScoreMetric = {
  key: string;
  value: number;
  score: number;
};

export type GenericFactorPolicyPayload = {
  strategyId:
    | "value_factor"
    | "quality_factor"
    | "dividend_factor"
    | "quality_value"
    | "defensive_factor"
    | "multi_factor_core";
  market?: string;
  name?: string;
  industry?: string;
  passesUniverseGate: boolean;
  filterReasons: string[];
  score: number;
  decision: FactorDecision;
  confidence: DecisionConfidence;
  metrics: {
    industryGroup: string | null;
    dividendYield: number | null;
    pe: number | null;
    pb: number | null;
    evEbitda: number | null;
    annualizedRoe: number | null;
    grossMargin: number | null;
    debtRatio: number | null;
    marketCap: number | null;
    turnover: number | null;
    fcfYield: number | null;
    ocf: number | null;
    capex: number | null;
    factorValue: number;
    factorQuality: number;
    factorDividend: number;
    factorDefensive: number;
    scoreBreakdown: FactorScoreMetric[];
  };
};

type BaseFactorInput = {
  market: string | undefined;
  name: string | undefined;
  industry: string | undefined;
  dividendYield: number;
  pe: number;
  pb: number;
  evEbitda: number;
  annualizedRoe: number;
  grossMargin: number;
  debtRatio: number;
  marketCap: number;
  turnover: number;
  fcfYield: number;
  ocf: number;
  capex: number;
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

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function toFactorInput(featureSet: FeatureSet): BaseFactorInput {
  const f = featureSet.features ?? {};
  return {
    market: typeof f.market === "string" ? f.market : undefined,
    name: typeof f.name === "string" ? f.name : undefined,
    industry: typeof f.industry === "string" ? f.industry : undefined,
    dividendYield: finiteNumber(f.dv) ?? 0,
    pe: finiteNumber(f.pe) ?? 0,
    pb: finiteNumber(f.pb) ?? 0,
    evEbitda: finiteNumber(f.evEbitda) ?? 0,
    annualizedRoe: (finiteNumber(f.roe) ?? 0) * 4,
    grossMargin: finiteNumber(f.grossMargin) ?? 0,
    debtRatio: finiteNumber(f.debtRatio) ?? 100,
    marketCap: finiteNumber(f.marketCap) ?? 0,
    turnover: finiteNumber(f.turnover) ?? 0,
    fcfYield: finiteNumber(f.fcfYield) ?? 0,
    ocf: finiteNumber(f.ocf) ?? 0,
    capex: finiteNumber(f.capex) ?? 0,
  };
}

function resolveCommonFilterReasons(input: BaseFactorInput): string[] {
  const reasons: string[] = [];
  if (input.market !== "CN_A") reasons.push("market_not_cn_a");
  if (/\*ST|ST|PT|退市/u.test(input.name ?? "")) reasons.push("special_treatment_stock");
  if ((input.industry ?? "").includes("银行")) reasons.push("bank_industry_excluded");
  if (input.marketCap < 5_000) reasons.push("market_cap_too_low");
  if (input.turnover < 0.1) reasons.push("turnover_too_low");
  return reasons;
}

function resolveFactors(input: BaseFactorInput): {
  factorValue: number;
  factorQuality: number;
  factorDividend: number;
  factorDefensive: number;
  parts: Record<string, number>;
} {
  const valuePe = rangeScore(input.pe, 4, 30, false);
  const valuePb = rangeScore(input.pb, 0.5, 4, false);
  const valueEv = rangeScore(input.evEbitda, 5, 22, false);
  const valueFcf = rangeScore(input.fcfYield, 1.5, 10, true);
  const factorValue = clamp01(0.3 * valuePe + 0.25 * valuePb + 0.2 * valueEv + 0.25 * valueFcf);

  const qualityRoe = rangeScore(input.annualizedRoe, 8, 28, true);
  const qualityGm = rangeScore(input.grossMargin, 10, 50, true);
  const qualityDebt = rangeScore(input.debtRatio, 20, 75, false);
  const qualityFcf = rangeScore(input.fcfYield, 1, 9, true);
  const factorQuality = clamp01(0.35 * qualityRoe + 0.25 * qualityGm + 0.2 * qualityDebt + 0.2 * qualityFcf);

  const dividendYield = rangeScore(input.dividendYield, 2.5, 10, true);
  const dividendDebt = rangeScore(input.debtRatio, 25, 70, false);
  const dividendRoe = rangeScore(input.annualizedRoe, 8, 24, true);
  const dividendValuation = rangeScore((input.pe + input.pb * 4) / 2, 6, 20, false);
  const factorDividend = clamp01(
    0.45 * dividendYield + 0.2 * dividendDebt + 0.2 * dividendRoe + 0.15 * dividendValuation,
  );

  const defensiveCap = rangeScore(input.marketCap, 8_000, 80_000, true);
  const defensiveDebt = rangeScore(input.debtRatio, 15, 65, false);
  const defensiveQuality = rangeScore((input.annualizedRoe + input.grossMargin) / 2, 12, 35, true);
  const defensiveDividend = rangeScore(input.dividendYield, 2, 7, true);
  const factorDefensive = clamp01(
    0.35 * defensiveCap + 0.25 * defensiveDebt + 0.25 * defensiveQuality + 0.15 * defensiveDividend,
  );

  return {
    factorValue,
    factorQuality,
    factorDividend,
    factorDefensive,
    parts: {
      valuePe,
      valuePb,
      valueEv,
      valueFcf,
      qualityRoe,
      qualityGm,
      qualityDebt,
      qualityFcf,
      dividendYield,
      dividendDebt,
      dividendRoe,
      dividendValuation,
      defensiveCap,
      defensiveDebt,
      defensiveQuality,
      defensiveDividend,
    },
  };
}

function resolveDecision(score: number, passesUniverseGate: boolean): {
  decision: FactorDecision;
  confidence: DecisionConfidence;
} {
  if (!passesUniverseGate) return { decision: "avoid", confidence: "low" };
  if (score >= 0.7) return { decision: "buy", confidence: score >= 0.82 ? "high" : "medium" };
  if (score >= 0.5) return { decision: "watch", confidence: score >= 0.6 ? "medium" : "low" };
  return { decision: "avoid", confidence: "low" };
}

function buildPayload(params: {
  strategyId: GenericFactorPolicyPayload["strategyId"];
  input: BaseFactorInput;
  score: number;
  scoreBreakdown: FactorScoreMetric[];
  factorValue: number;
  factorQuality: number;
  factorDividend: number;
  factorDefensive: number;
  filterReasons: string[];
}): GenericFactorPolicyPayload {
  const { strategyId, input } = params;
  const passesUniverseGate = params.filterReasons.length === 0;
  const verdict = resolveDecision(params.score, passesUniverseGate);
  return {
    strategyId,
    market: input.market,
    name: input.name,
    industry: input.industry,
    passesUniverseGate,
    filterReasons: params.filterReasons,
    score: params.score,
    decision: verdict.decision,
    confidence: verdict.confidence,
    metrics: {
      industryGroup: mapCnAIndustryGroup(input.industry) ?? null,
      dividendYield: Number.isFinite(input.dividendYield) ? input.dividendYield : null,
      pe: Number.isFinite(input.pe) ? input.pe : null,
      pb: Number.isFinite(input.pb) ? input.pb : null,
      evEbitda: Number.isFinite(input.evEbitda) ? input.evEbitda : null,
      annualizedRoe: Number.isFinite(input.annualizedRoe) ? input.annualizedRoe : null,
      grossMargin: Number.isFinite(input.grossMargin) ? input.grossMargin : null,
      debtRatio: Number.isFinite(input.debtRatio) ? input.debtRatio : null,
      marketCap: Number.isFinite(input.marketCap) ? input.marketCap : null,
      turnover: Number.isFinite(input.turnover) ? input.turnover : null,
      fcfYield: Number.isFinite(input.fcfYield) ? input.fcfYield : null,
      ocf: Number.isFinite(input.ocf) ? input.ocf : null,
      capex: Number.isFinite(input.capex) ? input.capex : null,
      factorValue: params.factorValue,
      factorQuality: params.factorQuality,
      factorDividend: params.factorDividend,
      factorDefensive: params.factorDefensive,
      scoreBreakdown: params.scoreBreakdown,
    },
  };
}

export function evaluateValueFactorPolicy(featureSet: FeatureSet): GenericFactorPolicyPayload {
  const input = toFactorInput(featureSet);
  const filterReasons = resolveCommonFilterReasons(input);
  if (input.pe <= 0 || input.pe > 35) filterReasons.push("pe_out_of_range");
  if (input.pb <= 0 || input.pb > 4.5) filterReasons.push("pb_out_of_range");
  if (input.evEbitda <= 0 || input.evEbitda > 28) filterReasons.push("ev_ebitda_out_of_range");
  if (input.annualizedRoe < 6) filterReasons.push("roe_too_low");
  if (input.debtRatio > 75) filterReasons.push("debt_too_high");

  const factors = resolveFactors(input);
  const score = clamp01(0.65 * factors.factorValue + 0.35 * factors.factorQuality);
  return buildPayload({
    strategyId: "value_factor",
    input,
    score,
    scoreBreakdown: [
      { key: "factorValue", value: factors.factorValue, score: 0.65 * factors.factorValue },
      { key: "factorQuality", value: factors.factorQuality, score: 0.35 * factors.factorQuality },
    ],
    factorValue: factors.factorValue,
    factorQuality: factors.factorQuality,
    factorDividend: factors.factorDividend,
    factorDefensive: factors.factorDefensive,
    filterReasons,
  });
}

export function evaluateQualityFactorPolicy(featureSet: FeatureSet): GenericFactorPolicyPayload {
  const input = toFactorInput(featureSet);
  const filterReasons = resolveCommonFilterReasons(input);
  if (input.annualizedRoe < 10) filterReasons.push("roe_too_low");
  if (input.grossMargin < 12) filterReasons.push("gross_margin_too_low");
  if (input.debtRatio > 70) filterReasons.push("debt_too_high");
  if (input.fcfYield < 0) filterReasons.push("fcf_negative");

  const factors = resolveFactors(input);
  const score = clamp01(0.75 * factors.factorQuality + 0.25 * factors.factorDefensive);
  return buildPayload({
    strategyId: "quality_factor",
    input,
    score,
    scoreBreakdown: [
      { key: "factorQuality", value: factors.factorQuality, score: 0.75 * factors.factorQuality },
      { key: "factorDefensive", value: factors.factorDefensive, score: 0.25 * factors.factorDefensive },
    ],
    factorValue: factors.factorValue,
    factorQuality: factors.factorQuality,
    factorDividend: factors.factorDividend,
    factorDefensive: factors.factorDefensive,
    filterReasons,
  });
}

export function evaluateDividendFactorPolicy(featureSet: FeatureSet): GenericFactorPolicyPayload {
  const input = toFactorInput(featureSet);
  const filterReasons = resolveCommonFilterReasons(input);
  if (input.dividendYield < 3) filterReasons.push("dividend_yield_below_floor");
  if (input.pe <= 0 || input.pe > 26) filterReasons.push("pe_out_of_range");
  if (input.pb <= 0 || input.pb > 3.2) filterReasons.push("pb_out_of_range");
  if (input.annualizedRoe < 8) filterReasons.push("roe_too_low");
  if (input.debtRatio > 72) filterReasons.push("debt_too_high");

  const factors = resolveFactors(input);
  const score = clamp01(0.7 * factors.factorDividend + 0.2 * factors.factorQuality + 0.1 * factors.factorValue);
  return buildPayload({
    strategyId: "dividend_factor",
    input,
    score,
    scoreBreakdown: [
      { key: "factorDividend", value: factors.factorDividend, score: 0.7 * factors.factorDividend },
      { key: "factorQuality", value: factors.factorQuality, score: 0.2 * factors.factorQuality },
      { key: "factorValue", value: factors.factorValue, score: 0.1 * factors.factorValue },
    ],
    factorValue: factors.factorValue,
    factorQuality: factors.factorQuality,
    factorDividend: factors.factorDividend,
    factorDefensive: factors.factorDefensive,
    filterReasons,
  });
}

export function evaluateQualityValuePolicy(featureSet: FeatureSet): GenericFactorPolicyPayload {
  const input = toFactorInput(featureSet);
  const filterReasons = resolveCommonFilterReasons(input);
  if (input.pe <= 0 || input.pe > 30) filterReasons.push("pe_out_of_range");
  if (input.pb <= 0 || input.pb > 4) filterReasons.push("pb_out_of_range");
  if (input.annualizedRoe < 8) filterReasons.push("roe_too_low");
  if (input.grossMargin < 10) filterReasons.push("gross_margin_too_low");
  if (input.debtRatio > 72) filterReasons.push("debt_too_high");

  const factors = resolveFactors(input);
  const score = clamp01(0.5 * factors.factorValue + 0.5 * factors.factorQuality);
  return buildPayload({
    strategyId: "quality_value",
    input,
    score,
    scoreBreakdown: [
      { key: "factorValue", value: factors.factorValue, score: 0.5 * factors.factorValue },
      { key: "factorQuality", value: factors.factorQuality, score: 0.5 * factors.factorQuality },
    ],
    factorValue: factors.factorValue,
    factorQuality: factors.factorQuality,
    factorDividend: factors.factorDividend,
    factorDefensive: factors.factorDefensive,
    filterReasons,
  });
}

export function evaluateDefensiveFactorPolicy(featureSet: FeatureSet): GenericFactorPolicyPayload {
  const input = toFactorInput(featureSet);
  const filterReasons = resolveCommonFilterReasons(input);
  if (input.marketCap < 10_000) filterReasons.push("market_cap_too_small_for_defensive");
  if (input.debtRatio > 65) filterReasons.push("debt_too_high");
  if (input.grossMargin < 12) filterReasons.push("gross_margin_too_low");
  if (input.annualizedRoe < 8) filterReasons.push("roe_too_low");
  if (input.dividendYield < 1.5) filterReasons.push("dividend_yield_too_low");

  const factors = resolveFactors(input);
  const score = clamp01(
    0.55 * factors.factorDefensive + 0.25 * factors.factorQuality + 0.2 * factors.factorDividend,
  );
  return buildPayload({
    strategyId: "defensive_factor",
    input,
    score,
    scoreBreakdown: [
      { key: "factorDefensive", value: factors.factorDefensive, score: 0.55 * factors.factorDefensive },
      { key: "factorQuality", value: factors.factorQuality, score: 0.25 * factors.factorQuality },
      { key: "factorDividend", value: factors.factorDividend, score: 0.2 * factors.factorDividend },
    ],
    factorValue: factors.factorValue,
    factorQuality: factors.factorQuality,
    factorDividend: factors.factorDividend,
    factorDefensive: factors.factorDefensive,
    filterReasons,
  });
}

export function evaluateMultiFactorCorePolicy(featureSet: FeatureSet): GenericFactorPolicyPayload {
  const input = toFactorInput(featureSet);
  const filterReasons = resolveCommonFilterReasons(input);
  if (input.pe <= 0 || input.pe > 35) filterReasons.push("pe_out_of_range");
  if (input.pb <= 0 || input.pb > 4.5) filterReasons.push("pb_out_of_range");
  if (input.annualizedRoe < 6) filterReasons.push("roe_too_low");
  if (input.debtRatio > 75) filterReasons.push("debt_too_high");
  if (input.dividendYield < 1) filterReasons.push("dividend_yield_too_low");

  const factors = resolveFactors(input);
  const score = clamp01(
    0.35 * factors.factorValue +
      0.3 * factors.factorQuality +
      0.2 * factors.factorDividend +
      0.15 * factors.factorDefensive,
  );
  return buildPayload({
    strategyId: "multi_factor_core",
    input,
    score,
    scoreBreakdown: [
      { key: "factorValue", value: factors.factorValue, score: 0.35 * factors.factorValue },
      { key: "factorQuality", value: factors.factorQuality, score: 0.3 * factors.factorQuality },
      { key: "factorDividend", value: factors.factorDividend, score: 0.2 * factors.factorDividend },
      { key: "factorDefensive", value: factors.factorDefensive, score: 0.15 * factors.factorDefensive },
    ],
    factorValue: factors.factorValue,
    factorQuality: factors.factorQuality,
    factorDividend: factors.factorDividend,
    factorDefensive: factors.factorDefensive,
    filterReasons,
  });
}
