import type {
  ScreenerCapabilityBlock,
  ScreenerMarket,
  ScreenerUniverseCapabilityStatus,
  ScreenerUniverseRow,
} from "./types.js";

/** Tier1 运行所需字段（每行应能提供；缺失会导致 Tier1 失真或整表不可用） */
export const SCREENER_FIELDS_REQUIRED_FOR_RUN: (keyof ScreenerUniverseRow)[] = [
  "code",
  "name",
  "market",
  "listDate",
  "industry",
  "close",
  "pb",
  "dv",
  "marketCap",
  "turnover",
];

/** Tier2 主通道财务质量门（缺失时无法做质量筛选，应显式降级而非静默当 0） */
export const SCREENER_FIELDS_REQUIRED_FOR_TIER2_MAIN: (keyof ScreenerUniverseRow)[] = [
  "debtRatio",
  "grossMargin",
  "roe",
  "netProfit",
];

/** 增强/因子字段：可缺省，但缺失时应出现在 warnings 便于解释降级 */
export const SCREENER_FIELDS_OPTIONAL_ENHANCEMENT: (keyof ScreenerUniverseRow)[] = [
  "pe",
  "pledgeRatio",
  "auditResult",
  "ocf",
  "capex",
  "revenue",
  "fcfPositiveYears",
  "payoutRatio",
  "assetDispIncome",
  "nonOperIncome",
  "othIncome",
  "riskFreeRatePct",
  "ebitda",
  "evEbitda",
  "floorPremium",
  "fcfYield",
  "totalAssets",
  "totalLiabilities",
];

function isMissingValue(row: ScreenerUniverseRow, key: keyof ScreenerUniverseRow): boolean {
  const v = row[key];
  if (v === undefined || v === null) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  return false;
}

/** 统计各字段在全表中的缺失行数 */
export function countMissingPerField(
  universe: ScreenerUniverseRow[],
  keys: (keyof ScreenerUniverseRow)[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of keys) {
    let n = 0;
    for (const row of universe) {
      if (isMissingValue(row, key)) n += 1;
    }
    out[String(key)] = n;
  }
  return out;
}

function allRowsMissingField(
  universe: ScreenerUniverseRow[],
  key: keyof ScreenerUniverseRow,
): boolean {
  return universe.length > 0 && universe.every((row) => isMissingValue(row, key));
}

/**
 * 评估 universe 字段分层与 HK 未接入语义（不修改 universe）。
 */
export function buildUniverseCapability(
  market: ScreenerMarket,
  universe: ScreenerUniverseRow[],
): ScreenerCapabilityBlock {
  if (market === "HK" && universe.length === 0) {
    return {
      status: "hk_not_ready",
      reasonCodes: ["hk_screener_universe_not_implemented"],
      messages: [
        "market=HK 且 universe 为空：trade-signal-feed 侧 screener/universe 尚未接入港股，并非筛选条件过严。",
      ],
      fieldTiers: {
        requiredForRun: {
          keys: SCREENER_FIELDS_REQUIRED_FOR_RUN.map(String),
          missingCountByField: {},
          allRowsMissingByField: {},
        },
        requiredForTier2Main: {
          keys: SCREENER_FIELDS_REQUIRED_FOR_TIER2_MAIN.map(String),
          missingCountByField: {},
          allRowsMissingByField: {},
        },
        optionalEnhancement: {
          keys: SCREENER_FIELDS_OPTIONAL_ENHANCEMENT.map(String),
          missingCountByField: {},
        },
      },
    };
  }

  const missRun = countMissingPerField(universe, SCREENER_FIELDS_REQUIRED_FOR_RUN);
  const allMissRun: Record<string, boolean> = {};
  for (const k of SCREENER_FIELDS_REQUIRED_FOR_RUN) {
    allMissRun[String(k)] = allRowsMissingField(universe, k);
  }

  const missT2 = countMissingPerField(universe, SCREENER_FIELDS_REQUIRED_FOR_TIER2_MAIN);
  const allMissT2: Record<string, boolean> = {};
  for (const k of SCREENER_FIELDS_REQUIRED_FOR_TIER2_MAIN) {
    allMissT2[String(k)] = allRowsMissingField(universe, k);
  }

  const missOpt = countMissingPerField(universe, SCREENER_FIELDS_OPTIONAL_ENHANCEMENT);

  const reasonCodes: string[] = [];
  const messages: string[] = [];

  let status: ScreenerUniverseCapabilityStatus = "ok";

  const criticalAllMissing = ["marketCap", "turnover", "pb", "dv"].filter((k) => allMissRun[k]);
  if (universe.length > 0 && criticalAllMissing.length > 0) {
    status = "blocked_missing_required_fields";
    reasonCodes.push("required_for_run_all_rows_missing_critical");
    messages.push(
      `以下 Tier1 关键字段在全部行上缺失，无法可靠跑选股：${criticalAllMissing.join(", ")}。请检查 feed universe 契约与映射。`,
    );
  }

  const t2AllMissingKeys = Object.entries(allMissT2)
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (
    universe.length > 0 &&
    t2AllMissingKeys.length > 0 &&
    status === "ok"
  ) {
    status = "degraded_tier2_fields";
    reasonCodes.push("required_for_tier2_main_all_rows_missing");
    messages.push(
      `以下 Tier2 主通道质量字段在全部行上缺失，质量门将退化为“全未通过/全按 0 处理”风险；建议仅跑 --tier1-only 或补齐字段：${t2AllMissingKeys.join(", ")}。`,
    );
  }

  if (universe.length > 0 && status === "ok") {
    const partialT2 = Object.entries(missT2).filter(([, c]) => c > 0 && c < universe.length);
    if (partialT2.length > 0) {
      reasonCodes.push("required_for_tier2_main_partial_missing");
      messages.push(
        `部分行缺失 Tier2 主通道字段（缺失计数）：${partialT2.map(([k, c]) => `${k}=${c}`).join(", ")}。`,
      );
    }
  }

  return {
    status,
    reasonCodes,
    messages,
    fieldTiers: {
      requiredForRun: {
        keys: SCREENER_FIELDS_REQUIRED_FOR_RUN.map(String),
        missingCountByField: missRun,
        allRowsMissingByField: allMissRun,
      },
      requiredForTier2Main: {
        keys: SCREENER_FIELDS_REQUIRED_FOR_TIER2_MAIN.map(String),
        missingCountByField: missT2,
        allRowsMissingByField: allMissT2,
      },
      optionalEnhancement: {
        keys: SCREENER_FIELDS_OPTIONAL_ENHANCEMENT.map(String),
        missingCountByField: missOpt,
      },
    },
  };
}
