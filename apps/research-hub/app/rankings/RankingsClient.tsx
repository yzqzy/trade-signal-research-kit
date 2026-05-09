"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { MethodologyGuideLink } from "@/components/MethodologyGuideLink";
import { getRankingStrategyMeta, RANKING_STRATEGIES } from "@/lib/rankings/strategies";
import type { RankingsIndex, RankingList } from "@/lib/rankings/types";

import { capabilityClass, capabilityLabel, formatRankingTime } from "./ranking-format";

const LIST_PREVIEW_LIMIT = 18;
type RankingListGroup = {
  key: "today" | "recent" | "earlier";
  label: string;
  lists: RankingList[];
};

function resolveTopN(list: RankingList): number {
  return typeof list.topN === "number" && Number.isFinite(list.topN) && list.topN > 0 ? Math.floor(list.topN) : 200;
}

function previewMetrics(list: RankingList): string {
  const first = list.items[0];
  if (!first) return "暂无条目";
  const meta = getRankingStrategyMeta(list.strategyId);
  const decision = meta.decisionLabel(first.decision);
  return `Top1 ${first.code} ${first.name} · ${decision} · ${first.score.toFixed(4)}`;
}

function resolveTopSummary(list: RankingList): { code: string; name: string; decision: string; score: string } | null {
  const first = list.items[0];
  if (!first) return null;
  const meta = getRankingStrategyMeta(list.strategyId);
  return {
    code: first.code,
    name: first.name,
    decision: meta.decisionLabel(first.decision),
    score: first.score.toFixed(4),
  };
}

function buildRankingDetailHref(list: RankingList, filters: { strategy?: string; market?: string }): string {
  const base = `/rankings/${encodeURIComponent(list.listId)}`;
  const query = new URLSearchParams();
  if (filters.strategy) query.set("strategy", filters.strategy);
  if (filters.market) query.set("market", filters.market);
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}

