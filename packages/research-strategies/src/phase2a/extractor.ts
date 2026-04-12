import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { PDFParse } from "pdf-parse";

import type { PdfSectionBlock, PdfSections } from "@trade-signal/schema-core";

import {
  PHASE2A_SECTION_BUFFER_PAGES,
  PHASE2A_SECTION_KEYWORDS,
  PHASE2A_SECTION_MAX_CHARS,
  PHASE2A_SECTION_PHASE2B_TARGETS,
  PHASE2A_SECTION_ORDER,
  PHASE2A_SECTION_TITLES,
  type Phase2ASectionId,
} from "./keywords.js";

type PageText = { page: number; text: string };
type PageCandidate = { page: number; score: number };

export interface Phase2AExtractInput {
  pdfPath: string;
  outputPath?: string;
  verbose?: boolean;
}

function truncateAroundKeyword(content: string, keywords: string[], maxChars: number): string {
  if (content.length <= maxChars) return content;

  let firstMatchIndex = -1;
  for (const keyword of keywords) {
    const index = content.indexOf(keyword);
    if (index >= 0 && (firstMatchIndex < 0 || index < firstMatchIndex)) {
      firstMatchIndex = index;
    }
  }

  if (firstMatchIndex < 0) return content.slice(0, maxChars);

  const start = Math.max(0, firstMatchIndex - Math.floor(maxChars * 0.35));
  const end = Math.min(content.length, start + maxChars);
  return content.slice(start, end);
}

async function extractPageTexts(pdfPath: string): Promise<PageText[]> {
  const raw = await readFile(pdfPath);
  const parser = new PDFParse({ data: new Uint8Array(raw) });
  try {
    const textResult = await parser.getText({
      lineEnforce: true,
      pageJoiner: "\n",
    });
    return textResult.pages.map((page) => ({
      page: page.num,
      text: page.text ?? "",
    }));
  } finally {
    await parser.destroy();
  }
}

function countOccurrences(text: string, needle: string): number {
  if (!needle) return 0;
  let from = 0;
  let count = 0;
  while (from < text.length) {
    const index = text.indexOf(needle, from);
    if (index < 0) break;
    count += 1;
    from = index + needle.length;
  }
  return count;
}

function detectAnnexStartPage(pages: PageText[]): number {
  const total = pages.length;
  for (const page of pages) {
    if (!page.text) continue;
    if (/第[十0-9一二三四五六七八九]+节\s*财务报告/.test(page.text)) {
      return page.page;
    }
  }

  const financeLowerBound = Math.max(5, Math.floor(total * 0.15));
  for (const page of pages) {
    if (!page.text || page.page < financeLowerBound) continue;
    if (/财务报告/.test(page.text)) return page.page;
  }

  const noteLowerBound = Math.max(20, Math.floor(total * 0.25));
  for (const page of pages) {
    if (!page.text || page.page < noteLowerBound) continue;
    if (/附注/.test(page.text)) return page.page;
  }

  return Math.max(1, Math.floor(total * 0.35));
}

function isLikelyTocPage(text: string): boolean {
  if (!text) return false;
  const tocHit = /目\s*录/.test(text);
  const dotLineHits = (text.match(/\.{6,}/g) ?? []).length;
  return tocHit || dotLineHits >= 3;
}

function isPhase2BTarget(sectionId: Phase2ASectionId): boolean {
  return (PHASE2A_SECTION_PHASE2B_TARGETS as readonly string[]).includes(sectionId);
}

