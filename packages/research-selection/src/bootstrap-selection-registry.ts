import { registerSelectionPlugin } from "./selection-registry.js";
import { HIGH_DIVIDEND_CN_A_SELECTION_ID, TURTLE_CN_A_SELECTION_ID } from "./selection-id.js";
import { createHighDividendCnASelectionPlugin } from "./selections/high-dividend-cn-a/index.js";
import { createTurtleCnASelectionPlugin } from "./selections/turtle-cn-a/index.js";

export function bootstrapSelectionRegistry(): void {
  registerSelectionPlugin(TURTLE_CN_A_SELECTION_ID, () => createTurtleCnASelectionPlugin());
  registerSelectionPlugin(HIGH_DIVIDEND_CN_A_SELECTION_ID, () => createHighDividendCnASelectionPlugin());
}
