import type { ReportSourceLink } from "../types.js";
import type { PublicEvidencePackSource } from "../public-evidence-pack-renderer.js";

export function officialAnnualPdfLink(input: Record<string, unknown>): ReportSourceLink[] {
  const href = typeof input.reportUrl === "string" ? input.reportUrl.trim() : "";
  if (!/^https?:\/\/.+\.pdf(?:[?#].*)?$/iu.test(href)) return [];
  return [{ id: "annual-pdf-official", label: "原始年报 PDF（官方）", kind: "pdf", href }];
}

export function commonEvidenceAttachments(paths: {
  marketPath?: string;
  dataPackReportPath?: string;
  phase1bMarkdownPath?: string;
}): PublicEvidencePackSource[] {
  return [
    {
      id: "annual-report-pack",
      label: "年报证据包摘要",
      kind: "markdown",
      sourcePath: paths.dataPackReportPath,
      fileName: "annual-report-pack.md",
    },
    {
      id: "regulatory-evidence",
      label: "公告与监管补充",
      kind: "markdown",
      sourcePath: paths.phase1bMarkdownPath,
      fileName: "regulatory-evidence.md",
    },
    {
      id: "market-pack",
      label: "市场与行业证据摘要",
      kind: "markdown",
      sourcePath: paths.marketPath,
      fileName: "market-pack.md",
    },
  ];
}

export function publicEvidenceLocator(raw: string): string {
  const cell = raw.replace(/`/gu, "").trim();
  const basename = cell.split(/[\\/]/u).filter(Boolean).at(-1) ?? cell;
  if (/data_pack_report(?:_interim)?\.md/u.test(basename)) return "[年报证据包 · 可展开/下载](#attachment-annual-report-pack)";
  if (/phase1b_qualitative\.md/u.test(basename)) return "[公告与监管补充 · 可展开/下载](#attachment-regulatory-evidence)";
  if (/data_pack_market\.md/u.test(basename)) return "[市场与行业证据摘要 · 可展开/下载](#attachment-market-pack)";
  if (/phase1a_data_pack\.json/u.test(basename)) return "基础行情与财务数据，已汇总入本页表格";
  if (/valuation_computed\.json/u.test(basename)) return "[估值模型结果 · 可下载](#attachment-valuation-model)";
  if (/analysis_report\.md/u.test(basename)) return "[策略计算底稿 · 可展开/下载](#attachment-strategy-calculation)";
  if (/phase3_preflight\.md/u.test(basename)) return "证据质量预检摘要，见“证据质量与限制”";
  if (/\.md$|\.json$/u.test(basename)) return "内部证据包摘要，已转写入正文";
  return cell || "正文引用定位";
}
