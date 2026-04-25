export const POLICY_IDS = {
  turtle: "policy:turtle",
  valueV1: "policy:value_v1",
} as const;

export const TOPIC_IDS = {
  businessSixDimension: "topic:business-six-dimension",
  valuation: "topic:valuation",
  penetrationReturn: "topic:penetration-return",
  turtleStrategyExplainer: "topic:turtle-strategy-explainer",
  earningsAlert: "topic:earnings-alert",
} as const;

export const FEATURE_PREFIX = "feature:";

export function selectionId(policyId: string, universe: string): string {
  const u = universe.replace(/[^a-zA-Z0-9_-]+/g, "_");
  return `selection:${policyId.replace(/^policy:/u, "")}:${u}`;
}
