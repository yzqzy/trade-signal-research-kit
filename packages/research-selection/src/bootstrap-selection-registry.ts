import { registerSelectionPlugin } from "./selection-registry.js";
import {
  DEFENSIVE_FACTOR_CN_A_SELECTION_ID,
  DIVIDEND_FACTOR_CN_A_SELECTION_ID,
  HIGH_DIVIDEND_CN_A_SELECTION_ID,
  MULTI_FACTOR_CORE_CN_A_SELECTION_ID,
  QUALITY_FACTOR_CN_A_SELECTION_ID,
  QUALITY_VALUE_CN_A_SELECTION_ID,
  TURTLE_CN_A_SELECTION_ID,
  VALUE_FACTOR_CN_A_SELECTION_ID,
} from "./selection-id.js";
import { createDefensiveFactorCnASelectionPlugin } from "./selections/defensive-factor-cn-a/index.js";
import { createDividendFactorCnASelectionPlugin } from "./selections/dividend-factor-cn-a/index.js";
import { createHighDividendCnASelectionPlugin } from "./selections/high-dividend-cn-a/index.js";
import { createMultiFactorCoreCnASelectionPlugin } from "./selections/multi-factor-core-cn-a/index.js";
import { createQualityFactorCnASelectionPlugin } from "./selections/quality-factor-cn-a/index.js";
import { createQualityValueCnASelectionPlugin } from "./selections/quality-value-cn-a/index.js";
import { createTurtleCnASelectionPlugin } from "./selections/turtle-cn-a/index.js";
import { createValueFactorCnASelectionPlugin } from "./selections/value-factor-cn-a/index.js";

export function bootstrapSelectionRegistry(): void {
  registerSelectionPlugin(TURTLE_CN_A_SELECTION_ID, () => createTurtleCnASelectionPlugin());
  registerSelectionPlugin(HIGH_DIVIDEND_CN_A_SELECTION_ID, () => createHighDividendCnASelectionPlugin());
  registerSelectionPlugin(VALUE_FACTOR_CN_A_SELECTION_ID, () => createValueFactorCnASelectionPlugin());
  registerSelectionPlugin(QUALITY_FACTOR_CN_A_SELECTION_ID, () => createQualityFactorCnASelectionPlugin());
  registerSelectionPlugin(DIVIDEND_FACTOR_CN_A_SELECTION_ID, () => createDividendFactorCnASelectionPlugin());
  registerSelectionPlugin(QUALITY_VALUE_CN_A_SELECTION_ID, () => createQualityValueCnASelectionPlugin());
  registerSelectionPlugin(DEFENSIVE_FACTOR_CN_A_SELECTION_ID, () => createDefensiveFactorCnASelectionPlugin());
  registerSelectionPlugin(MULTI_FACTOR_CORE_CN_A_SELECTION_ID, () => createMultiFactorCoreCnASelectionPlugin());
}
