import type { StrategyPlugin } from "./contracts.js";
import { createTurtleStrategyPlugin } from "./turtle/plugin.js";
import { createValueV1StrategyPlugin } from "./value-v1/plugin.js";
import type { WorkflowStrategyId } from "../contracts/workflow-run-types.js";
import type { FeatureSet } from "@trade-signal/research-contracts";
import { evaluateHighDividendPolicy } from "./high-dividend/plugin.js";
import { evaluateTurtlePolicy } from "./turtle/policy-evaluator.js";
export { listStrategyDefinitions, resolveStrategyDefinition } from "./definitions.js";

let cachedTurtle: StrategyPlugin | undefined;
let cachedValueV1: StrategyPlugin | undefined;

/**
 * 解析 workflow 在 Stage E 使用的策略插件。
 * 默认 `turtle`；`value_v1` 为样板策略，用于验证插件注册与编排隔离。
 */
export function resolveWorkflowStrategyPlugin(strategyId?: WorkflowStrategyId): StrategyPlugin {
  const id = strategyId ?? "turtle";
  if (id === "value_v1") {
    cachedValueV1 ??= createValueV1StrategyPlugin();
    return cachedValueV1;
  }
  cachedTurtle ??= createTurtleStrategyPlugin();
  return cachedTurtle;
}

export type PolicyPayloadEvaluator = (featureSet: FeatureSet) => Record<string, unknown>;

export function resolvePolicyPayloadEvaluator(policyId: string): PolicyPayloadEvaluator {
  if (policyId === "policy:high_dividend") {
    return (featureSet) => evaluateHighDividendPolicy(featureSet);
  }
  if (policyId === "policy:turtle") {
    return (featureSet) => evaluateTurtlePolicy(featureSet);
  }
  if (policyId === "policy:value_v1") {
    return () => ({ strategyId: "value_v1", stub: true });
  }
  throw new Error(`[policy] 未注册 payload evaluator: ${policyId}`);
}
