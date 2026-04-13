#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { strict as assert } from "node:assert";

import { runPhase3Strict } from "../phase3/analyzer.js";
import { renderPhase3Html, renderPhase3Markdown } from "../phase3/report-renderer.js";

function normalizeTimestamps(text: string): string {
  return text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, "<TIMESTAMP>");
}

async function main(): Promise<void> {
  const root = path.resolve(process.cwd(), "../..");
  const marketPackPath = path.join(root, "output/phase3_golden/data_pack_market.md");
  const reportPackPath = path.join(root, "output/phase3_golden/data_pack_report.md");
  const baselineValuationPath = path.join(root, "output/phase3_golden/run/valuation_computed.json");
  const baselineReportMdPath = path.join(root, "output/phase3_golden/run/analysis_report.md");
  const baselineReportHtmlPath = path.join(root, "output/phase3_golden/run/analysis_report.html");

  const [marketPack, reportPack, baselineValuationRaw, baselineReportMdRaw, baselineReportHtmlRaw] =
    await Promise.all([
    readFile(marketPackPath, "utf-8"),
    readFile(reportPackPath, "utf-8"),
      readFile(baselineValuationPath, "utf-8"),
      readFile(baselineReportMdPath, "utf-8"),
      readFile(baselineReportHtmlPath, "utf-8"),
    ]);

  const out = runPhase3Strict({
    marketMarkdown: marketPack,
    reportMarkdown: reportPack,
  });
  const valuationObj = out.valuation as unknown as Record<string, unknown>;
  valuationObj.generatedAt = "<TIMESTAMP>";
  const valuation = JSON.stringify(valuationObj, null, 2);
  const markdown = normalizeTimestamps(renderPhase3Markdown(out));
  const html = normalizeTimestamps(renderPhase3Html(markdown));

  const baselineValuationObj = JSON.parse(baselineValuationRaw) as Record<string, unknown>;
  baselineValuationObj.generatedAt = "<TIMESTAMP>";
  const baselineValuation = JSON.stringify(baselineValuationObj, null, 2);
  const baselineReportMd = normalizeTimestamps(baselineReportMdRaw);
  const baselineReportHtml = normalizeTimestamps(baselineReportHtmlRaw);

  assert.equal(
    createHash("sha256").update(valuation).digest("hex"),
    createHash("sha256").update(baselineValuation).digest("hex"),
    "valuation_computed regression mismatch",
  );
  assert.equal(
    createHash("sha256").update(markdown).digest("hex"),
    createHash("sha256").update(baselineReportMd).digest("hex"),
    "analysis_report.md regression mismatch",
  );
  assert.equal(
    createHash("sha256").update(html).digest("hex"),
    createHash("sha256").update(baselineReportHtml).digest("hex"),
    "analysis_report.html regression mismatch",
  );

  console.log("[quality] regression check passed (phase3 outputs match golden baseline)");
}

void main();
