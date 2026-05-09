export type TurtleMetricQualityStatus = "complete" | "partial" | "blocked";

export type TurtleCoreInput = {
  market?: string;
  code?: string;
  marketCap?: number;
  netProfit?: number;
  minorityPnL?: number;
  ocf?: number;
  capex?: number;
  depreciationAmortization?: number;
  payoutRatios?: number[];
  payoutRatio?: number;
  taxRate?: number;
  buybackCancellationAmount?: number;
  riskFreeRatePct?: number;
  assetDispIncome?: number;
  nonOperIncome?: number;
  othIncome?: number;
  fcfYield?: number;
  evEbitda?: number;
  floorPremium?: number;
  pe?: number;
  roe?: number;
};

export type TurtleCoreResult = {
  metrics: {
    ownerEarningsI: number | null;
    availableCashAA: number | null;
    penetrationR: number | null;
    refinedPenetrationGG: number | null;
    rf: number;
    thresholdII: number;
    payoutM: number | null;
    taxQ: number;
    buybackO: number;
    fcfYield: number | null;
    evEbitda: number | null;
    floorPremium: number | null;
    roe: number | null;
  };
  verdict: {
    rVsII: "below_rf" | "fail" | "marginal" | "pass" | null;
    ggVsII: "below_rf" | "fail" | "marginal" | "pass" | null;
    safetyMarginPct: number | null;
  };
  quality: {
    status: TurtleMetricQualityStatus;
    missingFields: string[];
    fallbacksUsed: string[];
  };
};

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function avg(values: number[]): number | undefined {
  const nums = values.filter((v) => Number.isFinite(v));
  if (nums.length === 0) return undefined;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function classifyVsThreshold(value: number | null, rf: number, thresholdII: number): TurtleCoreResult["verdict"]["rVsII"] {
  if (value === null) return null;
  if (value < rf) return "below_rf";
  if (value < thresholdII * 0.5) return "fail";
  if (value < thresholdII) return "marginal";
  return "pass";
}

export function evaluateTurtleCore(input: TurtleCoreInput): TurtleCoreResult {
  const missingFields: string[] = [];
  const fallbacksUsed: string[] = [];
  const rf = finite(input.riskFreeRatePct) ?? 2.5;
  if (finite(input.riskFreeRatePct) === undefined) fallbacksUsed.push("risk_free_rate_default_2_5");
  const thresholdII = input.market === "HK" ? Math.max(5, rf + 3) : input.market === "US" ? Math.max(4, rf + 2) : Math.max(3.5, rf + 2);

  const marketCap = finite(input.marketCap);
  const netProfit = finite(input.netProfit);
  const ocf = finite(input.ocf);
  const capex = finite(input.capex);
  if (marketCap === undefined || marketCap <= 0) missingFields.push("marketCap");
  if (netProfit === undefined) missingFields.push("netProfit");
  if (ocf === undefined) missingFields.push("ocf");
  if (capex === undefined) missingFields.push("capex");

  const payoutM =
    avg(input.payoutRatios ?? []) ??
    finite(input.payoutRatio);
  if (payoutM === undefined) missingFields.push("payoutRatio");

  const taxQ = finite(input.taxRate) ?? 20;
  if (finite(input.taxRate) === undefined) fallbacksUsed.push("tax_rate_default_20");
  const buybackO = finite(input.buybackCancellationAmount) ?? 0;
  if (finite(input.buybackCancellationAmount) === undefined) fallbacksUsed.push("buyback_cancellation_default_0");

  const da = finite(input.depreciationAmortization);
  const maintenanceCapex = capex !== undefined ? Math.abs(capex) : undefined;
  const ownerEarningsI =
    netProfit !== undefined
      ? da !== undefined && maintenanceCapex !== undefined
        ? netProfit + da - maintenanceCapex
        : netProfit
      : undefined;
  if (netProfit !== undefined && da === undefined) fallbacksUsed.push("owner_earnings_net_profit_fallback");

  const assetDispIncome = finite(input.assetDispIncome) ?? 0;
  const nonOperIncome = finite(input.nonOperIncome) ?? 0;
  const othIncome = finite(input.othIncome) ?? 0;
  const availableCashAA =
    ocf !== undefined && capex !== undefined
      ? ocf + assetDispIncome - nonOperIncome - othIncome - Math.abs(capex)
      : undefined;

  const distributionMultiplier = payoutM !== undefined ? (payoutM / 100) * (1 - taxQ / 100) : undefined;
  const penetrationR =
    ownerEarningsI !== undefined && distributionMultiplier !== undefined && marketCap !== undefined && marketCap > 0
      ? ((ownerEarningsI * distributionMultiplier + buybackO) / marketCap) * 100
      : undefined;
  const refinedPenetrationGG =
    availableCashAA !== undefined && distributionMultiplier !== undefined && marketCap !== undefined && marketCap > 0
      ? ((availableCashAA * distributionMultiplier + buybackO) / marketCap) * 100
      : undefined;

  const fcfYield =
    finite(input.fcfYield) ??
    (ocf !== undefined && capex !== undefined && marketCap !== undefined && marketCap > 0
      ? ((ocf - Math.abs(capex)) / marketCap) * 100
      : undefined);
  if (finite(input.fcfYield) === undefined && fcfYield !== undefined) fallbacksUsed.push("fcf_yield_from_ocf_capex");

  const floorPremium = finite(input.floorPremium);
  if (floorPremium === undefined) missingFields.push("floorPremium");

  const blocked = ["marketCap", "ocf", "capex", "payoutRatio"].some((field) => missingFields.includes(field));
  const status: TurtleMetricQualityStatus = blocked ? "blocked" : missingFields.length > 0 || fallbacksUsed.length > 0 ? "partial" : "complete";
  const r = penetrationR ?? null;
  const gg = refinedPenetrationGG ?? null;

  return {
    metrics: {
      ownerEarningsI: ownerEarningsI ?? null,
      availableCashAA: availableCashAA ?? null,
      penetrationR: r,
      refinedPenetrationGG: gg,
      rf,
      thresholdII,
      payoutM: payoutM ?? null,
      taxQ,
      buybackO,
      fcfYield: fcfYield ?? null,
      evEbitda: finite(input.evEbitda) ?? null,
      floorPremium: floorPremium ?? null,
      roe: finite(input.roe) ?? null,
    },
    verdict: {
      rVsII: classifyVsThreshold(r, rf, thresholdII),
      ggVsII: classifyVsThreshold(gg, rf, thresholdII),
      safetyMarginPct: gg !== null ? gg - thresholdII : r !== null ? r - thresholdII : null,
    },
    quality: {
      status,
      missingFields,
      fallbacksUsed,
    },
  };
}
