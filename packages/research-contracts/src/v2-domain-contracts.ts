/**
 * 架构 V2 领域契约（TS 真源骨架）。
 * 文档真源：docs/architecture/v2-domain-contract.md
 */

export type SourceRef = {
  kind: "file" | "uri" | "jsonPointer" | "policySlice";
  ref: string;
  note?: string;
};

export type RunProfile = "stock_full" | "selection_fast" | "publish_only";

export type RunStateV2 = {
  feature_ready: boolean;
  policy_ready: boolean;
  selection_ready: boolean;
  topic_ready: boolean;
  publish_ready: boolean;
};

export interface RawDataPackMeta {
  runId: string;
  code: string;
  area?: string;
}

export interface FeatureSet {
  runId: string;
  code: string;
  features: Record<string, unknown>;
  sourceRefs: SourceRef[];
}

export interface PolicyResult {
  policyId: string;
  runId: string;
  code: string;
  payload: Record<string, unknown>;
  reasonRefs: SourceRef[];
}

export interface TopicReport {
  topicId: string;
  runId: string;
  code: string;
  siteTopicType?: string;
  markdownPath?: string;
  evidenceRefs: SourceRef[];
}

export interface SelectionCandidate {
  code: string;
  score?: number;
  policyContributions?: Record<string, number>;
}

export interface SelectionResult {
  selectionId: string;
  runId: string;
  universe: string;
  candidates: SelectionCandidate[];
  drillDownTopicIds?: string[];
}
