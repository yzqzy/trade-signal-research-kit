import type { ScreenerCandidate, ScreenerConfig, ScreenerUniverseRow } from "./types.js";

function safe(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Python: list_date <= cutoff(今天 - min_listing_years*365)，YYYYMMDD */
function listingAgeOk(listDate: string | undefined, minYears: number): boolean {
  if (!listDate || listDate.length < 8) return false;
  const y = Number(listDate.slice(0, 4));
  const m = Number(listDate.slice(4, 6));
  const d = Number(listDate.slice(6, 8));
  if (![y, m, d].every((n) => Number.isFinite(n))) return false;
  const listed = new Date(y, m - 1, d);
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setFullYear(cutoff.getFullYear() - minYears);
  return listed.getTime() <= cutoff.getTime();
}

function peMissing(row: ScreenerUniverseRow): boolean {
  const v = row.pe;
  return v === undefined || v === null || (typeof v === "number" && !Number.isFinite(v));
}

export function tier1FilterCnA(rows: ScreenerUniverseRow[], cfg: ScreenerConfig): ScreenerCandidate[] {
  const minCapMm = cfg.minMarketCapYi * 100;

  const pre = rows.filter((row) => {
    if (row.market !== "CN_A") return false;
    if ((row.name ?? "").match(/\*ST|ST|PT|退市/)) return false;
    if (!cfg.includeBank && row.industry === "银行") return false;
    if (!listingAgeOk(row.listDate, cfg.minListingYears)) return false;
    if ((safe(row.marketCap) ?? 0) < minCapMm) return false;
    if ((safe(row.turnover) ?? 0) < cfg.minTurnoverPct) return false;
    const pb = safe(row.pb);
    if (pb === undefined || pb <= 0 || pb > cfg.maxPb) return false;
    return true;
  });

  const main = pre
    .filter((row) => {
      if (peMissing(row)) return false;
      const pe = safe(row.pe);
      if (pe === undefined) return false;
      const dv = safe(row.dv);
      return pe > 0 && pe <= cfg.maxPe && dv !== undefined && dv > 0;
    })
    .map((row) => ({ ...row, channel: "main" as const }));

  const observation = pre
    .filter((row) => peMissing(row))
    .sort((a, b) => (safe(b.marketCap) ?? 0) - (safe(a.marketCap) ?? 0))
    .slice(0, cfg.obsChannelLimit)
    .map((row) => ({ ...row, channel: "observation" as const }));

  const dvMax = Math.max(...main.map((r) => safe(r.dv) ?? 0), 0.0001);
  const peInvMax = Math.max(...main.map((r) => 1 / Math.max(safe(r.pe) ?? Number.POSITIVE_INFINITY, 1e-6)), 0.0001);
  const pbInvMax = Math.max(...main.map((r) => 1 / Math.max(safe(r.pb) ?? Number.POSITIVE_INFINITY, 1e-6)), 0.0001);

  const rankedMain = main
    .map((row) => {
      const dvNorm = (safe(row.dv) ?? 0) / dvMax;
      const peNorm = (1 / Math.max(safe(row.pe) ?? Number.POSITIVE_INFINITY, 1e-6)) / peInvMax;
      const pbNorm = (1 / Math.max(safe(row.pb) ?? Number.POSITIVE_INFINITY, 1e-6)) / pbInvMax;
      const tier1Score = cfg.dvWeight * dvNorm + cfg.peWeight * peNorm + cfg.pbWeight * pbNorm;
      return { ...row, tier1Score };
    })
    .sort((a, b) => b.tier1Score - a.tier1Score)
    .slice(0, cfg.tier2MainLimit);

  const rankedObs = observation.map((row) => ({ ...row, tier1Score: 0 }));
  return [...rankedMain, ...rankedObs];
}
