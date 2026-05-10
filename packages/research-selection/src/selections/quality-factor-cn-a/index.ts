import type { SelectionPlugin } from "../../selection-registry.js";
import { QUALITY_FACTOR_CN_A_SELECTION_ID } from "../../selection-id.js";
import { composeQualityFactorCnASelection } from "./compose.js";

export function createQualityFactorCnASelectionPlugin(): SelectionPlugin {
  return {
    id: QUALITY_FACTOR_CN_A_SELECTION_ID,
    version: "0.1.0",
    compose: (ctx) => composeQualityFactorCnASelection(ctx),
  };
}
