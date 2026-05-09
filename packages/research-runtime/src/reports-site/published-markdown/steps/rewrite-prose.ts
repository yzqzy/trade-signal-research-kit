import type { MarkdownTransform } from "../pipeline.js";
import { PUBLISH_TEXT_REWRITES } from "../patterns.js";
import { normalizeEvidenceRefSpacing } from "./normalize-evidence-ref-spacing.js";
import { sanitizeEvidenceAppendix } from "./sanitize-evidence-appendix.js";
import { stripInternalLines } from "./strip-internal-lines.js";

export const rewriteProse: MarkdownTransform = (markdown, ctx) => {
  let next = stripInternalLines(markdown, ctx);
  for (const [pattern, replacement] of PUBLISH_TEXT_REWRITES) {
    next = next.replace(pattern, replacement);
  }
  next = sanitizeEvidenceAppendix(next, ctx);
  next = normalizeEvidenceRefSpacing(next, ctx);
  return next.replace(/\n{3,}/g, "\n\n").trim();
};
