import type { SelectionPlugin } from "../../selection-registry.js";
import { MULTI_FACTOR_CORE_CN_A_SELECTION_ID } from "../../selection-id.js";
import { composeMultiFactorCoreCnASelection } from "./compose.js";

export function createMultiFactorCoreCnASelectionPlugin(): SelectionPlugin {
  return {
    id: MULTI_FACTOR_CORE_CN_A_SELECTION_ID,
    version: "0.1.0",
    compose: (ctx) => composeMultiFactorCoreCnASelection(ctx),
  };
}
