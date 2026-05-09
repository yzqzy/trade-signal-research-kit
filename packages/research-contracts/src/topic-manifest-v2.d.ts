export type ReportTopicType = "business-quality" | "valuation" | "penetration-return" | "turtle-strategy";
export declare const TOPIC_MANIFEST_VERSION: "1.0";
export declare function siteTopicTypeToV2TopicId(topic: ReportTopicType): string;
export type TopicManifestEntryV1 = {
    v2TopicId: string;
    siteTopicType: ReportTopicType;
    entryId: string;
    requiredFieldsStatus: string;
    sourceMarkdownRelative?: string;
    finalizedMarkdownRelative?: string;
    qualityStatus?: "complete" | "degraded" | "blocked" | "draft";
    blockingReasons?: string[];
};
export type TopicManifestV1 = {
    manifestVersion: typeof TOPIC_MANIFEST_VERSION;
    generatedAt: string;
    runDirHint?: string;
    runProfile?: "stock_full" | "selection_fast" | "publish_only";
    outputLayout?: {
        code: string;
        runId: string;
    };
    publishedAt?: string;
    topics: TopicManifestEntryV1[];
};
