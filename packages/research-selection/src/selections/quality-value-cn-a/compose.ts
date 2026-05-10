import type { SelectionResult } from "@trade-signal/research-contracts";
import type { SelectionPluginContext } from "../../selection-registry.js";
import { composeDecisionRankedSelection } from "../shared/compose-decision-ranked.js";

export function composeQualityValueCnASelection(ctx: SelectionPluginContext): SelectionResult {
  return composeDecisionRankedSelection(ctx, {
    policyId: "policy:quality_value",
    contributionKey: "qualityValueScore",
  });
}
