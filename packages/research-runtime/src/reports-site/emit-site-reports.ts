import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DataPackMarket, Market } from "@trade-signal/schema-core";

import { resolveOutputPath } from "../crosscut/normalization/resolve-monorepo-path.js";
import { formatListedCode } from "./listed-code.js";
import { buildDisplayTitle, TOPIC_DISPLAY_PAGE_NAME, TOPIC_ENTRY_SLUG } from "./topic-labels.js";
import { renderValuationComputedMarkdownFromJson } from "./valuation-computed-markdown.js";
import {
  renderPublicEvidencePack,
  writePublicEvidencePack,
  type PublicEvidencePackSource,
} from "./public-evidence-pack-renderer.js";
import type {
  ConfidenceState,
  EntryMeta,
  RankingListView,
  RankingViewItem,
  SiteRankingsIndex,
  ReportSourceLink,
  ReportTopicType,
  RequiredFieldsStatus,
  SiteReportsIndex,
  TimelineItem,
} from "./types.js";
import {
  siteTopicTypeToV2TopicId,
  TOPIC_MANIFEST_VERSION,
  type TopicManifestEntryV1,
  type TopicManifestV1,
} from "./topic-manifest-v2.js";
import {
  validateFinalNarrativeMarkdown,
  type FinalNarrativeStatus,
} from "../runtime/business-analysis/final-narrative-status.js";
import { validateTopicFinalMarkdown } from "../runtime/topic-finalization/finalization-gate.js";
import {
  evaluateBusinessQualityPublishGate,
  evaluateBusinessQualityPublicationHardBlock,
} from "../steps/phase3/report-polish/business-quality-publish-gate.js";
import type { Phase1BQualitativeSupplement } from "../steps/phase1b/types.js";
import type { SelectionManifestV1 } from "../screener/selection-manifest-v2.js";
import type { ScreenerRunOutput } from "../screener/types.js";
import type { FinancialMinesweeperManifestV1 } from "../contracts/financial-minesweeper-manifest.js";
import {
  commonEvidenceAttachments,
  deriveBusinessAnalysisConfidence,
  findPublishedMarkdownQualityViolations,
  officialAnnualPdfLink,
  parsePdfQualitySummary,
  renderBusinessAnalysisPublishedMarkdown,
  summarizeEvidenceRetrieval,
} from "./published-markdown/index.js";
import { rewriteProse } from "./published-markdown/steps/rewrite-prose.js";
import { toRankingViewItemsFromSelection } from "./rankings/from-selection.js";

export { findPublishedMarkdownQualityViolations } from "./published-markdown/index.js";

export type EmitSiteReportsOptions = {
  /** workflow / business-analysis / financial-minesweeper / screener 单次 run 根目录（含 manifest 或 screener 输出） */
  runDir: string;
  /** 聚合站点根目录，默认 `output/site/reports`（相对 monorepo 根） */
  siteDir?: string;
};

type RankingListFile = RankingListView & {
  sourceRunId: string;
};

type SwIndustryClassificationPayload = {
  provider?: string;
  level1Name?: string;
  level2Name?: string;
  level3Name?: string;
};

function shortRunId(runId: string): string {
  const compact = runId.replace(/-/g, "");
  return (compact.slice(0, 8) || "00000000").toLowerCase();
}

function dateKeyFromIso(iso: string): string {
  return iso.slice(0, 10);
}