function buildSectionBoundaryMatchers(sectionId: Phase2ASectionId): RegExp[] {
  const others = PHASE2A_SECTION_ORDER.filter((id) => id !== sectionId);
  const titles = others.map((id) => PHASE2A_SECTION_TITLES[id]);
  const keywords = others.flatMap((id) => PHASE2A_SECTION_KEYWORDS[id].slice(0, 2));
  return [...titles, ...keywords].map((token) => new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

function findSectionEndPage(
  sectionId: Phase2ASectionId,
  bestPage: number,
  pages: PageText[],
  annexStartPage: number,
): number {
  const buffer = PHASE2A_SECTION_BUFFER_PAGES[sectionId];
  const boundaryMatchers = buildSectionBoundaryMatchers(sectionId);
  const maxPage = Math.min(pages.length, bestPage + Math.max(buffer + 2, 4));
  for (let pageNo = bestPage + 1; pageNo <= maxPage; pageNo += 1) {
    const page = pages[pageNo - 1];
    if (!page?.text) continue;
    const hitBoundary = boundaryMatchers.some((matcher) => matcher.test(page.text));
    if (hitBoundary) return Math.max(bestPage, pageNo - 1);
  }
  if (isPhase2BTarget(sectionId)) {
    return Math.min(pages.length, Math.max(bestPage, bestPage + buffer));
  }
  if (sectionId === "MDA" && bestPage < annexStartPage) {
    return Math.min(pages.length, Math.max(bestPage + 1, annexStartPage - 1));
  }
  return Math.min(pages.length, bestPage + buffer);
}

function scoreSectionCandidate(
  sectionId: Phase2ASectionId,
  page: PageText,
  annexStartPage: number,
): number {
  const keywords = PHASE2A_SECTION_KEYWORDS[sectionId];
  if (!page.text) return 0;
  let score = 0;
  for (const keyword of keywords) {
    const hits = countOccurrences(page.text, keyword);
    if (hits > 0) {
      score += 20;
      score += hits * 3;
      const lineHit = page.text
        .split("\n")
        .some((line) => line.length <= 60 && line.includes(keyword));
      if (lineHit) score += 10;
    }
  }
  if (score === 0) return 0;
  if (isLikelyTocPage(page.text)) score -= 50;
  const isAnnexSection = isPhase2BTarget(sectionId);
  if (isAnnexSection) {
    score += page.page >= annexStartPage ? 28 : -22;
  } else if (sectionId === "MDA") {
    score += page.page < annexStartPage ? 18 : -10;
  }
  return score;
}

function findBestPageForSection(
  sectionId: Phase2ASectionId,
  pages: PageText[],
  annexStartPage: number,
): PageCandidate | undefined {
  let best: PageCandidate | undefined;
  for (const page of pages) {
    const score = scoreSectionCandidate(sectionId, page, annexStartPage);
    if (score <= 0) continue;
    if (!best || score > best.score) {
      best = { page: page.page, score };
    }
  }
  return best;
}

function buildSectionBlock(
  sectionId: Phase2ASectionId,
  pages: PageText[],
  bestPage: number,
  annexStartPage: number,
): PdfSectionBlock | undefined {
  const bufferPages = PHASE2A_SECTION_BUFFER_PAGES[sectionId];
  let start = Math.max(1, bestPage - bufferPages);
  if (isPhase2BTarget(sectionId)) {
    start = Math.max(start, annexStartPage);
  }
  const end = findSectionEndPage(sectionId, bestPage, pages, annexStartPage);

  const collected = pages
    .filter((page) => page.page >= start && page.page <= end)
    .map((page) => `--- p.${page.page} ---\n${page.text}`)
    .join("\n\n")
    .trim();

  if (!collected) return undefined;

  return {
    title: PHASE2A_SECTION_TITLES[sectionId],
    content: truncateAroundKeyword(
      collected,
      PHASE2A_SECTION_KEYWORDS[sectionId],
      PHASE2A_SECTION_MAX_CHARS[sectionId],
    ),
    pageFrom: start,
    pageTo: end,
  };
}

function writeSection(
  target: PdfSections,
  sectionId: Phase2ASectionId,
  value: PdfSectionBlock | undefined,
): void {
  if (!value) return;
  if (sectionId === "P2") target.P2 = value;
  if (sectionId === "P3") target.P3 = value;
  if (sectionId === "P4") target.P4 = value;
  if (sectionId === "P6") target.P6 = value;
  if (sectionId === "P13") target.P13 = value;
  if (sectionId === "MDA") target.MDA = value;
  if (sectionId === "SUB") target.SUB = value;
}

export async function runPhase2AExtractPdfSections(input: Phase2AExtractInput): Promise<PdfSections> {
  const pages = await extractPageTexts(input.pdfPath);
  const annexStartPage = detectAnnexStartPage(pages);
  const metadata = {
    pdfFile: path.basename(input.pdfPath),
    totalPages: pages.length,
    extractTime: new Date().toISOString(),
    sectionsFound: 0,
    sectionsTotal: PHASE2A_SECTION_ORDER.length,
  };

  const sections: PdfSections = { metadata };
  for (const sectionId of PHASE2A_SECTION_ORDER) {
    const best = findBestPageForSection(sectionId, pages, annexStartPage);
    if (!best) continue;
    const block = buildSectionBlock(sectionId, pages, best.page, annexStartPage);
    if (!block) continue;
    writeSection(sections, sectionId, block);
    sections.metadata.sectionsFound += 1;
    if (input.verbose) {
      // Keep logs terse for CLI use.
      console.log(
        `[phase2a] ${sectionId} -> pages ${block.pageFrom}-${block.pageTo} (score=${best.score}, annexStart=${annexStartPage})`,
      );
    }
  }

  if (input.outputPath) {
    const outDir = path.dirname(input.outputPath);
    await mkdir(outDir, { recursive: true });
    await writeFile(input.outputPath, JSON.stringify(sections, null, 2), "utf-8");
  }

  return sections;
}