export function RankingsClient({ data }: { data: RankingsIndex }) {
  const sp = useSearchParams();
  const [showAllLists, setShowAllLists] = useState(false);
  const strategyFilter = sp.get("strategy")?.trim() || "";
  const marketFilter = sp.get("market")?.trim() || "";

  const visibleStrategies = useMemo(() => {
    const dataIds = new Set(data.lists.map((list) => list.strategyId));
    const configured = RANKING_STRATEGIES.filter((item) => dataIds.has(item.id)).map((item) => item.id);
    return [...new Set([...configured, ...data.lists.map((list) => list.strategyId)])];
  }, [data.lists]);

  const filteredLists = useMemo(() => {
    return data.lists.filter((list) => {
      if (strategyFilter && list.strategyId !== strategyFilter) return false;
      if (marketFilter && list.market !== marketFilter) return false;
      return true;
    });
  }, [data.lists, marketFilter, strategyFilter]);

  const selectedStrategyMeta = strategyFilter ? getRankingStrategyMeta(strategyFilter) : undefined;
  const markets = useMemo(() => [...new Set(data.lists.map((list) => list.market))].sort(), [data.lists]);
  const displayLists = showAllLists ? filteredLists : filteredLists.slice(0, LIST_PREVIEW_LIMIT);
  const isListTruncated = filteredLists.length > LIST_PREVIEW_LIMIT;
  const groupedLists = useMemo<RankingListGroup[]>(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;
    const today: RankingList[] = [];
    const recent: RankingList[] = [];
    const earlier: RankingList[] = [];
    for (const list of displayLists) {
      const ts = Date.parse(list.generatedAt);
      if (!Number.isFinite(ts)) {
        earlier.push(list);
        continue;
      }
      if (ts >= startOfToday) {
        today.push(list);
      } else if (ts >= sevenDaysAgo) {
        recent.push(list);
      } else {
        earlier.push(list);
      }
    }
    return [
      { key: "today", label: "今天", lists: today },
      { key: "recent", label: "近 7 天", lists: recent },
      { key: "earlier", label: "更早", lists: earlier },
    ].filter((group) => group.lists.length > 0);
  }, [displayLists]);

  return (
    <div className="rh-container rankings-root">
      <header className="rh-page-header">
        <h1 className="rh-page-title">策略榜单中心</h1>
        <p className="rh-page-desc">
          这里按“策略 · 市场 · 模式”聚合榜单摘要；点击榜单卡片进入明细，避免在中心页一次铺开所有标的。
        </p>
        {selectedStrategyMeta?.methodologyHref ? (
          <p className="rh-page-desc">
            <MethodologyGuideLink from="rankings" hrefBase={selectedStrategyMeta.methodologyHref} />
          </p>
        ) : null}
        <p className="rh-page-meta">
          协议 {data.version} · 生成 {data.generatedAt ? formatRankingTime(data.generatedAt) : "—"} · 榜单 {data.listCount} ·
          策略 {data.strategyCount}
        </p>
      </header>

      <section className="rh-filter-row" aria-label="按策略筛选">
        <span className="rh-filter-label">策略</span>
        <Link className={`rh-chip${!strategyFilter ? " rh-chip--active" : ""}`} href="/rankings">
          全部
        </Link>
        {visibleStrategies.map((strategyId) => {
          const meta = getRankingStrategyMeta(strategyId);
          const isActive = strategyFilter === strategyId;
          return (
            <Link
              key={strategyId}
              className={`rh-chip${isActive ? " rh-chip--active" : ""}`}
              href={`/rankings?strategy=${encodeURIComponent(strategyId)}`}
            >
              {meta.label}
            </Link>
          );
        })}
      </section>

      <section className="rh-filter-row" aria-label="按市场筛选">
        <span className="rh-filter-label">市场</span>
        <Link
          className={`rh-chip${!marketFilter ? " rh-chip--active" : ""}`}
          href={strategyFilter ? `/rankings?strategy=${encodeURIComponent(strategyFilter)}` : "/rankings"}
        >
          全部
        </Link>
        {markets.map((market) => {
          const query = new URLSearchParams();
          if (strategyFilter) query.set("strategy", strategyFilter);
          query.set("market", market);
          return (
            <Link
              key={market}
              className={`rh-chip${marketFilter === market ? " rh-chip--active" : ""}`}
              href={`/rankings?${query.toString()}`}
            >
              {market}
            </Link>
          );
        })}
      </section>

      {filteredLists.length === 0 ? (
        <div className="rh-empty" role="status">
          {data.listCount === 0 ? "暂无榜单数据。可先运行 screener 并执行 reports-site:emit / sync。" : "没有符合当前筛选条件的榜单。"}
        </div>
      ) : (
        <>
          {isListTruncated ? (
            <div className="rh-filter-row">
              <span className="rh-page-meta">
                当前条件下共 {filteredLists.length} 个榜单，默认展示前 {LIST_PREVIEW_LIMIT} 个。
              </span>
              <button className="rh-chip" type="button" onClick={() => setShowAllLists((value) => !value)} aria-pressed={showAllLists}>
                {showAllLists ? `收起到前 ${LIST_PREVIEW_LIMIT} 个` : "展开全部榜单"}
              </button>
            </div>
          ) : null}
          {groupedLists.map((group) => (
            <section key={group.key} className="rh-ranking-group" aria-label={`榜单分组：${group.label}`}>
              <h2 className="rh-ranking-group-title">{group.label}</h2>
              <section className="rh-grid">
                {group.lists.map((list) => {
                  const strategyMeta = getRankingStrategyMeta(list.strategyId);
                  const topSummary = resolveTopSummary(list);
                  return (
                    <article key={list.listId} className="rh-card rh-ranking-list-card">
                      <div className="rh-card-meta rh-card-meta--head">
                        <span className="rh-pill rh-pill--mono">{list.market}</span>
                        <span className="rh-pill rh-pill--mono">{list.mode}</span>
                        <span className={capabilityClass(list)}>{capabilityLabel(list)}</span>
                      </div>
                      <h3 className="rh-card-title rh-card-title--clamp">{strategyMeta.label}</h3>
                      <Link
                        className="rh-stretched-link"
                        href={buildRankingDetailHref(list, { strategy: strategyFilter, market: marketFilter })}
                        aria-label={`打开榜单：${strategyMeta.label} ${list.market} ${list.mode}`}
                      />
                      <p className="rh-ranking-card-highlight">
                        {topSummary ? (
                          <>
                            <span className="rh-ranking-card-highlight-label">Top1</span>
                            <span className="rh-ranking-card-highlight-main">
                              {topSummary.code} {topSummary.name}
                            </span>
                            <span className="rh-ranking-card-highlight-meta">{topSummary.decision}</span>
                            <span className="rh-ranking-card-highlight-score">{topSummary.score}</span>
                          </>
                        ) : (
                          previewMetrics(list)
                        )}
                      </p>
                      <p className="rh-page-meta rh-card-meta--support">
                        展示 Top {resolveTopN(list)} · 候选 {list.totalCandidates ?? list.items.length} · 更新时间 {formatRankingTime(list.generatedAt)}
                      </p>
                      <p className="rh-card-excerpt">{strategyMeta.shortDescription}</p>
                    </article>
                  );
                })}
              </section>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
