import type { SelectionPlugin } from "../../selection-registry.js";
import { HIGH_DIVIDEND_CN_A_SELECTION_ID } from "../../selection-id.js";
import { composeHighDividendCnASelection } from "./compose.js";

export function createHighDividendCnASelectionPlugin(): SelectionPlugin {
  return {
    id: HIGH_DIVIDEND_CN_A_SELECTION_ID,
    version: "0.1.0",
    compose: (ctx) => composeHighDividendCnASelection(ctx),
  };
}
