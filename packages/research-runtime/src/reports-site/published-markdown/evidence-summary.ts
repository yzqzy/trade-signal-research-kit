import type { Phase1BItem, Phase1BQualitativeSupplement } from "../../steps/phase1b/types.js";

export type EvidenceRetrievalSummary = {
  hasCriticalGap: boolean;
  hasConfirmedCriticalEvent: boolean;
  webSearchUsed: boolean;
  webSearchLimited: boolean;
  missingItems: string[];
  limitedItems: string[];
};

export function isRateLimited(reason: string | undefined): boolean {
  return /rate[_ -]?limit|限流|quota|too many/i.test(reason ?? "");
}

export function flattenPhase1BItems(phase1b: Phase1BQualitativeSupplement | undefined): Phase1BItem[] {
  if (!phase1b) return [];
  return [...(phase1b.section7 ?? []), ...(phase1b.section8 ?? [])];
}

export function isOfficialNoHit(item: Phase1BItem): boolean {
  const diagnostics = item.retrievalDiagnostics;
  if (
    diagnostics?.feedFallbackUsed &&
    diagnostics.feedEvidenceCount === 0 &&
    /(?:^|_)feed_empty$/u.test(diagnostics.evidenceRetrievalStatus ?? "")
  ) {
    return true;
  }
  return /官方源.*(?:无命中|未形成|未检索到)|交易所\/巨潮.*(?:无命中|未形成)|官方.*零命中/u.test(
    `${item.item}\n${item.content}`,
  );
}

export function summarizeEvidenceRetrieval(phase1b: Phase1BQualitativeSupplement | undefined): EvidenceRetrievalSummary {
  const critical = /违规|处罚|诉讼|仲裁|监管|问询|关注函|警示函|立案|纪律处分|公开谴责/u;
  const confirmedCritical =
    /违规|处罚|诉讼|仲裁|监管|问询|关注函|警示函|立案|调查|纪律处分|公开谴责|信披|信息披露违法/u;
  const items = flattenPhase1BItems(phase1b);
  const missing = items.filter((it) => it.evidences.length === 0);
  const limited = items.filter((it) => isRateLimited(it.retrievalDiagnostics?.webSearchFailureReason));
  return {
    hasCriticalGap: missing.some((it) => critical.test(it.item) && !isOfficialNoHit(it)),
    hasConfirmedCriticalEvent: items.some(
      (it) =>
        critical.test(it.item) &&
        it.evidences.some((ev) => confirmedCritical.test(`${ev.title}\n${ev.snippet ?? ""}\n${it.content}`)),
    ),
    webSearchUsed: items.some((it) => it.retrievalDiagnostics?.webSearchUsed),
    webSearchLimited: limited.length > 0,
    missingItems: missing.map((it) => it.item),
    limitedItems: limited.map((it) => it.item),
  };
}
