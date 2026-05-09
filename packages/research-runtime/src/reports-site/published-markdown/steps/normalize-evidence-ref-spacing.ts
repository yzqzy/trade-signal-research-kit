import type { MarkdownTransform } from "../pipeline.js";

export const normalizeEvidenceRefSpacing: MarkdownTransform = (markdown) =>
  markdown
    .replace(/(\[(?:E\d+|M:§\d+)\])(?=\[(?:E\d+|M:§\d+)\])/giu, "$1 ")
    .replace(/(\[(?:E\d+|M:§\d+)\]\([^)]*\))(?=\[(?:E\d+|M:§\d+)\]\([^)]*\))/giu, "$1 ");
