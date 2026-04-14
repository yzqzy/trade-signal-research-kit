import type { ScreenerConfig, ScreenerConfigOverrides, ScreenerMarket } from "./types.js";

const CN_A_CONFIG: ScreenerConfig = {
  minListingYears: 3,
  minMarketCapYi: 5,
  minTurnoverPct: 0.1,
  maxPb: 10,
  maxPe: 50,
  includeBank: false,
  obsChannelLimit: 50,
  tier2MainLimit: 150,
  dvWeight: 0.4,
  peWeight: 0.3,
  pbWeight: 0.3,
  maxPledgePct: 70,
  minRoe: 8,
  minGrossMargin: 15,
  maxDebtRatio: 70,
  minRoeObs: 0,
  minFcfMarginObs: 0,
  minFcfPositiveYearsObs: 2,
  obsRequireOcfPositive: true,
  weightRoe: 0.2,
  weightFcfYield: 0.2,
  weightPenetrationR: 0.25,
  weightEvEbitda: 0.15,
  weightFloorPremium: 0.2,
  weightScreenerScore: 0.7,
  weightReportScore: 0.3,
  cacheDir: "output/.screener_cache",
  cacheStockBasicTtlDays: 7,
  cacheDailyBasicTtlDays: 0,
  cacheRfTtlDays: 1,
  cacheTier2TtlHours: 24,
  cacheTier2FinancialTtlHours: 168,
  cacheTier2MarketTtlHours: 24,
  cacheTier2GlobalTtlHours: 24,
};

const HK_CONFIG: ScreenerConfig = {
  ...CN_A_CONFIG,
  minTurnoverPct: 5,
  maxPb: 8,
  maxPe: 30,
};

export function getDefaultScreenerConfig(market: ScreenerMarket): ScreenerConfig {
  return market === "HK" ? HK_CONFIG : CN_A_CONFIG;
}

function scoringWeightSum(cfg: ScreenerConfig): number {
  return (
    cfg.weightRoe +
    cfg.weightFcfYield +
    cfg.weightPenetrationR +
    cfg.weightEvEbitda +
    cfg.weightFloorPremium
  );
}

export function validateScreenerConfig(cfg: ScreenerConfig): string[] {
  const errors: string[] = [];
  const w = scoringWeightSum(cfg);
  if (Math.abs(w - 1) > 0.01) {
    errors.push(`Scoring weights must sum to 1.0, got ${w.toFixed(3)}`);
  }
  if (cfg.minListingYears < 0) errors.push("minListingYears must be >= 0");
  if (cfg.minMarketCapYi < 0) errors.push("minMarketCapYi must be >= 0");
  if (cfg.tier2MainLimit < 1) errors.push("tier2MainLimit must be >= 1");
  if (cfg.obsChannelLimit < 0) errors.push("obsChannelLimit must be >= 0");
  if (cfg.minFcfPositiveYearsObs < 0 || cfg.minFcfPositiveYearsObs > 5) {
    errors.push("minFcfPositiveYearsObs must be 0-5");
  }
  return errors;
}

export function resolveScreenerConfig(
  market: ScreenerMarket,
  overrides: ScreenerConfigOverrides = {},
): ScreenerConfig {
  const base = getDefaultScreenerConfig(market);
  const { minMarketCap, hardVetoDebtRatio: _legacyVeto, ...rest } = overrides;
  void _legacyVeto;
  let merged: ScreenerConfig = { ...base, ...rest };
  if (minMarketCap !== undefined && rest.minMarketCapYi === undefined) {
    merged = { ...merged, minMarketCapYi: minMarketCap / 100 };
  }
  return merged;
}
