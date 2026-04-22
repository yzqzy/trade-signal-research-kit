/** 与 `site/reports` 发布协议对齐的专题类型（用于 views 与 meta） */
export type ReportTopicType =
  | "business-quality"
  | "valuation"
  | "penetration-return"
  | "turtle-strategy";

export type RequiredFieldsStatus = "complete" | "degraded" | "missing";

export type ConfidenceState = "high" | "medium" | "low" | "unknown";

export type SiteReportsIndex = {
  /** 协议 v2：`entries/<id>/content.md` + `meta.json`，不再产出 `index.html` */
  version: "2.0";
  generatedAt: string;
  entryCount: number;
  /** 站点内时间流列表页路径（相对站点根，如 /reports/） */
  timelineHref: string;
};

export type TimelineItem = {
  entryId: string;
  displayTitle: string;
  topicType: ReportTopicType;
  code: string;
  publishedAt: string;
  href: string;
  requiredFieldsStatus: RequiredFieldsStatus;
  confidenceState: ConfidenceState;
};

export type EntryMeta = {
  entryId: string;
  code: string;
  topicType: ReportTopicType;
  displayTitle: string;
  publishedAt: string;
  sourceRunId: string;
  requiredFieldsStatus: RequiredFieldsStatus;
  confidenceState: ConfidenceState;
  /** 正文相对路径（相对 `entries/<entryId>/`），固定为 `content.md` */
  contentFile: "content.md";
  /** 可选：来源 manifest 路径（便于追溯） */
  sourceManifestPath?: string;
};
