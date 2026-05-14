/** 与 `site/reports` 发布协议对齐的专题类型（用于 views 与 meta） */
export type ReportTopicType =
  | "business-quality"
  | "valuation"
  | "penetration-return"
  | "turtle-strategy"
  | "financial-minesweeper";

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

export type RankingCapabilityStatus =
  | "ok"
  | "degraded_tier2_fields"
  | "blocked_missing_required_fields"
  | "hk_not_ready";

export type RankingMetricValue = string | number | boolean | null;

export type RankingMetricMap = Record<string, RankingMetricValue>;

export type RankingViewItem = {
  rank: number;
  code: string;
  name: string;
  industry?: string;
  score: number;
  decision: string;
  confidence: ConfidenceState;
  href?: string;
  metrics: RankingMetricMap;
};

export type RankingListView = {
  listId: string;
  strategyId: string;
  strategyLabel: string;
  market: string;
  mode: string;
  generatedAt: string;
  capabilityStatus?: RankingCapabilityStatus;
  capabilityReasonCodes?: string[];
  /** 上游策略综合分降序后取的前 N 名上限，与 `items.length <= topN` 一致 */
  topN?: number;
  /** 截断前的候选总数（含未通过门禁，便于审计） */
  totalCandidates?: number;
  items: RankingViewItem[];
};

export type SiteRankingsIndex = {
  version: "1.0";
  generatedAt: string;
  strategyCount: number;
  listCount: number;
  defaultStrategyId?: string;
  lists: RankingListView[];
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

export type ReportAttachment = {
  id: string;
  label: string;
  kind: "markdown" | "json";
  href: string;
  previewable: boolean;
  bytes?: number;
  lines?: number;
};

export type ReportSourceLink = {
  id: string;
  label: string;
  kind: "pdf" | "external";
  href: string;
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
  /** 可公开查看/下载的净化证据包附件（相对 `entries/<entryId>/`） */
  attachments?: ReportAttachment[];
  /** 官方外部来源链接，如原始年报 PDF */
  sourceLinks?: ReportSourceLink[];
  /** 可选：来源 manifest 路径（便于追溯） */
  sourceManifestPath?: string;
};
