import type { DataPackMarketParsed, Factor1BResult, Factor2Result, Factor3Result } from "../types.js";
import { evaluateTurtleCore } from "../../../strategy/turtle/core.js";

function avg(values: Array<number | undefined>): number {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function runFactor3(market: DataPackMarketParsed, factor1b: Factor1BResult, factor2: Factor2Result): Factor3Result {
  const seq = market.financials.slice(0, 5).map((f) => {
    const S = f.revenue ?? 0;
    const T = 0;
    const U = 0;
    const realCashIncome = S - T - U;
    const maintenanceCapex = Math.abs(f.capex ?? 0) * (factor1b.moduleRatings["3.1资本消耗"] === "capital-hungry" ? 1.2 : 0.85);
    const FF = (f.ocf ?? 0) - maintenanceCapex;
    return { year: f.year, S, FF };
  });

  const FFSeries = seq.map((x) => x.FF);
  const AA = avg(FFSeries.slice(0, 2));
  const FF = avg(FFSeries.slice(0, 3));
  const marketCap = market.marketCap ?? 0;
  const latest = market.financials[0];
  const payoutRatios = market.financials
    .slice(0, 3)
    .map((f) => (f.dps && f.basicEps && f.basicEps > 0 ? (f.dps / f.basicEps) * 100 : undefined))
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const core = evaluateTurtleCore({
    market: market.market,
    code: market.code,
    marketCap,
    netProfit: latest?.netProfit,
    minorityPnL: latest?.minorityPnL,
    ocf: latest?.ocf,
    capex: latest?.capex,
    payoutRatios,
    taxRate: factor2.Q,
    buybackCancellationAmount: factor2.O,
    riskFreeRatePct: market.rf,
  });
  const GG = core.metrics.refinedPenetrationGG ?? undefined;
  const HH = GG !== undefined && factor2.R !== undefined ? factor2.R - GG : undefined;
  if (core.quality.status === "blocked") {
    return {
      passed: false,
      reason: `因子3无法计算：核心字段缺失（${core.quality.missingFields.join(", ")}）`,
      AA,
      FF,
      GG,
      HH,
      extrapolationTrust: "low",
      mismatchWithFactor1: false,
    };
  }

  const extrapolationTrust: Factor3Result["extrapolationTrust"] = Math.abs(HH ?? 0) > 5 ? "low" : Math.abs(HH ?? 0) > 2 ? "medium" : "high";
  const mismatchWithFactor1 = extrapolationTrust === "low" && factor1b.moduleRatings["3.3护城河"] === "优质";

  if (mismatchWithFactor1) {
    return {
      passed: false,
      reason: "因子3-S11：精算结果与因子1预期背离且无法解释",
      AA,
      FF,
      GG,
      HH,
      extrapolationTrust,
      mismatchWithFactor1,
    };
  }

  return {
    passed: true,
    AA,
    FF,
    GG,
    HH,
    extrapolationTrust,
    mismatchWithFactor1,
  };
}
