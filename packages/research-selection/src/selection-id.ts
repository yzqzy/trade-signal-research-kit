export function selectionId(policyId: string, universe: string): string {
  const u = universe.replace(/[^a-zA-Z0-9_-]+/g, "_");
  return `selection:${policyId.replace(/^policy:/u, "")}:${u}`;
}

export const HIGH_DIVIDEND_CN_A_SELECTION_ID = "selection:high_dividend:cn_a" as const;
export const TURTLE_CN_A_SELECTION_ID = "selection:turtle:cn_a_universe" as const;
export const VALUE_FACTOR_CN_A_SELECTION_ID = "selection:value_factor:cn_a" as const;
export const QUALITY_FACTOR_CN_A_SELECTION_ID = "selection:quality_factor:cn_a" as const;
export const DIVIDEND_FACTOR_CN_A_SELECTION_ID = "selection:dividend_factor:cn_a" as const;
export const QUALITY_VALUE_CN_A_SELECTION_ID = "selection:quality_value:cn_a" as const;
export const DEFENSIVE_FACTOR_CN_A_SELECTION_ID = "selection:defensive_factor:cn_a" as const;
export const MULTI_FACTOR_CORE_CN_A_SELECTION_ID = "selection:multi_factor_core:cn_a" as const;
