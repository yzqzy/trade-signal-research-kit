import { registerTopicPlugin } from "./topic-registry.js";
import { TOPIC_IDS } from "./topic-ids.js";

function registerBasicTopic(id: string, siteTopicType?: string): void {
  registerTopicPlugin(id, () => ({
    id,
    version: "0.0.0",
    render: ({ runId, code, markdownPath, evidenceRefs }) => ({
      topicId: id,
      runId,
      code,
      siteTopicType,
      markdownPath,
      qualityStatus: markdownPath ? "draft" : "blocked",
      blockingReasons: markdownPath ? [] : ["缺少 Topic Markdown 路径"],
      evidenceRefs: evidenceRefs ?? [],
    }),
  }));
}

export function bootstrapTopicRegistry(): void {
  registerBasicTopic(TOPIC_IDS.businessSixDimension, "business-quality");
  registerBasicTopic(TOPIC_IDS.valuation, "valuation");
  registerBasicTopic(TOPIC_IDS.penetrationReturn, "penetration-return");
  registerBasicTopic(TOPIC_IDS.turtleStrategyExplainer, "turtle-strategy");
  registerBasicTopic(TOPIC_IDS.earningsAlert);
}
