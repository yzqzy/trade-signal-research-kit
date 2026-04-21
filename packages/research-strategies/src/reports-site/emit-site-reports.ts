import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DataPackMarket, Market } from "@trade-signal/schema-core";
import { qualitativeMarkdownToDashboardHtml } from "@trade-signal/reporting";

import { resolveOutputPath } from "../crosscut/normalization/resolve-monorepo-path.js";
import { renderMarkdownToSemanticHtml } from "../steps/phase3/markdown-to-html.js";
import { renderPhase3Html } from "../steps/phase3/report-renderer.js";
import { extractInnerBodyFromFullHtml } from "./extract-html-body.js";
import { wrapStandaloneReportHtml } from "./html-shell.js";
import { formatListedCode } from "./listed-code.js";
import { buildDisplayTitle, TOPIC_ENTRY_SLUG } from "./topic-labels.js";
import type {
  ConfidenceState,
  EntryMeta,
  ReportTopicType,
  RequiredFieldsStatus,
  SiteReportsIndex,
  TimelineItem,
} from "./types.js";

export type EmitSiteReportsOptions = {
  /** workflow 或 business-analysis 单次 run 根目录（含 manifest） */
  runDir: string;
  /** 聚合站点根目录，默认 `output/site/reports`（相对 monorepo 根） */
  siteDir?: string;
};

function shortRunId(runId: string): string {
  const compact = runId.replace(/-/g, "");
  return (compact.slice(0, 8) || "00000000").toLowerCase();
}

function dateKeyFromIso(iso: string): string {
  return iso.slice(0, 10);
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

async function tryReadCompanyContext(
  runDir: string,
  manifestInput: Record<string, unknown>,
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
  return { name: code };
}

function parseConfidenceFromReportMd(md: string): ConfidenceState {
  const m = md.match(/^\s*-\s*confidence:\s*(\S+)/im);
  const v = m?.[1]?.toLowerCase();
  if (v === "high" || v === "medium" || v === "low") return v;
  return "unknown";
}

function buildEntryId(date: string, codeDigits: string, topic: ReportTopicType, runShort: string): string {
  const slug = TOPIC_ENTRY_SLUG[topic];
  return `${date}-${codeDigits}-${slug}-${runShort}`;
}

async function writeEntry(params: {
  siteDir: string;
  meta: EntryMeta;
  indexHtml: string;
}): Promise<void> {
  const dir = path.join(params.siteDir, "entries", params.meta.entryId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "meta.json"), JSON.stringify(params.meta, null, 2), "utf-8");
  await writeFile(path.join(dir, "index.html"), params.indexHtml, "utf-8");
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
    valuationPath?: string;
    reportMarkdownPath?: string;
    reportHtmlPath?: string;
  };
  orchestration?: { threadId?: string; runId?: string };
};

type BusinessAnalysisManifest = {
  manifestVersion: string;
  generatedAt: string;
  outputLayout: { code: string; runId: string };
  input: Record<string, unknown>;
  outputs: {
    qualitativeReportPath?: string;
    qualitativeD1D6Path?: string;
    marketPackPath?: string;
    phase1bMarkdownPath?: string;
  };
};

