import { POLICY_IDS } from "./policy-ids.js";
import { registerPolicyPlugin } from "./policy-registry.js";

export function bootstrapPolicyRegistry(): void {
  registerPolicyPlugin(POLICY_IDS.turtle, () => ({ id: POLICY_IDS.turtle, version: "0.0.0" }));
  registerPolicyPlugin(POLICY_IDS.valueV1, () => ({ id: POLICY_IDS.valueV1, version: "0.0.0" }));
}
