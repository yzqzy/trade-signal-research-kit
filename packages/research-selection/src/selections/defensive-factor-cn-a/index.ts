import type { SelectionPlugin } from "../../selection-registry.js";
import { DEFENSIVE_FACTOR_CN_A_SELECTION_ID } from "../../selection-id.js";
import { composeDefensiveFactorCnASelection } from "./compose.js";

export function createDefensiveFactorCnASelectionPlugin(): SelectionPlugin {
  return {
    id: DEFENSIVE_FACTOR_CN_A_SELECTION_ID,
    version: "0.1.0",
    compose: (ctx) => composeDefensiveFactorCnASelection(ctx),
  };
}
