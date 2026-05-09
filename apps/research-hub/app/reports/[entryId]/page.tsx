import path from "node:path";
import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";

import { ReportAttachments, type ReportAttachmentView, type ReportSourceLinkView } from "@/components/ReportAttachments";
import { ReportBackLink } from "@/components/ReportBackLink";
import { ReportMarkdownBody } from "@/components/ReportMarkdownBody";
import { MethodologyGuideLink } from "@/components/MethodologyGuideLink";
import { TOPIC_LABEL_ZH, type ReportTopicType } from "@/lib/reports/topic-labels";

const PLACEHOLDER_ENTRY_ID = "__no_entries__";
const DEFAULT_CONTENT_FILE = "content.md";

type EntryMeta = {
  entryId: string;
  code: string;
  topicType: ReportTopicType;
  displayTitle: string;
  publishedAt: string;
  sourceRunId: string;
  requiredFieldsStatus: "complete" | "degraded" | "missing";
  confidenceState: "high" | "medium" | "low" | "unknown";
  contentFile?: string;
  attachments?: Array<Omit<ReportAttachmentView, "content">>;
  sourceLinks?: ReportSourceLinkView[];
};

function ReportBackLinkBoundary() {
  return (
    <Suspense
      fallback={
        <Link className="rh-back-link" href="/reports">
          ← 报告中心
        </Link>
      }
    >
      <ReportBackLink />
    </Suspense>
  );
}

function metaStatusClass(s: EntryMeta["requiredFieldsStatus"]): string {
  if (s === "complete") return "rh-pill rh-pill--success";
  if (s === "degraded") return "rh-pill rh-pill--warn";
  return "rh-pill rh-pill--danger";
}

function metaStatusBadge(meta: Pick<EntryMeta, "requiredFieldsStatus" | "topicType">): string {
  if (meta.topicType === "business-quality" && meta.requiredFieldsStatus === "degraded") return "结构化预览";
  if (meta.requiredFieldsStatus === "complete") return "完整";
  if (meta.requiredFieldsStatus === "degraded") return "降级";
  return "缺失";
}

function metaStatusPrefix(meta: Pick<EntryMeta, "requiredFieldsStatus" | "topicType">): string {
  return meta.topicType === "business-quality" && meta.requiredFieldsStatus === "degraded" ? "状态" : "字段";
}

function stripLeadingMarkdownTitle(markdown: string): string {
  return markdown.replace(/^\s*#\s+.+?(?:\r?\n|$)/u, "").trimStart();
}

/**
 * 静态导出（`output: "export"`）要求至少返回一条路径；空目录时返回占位 id。
 */
export function generateStaticParams(): { entryId: string }[] {
  const root = path.join(process.cwd(), "public", "reports", "entries");
  try {
    const ids = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((id) => id !== PLACEHOLDER_ENTRY_ID);
    return ids.length > 0 ? ids.map((entryId) => ({ entryId })) : [{ entryId: PLACEHOLDER_ENTRY_ID }];
  } catch {
    return [{ entryId: PLACEHOLDER_ENTRY_ID }];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ entryId: string }>;
}): Promise<Metadata> {
  const { entryId } = await params;
  if (entryId === PLACEHOLDER_ENTRY_ID) {
    return { title: "暂无报告 · 研究站" };
  }
  const metaPath = path.join(process.cwd(), "public", "reports", "entries", entryId, "meta.json");
  try {
    const raw = await readFile(metaPath, "utf-8");
    const meta = JSON.parse(raw) as EntryMeta;
    return { title: `${meta.displayTitle} · 研究站` };
  } catch {
    return { title: "报告详情 · 研究站" };
  }
}

export default async function ReportEntryPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = await params;
  if (entryId === PLACEHOLDER_ENTRY_ID) {
    return (
      <div className="rh-container rh-container--narrow">
        <ReportBackLinkBoundary />
        <div className="rh-empty" role="status">
          当前没有可展示的报告。
        </div>
      </div>
    );
  }

  const base = path.join(process.cwd(), "public", "reports", "entries", entryId);
  let meta: EntryMeta;
  let markdown: string;
  let attachments: ReportAttachmentView[] = [];
  try {
    const metaRaw = await readFile(path.join(base, "meta.json"), "utf-8");
    meta = JSON.parse(metaRaw) as EntryMeta;
    const contentName = meta.contentFile?.trim() || DEFAULT_CONTENT_FILE;
    markdown = await readFile(path.join(base, contentName), "utf-8");
    attachments = await Promise.all(
      (meta.attachments ?? []).map(async (att) => {
        const safeHref = att.href.replace(/^\/+/u, "");
        if (safeHref.includes("..")) return att;
        const content = att.previewable ? await readFile(path.join(base, safeHref), "utf-8").catch(() => undefined) : undefined;
        return {
          ...att,
          href: `/reports/entries/${entryId}/${safeHref}`,
          content,
        };
      }),
    );
  } catch {
    notFound();
  }

  return (
    <div className="rh-container">
      <ReportBackLinkBoundary />
      <header className="rh-report-header">
        <div className="rh-report-hero">
          <h1 className="rh-report-title">{meta.displayTitle}</h1>
          <div className="rh-report-meta">
            <time className="rh-report-meta-primary" dateTime={meta.publishedAt}>
              {meta.publishedAt}
            </time>
            <span className="rh-pill">{TOPIC_LABEL_ZH[meta.topicType]}</span>
            <span className="rh-pill rh-pill--mono">代码 {meta.code}</span>
            <span className="rh-pill rh-pill--mono">run {meta.sourceRunId}</span>
            <span className="rh-pill">置信度 {meta.confidenceState}</span>
            <span className={metaStatusClass(meta.requiredFieldsStatus)}>
              {metaStatusPrefix(meta)} {metaStatusBadge(meta)}
            </span>
            <MethodologyGuideLink from="reports" variant="pill" />
          </div>
          <p className="rh-ai-disclaimer">本页内容可能包含模型辅助生成结果，需结合原始公告与财务数据复核，不构成投资建议。</p>
        </div>
      </header>
      <ReportMarkdownBody markdown={stripLeadingMarkdownTitle(markdown)} />
      <ReportAttachments attachments={attachments} sourceLinks={meta.sourceLinks ?? []} />
    </div>
  );
}