async function emitFromWorkflow(runDir: string, siteDir: string, manifestPath: string): Promise<void> {
  const m = await readJson<WorkflowManifest>(manifestPath);
  const publishedAt = m.generatedAt;
  const date = dateKeyFromIso(publishedAt);
  const codeDigits = String(m.outputLayout.code ?? "").replace(/\D/g, "") || m.outputLayout.code;
  const sourceRunId = String(m.orchestration?.threadId ?? m.orchestration?.runId ?? m.outputLayout.runId ?? "");
  const runShort = shortRunId(sourceRunId || m.outputLayout.runId || "run");
  const ctx = await tryReadCompanyContext(runDir, m.input as Record<string, unknown>);
  const listed = formatListedCode(codeDigits, ctx.market);

  const reportMdPath = m.outputs.reportMarkdownPath;
  const reportHtmlPath = m.outputs.reportHtmlPath;
  const valuationPath = m.outputs.valuationPath;
  const marketPath = m.outputs.marketPackPath;

  let reportMarkdown = "";
  if (reportMdPath && (await pathExists(reportMdPath))) {
    reportMarkdown = await readFile(reportMdPath, "utf-8");
  }
  const confidence = parseConfidenceFromReportMd(reportMarkdown);

  const hasValuationJson = Boolean(valuationPath && (await pathExists(valuationPath)));
  const hasReportMd = reportMarkdown.length > 0;
  const hasReportHtml = Boolean(reportHtmlPath && (await pathExists(reportHtmlPath)));
  const hasMarketMd = Boolean(marketPath && (await pathExists(marketPath)));

  const manifestRel = path.relative(siteDir, manifestPath);

  const topics: Array<{
    topic: ReportTopicType;
    status: RequiredFieldsStatus;
    html: string;
  }> = [];

  /** 龟龟整包 */
  {
    let status: RequiredFieldsStatus = "missing";
    let html = "";
    if (hasReportHtml && reportHtmlPath) {
      status = hasValuationJson && hasReportMd ? "complete" : "degraded";
      const inner = extractInnerBodyFromFullHtml(await readFile(reportHtmlPath, "utf-8"));
      html = wrapStandaloneReportHtml({
        title: buildDisplayTitle({ companyName: ctx.name, listedCode: listed, topic: "turtle-strategy" }),
        bodyInnerHtml: inner,
      });
    } else if (hasReportMd) {
      status = hasValuationJson ? "degraded" : "degraded";
      html = wrapStandaloneReportHtml({
        title: buildDisplayTitle({ companyName: ctx.name, listedCode: listed, topic: "turtle-strategy" }),
        bodyInnerHtml: extractInnerBodyFromFullHtml(renderPhase3Html(reportMarkdown)),
      });
    }
    topics.push({ topic: "turtle-strategy", status, html });
  }

  /** 估值 */
  {
    let status: RequiredFieldsStatus = "missing";
    let body = "";
    if (hasReportMd) {
      body = extractInnerBodyFromFullHtml(renderPhase3Html(reportMarkdown));
      status = hasValuationJson ? "complete" : "degraded";
    }
    if (hasValuationJson && valuationPath) {
      const vj = await readFile(valuationPath, "utf-8");
      const parsed = JSON.parse(vj) as unknown;
      const pre = `<section class="meta"><h2>valuation_computed.json</h2><pre>${escapeHtml(
        JSON.stringify(parsed, null, 2),
      )}</pre></section>`;
      body = `${pre}${body}`;
    }
    const html = body
      ? wrapStandaloneReportHtml({
          title: buildDisplayTitle({ companyName: ctx.name, listedCode: listed, topic: "valuation" }),
          bodyInnerHtml: body,
        })
      : "";
    topics.push({ topic: "valuation", status, html });
  }

  /** 穿透回报率 */
  {
    let status: RequiredFieldsStatus = "missing";
    let parts: string[] = [];
    if (hasReportMd) {
      parts.push(extractInnerBodyFromFullHtml(renderPhase3Html(reportMarkdown)));
      status = hasMarketMd ? "complete" : "degraded";
    }
    if (hasMarketMd && marketPath) {
      const md = await readFile(marketPath, "utf-8");
      parts.push(`<h2>市场数据包（data_pack_market.md）</h2>${mdToArticleHtml(md, "市场数据包")}`);
    }
    const body = parts.join('<hr style="margin:2rem 0" />');
    const html = body
      ? wrapStandaloneReportHtml({
          title: buildDisplayTitle({ companyName: ctx.name, listedCode: listed, topic: "penetration-return" }),
          bodyInnerHtml: body,
        })
      : "";
    topics.push({ topic: "penetration-return", status, html });
  }

  /** 商业质量（workflow 侧通常无终稿 qualitative；以 Phase1B 为降级占位） */
  {
    const p1b = m.outputs.phase1bMarkdownPath;
    const hasP1b = Boolean(p1b && (await pathExists(p1b!)));
    let status: RequiredFieldsStatus = "missing";
    let html = "";
    if (hasP1b && p1b) {
      const md = await readFile(p1b, "utf-8");
      status = "degraded";
      html = wrapStandaloneReportHtml({
        title: buildDisplayTitle({ companyName: ctx.name, listedCode: listed, topic: "business-quality" }),
        bodyInnerHtml: `<p class="meta">workflow 产物不包含 <code>qualitative_report.md</code> 终稿；以下为 Phase1B 外部证据补充稿（占位降级）。完整商业质量评估请运行 <code>business-analysis:run</code>。</p>${mdToArticleHtml(md, "Phase1B")}`,
      });
    }
    topics.push({ topic: "business-quality", status, html });
  }

  for (const t of topics) {
    if (!t.html) continue;
    const entryId = buildEntryId(date, codeDigits, t.topic, runShort);
    const meta: EntryMeta = {
      entryId,
      code: codeDigits,
      topicType: t.topic,
      displayTitle: buildDisplayTitle({ companyName: ctx.name, listedCode: listed, topic: t.topic }),
      publishedAt,
      sourceRunId,
      requiredFieldsStatus: t.status,
      confidenceState: confidence,
      contentFile: "index.html",
      sourceManifestPath: manifestRel,
    };
    await writeEntry({ siteDir, meta, indexHtml: t.html });
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function mdToArticleHtml(markdown: string, documentTitle: string): string {
  return extractInnerBodyFromFullHtml(
    renderMarkdownToSemanticHtml(markdown, { documentTitle }),
  );
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
  const ctx = await tryReadCompanyContext(runDir, m.input as Record<string, unknown>);
  const listed = formatListedCode(codeDigits, ctx.market);

  const qPath = m.outputs.qualitativeReportPath;
  const d1 = m.outputs.qualitativeD1D6Path;
  const hasQ = Boolean(qPath && (await pathExists(qPath!)));
  const hasD1 = Boolean(d1 && (await pathExists(d1!)));

  let status: RequiredFieldsStatus = "missing";
  if (hasQ && hasD1) status = "complete";
  else if (hasQ || hasD1) status = "degraded";

  const parts: string[] = [];
  if (hasQ && qPath) {
    const md = await readFile(qPath, "utf-8");
    parts.push(extractInnerBodyFromFullHtml(qualitativeMarkdownToDashboardHtml(md)));
  }
  if (hasD1 && d1) {
    const md = await readFile(d1, "utf-8");
    parts.push(`<h2>qualitative_d1_d6.md</h2>${mdToArticleHtml(md, "D1~D6")}`);
  }

  const body = parts.join('<hr style="margin:2rem 0" />');
  if (!body) return;

  const html = wrapStandaloneReportHtml({
    title: buildDisplayTitle({ companyName: ctx.name, listedCode: listed, topic: "business-quality" }),
    bodyInnerHtml: body,
  });

  const topic: ReportTopicType = "business-quality";
  const entryId = buildEntryId(date, codeDigits, topic, runShort);
  const manifestRel = path.relative(siteDir, manifestPath);
  const meta: EntryMeta = {
    entryId,
    code: codeDigits,
    topicType: topic,
    displayTitle: buildDisplayTitle({ companyName: ctx.name, listedCode: listed, topic }),
    publishedAt,
    sourceRunId,
    requiredFieldsStatus: status,
    confidenceState: "unknown",
    contentFile: "index.html",
    sourceManifestPath: manifestRel,
  };
  await writeEntry({ siteDir, meta, indexHtml: html });
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

  /** 去重：同一自然日 + code + topic 仅保留 publishedAt 最新 */
  const dedup = new Map<string, TimelineItem>();
  const sorted = [...items].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  for (const it of sorted) {
    const dk = `${dateKeyFromIso(it.publishedAt)}|${it.code}|${it.topicType}`;
    dedup.set(dk, it);
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

  for (const [topic, arr] of byTopic) {
    await writeFile(path.join(siteDir, "views", "by-topic", `${topic}.json`), JSON.stringify(arr, null, 2), "utf-8");
  }
  for (const [code, arr] of byCode) {
    await writeFile(path.join(siteDir, "views", "by-code", `${code}.json`), JSON.stringify(arr, null, 2), "utf-8");
  }

  await writeFile(path.join(siteDir, "views", "timeline.json"), JSON.stringify(timeline, null, 2), "utf-8");

  const index: SiteReportsIndex = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
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

  if (await pathExists(wf)) {
    await emitFromWorkflow(runDir, siteDir, wf);
  } else if (await pathExists(ba)) {
    await emitFromBusinessAnalysis(runDir, siteDir, ba);
  } else {
    throw new Error(
      `[reports-site] 未找到 workflow_manifest.json / business_analysis_manifest.json：${runDir}`,
    );
  }

  await rebuildSiteReportsIndex(siteDir);
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
