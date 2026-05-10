import type { SelectionPlugin } from "../../selection-registry.js";
import { DIVIDEND_FACTOR_CN_A_SELECTION_ID } from "../../selection-id.js";
import { composeDividendFactorCnASelection } from "./compose.js";

export function createDividendFactorCnASelectionPlugin(): SelectionPlugin {
  return {
    id: DIVIDEND_FACTOR_CN_A_SELECTION_ID,
    version: "0.1.0",
    compose: (ctx) => composeDividendFactorCnASelection(ctx),
  };
}
