export type ReportTopicType =
  | "business-quality"
  | "valuation"
  | "penetration-return"
  | "turtle-strategy";

export const TOPIC_LABEL_ZH: Record<ReportTopicType, string> = {
  "business-quality": "商业质量评估",
  valuation: "估值分析",
  "penetration-return": "穿透回报率定量分析",
  "turtle-strategy": "龟龟投资策略分析",
};

export const TOPIC_TYPES: ReportTopicType[] = [
  "business-quality",
  "valuation",
  "penetration-return",
  "turtle-strategy",
];
