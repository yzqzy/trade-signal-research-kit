import { POLICY_IDS } from "./policy-ids.js";
import { registerPolicyPlugin } from "./policy-registry.js";

export function bootstrapPolicyRegistry(): void {
  registerPolicyPlugin(POLICY_IDS.turtle, () => ({
    id: POLICY_IDS.turtle,
    version: "0.0.0",
    evaluate: ({ runId, code, payload }) => ({
      policyId: POLICY_IDS.turtle,
      runId,
      code,
      payload: payload ?? {},
      reasonRefs: [],
    }),
  }));
  registerPolicyPlugin(POLICY_IDS.valueV1, () => ({
    id: POLICY_IDS.valueV1,
    version: "0.0.0",
    evaluate: ({ runId, code, payload }) => ({
      policyId: POLICY_IDS.valueV1,
      runId,
      code,
      payload: payload ?? {},
      reasonRefs: [],
    }),
  }));
}
