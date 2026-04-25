import { registerTopicPlugin } from "./topic-registry.js";
import { TOPIC_IDS } from "./topic-ids.js";

export function bootstrapTopicRegistry(): void {
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
}