function formatLocalDateTime(input: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  const y = input.getFullYear();
  const m = pad(input.getMonth() + 1);
  const d = pad(input.getDate());
  const hh = pad(input.getHours());
  const mm = pad(input.getMinutes());
  const ss = pad(input.getSeconds());
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await readFile(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(p: string): Promise<T> {
  const raw = await readFile(p, "utf-8");
  return JSON.parse(raw) as T;
}

function resolveArtifactPath(runDir: string, filePath?: string): string | undefined {
  const p = filePath?.trim();
  if (!p) return undefined;
  return path.isAbsolute(p) ? p : path.resolve(runDir, p);
}

function relFromRun(runDir: string, absPath?: string): string | undefined {
  if (!absPath) return undefined;
  try {
    const r = path.relative(runDir, absPath);
    return r && !r.startsWith("..") ? r : undefined;
  } catch {
    return undefined;
  }
}

async function writeTopicManifest(runDir: string, body: TopicManifestV1): Promise<void> {
  const out = path.join(runDir, "topic_manifest.json");
  await writeFile(out, JSON.stringify(body, null, 2), "utf-8");
}

/** 从 `data_pack_market.md` 首行标题（如 `# 伊利股份（600887）`）与「市场」行推断展示名与板块 */
function parseMarketPackMarkdownContext(md: string): { companyName?: string; market?: Market } {
  const firstLine = (md.trim().split(/\r?\n/u)[0] ?? "").trim();
  const h1 = firstLine.match(/^#\s*(.+)$/u);
  let companyName: string | undefined;
  if (h1) {
    const inner = h1[1].trim();
    const paren = inner.match(/^(.+?)（\s*([0-9A-Za-z._-]+)\s*）\s*$/u);
    companyName = paren ? paren[1].trim() : inner;
  }
  const marketLine = md.match(/^\s*-\s*市场：\s*(\S+)/imu);
  const rawM = marketLine?.[1]?.trim();
  const market: Market | undefined = rawM === "HK" || rawM === "CN_A" ? rawM : undefined;
  return { companyName, market };
}

async function tryReadCompanyContext(
  runDir: string,
  manifestInput: Record<string, unknown>,
  options?: { marketPackPath?: string },
): Promise<{ name: string; market?: Market }> {
  const code = String(manifestInput.code ?? "").trim() || "—";
  const fromInput = manifestInput.companyName;
  if (typeof fromInput === "string" && fromInput.trim()) {
    return { name: fromInput.trim() };
  }
  const p1 = path.join(runDir, "phase1a_data_pack.json");
  if (await pathExists(p1)) {
    try {
      const pack = await readJson<DataPackMarket>(p1);
      const name = pack.instrument?.name?.trim();
      const market = pack.instrument?.market;
      if (name) return { name, market };
    } catch {
      /* ignore */
    }
  }
  const marketAbs = resolveArtifactPath(runDir, options?.marketPackPath);
  if (marketAbs && (await pathExists(marketAbs))) {
    try {
      const md = await readFile(marketAbs, "utf-8");
      const parsed = parseMarketPackMarkdownContext(md);
      if (parsed.companyName) return { name: parsed.companyName, market: parsed.market };
      if (parsed.market) return { name: code, market: parsed.market };
    } catch {
      /* ignore */
    }
  }
  return { name: code };
}

function normalizeConfidenceToken(raw: string | undefined): ConfidenceState | undefined {
  const v = raw?.trim().toLowerCase();
  if (v === "high" || v === "medium" || v === "low") return v;
  return undefined;
}

/** 从 Phase3 / 定性稿 Markdown 提取置信度（YAML 列表或执行摘要表「分析置信度」行） */
function parseConfidenceFromReportMd(md: string): ConfidenceState {
  const yaml = normalizeConfidenceToken(md.match(/^\s*-\s*confidence:\s*(\S+)/im)?.[1]);
  if (yaml) return yaml;

  const metadataBlock = normalizeConfidenceToken(md.match(/^\s*confidence:\s*(\S+)/im)?.[1]);
  if (metadataBlock) return metadataBlock;

  const tableCell = md.match(/\|\s*分析置信度\s*\|\s*([^|\n]+?)\s*\|/imu)?.[1];
  const fromTable = normalizeConfidenceToken(tableCell);
  if (fromTable) return fromTable;

  return "unknown";
}

type ValuationQualitySummary = {
  activeMethodCount: number;
  activeCoreMethodCount: number;
  consistency?: string;
  coefficientOfVariation?: number;
};

function parseValuationQuality(rawJson: string | undefined): ValuationQualitySummary | undefined {
  if (!rawJson?.trim()) return undefined;
  try {
    const v = JSON.parse(rawJson) as {
      methods?: Array<{ id?: string; method?: string; name?: string; value?: number | null }>;
      crossValidation?: { consistency?: string; coefficientOfVariation?: number };
    };
    const methods = Array.isArray(v.methods) ? v.methods : [];
    const active = methods.filter((m) => typeof m.value === "number" && Number.isFinite(m.value));
    const core = /DCF|DDM|PE[_\s-]?BAND|PE\s*Band|市盈率/i;
    return {
      activeMethodCount: active.length,
      activeCoreMethodCount: active.filter((m) => core.test(String(m.method ?? m.name ?? m.id ?? ""))).length,
      consistency: v.crossValidation?.consistency,
      coefficientOfVariation: v.crossValidation?.coefficientOfVariation,
    };
  } catch {
    return undefined;
  }
}

function deriveValuationConfidence(base: ConfidenceState, q: ValuationQualitySummary | undefined): ConfidenceState {
  if (!q) return base === "unknown" ? "unknown" : "low";
  if (q.activeMethodCount < 2) return "low";
  if (q.activeCoreMethodCount < 2 && base === "high") return "medium";
  if (q.consistency === "low") return "medium";
  if (typeof q.coefficientOfVariation === "number" && q.coefficientOfVariation > 40) return "medium";
  return base === "unknown" ? "medium" : base;
}

function buildEntryId(date: string, codeDigits: string, topic: ReportTopicType, runShort: string): string {
  const slug = TOPIC_ENTRY_SLUG[topic];
  return `${date}-${codeDigits}-${slug}-${runShort}`;
}

function joinSections(sections: string[]): string {
  return sections
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n\n---\n\n");
}

async function writeEntry(params: {
  siteDir: string;
  meta: EntryMeta;
  contentMarkdown: string;
  attachments?: PublicEvidencePackSource[];
  sourceLinks?: ReportSourceLink[];
}): Promise<void> {
  const contentMarkdown = normalizePublishedMarkdownProse(params.contentMarkdown);
  const violations = findPublishedMarkdownQualityViolations(contentMarkdown);
  if (violations.length > 0) {
    throw new Error(
      `[reports-site] ${params.meta.entryId} 含发布禁用内容：${violations.join(", ")}`,
    );
  }
  const dir = path.join(params.siteDir, "entries", params.meta.entryId);
  await mkdir(dir, { recursive: true });
  const publicEvidencePack = await renderPublicEvidencePack(params.attachments ?? [], {
    normalizeMarkdown: normalizePublishedMarkdownProse,
    validateContent: findPublishedMarkdownQualityViolations,
    pathExists,
  });
  const attachments = await writePublicEvidencePack(dir, publicEvidencePack);
  const meta: EntryMeta = {
    ...params.meta,
    attachments: attachments.length ? attachments : undefined,
    sourceLinks: params.sourceLinks?.length ? params.sourceLinks : undefined,
  };
  await writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");
  await writeFile(path.join(dir, "content.md"), contentMarkdown, "utf-8");
}

async function removeVisibleEntriesForTopic(siteDir: string, input: {
  date: string;
  code: string;
  topic: ReportTopicType;
}): Promise<void> {
  const entriesRoot = path.join(siteDir, "entries");
  let dirs: string[] = [];
  try {
    dirs = await readdir(entriesRoot, { withFileTypes: true }).then((xs) =>
      xs.filter((d) => d.isDirectory()).map((d) => d.name),
    );
  } catch {
    return;
  }
  for (const id of dirs) {
    const metaPath = path.join(entriesRoot, id, "meta.json");
    if (!(await pathExists(metaPath))) continue;
    try {
      const meta = await readJson<EntryMeta>(metaPath);
      if (
        meta.code === input.code &&
        meta.topicType === input.topic &&
        dateKeyFromIso(meta.publishedAt) === input.date
      ) {
        await rm(path.join(entriesRoot, id), { recursive: true, force: true });
      }
    } catch {
      /* broken entry is ignored by rebuild; leave it for manual inspection */
    }
  }
}

function statusRank(s: RequiredFieldsStatus): number {
  if (s === "complete") return 3;
  if (s === "degraded") return 2;
  return 1;
}

function isBetterTimelineItem(a: TimelineItem, b: TimelineItem): boolean {
  const ar = statusRank(a.requiredFieldsStatus);
  const br = statusRank(b.requiredFieldsStatus);
  if (ar !== br) return ar > br;
  if (a.publishedAt !== b.publishedAt) return a.publishedAt > b.publishedAt;
  return a.entryId > b.entryId;
}
function normalizePublishedMarkdownProse(markdown: string): string {
  return rewriteProse(markdown, { pdfQuality: {}, evidence: undefined, finalNarrativeStatus: undefined });
}

async function resolveFinalizedTopicMarkdown(runDir: string, topic: ReportTopicType, draftAbs?: string, configuredRel?: string): Promise<{
  markdown?: string;
  absPath?: string;
}> {
  const candidates = [
    configuredRel ? resolveArtifactPath(runDir, configuredRel) : undefined,
    path.join(runDir, "finalized", `${topic}.md`),
    draftAbs ? path.join(path.dirname(draftAbs), `${path.basename(draftAbs, path.extname(draftAbs))}.final.md`) : undefined,
  ].filter((p): p is string => Boolean(p));
  for (const p of candidates) {
    if (!(await pathExists(p))) continue;
    const markdown = (await readFile(p, "utf-8")).trim();
    if (markdown) return { markdown, absPath: p };
  }
  return {};
}

type WorkflowManifest = {
  manifestVersion: string;
  generatedAt: string;
  outputLayout: { code: string; runId: string };
  input: Record<string, unknown>;
  outputs: {
    phase1aJsonPath?: string;
    marketPackPath?: string;
    phase1bMarkdownPath?: string;
    phase2bMarkdownPath?: string;
    phase3PreflightPath?: string;
    valuationPath?: string;
    reportMarkdownPath?: string;
    reportViewModelPath?: string;
    turtleOverviewMarkdownPath?: string;
    businessQualityMarkdownPath?: string;
    penetrationReturnMarkdownPath?: string;
    /** 与 `valuation.md` 文件对应（workflow manifest 字段名） */
    valuationMarkdownPath?: string;
  };
  orchestration?: { threadId?: string; runId?: string };
};

type BusinessAnalysisManifest = {
  manifestVersion: string;
  generatedAt: string;
  finalNarrativeStatus?: FinalNarrativeStatus;
  finalNarrativeBlockingReasons?: string[];
  outputLayout: { code: string; runId: string };
  input: Record<string, unknown>;
  outputs: {
    qualitativeReportPath?: string;
    qualitativeD1D6Path?: string;
    marketPackPath?: string;
    phase1bJsonPath?: string;
    phase1bMarkdownPath?: string;
    dataPackReportPath?: string;
  };
};

type WorkflowReportViewModel = {
  topicReports?: Array<{
    topicId?: string;
    siteTopicType?: string;
    qualityStatus?: "complete" | "degraded" | "blocked" | "draft";
    blockingReasons?: string[];
    finalizedMarkdownRelative?: string;
  }>;
  businessModel?: { l1Key?: string };
  dataPackReport?: { pdfGateVerdict?: string };
};

async function emitFromWorkflow(runDir: string, siteDir: string, manifestPath: string): Promise<void> {
  const m = await readJson<WorkflowManifest>(manifestPath);
  const publishedAt = m.generatedAt;
  const date = dateKeyFromIso(publishedAt);
  const codeDigits = String(m.outputLayout.code ?? "").replace(/\D/g, "") || m.outputLayout.code;
  const sourceRunId = String(m.orchestration?.threadId ?? m.orchestration?.runId ?? m.outputLayout.runId ?? "");
  const runShort = shortRunId(sourceRunId || m.outputLayout.runId || "run");
  const reportMdPath = resolveArtifactPath(runDir, m.outputs.reportMarkdownPath);
  const valuationPath = resolveArtifactPath(runDir, m.outputs.valuationPath);
  const marketPath = resolveArtifactPath(runDir, m.outputs.marketPackPath);
  const dataPackReportPath = resolveArtifactPath(runDir, m.outputs.phase2bMarkdownPath);
  const phase1bMarkdownPath = resolveArtifactPath(runDir, m.outputs.phase1bMarkdownPath);
  const polishOverviewPath = resolveArtifactPath(runDir, m.outputs.turtleOverviewMarkdownPath);
  const polishBusinessPath = resolveArtifactPath(runDir, m.outputs.businessQualityMarkdownPath);
  const polishPenetrationPath = resolveArtifactPath(runDir, m.outputs.penetrationReturnMarkdownPath);
  const polishValuationPath = resolveArtifactPath(runDir, m.outputs.valuationMarkdownPath);
  const reportViewModelPath = resolveArtifactPath(runDir, m.outputs.reportViewModelPath);
  let topicQuality = new Map<string, {
    qualityStatus?: "complete" | "degraded" | "blocked" | "draft";
    blockingReasons?: string[];
    finalizedMarkdownRelative?: string;
  }>();
  let workflowVmForGate: WorkflowReportViewModel | undefined;
  if (reportViewModelPath && (await pathExists(reportViewModelPath))) {
    try {
      const vm = await readJson<WorkflowReportViewModel>(reportViewModelPath);
      workflowVmForGate = vm;
      topicQuality = new Map(
        (vm.topicReports ?? [])
          .filter((t) => t.siteTopicType)
          .map((t) => [
            String(t.siteTopicType),
            {
              qualityStatus: t.qualityStatus,
              blockingReasons: t.blockingReasons,
              finalizedMarkdownRelative: t.finalizedMarkdownRelative,
            },
          ]),
      );
    } catch {
      topicQuality = new Map();
    }
  }

  if (polishBusinessPath && (await pathExists(polishBusinessPath))) {
    const bqMd = (await readFile(polishBusinessPath, "utf-8")).trim();
    const marketMd =
      marketPath && (await pathExists(marketPath)) ? (await readFile(marketPath, "utf-8")).trim() : "";
    const gate = evaluateBusinessQualityPublishGate(bqMd, {
      hasBusinessModel: Boolean(workflowVmForGate?.businessModel?.l1Key),
    });
    const hard = evaluateBusinessQualityPublicationHardBlock(
      bqMd,
      marketMd,
      workflowVmForGate?.dataPackReport?.pdfGateVerdict,
    );
    const prev = topicQuality.get("business-quality") ?? {};
    if (hard.blocked) {
      topicQuality.set("business-quality", {
        qualityStatus: "blocked",
        blockingReasons: [...(prev.blockingReasons ?? []), ...hard.reasons],
      });
    } else if (!gate.passed) {
      topicQuality.set("business-quality", {
        qualityStatus: "degraded",
        blockingReasons: [...(prev.blockingReasons ?? []), ...gate.reasons],
      });
    }
  }

  const ctx = await tryReadCompanyContext(runDir, m.input as Record<string, unknown>, {
    marketPackPath: marketPath,
  });
  const listed = formatListedCode(codeDigits, ctx.market);

  let reportMarkdown = "";
  if (reportMdPath && (await pathExists(reportMdPath))) {
    reportMarkdown = await readFile(reportMdPath, "utf-8");
  }
  const confidence = parseConfidenceFromReportMd(reportMarkdown);

  const hasValuationJson = Boolean(valuationPath && (await pathExists(valuationPath)));
  const hasReportMd = reportMarkdown.length > 0;
  const hasMarketMd = Boolean(marketPath && (await pathExists(marketPath)));
  const hasPolishOverview = Boolean(polishOverviewPath && (await pathExists(polishOverviewPath)));
  const hasPolishBusiness = Boolean(polishBusinessPath && (await pathExists(polishBusinessPath)));
  const hasPolishPenetration = Boolean(polishPenetrationPath && (await pathExists(polishPenetrationPath)));
  const hasPolishValuation = Boolean(polishValuationPath && (await pathExists(polishValuationPath)));

  const manifestRel = path.relative(siteDir, manifestPath);
  const valuationRawJson =
    hasValuationJson && valuationPath ? await readFile(valuationPath, "utf-8") : undefined;
  const valuationConfidence = deriveValuationConfidence(confidence, parseValuationQuality(valuationRawJson));
  const workflowCommonAttachments = commonEvidenceAttachments({
    marketPath,
    dataPackReportPath,
    phase1bMarkdownPath,
  });
  const workflowSourceLinks = officialAnnualPdfLink(m.input);

  const topics: Array<{
    topic: ReportTopicType;
    status: RequiredFieldsStatus;
    markdown: string;
    publishable?: boolean;
    draftAbs?: string;
  }> = [];

  /** 龟龟整包 */
  {
    let status: RequiredFieldsStatus = "missing";
    let markdown = "";
    if (hasPolishOverview && polishOverviewPath) {
      markdown = (await readFile(polishOverviewPath, "utf-8")).trim();
      status = hasValuationJson ? "complete" : "degraded";
    } else if (hasReportMd) {
      markdown = reportMarkdown.trim();
      status = hasValuationJson ? "complete" : "degraded";
    }
    topics.push({ topic: "turtle-strategy", status, markdown, draftAbs: polishOverviewPath ?? reportMdPath });
  }

  /** 估值 */
  {
    let status: RequiredFieldsStatus = "missing";
    let markdown = "";
    if (hasPolishValuation && polishValuationPath) {
      markdown = (await readFile(polishValuationPath, "utf-8")).trim();
      status = hasValuationJson ? "complete" : "degraded";
    } else {
      const parts: string[] = [];
      if (hasValuationJson && valuationPath) {
        const vj = await readFile(valuationPath, "utf-8");
        parts.push(renderValuationComputedMarkdownFromJson(vj));
        status = hasReportMd ? "complete" : "degraded";
      } else if (hasReportMd) {
        status = "degraded";
      }
      if (hasReportMd) {
        parts.push(reportMarkdown.trim());
      }
      markdown = joinSections(parts);
    }
    topics.push({ topic: "valuation", status, markdown, draftAbs: polishValuationPath ?? valuationPath ?? reportMdPath });
  }

  /** 穿透回报率 */
  {
    let status: RequiredFieldsStatus = "missing";
    let markdown = "";
    if (hasPolishPenetration && polishPenetrationPath) {
      markdown = (await readFile(polishPenetrationPath, "utf-8")).trim();
      status = hasMarketMd ? "complete" : "degraded";
    } else {
      const parts: string[] = [];
      if (hasReportMd) {
        parts.push(reportMarkdown.trim());
        status = hasMarketMd ? "complete" : "degraded";
      } else if (hasMarketMd) {
        status = "degraded";
      }
      if (hasMarketMd && marketPath) {
        const md = await readFile(marketPath, "utf-8");
        parts.push(`## 市场数据包（data_pack_market.md）\n\n${md.trim()}`);
      }
      markdown = joinSections(parts);
    }
    topics.push({ topic: "penetration-return", status, markdown, draftAbs: polishPenetrationPath ?? reportMdPath });
  }

  /** 商业质量必须由 business-analysis 终稿发布；workflow 侧只保留 topic_manifest/handoff，避免把结构化预览误当终稿。 */
  {
    const markdown = hasPolishBusiness && polishBusinessPath ? (await readFile(polishBusinessPath, "utf-8")).trim() : "";
    topics.push({ topic: "business-quality", status: markdown ? "degraded" : "missing", markdown, publishable: false, draftAbs: polishBusinessPath });
  }

  const sourceMarkdownAbsForTopic = (topic: ReportTopicType): string | undefined => {
    switch (topic) {
      case "turtle-strategy":
        return polishOverviewPath ?? reportMdPath;
      case "valuation":
        return polishValuationPath ?? valuationPath;
      case "penetration-return":
        return polishPenetrationPath ?? reportMdPath;
      case "business-quality": {
        const p1bPath = resolveArtifactPath(runDir, m.outputs.phase1bMarkdownPath);
        return polishBusinessPath ?? p1bPath ?? reportMdPath;
      }
      case "financial-minesweeper":
        return undefined;
      default: {
        const _ex: never = topic;
        return _ex;
      }
    }
  };

  const manifestTopics: TopicManifestEntryV1[] = [];

  for (const t of topics) {
    if (!t.markdown.trim()) continue;
    const vmTopicQuality = topicQuality.get(t.topic);
    const configuredFinal = vmTopicQuality?.finalizedMarkdownRelative;
    if (t.publishable === false) {
      manifestTopics.push({
        v2TopicId: siteTopicTypeToV2TopicId(t.topic),
        siteTopicType: t.topic,
        entryId: buildEntryId(date, codeDigits, t.topic, runShort),
        requiredFieldsStatus: t.status,
        sourceMarkdownRelative: relFromRun(runDir, sourceMarkdownAbsForTopic(t.topic)),
        finalizedMarkdownRelative: configuredFinal,
        qualityStatus: vmTopicQuality?.qualityStatus ?? "draft",
        blockingReasons: vmTopicQuality?.blockingReasons,
      });
      continue;
    }
    const finalized = await resolveFinalizedTopicMarkdown(runDir, t.topic, t.draftAbs, configuredFinal);
    if (!finalized.markdown) {
      await removeVisibleEntriesForTopic(siteDir, { date, code: codeDigits, topic: t.topic });
      manifestTopics.push({
        v2TopicId: siteTopicTypeToV2TopicId(t.topic),
        siteTopicType: t.topic,
        entryId: buildEntryId(date, codeDigits, t.topic, runShort),
        requiredFieldsStatus: t.status,
        sourceMarkdownRelative: relFromRun(runDir, sourceMarkdownAbsForTopic(t.topic)),
        finalizedMarkdownRelative: configuredFinal ?? `finalized/${t.topic}.md`,
        qualityStatus: "draft",
        blockingReasons: [
          `${TOPIC_DISPLAY_PAGE_NAME[t.topic]} 缺少 finalized markdown；结构化草稿不会发布`,
          ...(vmTopicQuality?.blockingReasons ?? []),
        ],
      });
      continue;
    }
    const finalGate = validateTopicFinalMarkdown(t.topic, finalized.markdown);
    if (finalGate.status !== "complete") {
      await removeVisibleEntriesForTopic(siteDir, { date, code: codeDigits, topic: t.topic });
      manifestTopics.push({
        v2TopicId: siteTopicTypeToV2TopicId(t.topic),
        siteTopicType: t.topic,
        entryId: buildEntryId(date, codeDigits, t.topic, runShort),
        requiredFieldsStatus: t.status,
        sourceMarkdownRelative: relFromRun(runDir, sourceMarkdownAbsForTopic(t.topic)),
        finalizedMarkdownRelative: relFromRun(runDir, finalized.absPath),
        qualityStatus: "draft",
        blockingReasons: finalGate.blockingReasons,
      });
      continue;
    }
    const entryId = buildEntryId(date, codeDigits, t.topic, runShort);
    const meta: EntryMeta = {
      entryId,
      code: codeDigits,
      topicType: t.topic,
      displayTitle: buildDisplayTitle({ companyName: ctx.name, listedCode: listed, topic: t.topic }),
      publishedAt,
      sourceRunId,
      requiredFieldsStatus: t.status,
      confidenceState: t.topic === "valuation" ? valuationConfidence : confidence,
      contentFile: "content.md",
      sourceManifestPath: manifestRel,
    };
    const attachments = [
      ...workflowCommonAttachments,
      ...(t.topic === "valuation" && valuationPath
        ? [
            {
              id: "valuation-model",
              label: "估值模型结果",
              kind: "json" as const,
              sourcePath: valuationPath,
              fileName: "valuation-model.json",
              previewable: true,
            },
          ]
        : []),
      ...(t.topic === "penetration-return" || t.topic === "turtle-strategy"
        ? [
            {
              id: "strategy-calculation",
              label: "策略计算底稿",
              kind: "markdown" as const,
              sourcePath: reportMdPath,
              fileName: "strategy-calculation.md",
            },
          ]
        : []),
    ];
    await writeEntry({
      siteDir,
      meta,
      contentMarkdown: finalized.markdown,
      attachments,
      sourceLinks: workflowSourceLinks,
    });
    manifestTopics.push({
      v2TopicId: siteTopicTypeToV2TopicId(t.topic),
      siteTopicType: t.topic,
      entryId,
      requiredFieldsStatus: t.status,
      sourceMarkdownRelative: relFromRun(runDir, sourceMarkdownAbsForTopic(t.topic)),
      finalizedMarkdownRelative: relFromRun(runDir, finalized.absPath),
      qualityStatus: "complete",
      blockingReasons: undefined,
    });
  }

  if (manifestTopics.length > 0) {
    const topicManifest: TopicManifestV1 = {
      manifestVersion: TOPIC_MANIFEST_VERSION,
      generatedAt: new Date().toISOString(),
      publishedAt,
      runProfile: "stock_full",
      outputLayout: { code: m.outputLayout.code, runId: m.outputLayout.runId },
      topics: manifestTopics,
    };
    await writeTopicManifest(runDir, topicManifest);
  }
}

/** 仅 `topic_manifest.json`（publish_only）：再发布已有 Markdown 专题 */
async function emitFromTopicManifestOnly(
  runDir: string,
  siteDir: string,
  manifestPath: string,
): Promise<void> {
  const m = await readJson<TopicManifestV1>(manifestPath);
  if (m.manifestVersion !== TOPIC_MANIFEST_VERSION) {
    throw new Error(`[reports-site] topic_manifest.json 不支持的 manifestVersion: ${String(m.manifestVersion)}`);
  }
  const publishedAt = m.publishedAt ?? m.generatedAt;
  const codeDigits =
    String(m.outputLayout?.code ?? "")
      .replace(/\D/g, "")
      .trim() ||
    (() => {
      const e0 = m.topics[0]?.entryId ?? "";
      const mm = e0.match(/^(\d{4}-\d{2}-\d{2})-([^-]+)-/u);
      return (mm?.[2] ?? "").replace(/\D/g, "") || e0;
    })();
  const sourceRunId = String(m.outputLayout?.runId ?? "");
  const manifestRel = path.relative(siteDir, manifestPath);
  const marketTry = path.join(runDir, "data_pack_market.md");
  const ctx = await tryReadCompanyContext(runDir, { code: codeDigits } as Record<string, unknown>, {
    marketPackPath: (await pathExists(marketTry)) ? marketTry : undefined,
  });
  const listed = formatListedCode(codeDigits, ctx.market);

  for (const row of m.topics) {
    if (row.qualityStatus !== "complete") {
      await removeVisibleEntriesForTopic(siteDir, {
        date: dateKeyFromIso(publishedAt),
        code: codeDigits,
        topic: row.siteTopicType,
      });
      continue;
    }
    const rel = (row.finalizedMarkdownRelative ?? row.sourceMarkdownRelative)?.trim();
    if (!rel) continue;
    const absMd = path.resolve(runDir, rel);
    if (!(await pathExists(absMd))) continue;
    const markdown = (await readFile(absMd, "utf-8")).trim();
    if (!markdown) continue;
    const finalGate = validateTopicFinalMarkdown(row.siteTopicType, markdown);
    if (finalGate.status !== "complete") {
      await removeVisibleEntriesForTopic(siteDir, {
        date: dateKeyFromIso(publishedAt),
        code: codeDigits,
        topic: row.siteTopicType,
      });
      continue;
    }
    const status: RequiredFieldsStatus =
      row.requiredFieldsStatus === "complete" ||
      row.requiredFieldsStatus === "degraded" ||
      row.requiredFieldsStatus === "missing"
        ? row.requiredFieldsStatus
        : "degraded";
    const confidence = parseConfidenceFromReportMd(markdown);
    const meta: EntryMeta = {
      entryId: row.entryId,
      code: codeDigits,
      topicType: row.siteTopicType,
      displayTitle: buildDisplayTitle({
        companyName: ctx.name,
        listedCode: listed,
        topic: row.siteTopicType,
      }),
      publishedAt,
      sourceRunId,
      requiredFieldsStatus: status,
      confidenceState: confidence,
      contentFile: "content.md",
      sourceManifestPath: manifestRel,
    };
    await writeEntry({ siteDir, meta, contentMarkdown: markdown });
  }
}

async function emitFromBusinessAnalysis(
  runDir: string,
  siteDir: string,
  manifestPath: string,
): Promise<void> {
  const m = await readJson<BusinessAnalysisManifest>(manifestPath);
  const publishedAt = m.generatedAt;
  const date = dateKeyFromIso(publishedAt);
  const codeDigits = String(m.outputLayout.code ?? "").replace(/\D/g, "") || m.outputLayout.code;
  const sourceRunId = String(m.input.runId ?? m.outputLayout.runId ?? "");
  const runShort = shortRunId(sourceRunId || m.outputLayout.runId || "run");
  const marketPathBa = resolveArtifactPath(runDir, m.outputs.marketPackPath);
  const ctx = await tryReadCompanyContext(runDir, m.input as Record<string, unknown>, {
    marketPackPath: marketPathBa,
  });
  const listed = formatListedCode(codeDigits, ctx.market);

  const qPath = m.outputs.qualitativeReportPath ? resolveArtifactPath(runDir, m.outputs.qualitativeReportPath) : undefined;
  const d1 = m.outputs.qualitativeD1D6Path ? resolveArtifactPath(runDir, m.outputs.qualitativeD1D6Path) : undefined;
  const hasQ = Boolean(qPath && (await pathExists(qPath)));
  const hasD1 = Boolean(d1 && (await pathExists(d1)));

  let status: RequiredFieldsStatus = "missing";
  if (hasQ && hasD1) status = "complete";
  else if (hasQ || hasD1) status = "degraded";

  let qMarkdown = "";
  let d1Markdown = "";
  if (hasQ && qPath) {
    qMarkdown = await readFile(qPath, "utf-8");
  }
  if (hasD1 && d1) {
    d1Markdown = await readFile(d1, "utf-8");
  }

  const dataPackReportPath =
    typeof m.outputs.dataPackReportPath === "string" ? resolveArtifactPath(runDir, m.outputs.dataPackReportPath) : undefined;
  const dataPackReportMarkdown = dataPackReportPath && (await pathExists(dataPackReportPath))
    ? await readFile(dataPackReportPath, "utf-8")
    : undefined;
  const phase1bJsonPath =
    typeof m.outputs.phase1bJsonPath === "string" ? resolveArtifactPath(runDir, m.outputs.phase1bJsonPath) : undefined;
  const phase1b =
    phase1bJsonPath && (await pathExists(phase1bJsonPath))
      ? await readJson<Phase1BQualitativeSupplement>(phase1bJsonPath)
      : undefined;
  const pdfQuality = parsePdfQualitySummary(dataPackReportMarkdown);
  const evidence = summarizeEvidenceRetrieval(phase1b);
  const finalNarrative = validateFinalNarrativeMarkdown({
    qualitativeReportMarkdown: qMarkdown,
    qualitativeD1D6Markdown: d1Markdown,
    dataPackReportMarkdown,
  });
  if (finalNarrative.status !== "complete") {
    status = status === "missing" ? "missing" : "degraded";
  } else {
    status = "complete";
  }

  const topic: ReportTopicType = "business-quality";
  const entryId = buildEntryId(date, codeDigits, topic, runShort);

  if (finalNarrative.status !== "complete") {
    await removeVisibleEntriesForTopic(siteDir, { date, code: codeDigits, topic });
    const topicManifest: TopicManifestV1 = {
      manifestVersion: TOPIC_MANIFEST_VERSION,
      generatedAt: new Date().toISOString(),
      publishedAt,
      runProfile: "stock_full",
      outputLayout: { code: m.outputLayout.code, runId: m.outputLayout.runId },
      topics: [
        {
          v2TopicId: siteTopicTypeToV2TopicId(topic),
          siteTopicType: topic,
          entryId,
          requiredFieldsStatus: status,
          sourceMarkdownRelative:
            relFromRun(runDir, qPath) ??
            relFromRun(runDir, d1) ??
            (typeof m.outputs.qualitativeReportPath === "string" ? m.outputs.qualitativeReportPath : undefined),
          qualityStatus: finalNarrative.status,
          blockingReasons: finalNarrative.blockingReasons,
        },
      ],
    };
    await writeTopicManifest(runDir, topicManifest);
    return;
  }

  const confidenceBa = deriveBusinessAnalysisConfidence({
    status,
    finalNarrativeStatus: finalNarrative.status,
    pdfQuality,
    evidence,
  });

  const markdown = renderBusinessAnalysisPublishedMarkdown({
    qualitativeReportMarkdown: qMarkdown,
    qualitativeD1D6Markdown: d1Markdown,
    finalNarrativeStatus: finalNarrative.status,
    confidence: confidenceBa,
    pdfQuality,
    evidence,
  });
  if (!markdown.trim()) return;

  const manifestRel = path.relative(siteDir, manifestPath);
  const businessAttachments = commonEvidenceAttachments({
    marketPath: marketPathBa,
    dataPackReportPath,
    phase1bMarkdownPath:
      typeof m.outputs.phase1bMarkdownPath === "string" ? resolveArtifactPath(runDir, m.outputs.phase1bMarkdownPath) : undefined,
  });
  const meta: EntryMeta = {
    entryId,
    code: codeDigits,
    topicType: topic,
    displayTitle: buildDisplayTitle({ companyName: ctx.name, listedCode: listed, topic }),
    publishedAt,
    sourceRunId,
    requiredFieldsStatus: status,
    confidenceState: confidenceBa,
    contentFile: "content.md",
    sourceManifestPath: manifestRel,
  };
  await writeEntry({
    siteDir,
    meta,
    contentMarkdown: markdown,
    attachments: businessAttachments,
    sourceLinks: officialAnnualPdfLink(m.input),
  });

  const topicManifest: TopicManifestV1 = {
    manifestVersion: TOPIC_MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    publishedAt,
    runProfile: "stock_full",
    outputLayout: { code: m.outputLayout.code, runId: m.outputLayout.runId },
    topics: [
      {
        v2TopicId: siteTopicTypeToV2TopicId(topic),
        siteTopicType: topic,
        entryId,
        requiredFieldsStatus: status,
        sourceMarkdownRelative:
          relFromRun(runDir, qPath) ??
          relFromRun(runDir, d1) ??
          (typeof m.outputs.qualitativeReportPath === "string" ? m.outputs.qualitativeReportPath : undefined),
        qualityStatus: finalNarrative.status,
        blockingReasons: finalNarrative.blockingReasons,
      },
    ],
  };
  await writeTopicManifest(runDir, topicManifest);
}

function minesweeperConfidenceFromSummary(band?: string): ConfidenceState {
  if (band === "低") return "high";
  if (band === "中") return "medium";
  return "low";
}

async function emitFromFinancialMinesweeper(runDir: string, siteDir: string, manifestPath: string): Promise<void> {
  const m = await readJson<FinancialMinesweeperManifestV1>(manifestPath);
  const publishedAt = m.generatedAt;
  const date = dateKeyFromIso(publishedAt);
  const codeDigits = String(m.outputLayout.code ?? "").replace(/\D/g, "") || m.outputLayout.code;
  const sourceRunId = String(m.outputLayout.runId ?? "");
  const runShort = shortRunId(sourceRunId || "run");
  const reportAbs = resolveArtifactPath(runDir, m.outputs.reportMarkdownPath);
  const analysisAbs = resolveArtifactPath(runDir, m.outputs.analysisJsonPath);
  const phase2aAbs = resolveArtifactPath(runDir, m.outputs.phase2aJsonPath);
  const phase2bAbs = resolveArtifactPath(runDir, m.outputs.phase2bMarkdownPath);
  if (!reportAbs || !(await pathExists(reportAbs))) return;

  const markdown = (await readFile(reportAbs, "utf-8")).trim();
  const topic: ReportTopicType = "financial-minesweeper";
  const gate = validateTopicFinalMarkdown(topic, markdown);
  const manifestRel = path.relative(siteDir, manifestPath);
  const ctx = await tryReadCompanyContext(runDir, {
    code: codeDigits,
    companyName: m.input.companyName,
  } as Record<string, unknown>);
  const listed = formatListedCode(codeDigits, ctx.market);
  const entryId = buildEntryId(date, codeDigits, topic, runShort);

  if (gate.status !== "complete") {
    await removeVisibleEntriesForTopic(siteDir, { date, code: codeDigits, topic });
    const topicManifest: TopicManifestV1 = {
      manifestVersion: TOPIC_MANIFEST_VERSION,
      generatedAt: new Date().toISOString(),
      publishedAt,
      runProfile: "stock_full",
      outputLayout: { code: m.outputLayout.code, runId: m.outputLayout.runId },
      topics: [
        {
          v2TopicId: siteTopicTypeToV2TopicId(topic),
          siteTopicType: topic,
          entryId,
          requiredFieldsStatus: "degraded",
          sourceMarkdownRelative: relFromRun(runDir, reportAbs),
          qualityStatus: "draft",
          blockingReasons: gate.blockingReasons,
        },
      ],
    };
    await writeTopicManifest(runDir, topicManifest);
    return;
  }

  const violations = findPublishedMarkdownQualityViolations(markdown);
  if (violations.length > 0) {
    await removeVisibleEntriesForTopic(siteDir, { date, code: codeDigits, topic });
    const topicManifest: TopicManifestV1 = {
      manifestVersion: TOPIC_MANIFEST_VERSION,
      generatedAt: new Date().toISOString(),
      publishedAt,
      runProfile: "stock_full",
      outputLayout: { code: m.outputLayout.code, runId: m.outputLayout.runId },
      topics: [
        {
          v2TopicId: siteTopicTypeToV2TopicId(topic),
          siteTopicType: topic,
          entryId,
          requiredFieldsStatus: "degraded",
          sourceMarkdownRelative: relFromRun(runDir, reportAbs),
          qualityStatus: "draft",
          blockingReasons: [`发布禁用内容：${violations.join(", ")}`],
        },
      ],
    };
    await writeTopicManifest(runDir, topicManifest);
    return;
  }

  const meta: EntryMeta = {
    entryId,
    code: codeDigits,
    topicType: topic,
    displayTitle: buildDisplayTitle({ companyName: ctx.name, listedCode: listed, topic }),
    publishedAt,
    sourceRunId,
    requiredFieldsStatus: "complete",
    confidenceState: minesweeperConfidenceFromSummary(m.summary?.riskBand),
    contentFile: "content.md",
    sourceManifestPath: manifestRel,
  };

  const attachments: PublicEvidencePackSource[] = [];
  if (analysisAbs && (await pathExists(analysisAbs))) {
    attachments.push({
      id: "financial-minesweeper-analysis",
      label: "排雷规则明细（JSON）",
      kind: "json",
      sourcePath: analysisAbs,
      fileName: "financial-minesweeper-analysis.json",
      previewable: true,
    });
  }
  if (phase2aAbs && (await pathExists(phase2aAbs))) {
    attachments.push({
      id: "financial-minesweeper-phase2a",
      label: "PDF 章节抽取（Phase2A）",
      kind: "json",
      sourcePath: phase2aAbs,
      fileName: "pdf-sections.json",
      previewable: true,
    });
  }
  if (phase2bAbs && (await pathExists(phase2bAbs))) {
    attachments.push({
      id: "financial-minesweeper-phase2b",
      label: "年报证据包（Phase2B）",
      kind: "markdown",
      sourcePath: phase2bAbs,
      fileName: "data-pack-report.md",
    });
  }

  await writeEntry({ siteDir, meta, contentMarkdown: markdown, attachments });

  const topicManifest: TopicManifestV1 = {
    manifestVersion: TOPIC_MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    publishedAt,
    runProfile: "stock_full",
    outputLayout: { code: m.outputLayout.code, runId: m.outputLayout.runId },
    topics: [
      {
        v2TopicId: siteTopicTypeToV2TopicId(topic),
        siteTopicType: topic,
        entryId,
        requiredFieldsStatus: "complete",
        sourceMarkdownRelative: relFromRun(runDir, reportAbs),
        qualityStatus: "complete",
      },
    ],
  };
  await writeTopicManifest(runDir, topicManifest);
}

function buildRankingListId(params: {
  generatedAt: string;
  strategyId: string;
  market: string;
  mode: string;
  runId: string;
}): string {
  const day = dateKeyFromIso(params.generatedAt);
  const compactStrategy = params.strategyId.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();
  const compactMarket = params.market.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();
  const compactMode = params.mode.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();
  return `${day}-${compactStrategy}-${compactMarket}-${compactMode}-${shortRunId(params.runId)}`;
}

/**
 * 策略 → 站点专题 slug 映射；用于榜单条目跳转研报详情页的 `topic` 查询参数。
 * 未映射的策略返回 `undefined`，调用方将省略 href 中的 `topic` 部分。
 */
const STRATEGY_TOPIC_SLUG: Record<string, ReportTopicType> = {
  turtle: "turtle-strategy",
};

function strategyHref(strategyId: string, code: string): string {
  const topic = STRATEGY_TOPIC_SLUG[strategyId];
  const params = new URLSearchParams();
  params.set("code", code);
  if (topic) params.set("topic", topic);
  return `/reports?${params.toString()}`;
}

function normalizeFeedBaseUrl(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  return value ? value.replace(/\/+$/u, "") : undefined;
}

function rankingSwCachePath(code: string): string {
  return path.join(resolveOutputPath("output/.rankings_cache/sw-industry"), `${code.replace(/[^0-9A-Za-z_.-]/gu, "_")}.json`);
}

function readSwPayload(body: unknown): SwIndustryClassificationPayload | undefined {
  if (!body || typeof body !== "object") return undefined;
  const root = body as Record<string, unknown>;
  const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : root;
  const level1Name = typeof data.level1Name === "string" ? data.level1Name.trim() : "";
  if (!level1Name) return undefined;
  return {
    provider: typeof data.provider === "string" ? data.provider : "sw",
    level1Name,
    level2Name: typeof data.level2Name === "string" ? data.level2Name.trim() : undefined,
    level3Name: typeof data.level3Name === "string" ? data.level3Name.trim() : undefined,
  };
}

async function fetchSwIndustryClassification(
  code: string,
): Promise<SwIndustryClassificationPayload | undefined> {
  const cachePath = rankingSwCachePath(code);
  try {
    const cached = readSwPayload(await readJson<unknown>(cachePath));
    if (cached) return cached;
  } catch {
    /* cache miss */
  }

  const baseUrl = normalizeFeedBaseUrl(process.env.FEED_BASE_URL);
  if (!baseUrl) return undefined;

  try {
    const res = await fetch(`${baseUrl}/api/v1/stock/industry/sw-classification/${encodeURIComponent(code)}`);
    if (!res.ok) return undefined;
    const payload = readSwPayload(await res.json());
    if (!payload) return undefined;
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(cachePath, JSON.stringify(payload, null, 2), "utf-8");
    return payload;
  } catch {
    return undefined;
  }
}

async function enrichRankingListSwIndustries(list: RankingListFile, siteDir: string): Promise<RankingListFile> {
  if (list.market !== "CN_A" || list.items.length === 0) return list;

  let enriched = 0;
  const items = await Promise.all(
    list.items.map(async (item) => {
      const sw = await fetchSwIndustryClassification(item.code);
      if (!sw?.level1Name) return item;
      enriched += 1;
      return {
        ...item,
        metrics: {
          ...item.metrics,
          classificationProvider: sw.provider ?? "sw",
          swLevel1Name: sw.level1Name,
          swLevel2Name: sw.level2Name ?? null,
          swLevel3Name: sw.level3Name ?? null,
        },
      };
    }),
  );

  const reasonCodes = new Set(list.capabilityReasonCodes ?? []);
  if (enriched > 0) reasonCodes.add("sw_industry_classification_enriched");
  if (enriched < list.items.length) reasonCodes.add("sw_industry_classification_partial_fallback");

  return {
    ...list,
    capabilityReasonCodes: [...reasonCodes],
    items,
  };
}

/**
 * 从 manifest 中读取 `rankingsTopN` 并做防御性收敛：非有限正数则使用默认 200。
 * 实际是否截断取决于 results 的真实长度，本函数只决定上限。
 */
function resolveRankingsTopN(manifest: SelectionManifestV1): number {
  const raw = manifest.rankingsTopN;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  return 200;
}

async function emitFromScreener(runDir: string, siteDir: string): Promise<void> {
  const [result, manifest] = await Promise.all([
    readJson<ScreenerRunOutput>(path.join(runDir, "screener_results.json")),
    readJson<SelectionManifestV1>(path.join(runDir, "selection_manifest.json")),
  ]);
  const runId = manifest.runId?.trim() || path.basename(runDir);
  const listId = buildRankingListId({
    generatedAt: result.generatedAt,
    strategyId: manifest.strategyId || result.strategyId || "turtle",
    market: result.market,
    mode: result.mode,
    runId,
  });
  const topN = resolveRankingsTopN(manifest);
  const strategyId = manifest.strategyId || result.strategyId || "turtle";
  const candidates = (manifest.candidates ?? []).slice(0, topN);
  const policyResults = (manifest.policyResults ?? []).map((it) => ({
    policyId: it.policyId,
    runId,
    code: it.code,
    payload: it.payload,
    reasonRefs: [],
  }));
  if (!manifest.policyResults || manifest.policyResults.length === 0) {
    throw new Error("[reports-site] selection_manifest.json 缺少 policyResults，rankings 不再回退到 screener_results.json");
  }
  const list: RankingListFile = await enrichRankingListSwIndustries({
    listId,
    sourceRunId: runId,
    strategyId,
    strategyLabel: manifest.strategyLabel || result.strategyLabel || "龟龟策略",
    market: result.market,
    mode: result.mode,
    generatedAt: result.generatedAt,
    capabilityStatus: result.capability?.status,
    capabilityReasonCodes: result.capability?.reasonCodes ?? [],
    topN,
    totalCandidates: manifest.candidates?.length ?? 0,
    items: toRankingViewItemsFromSelection({
      strategyId,
      candidates,
      policyResults,
      hrefResolver: strategyHref,
    }),
  }, siteDir);
  const rankingsDir = path.join(siteDir, "rankings", "lists");
  await mkdir(rankingsDir, { recursive: true });
  await writeFile(path.join(rankingsDir, `${listId}.json`), JSON.stringify(list, null, 2), "utf-8");
}

function isBetterRankingList(next: RankingListView, prev: RankingListView): boolean {
  return next.generatedAt > prev.generatedAt;
}

function resolveDefaultRankingStrategyId(lists: RankingListView[]): string {
  if (lists.some((list) => list.strategyId === "turtle")) return "turtle";
  return lists[0]?.strategyId ?? "turtle";
}

export async function rebuildSiteRankingsIndex(siteDir: string): Promise<void> {
  const listsRoot = path.join(siteDir, "rankings", "lists");
  const rawLists: RankingListFile[] = [];
  try {
    const files = (await readdir(listsRoot)).filter((name) => name.endsWith(".json")).sort();
    for (const fileName of files) {
      try {
        rawLists.push(await readJson<RankingListFile>(path.join(listsRoot, fileName)));
      } catch {
        /* skip broken */
      }
    }
  } catch {
    /* rankings directory absent */
  }

  const dedup = new Map<string, RankingListFile>();
  for (const list of rawLists) {
    const key = `${list.strategyId}|${list.market}|${list.mode}`;
    const prev = dedup.get(key);
    if (!prev || isBetterRankingList(list, prev)) dedup.set(key, list);
  }

  const winnerIds = new Set([...dedup.values()].map((it) => it.listId));
  for (const list of rawLists) {
    if (winnerIds.has(list.listId)) continue;
    await rm(path.join(listsRoot, `${list.listId}.json`), { force: true });
  }

  const lists = [...dedup.values()]
    .map(({ sourceRunId: _sourceRunId, ...list }) => list)
    .sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1));
  const index: SiteRankingsIndex = {
    version: "1.0",
    generatedAt: formatLocalDateTime(new Date()),
    strategyCount: new Set(lists.map((list) => list.strategyId)).size,
    listCount: lists.length,
    defaultStrategyId: resolveDefaultRankingStrategyId(lists),
    lists,
  };
  await mkdir(path.join(siteDir, "rankings"), { recursive: true });
  await writeFile(path.join(siteDir, "rankings", "index.json"), JSON.stringify(index, null, 2), "utf-8");
}

/** 扫描 entries 下各子目录的 meta.json，去重后重写 views 与 index.json */
export async function rebuildSiteReportsIndex(siteDir: string): Promise<void> {
  const entriesRoot = path.join(siteDir, "entries");
  let dirs: string[] = [];
  try {
    dirs = await readdir(entriesRoot, { withFileTypes: true }).then((xs) =>
      xs.filter((d) => d.isDirectory()).map((d) => d.name),
    );
  } catch {
    dirs = [];
  }

  const items: TimelineItem[] = [];
  for (const id of dirs) {
    const metaPath = path.join(entriesRoot, id, "meta.json");
    if (!(await pathExists(metaPath))) continue;
    try {
      const meta = await readJson<EntryMeta>(metaPath);
      items.push({
        entryId: meta.entryId,
        displayTitle: meta.displayTitle,
        topicType: meta.topicType,
        code: meta.code,
        publishedAt: meta.publishedAt,
        href: "/reports/" + meta.entryId + "/",
        requiredFieldsStatus: meta.requiredFieldsStatus,
        confidenceState: meta.confidenceState,
      });
    } catch {
      /* skip broken */
    }
  }

  /** 去重：同一自然日 + code + topic 仅保留质量最高；同质量保留最新 */
  const dedup = new Map<string, TimelineItem>();
  for (const it of items) {
    const dk = `${dateKeyFromIso(it.publishedAt)}|${it.code}|${it.topicType}`;
    const prev = dedup.get(dk);
    if (!prev || isBetterTimelineItem(it, prev)) dedup.set(dk, it);
  }
  const winnerIds = new Set([...dedup.values()].map((it) => it.entryId));
  for (const it of items) {
    if (winnerIds.has(it.entryId)) continue;
    const dir = path.join(entriesRoot, it.entryId);
    await rm(dir, { recursive: true, force: true });
  }
  const timeline = [...dedup.values()].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));

  await mkdir(path.join(siteDir, "views", "by-topic"), { recursive: true });
  await mkdir(path.join(siteDir, "views", "by-code"), { recursive: true });

  const byTopic = new Map<string, TimelineItem[]>();
  const byCode = new Map<string, TimelineItem[]>();
  for (const it of timeline) {
    byTopic.set(it.topicType, [...(byTopic.get(it.topicType) ?? []), it]);
    byCode.set(it.code, [...(byCode.get(it.code) ?? []), it]);
  }

  for (const topic of Object.keys(TOPIC_DISPLAY_PAGE_NAME) as ReportTopicType[]) {
    const arr = byTopic.get(topic) ?? [];
    await writeFile(path.join(siteDir, "views", "by-topic", `${topic}.json`), JSON.stringify(arr, null, 2), "utf-8");
  }
  for (const [code, arr] of byCode) {
    await writeFile(path.join(siteDir, "views", "by-code", `${code}.json`), JSON.stringify(arr, null, 2), "utf-8");
  }

  await writeFile(path.join(siteDir, "views", "timeline.json"), JSON.stringify(timeline, null, 2), "utf-8");

  const index: SiteReportsIndex = {
    version: "2.0",
    generatedAt: formatLocalDateTime(new Date()),
    entryCount: timeline.length,
    timelineHref: "/reports/",
  };
  await writeFile(path.join(siteDir, "index.json"), JSON.stringify(index, null, 2), "utf-8");
}

