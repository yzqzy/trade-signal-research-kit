import { registerSelectionPlugin } from "./selection-registry.js";
import { selectionId } from "./selection-id.js";

export function bootstrapSelectionRegistry(): void {
  const id = selectionId("policy:turtle", "cn_a_universe");
  registerSelectionPlugin(id, () => ({
    id,
    version: "0.0.0",
    compose: ({ runId, universe }) => ({
      selectionId: id,
      runId,
      universe,
      candidates: [],
      drillDownTopicIds: [],
    }),
  }));
}
