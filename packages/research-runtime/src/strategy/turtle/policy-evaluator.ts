import type { FeatureSet, SourceRef } from "@trade-signal/research-contracts";
import { evaluateTurtleCore, type TurtleMetricQualityStatus } from "./core.js";

type DecisionConfidence = "high" | "medium" | "low";

export type TurtlePolicyPayload = {
  strategyId: "turtle";
  market?: string;
  name?: string;
  industry?: string;
  passesUniverseGate: boolean;
  filterReasons: string[];
  score: number;
  decision: "buy" | "watch" | "avoid";
  confidence: DecisionConfidence;
  metrics: {
    penetrationR: number | null;
    refinedPenetrationGG: number | null;
    rf: number | null;
    thresholdII: number | null;
    ownerEarningsI: number | null;
    roe: number | null;
    fcfYield: number | null;
    evEbitda: number | null;
    floorPremium: number | null;
    payoutM: number | null;
    taxQ: number | null;
    buybackO: number | null;
    aa: number | null;
    ocf: number | null;
    capex: number | null;
    grossMargin: number | null;
    debtRatio: number | null;
    pe: number | null;
    pb: number | null;
    dividendYield: number | null;
    marketCap: number | null;
    turnover: number | null;
    rVsII: "below_rf" | "fail" | "marginal" | "pass" | null;
    ggVsII: "below_rf" | "fail" | "marginal" | "pass" | null;
    safetyMarginPct: number | null;
    metricQuality: TurtleMetricQualityStatus;
    missingFields: string[];
    fallbacksUsed: string[];
  };
};

function finiteNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function text(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function parseListDate(raw: unknown): Date | undefined {
  const value = text(raw);
  if (!value || value.length < 8) return undefined;
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(4, 6));
  const d = Number(value.slice(6, 8));
  if (![y, m, d].every(Number.isFinite)) return undefined;
  return new Date(y, m - 1, d);
}

function listedAtLeastYears(raw: unknown, minYears: number): boolean {
  const listed = parseListDate(raw);
  if (!listed) return false;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setFullYear(cutoff.getFullYear() - minYears);
  return listed.getTime() <= cutoff.getTime();
}

function computeTurtleMetrics(f: Record<string, unknown>): TurtlePolicyPayload["metrics"] {
  const core = evaluateTurtleCore({
    market: text(f.market),
    code: text(f.code),
    marketCap: finiteNumber(f.marketCap),
    netProfit: finiteNumber(f.netProfit),
    minorityPnL: finiteNumber(f.minorityPnL),
    ocf: finiteNumber(f.ocf),
    capex: finiteNumber(f.capex),
    depreciationAmortization: finiteNumber(f.depreciationAmortization),
    payoutRatio: finiteNumber(f.payoutRatio),
    taxRate: finiteNumber(f.taxRate),
    buybackCancellationAmount: finiteNumber(f.buybackCancellationAmount),
    riskFreeRatePct: finiteNumber(f.riskFreeRatePct),
    assetDispIncome: finiteNumber(f.assetDispIncome),
    nonOperIncome: finiteNumber(f.nonOperIncome),
    othIncome: finiteNumber(f.othIncome),
    fcfYield: finiteNumber(f.fcfYield),
    evEbitda: finiteNumber(f.evEbitda),
    floorPremium: finiteNumber(f.floorPremium),
    pe: finiteNumber(f.pe),
    roe: finiteNumber(f.roe) !== undefined ? finiteNumber(f.roe)! * 4 : undefined,
  });
  const dividendYield = finiteNumber(f.dv);
  const marketCap = finiteNumber(f.marketCap);

  const pe = finiteNumber(f.pe);
  const floorPremium = core.metrics.floorPremium;
  const totalLiabilities = finiteNumber(f.totalLiabilities) ?? 0;
  const totalAssets = finiteNumber(f.totalAssets) ?? 0;
  const ebitda = finiteNumber(f.ebitda) ?? finiteNumber(f.netProfit);
  const evEbitda =
    finiteNumber(f.evEbitda) ??
    (marketCap !== undefined && ebitda !== undefined && ebitda > 0
      ? (marketCap + Math.max(0, totalLiabilities) - Math.max(0, totalAssets) * 0.15) / ebitda
      : undefined);

  return {
    penetrationR: core.metrics.penetrationR,
    refinedPenetrationGG: core.metrics.refinedPenetrationGG,
    rf: core.metrics.rf,
    thresholdII: core.metrics.thresholdII,
    ownerEarningsI: core.metrics.ownerEarningsI,
    roe: finiteNumber(f.roe) !== undefined ? finiteNumber(f.roe)! * 4 : null,
    fcfYield: core.metrics.fcfYield,
    evEbitda: evEbitda ?? null,
    floorPremium: floorPremium,
    payoutM: core.metrics.payoutM,
    taxQ: core.metrics.taxQ,
    buybackO: core.metrics.buybackO,
    aa: core.metrics.availableCashAA,
    ocf: finiteNumber(f.ocf) ?? null,
    capex: finiteNumber(f.capex) ?? null,
    grossMargin: finiteNumber(f.grossMargin) ?? null,
    debtRatio: finiteNumber(f.debtRatio) ?? null,
    pe: pe ?? null,
    pb: finiteNumber(f.pb) ?? null,
    dividendYield: dividendYield ?? null,
    marketCap: marketCap ?? null,
    turnover: finiteNumber(f.turnover) ?? null,
    rVsII: core.verdict.rVsII,
    ggVsII: core.verdict.ggVsII,
    safetyMarginPct: core.verdict.safetyMarginPct,
    metricQuality: core.quality.status,
    missingFields: core.quality.missingFields,
    fallbacksUsed: core.quality.fallbacksUsed,
  };
}

