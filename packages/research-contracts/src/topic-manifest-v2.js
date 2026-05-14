export const TOPIC_MANIFEST_VERSION = "1.0";
export function siteTopicTypeToV2TopicId(topic) {
    switch (topic) {
        case "business-quality":
            return "topic:business-six-dimension";
        case "valuation":
            return "topic:valuation";
        case "penetration-return":
            return "topic:penetration-return";
        case "turtle-strategy":
            return "topic:turtle-strategy-explainer";
        case "financial-minesweeper":
            return "topic:financial-minesweeper";
        default: {
            const _exhaustive = topic;
            return _exhaustive;
        }
    }
}
