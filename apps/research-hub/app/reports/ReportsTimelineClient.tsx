"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { MethodologyGuideLink } from "@/components/MethodologyGuideLink";
import { TOPIC_LABEL_ZH, TOPIC_TYPES, type ReportTopicType } from "@/lib/reports/topic-labels";

dayjs.extend(utc);
dayjs.extend(timezone);

const REPORTS_TIMEZONE = process.env.NEXT_PUBLIC_REPORTS_TIMEZONE?.trim() || "local";

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

type TimelineGroup = {
  key: "today" | "recent" | "earlier";
  label: string;
  items: TimelineItem[];
};

function statusBadge(it: Pick<TimelineItem, "requiredFieldsStatus" | "topicType">): string {
  if (it.topicType === "business-quality" && it.requiredFieldsStatus === "degraded") return "结构化预览";
  if (it.requiredFieldsStatus === "complete") return "完整";
  if (it.requiredFieldsStatus === "degraded") return "降级";
  return "缺失";
}

function statusPrefix(it: Pick<TimelineItem, "requiredFieldsStatus" | "topicType">): string {
  return it.topicType === "business-quality" && it.requiredFieldsStatus === "degraded" ? "状态" : "字段";
}

function statusClass(s: TimelineItem["requiredFieldsStatus"]): string {
  if (s === "complete") return "rh-status rh-status--complete";
  if (s === "degraded") return "rh-status rh-status--degraded";
  return "rh-status rh-status--missing";
}

function formatIsoUtcText(value: string): string {
  const parsed = dayjs(value);
  if (!parsed.isValid()) return value;
  if (REPORTS_TIMEZONE === "Asia/Shanghai") {
    return `${parsed.tz("Asia/Shanghai").format("YYYY-MM-DD HH:mm:ss")} 北京时间`;
  }
  if (REPORTS_TIMEZONE !== "local") {
    return `${parsed.tz(REPORTS_TIMEZONE).format("YYYY-MM-DD HH:mm:ss")} ${REPORTS_TIMEZONE}`;
  }
  return parsed.format("YYYY-MM-DD HH:mm:ss");
}

function buildReportDetailHref(item: TimelineItem, filters: { topic?: string | null; code?: string }): string {
  const base = item.href.replace(/\/$/, "");
  const query = new URLSearchParams();
  if (filters.topic && TOPIC_TYPES.includes(filters.topic as ReportTopicType)) query.set("topic", filters.topic);
  if (filters.code) query.set("code", filters.code);
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
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

  const grouped = useMemo<TimelineGroup[]>(() => {
    const today: TimelineItem[] = [];
    const recent: TimelineItem[] = [];
    const earlier: TimelineItem[] = [];
    const now = dayjs();
    const startOfToday = now.startOf("day");
    const sevenDaysAgo = now.subtract(7, "day").startOf("day");

    for (const it of filtered) {
      const at = dayjs(it.publishedAt);
      if (!at.isValid()) {
        earlier.push(it);
        continue;
      }
      if (at.isAfter(startOfToday) || at.isSame(startOfToday)) {
        today.push(it);
      } else if (at.isAfter(sevenDaysAgo) || at.isSame(sevenDaysAgo)) {
        recent.push(it);
      } else {
        earlier.push(it);
      }
    }

    return [
      { key: "today", label: "今天", items: today },
      { key: "recent", label: "近 7 天", items: recent },
      { key: "earlier", label: "更早", items: earlier },
    ].filter((group) => group.items.length > 0);
  }, [filtered]);

  const codes = useMemo(() => [...new Set(items.map((i) => i.code))].sort(), [items]);

  return (
    <div className="rh-container reports-root">
      <header className="rh-page-header">
        <h1 className="rh-page-title">报告中心</h1>
        <p className="rh-page-desc">按发布时间浏览报告，并可用专题、股票代码筛选。</p>
        <p className="rh-page-desc">
          <MethodologyGuideLink from="reports" />
        </p>
        {indexMeta ? (
          <p className="rh-page-meta">
            索引 {indexMeta.version} · 生成 {formatIsoUtcText(indexMeta.generatedAt)} · 条目 {indexMeta.entryCount}
          </p>
        ) : null}
      </header>

      <div className="rh-filter-sticky-wrap">
        <section className="rh-filter-row rh-filter-row--compact" aria-label="按专题筛选">
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

        <section className="rh-filter-row rh-filter-row--compact" aria-label="按代码筛选">
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
      </div>

      {filtered.length === 0 ? (
        <div className="rh-empty" role="status">
          {items.length === 0 ? (
            <>暂无报告。</>
          ) : (
            <>没有符合当前筛选条件的条目。可点击「全部」或调整筛选。</>
          )}
        </div>
      ) : (
        <>
          {grouped.map((group) => (
            <section key={group.key} className="rh-report-group" aria-label={`报告分组：${group.label}`}>
              <h2 className="rh-report-group-title">{group.label}</h2>
              <ul className="rh-report-list" aria-label={`${group.label}报告列表`}>
                {group.items.map((it) => (
                  <li key={it.entryId} className="rh-report-list-item">
                    <h3 className="rh-report-list-title">{it.displayTitle}</h3>
                    <Link
                      className="rh-stretched-link"
                      href={buildReportDetailHref(it, { topic: topicFilter, code: codeFilter })}
                      aria-label={`打开报告：${it.displayTitle}`}
                    />
                    <div className="rh-report-list-meta">
                      <span title={it.publishedAt}>{formatIsoUtcText(it.publishedAt)}</span>
                      <span className="rh-pill">{TOPIC_LABEL_ZH[it.topicType]}</span>
                      <span>置信度 {it.confidenceState}</span>
                      <span className={statusClass(it.requiredFieldsStatus)}>
                        {statusPrefix(it)} {statusBadge(it)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
