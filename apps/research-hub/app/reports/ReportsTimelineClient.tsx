"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { TOPIC_LABEL_ZH, TOPIC_TYPES, type ReportTopicType } from "@/lib/reports/topic-labels";

export type TimelineItem = {
  entryId: string;
  displayTitle: string;
  topicType: ReportTopicType;
  code: string;
  publishedAt: string;
  href: string;
  requiredFieldsStatus: "complete" | "degraded" | "missing";
  confidenceState: "high" | "medium" | "low" | "unknown";
};

function statusBadge(s: TimelineItem["requiredFieldsStatus"]): string {
  if (s === "complete") return "完整";
  if (s === "degraded") return "降级";
  return "缺失";
}

function statusClass(s: TimelineItem["requiredFieldsStatus"]): string {
  if (s === "complete") return "rh-status rh-status--complete";
  if (s === "degraded") return "rh-status rh-status--degraded";
  return "rh-status rh-status--missing";
}

export function ReportsTimelineClient({
  items,
  indexMeta,
}: {
  items: TimelineItem[];
  indexMeta: { version: string; generatedAt: string; entryCount: number } | null;
}) {
  const sp = useSearchParams();
  const topicFilter = sp.get("topic") as ReportTopicType | null;
  const codeFilter = sp.get("code")?.trim() ?? "";

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (topicFilter && TOPIC_TYPES.includes(topicFilter) && it.topicType !== topicFilter) return false;
      if (codeFilter && it.code !== codeFilter) return false;
      return true;
    });
  }, [items, topicFilter, codeFilter]);

  const codes = useMemo(() => [...new Set(items.map((i) => i.code))].sort(), [items]);

  return (
    <div className="rh-container reports-root">
      <header className="rh-page-header">
        <h1 className="rh-page-title">报告中心</h1>
        <p className="rh-page-desc">
          时间流与按专题、代码筛选。数据在构建时来自 <code className="rh-kbd">public/reports/**</code>；由 monorepo 根{" "}
          <code className="rh-kbd">pnpm run reports-site:emit</code> 与 <code className="rh-kbd">pnpm run sync:reports-to-app</code>{" "}
          生成。
        </p>
        {indexMeta ? (
          <p className="rh-page-meta">
            索引 {indexMeta.version} · 生成 {indexMeta.generatedAt} · 条目 {indexMeta.entryCount}
          </p>
        ) : null}
      </header>

      <section className="rh-filter-row" aria-label="按专题筛选">
        <span className="rh-filter-label">专题</span>
        <Link className={`rh-chip${!topicFilter ? " rh-chip--active" : ""}`} href="/reports">
          全部
        </Link>
        {TOPIC_TYPES.map((t) => (
          <Link
            key={t}
            className={`rh-chip${topicFilter === t ? " rh-chip--active" : ""}`}
            href={`/reports?topic=${encodeURIComponent(t)}`}
          >
            {TOPIC_LABEL_ZH[t]}
          </Link>
        ))}
      </section>

      <section className="rh-filter-row" aria-label="按代码筛选">
        <span className="rh-filter-label">代码</span>
        <Link
          className={`rh-chip${!codeFilter ? " rh-chip--active" : ""}`}
          href={topicFilter ? `/reports?topic=${encodeURIComponent(topicFilter)}` : "/reports"}
        >
          全部
        </Link>
        {codes.map((c) => (
          <Link
            key={c}
            className={`rh-chip${codeFilter === c ? " rh-chip--active" : ""}`}
            href={`/reports?code=${encodeURIComponent(c)}${topicFilter ? `&topic=${encodeURIComponent(topicFilter)}` : ""}`}
          >
            {c}
          </Link>
        ))}
      </section>

      {filtered.length === 0 ? (
        <div className="rh-empty" role="status">
          暂无报告条目。请在 monorepo 根执行 <code className="rh-kbd">pnpm run reports-site:emit -- --run-dir &lt;run&gt;</code>，再执行{" "}
          <code className="rh-kbd">pnpm run sync:reports-to-app</code>，然后{" "}
          <code className="rh-kbd">pnpm --filter @trade-signal/research-hub run build</code>。
        </div>
      ) : (
        <ul className="rh-card-list">
          {filtered.map((it) => (
            <li key={it.entryId} className="rh-card">
              <Link className="rh-card-title" href={it.href.replace(/\/$/, "")}>
                {it.displayTitle}
              </Link>
              <div className="rh-card-meta">
                <span>{it.publishedAt}</span>
                <span className="rh-pill">{TOPIC_LABEL_ZH[it.topicType]}</span>
                <span>置信度 {it.confidenceState}</span>
                <span className={statusClass(it.requiredFieldsStatus)}>字段 {statusBadge(it.requiredFieldsStatus)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
