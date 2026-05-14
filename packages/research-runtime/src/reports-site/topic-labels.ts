import type { ReportTopicType } from "./types.js";

/** 中文页面名称（计划冻结命名） */
export const TOPIC_DISPLAY_PAGE_NAME: Record<ReportTopicType, string> = {
  "business-quality": "商业质量评估",
  valuation: "估值分析",
  "penetration-return": "穿透回报率定量分析",
  "turtle-strategy": "龟龟投资策略分析",
  "financial-minesweeper": "财报排雷",
};

/** entryId 中使用的短 slug（小写、无点号） */
export const TOPIC_ENTRY_SLUG: Record<ReportTopicType, string> = {
  "business-quality": "biz-quality",
  valuation: "valuation",
  "penetration-return": "penetration",
  "turtle-strategy": "turtle",
  "financial-minesweeper": "minesweeper",
};

export function buildDisplayTitle(input: {
  companyName: string;
  listedCode: string;
  topic: ReportTopicType;
}): string {
  const page = TOPIC_DISPLAY_PAGE_NAME[input.topic];
  return `${input.companyName} (${input.listedCode}) · ${page}`;
}
