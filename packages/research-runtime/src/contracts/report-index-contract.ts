import type { ReportTopicType, RequiredFieldsStatus } from "./report-topic-contract.js";

export type ConfidenceState = "high" | "medium" | "low" | "unknown";

export interface ReportIndexItem {
  code: string;
  companyName: string;
  runId: string;
  topicType: ReportTopicType;
  displayTitle: string; // 个股名称 (代码) · 页面名称
  fileNameCn: string;
  fileNameSlug: string;
  requiredFieldsStatus: RequiredFieldsStatus;
  confidenceState: ConfidenceState;
  href: string;
  generatedAt: string; // ISO-8601
}

export interface ReportIndexDocument {
  schemaVersion: "1.0";
  generatedAt: string; // ISO-8601
  items: ReportIndexItem[];
}

export function buildDisplayTitle(
  companyName: string,
  code: string,
  pageName: string,
): string {
  return `${companyName} (${code}) · ${pageName}`;
}