/**
 * 将单次 run 映射为 entries 子目录并重建聚合索引。
 * 会先删除本 run 可能生成的同目录下「同日同码同专题」旧 entry 再写入（按 entryId 目录覆盖）。
 */
export async function emitSiteReportsFromRun(opts: EmitSiteReportsOptions): Promise<{ siteDir: string }> {
  const runDir = path.resolve(opts.runDir);
  const siteDir = resolveOutputPath((opts.siteDir ?? "output/site/reports").trim() || "output/site/reports");
  await mkdir(siteDir, { recursive: true });
  await mkdir(path.join(siteDir, "entries"), { recursive: true });

  const wf = path.join(runDir, "workflow_manifest.json");
  const ba = path.join(runDir, "business_analysis_manifest.json");
  const fm = path.join(runDir, "financial_minesweeper_manifest.json");
  const tm = path.join(runDir, "topic_manifest.json");
  const screener = path.join(runDir, "screener_results.json");
  const selectionManifest = path.join(runDir, "selection_manifest.json");

  if (await pathExists(wf)) {
    await emitFromWorkflow(runDir, siteDir, wf);
  } else if (await pathExists(ba)) {
    await emitFromBusinessAnalysis(runDir, siteDir, ba);
  } else if (await pathExists(fm)) {
    await emitFromFinancialMinesweeper(runDir, siteDir, fm);
  } else if (await pathExists(tm)) {
    await emitFromTopicManifestOnly(runDir, siteDir, tm);
  } else if ((await pathExists(screener)) && (await pathExists(selectionManifest))) {
    await emitFromScreener(runDir, siteDir);
  } else {
    throw new Error(
      `[reports-site] 未找到 workflow_manifest.json / business_analysis_manifest.json / financial_minesweeper_manifest.json / topic_manifest.json / screener 双文件：${runDir}`,
    );
  }

  await rebuildSiteReportsIndex(siteDir);
  await rebuildSiteRankingsIndex(siteDir);
  return { siteDir };
}

/** 将 `site/reports` 同步到目标目录（通常为 app 的 `public/reports`，用于 Next 静态导出） */
export async function syncSiteReportsToPublicDir(input: {
  siteDir: string;
  targetPublicReportsDir: string;
}): Promise<void> {
  const src = path.resolve(input.siteDir);
  const dest = path.resolve(input.targetPublicReportsDir);
  await mkdir(path.dirname(dest), { recursive: true });
  await rm(dest, { recursive: true, force: true });
  await cp(src, dest, { recursive: true });
}

/** @deprecated 使用 {@link syncSiteReportsToPublicDir} */
export async function syncSiteReportsToDocsPublic(input: {
  siteDir: string;
  docsPublicReportsDir: string;
}): Promise<void> {
  return syncSiteReportsToPublicDir({
    siteDir: input.siteDir,
    targetPublicReportsDir: input.docsPublicReportsDir,
  });
}
