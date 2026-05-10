import type { SelectionPlugin } from "../../selection-registry.js";
import { QUALITY_VALUE_CN_A_SELECTION_ID } from "../../selection-id.js";
import { composeQualityValueCnASelection } from "./compose.js";

export function createQualityValueCnASelectionPlugin(): SelectionPlugin {
  return {
    id: QUALITY_VALUE_CN_A_SELECTION_ID,
    version: "0.1.0",
    compose: (ctx) => composeQualityValueCnASelection(ctx),
  };
}
