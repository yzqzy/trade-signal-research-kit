import { POLICY_IDS } from "./policy-ids.js";
import { registerPolicyPlugin, resolvePolicyEvaluator } from "./policy-registry.js";
import type { PolicyPluginContext } from "./policy-registry.js";

export function bootstrapPolicyRegistry(): void {
  const createAdapter = (id: string) => ({
    id,
    version: "0.1.0",
    evaluate: async ({ runId, code, payload, featureSet }: PolicyPluginContext) => {
      const evaluator = resolvePolicyEvaluator(id);
      const evaluatedPayload = evaluator
        ? await evaluator({ policyId: id, runId, code, payload, featureSet })
        : undefined;
      return {
        policyId: id,
        runId,
        code,
        payload:
          evaluatedPayload ??
          payload ??
          (featureSet?.features as Record<string, unknown> | undefined) ??
          {},
        reasonRefs: [],
      };
    },
  });

  registerPolicyPlugin(POLICY_IDS.turtle, () => ({
    ...createAdapter(POLICY_IDS.turtle),
  }));
  registerPolicyPlugin(POLICY_IDS.valueV1, () => ({
    ...createAdapter(POLICY_IDS.valueV1),
  }));
  registerPolicyPlugin(POLICY_IDS.highDividend, () => ({
    ...createAdapter(POLICY_IDS.highDividend),
  }));
  registerPolicyPlugin(POLICY_IDS.valueFactor, () => ({
    ...createAdapter(POLICY_IDS.valueFactor),
  }));
  registerPolicyPlugin(POLICY_IDS.qualityFactor, () => ({
    ...createAdapter(POLICY_IDS.qualityFactor),
  }));
  registerPolicyPlugin(POLICY_IDS.dividendFactor, () => ({
    ...createAdapter(POLICY_IDS.dividendFactor),
  }));
  registerPolicyPlugin(POLICY_IDS.qualityValue, () => ({
    ...createAdapter(POLICY_IDS.qualityValue),
  }));
  registerPolicyPlugin(POLICY_IDS.defensiveFactor, () => ({
    ...createAdapter(POLICY_IDS.defensiveFactor),
  }));
  registerPolicyPlugin(POLICY_IDS.multiFactorCore, () => ({
    ...createAdapter(POLICY_IDS.multiFactorCore),
  }));
}
