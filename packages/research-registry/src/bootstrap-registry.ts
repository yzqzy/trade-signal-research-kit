import { POLICY_IDS, TOPIC_IDS, selectionId } from "./topic-ids.js";
import {
  registerPolicyPlugin,
  registerSelectionPlugin,
  registerTopicPlugin,
} from "./plugin-registry.js";

export function bootstrapV2PluginRegistry(): void {
  registerPolicyPlugin(POLICY_IDS.turtle, () => ({ id: POLICY_IDS.turtle, version: "0.0.0" }));
  registerPolicyPlugin(POLICY_IDS.valueV1, () => ({ id: POLICY_IDS.valueV1, version: "0.0.0" }));

  registerTopicPlugin(TOPIC_IDS.businessSixDimension, () => ({
    id: TOPIC_IDS.businessSixDimension,
    version: "0.0.0",
  }));
  registerTopicPlugin(TOPIC_IDS.valuation, () => ({ id: TOPIC_IDS.valuation, version: "0.0.0" }));
  registerTopicPlugin(TOPIC_IDS.penetrationReturn, () => ({
    id: TOPIC_IDS.penetrationReturn,
    version: "0.0.0",
  }));
  registerTopicPlugin(TOPIC_IDS.turtleStrategyExplainer, () => ({
    id: TOPIC_IDS.turtleStrategyExplainer,
    version: "0.0.0",
  }));
  registerTopicPlugin(TOPIC_IDS.earningsAlert, () => ({
    id: TOPIC_IDS.earningsAlert,
    version: "0.0.0",
  }));

  registerSelectionPlugin(selectionId(POLICY_IDS.turtle, "cn_a_universe"), () => ({
    id: selectionId(POLICY_IDS.turtle, "cn_a_universe"),
    version: "0.0.0",
  }));
}
