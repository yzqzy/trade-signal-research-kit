import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { RankingBackLink } from "@/components/RankingBackLink";
import { getRankingStrategyMeta } from "@/lib/rankings/strategies";

import { capabilityClass, capabilityLabel, formatRankingTime } from "../ranking-format";
import { readRankingsData } from "../read-rankings";

function RankingBackLinkBoundary() {
  return (
    <Suspense
      fallback={
        <Link className="rh-back-link" href="/rankings">
          ← 策略榜单中心
        </Link>
      }
    >
      <RankingBackLink />
    </Suspense>
  );
}

function renderMetricGroups(
  strategyMeta: ReturnType<typeof getRankingStrategyMeta>,
  columns: ReturnType<typeof getRankingStrategyMeta>["columns"],
  item: Parameters<ReturnType<typeof getRankingStrategyMeta>["columns"][number]["render"]>[0],
) {
  const columnMap = new Map(columns.map((column) => [column.key, column]));
  const groupedKeys = new Set(strategyMeta.metricGroups.flatMap((group) => group.keys));
  const groups = strategyMeta.metricGroups
    .map((group) => ({
      ...group,
      columns: group.keys.map((key) => columnMap.get(key)).filter((column): column is (typeof columns)[number] => Boolean(column)),
    }))
    .filter((group) => group.columns.length > 0);
  const leftovers = columns
    .slice(5)
    .filter((column) => !groupedKeys.has(column.key));

  return (
    <>
      {groups.map((group) => (
        <section key={group.label} className="rh-ranking-metric-group">
          <h3>{group.label}</h3>
          <div className="rh-ranking-card-metrics">
            {group.columns.map((column) => (
              <span key={column.key} className="rh-ranking-metric-cell">
                <strong>{column.label}</strong>
                <em>{column.render(item)}</em>
              </span>
            ))}
          </div>
        </section>
      ))}
      {leftovers.length > 0 ? (
        <section className="rh-ranking-metric-group">
          <h3>其他指标</h3>
          <div className="rh-ranking-card-metrics">
            {leftovers.map((column) => (
              <span key={column.key} className="rh-ranking-metric-cell">
                <strong>{column.label}</strong>
                <em>{column.render(item)}</em>
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

export async function generateStaticParams() {
  const data = await readRankingsData();
  return data.lists.map((list) => ({ listId: list.listId }));
}

export default async function RankingDetailPage({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const data = await readRankingsData();
  const list = data.lists.find((item) => item.listId === listId);
  if (!list) notFound();

  const strategyMeta = getRankingStrategyMeta(list.strategyId);
  const columns = strategyMeta.columns;
  const metricColumnCount = Math.max(columns.length - 5, 0);

  return (
    <div className="rh-container rankings-root">
      <RankingBackLinkBoundary />
      <header className="rh-page-header">
        <p className="rh-page-meta">
          <Link href="/rankings">策略榜单中心</Link> / {strategyMeta.label}
        </p>
        <h1 className="rh-page-title">
          {strategyMeta.label} · {list.market} · {list.mode}
        </h1>
        <p className="rh-page-desc">{strategyMeta.shortDescription}</p>
        <p className="rh-page-meta">
          更新时间 {formatRankingTime(list.generatedAt)} · 条目 {list.items.length} · 候选 {list.totalCandidates ?? list.items.length} ·
          指标 {metricColumnCount}
        </p>
        <div className="rh-card-meta">
          <span className="rh-pill">{strategyMeta.label}</span>
          <span className="rh-pill rh-pill--mono">{list.market}</span>
          <span className="rh-pill rh-pill--mono">{list.mode}</span>
          <span className={capabilityClass(list)}>{capabilityLabel(list)}</span>
        </div>
      </header>

      <section className="rh-criteria-box" aria-label="榜单筛选条件">
        <p className="rh-criteria-title">筛选条件</p>
        <p className="rh-criteria-note">{strategyMeta.criteriaSummary}</p>
        <details className="rh-criteria-details">
          <summary>展开完整筛选与判定规则</summary>
          <ul>
            {strategyMeta.criteriaDetails.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      </section>

      <section className="rh-ranking-metric-guide" aria-label="榜单展示指标">
        <p className="rh-criteria-title">展示指标</p>
        <div className="rh-metric-chip-row">
          {columns.slice(5).map((column) => (
            <span key={column.key} className="rh-pill rh-pill--mono">
              {column.label}
            </span>
          ))}
        </div>
      </section>

      <section className="rh-ranking-block">
        <div className="rh-ranking-cards">
          {list.items.map((item) => (
            <article key={`${list.listId}-${item.code}-card`} className="rh-card">
              <div className="rh-ranking-card-top">
                <span className="rh-pill rh-pill--mono">#{item.rank}</span>
                <span className="rh-pill">{strategyMeta.decisionLabel(item.decision)}</span>
                <span className="rh-pill rh-pill--mono">score {item.score.toFixed(4)}</span>
              </div>
              <h2 className="rh-card-title">
                {item.href ? <Link href={item.href}>{item.code} {item.name}</Link> : `${item.code} ${item.name}`}
              </h2>
              <p className="rh-page-meta">{columns.find((column) => column.key === "industry")?.render(item)}</p>
              {renderMetricGroups(strategyMeta, columns, item)}
            </article>
          ))}
        </div>
        <details className="rh-ranking-table-details">
          <summary>展开紧凑表格</summary>
          <div className="rh-ranking-table-wrap">
            <table className="rh-ranking-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.items.map((item) => (
                  <tr key={`${list.listId}-${item.code}`}>
                    {columns.map((column) => {
                      let text = column.render(item);
                      if (column.key === "decision") text = strategyMeta.decisionLabel(item.decision);
                      if (column.key === "security") {
                        return (
                          <td key={column.key}>
                            {item.href ? (
                              <Link className="rh-card-title" href={item.href}>
                                {text}
                              </Link>
                            ) : (
                              text
                            )}
                          </td>
                        );
                      }
                      return <td key={column.key}>{text}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </div>
  );
}
