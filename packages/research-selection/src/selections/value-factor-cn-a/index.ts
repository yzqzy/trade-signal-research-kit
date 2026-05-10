import type { SelectionPlugin } from "../../selection-registry.js";
import { VALUE_FACTOR_CN_A_SELECTION_ID } from "../../selection-id.js";
import { composeValueFactorCnASelection } from "./compose.js";

export function createValueFactorCnASelectionPlugin(): SelectionPlugin {
  return {
    id: VALUE_FACTOR_CN_A_SELECTION_ID,
    version: "0.1.0",
    compose: (ctx) => composeValueFactorCnASelection(ctx),
  };
}
