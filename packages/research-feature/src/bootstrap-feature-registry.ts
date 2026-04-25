import { registerFeaturePlugin } from "./feature-registry.js";

/** 占位：后续 Feature 插件在此注册；全仓编排由 @trade-signal/research-runtime 统一 bootstrap。 */
export function bootstrapFeatureRegistry(): void {
  registerFeaturePlugin("feature:placeholders", () => ({
    id: "feature:placeholders",
    version: "0.0.0",
    compute: ({ runId, code }) => ({
      runId,
      code,
      features: {},
      sourceRefs: [],
    }),
  }));
}
