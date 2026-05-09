import type { MarkdownTransform } from "../pipeline.js";

export const stripExistingEvidenceQuality: MarkdownTransform = (markdown) =>
  markdown
    .replace(/^##\s+证据质量与限制\s*\n[\s\S]*?(?=^##\s+附录：证据索引\s*$|^##\s+证据缺口清单|^##\s+D[1-6]\b|(?![\s\S]))/imu, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
