export type TopicSiteType =
  | "business-quality"
  | "valuation"
  | "penetration-return"
  | "turtle-strategy";

export const TOPIC_MANIFEST_VERSION = "1.0" as const;

export function siteTopicTypeToV2TopicId(topic: TopicSiteType): string {
  switch (topic) {
    case "business-quality":
      return "topic:business-six-dimension";
    case "valuation":
      return "topic:valuation";
    case "penetration-return":
      return "topic:penetration-return";
    case "turtle-strategy":
      return "topic:turtle-strategy-explainer";
    default: {
      const _exhaustive: never = topic;
      return _exhaustive;
    }
  }
}

export type TopicManifestEntryV1 = {
  v2TopicId: string;
  siteTopicType: TopicSiteType;
  entryId: string;
  requiredFieldsStatus: string;
  sourceMarkdownRelative?: string;
};

export type TopicManifestV1 = {
  manifestVersion: typeof TOPIC_MANIFEST_VERSION;
  generatedAt: string;
  runDirHint?: string;
  runProfile?: "stock_full" | "selection_fast" | "publish_only";
  outputLayout?: { code: string; runId: string };
  publishedAt?: string;
  topics: TopicManifestEntryV1[];
};