function preliminaryScore(metrics: TurtlePolicyPayload["metrics"]): number {
  const roe = metrics.roe ?? 0;
  const r = metrics.penetrationR ?? 0;
  const fcf = metrics.fcfYield ?? 0;
  const ev = metrics.evEbitda ?? 50;
  const floor = metrics.floorPremium ?? 30;
  const roeScore = Math.max(0, Math.min(1, (roe - 8) / 17));
  const rScore = Math.max(0, Math.min(1, r / Math.max(metrics.thresholdII ?? 4.5, 1)));
  const fcfScore = Math.max(0, Math.min(1, fcf / 8));
  const evScore = Math.max(0, Math.min(1, 1 - (ev - 5) / 25));
  const floorScore = Math.max(0, Math.min(1, 1 - floor / 20));
  return 0.2 * roeScore + 0.25 * rScore + 0.2 * fcfScore + 0.15 * evScore + 0.2 * floorScore;
}

function resolveDecision(score: number, metrics: TurtlePolicyPayload["metrics"], pass: boolean): {
  decision: TurtlePolicyPayload["decision"];
  confidence: DecisionConfidence;
} {
  if (!pass) return { decision: "avoid", confidence: "low" };
  const r = metrics.penetrationR ?? 0;
  const threshold = metrics.thresholdII ?? 4.5;
  if (score >= 0.65 && r >= threshold) return { decision: "buy", confidence: score >= 0.78 ? "high" : "medium" };
  if (score >= 0.45 && r >= (metrics.rf ?? 2.5)) return { decision: "watch", confidence: score >= 0.55 ? "medium" : "low" };
  return { decision: "avoid", confidence: "low" };
}

export function evaluateTurtlePolicy(featureSet: FeatureSet): TurtlePolicyPayload {
  const f = featureSet.features ?? {};
  const name = text(f.name);
  const industry = text(f.industry);
  const market = text(f.market);
  const metrics = computeTurtleMetrics(f);
  const reasons: string[] = [];

  if (market !== "CN_A") reasons.push("market_not_cn_a");
  if (/\*ST|ST|PT|退市/u.test(name ?? "")) reasons.push("special_treatment_stock");
  if ((industry ?? "").includes("银行")) reasons.push("bank_industry_excluded");
  if (!listedAtLeastYears(f.listDate, 3)) reasons.push("listing_age_too_short");
  if ((metrics.marketCap ?? 0) < 500) reasons.push("market_cap_too_low");
  if ((metrics.turnover ?? 0) < 0.1) reasons.push("turnover_too_low");
  if ((metrics.pb ?? 0) <= 0 || (metrics.pb ?? 0) > 10) reasons.push("pb_out_of_range");
  if ((metrics.pe ?? 0) <= 0 || (metrics.pe ?? 0) > 50) reasons.push("pe_out_of_range");
  if ((metrics.dividendYield ?? 0) <= 0) reasons.push("dividend_yield_missing");
  if (metrics.ocf === null || metrics.capex === null) reasons.push("missing_cashflow_for_penetration_r");
  if ((metrics.roe ?? 0) < 8) reasons.push("low_roe");
  if ((metrics.grossMargin ?? 0) < 15) reasons.push("low_gross_margin");
  if ((metrics.debtRatio ?? 100) > 70) reasons.push("high_debt_ratio");
  if (metrics.penetrationR === null) reasons.push("missing_penetration_r");
  if (metrics.penetrationR !== null && metrics.rf !== null && metrics.penetrationR < metrics.rf) {
    reasons.push("penetration_r_below_rf");
  }

  const passesUniverseGate = reasons.length === 0;
  const score = preliminaryScore(metrics);
  const verdict = resolveDecision(score, metrics, passesUniverseGate);
  return {
    strategyId: "turtle",
    market,
    name,
    industry,
    passesUniverseGate,
    filterReasons: reasons,
    score,
    decision: verdict.decision,
    confidence: verdict.confidence,
    metrics,
  };
}

export function turtlePolicyReasonRefs(featureSet: FeatureSet, payload: TurtlePolicyPayload): SourceRef[] {
  const refs = [...(featureSet.sourceRefs ?? [])];
  if (payload.metrics.penetrationR !== null) {
    refs.push({ kind: "policySlice", ref: "policy:turtle.metrics.penetrationR", note: "穿透 R 来自 OCF、Capex、分红率与市值" });
  }
  return refs;
}
