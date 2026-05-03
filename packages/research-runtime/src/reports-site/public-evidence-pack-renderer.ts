import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ReportAttachment } from "./types.js";

export type PublicEvidencePackSource = {
  id: string;
  label: string;
  kind: ReportAttachment["kind"];
  sourcePath?: string;
  fileName: string;
  previewable?: boolean;
};

export type PublicEvidencePackArtifact = PublicEvidencePackSource & {
  content: string;
};

export type PublicEvidencePackRendererOptions = {
  normalizeMarkdown: (markdown: string) => string;
  validateContent: (content: string) => string[];
  pathExists: (p: string) => Promise<boolean>;
};

function hideInternalPaths(text: string): string {
  return text
    .replace(/\/Users\/[^\s|)"'`]+/gu, "内部路径已隐藏")
    .replace(/\/private\/[^\s|)"'`]+/gu, "内部路径已隐藏")
    .replace(/\/var\/folders\/[^\s|)"'`]+/gu, "内部路径已隐藏")
    .replace(/output\/(?:workflow|business-analysis|site)\/[^\s|)"'`]+/gu, "内部路径已隐藏");
}

export function renderPublicEvidencePackContent(
  raw: string,
  kind: ReportAttachment["kind"],
  options: Pick<PublicEvidencePackRendererOptions, "normalizeMarkdown" | "validateContent">,
): string {
  const withoutInternalComments = raw.replace(/<!--\s*PDF_EXTRACT_QUALITY:[\s\S]*?-->\s*/gu, "");
  let content = kind === "markdown" ? options.normalizeMarkdown(withoutInternalComments) : withoutInternalComments.trim();
  if (kind === "json") {
    try {
      content = JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      /* keep raw JSON-ish content */
    }
  }
  content = hideInternalPaths(content);
  const violations = options.validateContent(content);
  if (violations.length > 0) {
    throw new Error(`[reports-site] public evidence pack 含发布禁用内容：${violations.join(", ")}`);
  }
  return content.endsWith("\n") ? content : `${content}\n`;
}

export async function renderPublicEvidencePack(
  sources: PublicEvidencePackSource[],
  options: PublicEvidencePackRendererOptions,
): Promise<PublicEvidencePackArtifact[]> {
  const artifacts: PublicEvidencePackArtifact[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    if (!source.sourcePath || seen.has(source.id) || !(await options.pathExists(source.sourcePath))) continue;
    seen.add(source.id);
    const raw = await readFile(source.sourcePath, "utf-8");
    const content = renderPublicEvidencePackContent(raw, source.kind, options);
    if (!content.trim()) continue;
    artifacts.push({ ...source, content });
  }
  return artifacts;
}

export async function writePublicEvidencePack(
  entryDir: string,
  artifacts: PublicEvidencePackArtifact[],
): Promise<ReportAttachment[]> {
  const attachments: ReportAttachment[] = [];
  for (const artifact of artifacts) {
    const href = `attachments/${artifact.fileName}`;
    const abs = path.join(entryDir, href);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, artifact.content, "utf-8");
    attachments.push({
      id: artifact.id,
      label: artifact.label,
      kind: artifact.kind,
      href,
      previewable: artifact.previewable ?? artifact.kind === "markdown",
      bytes: Buffer.byteLength(artifact.content, "utf-8"),
      lines: artifact.content.split(/\r?\n/u).length,
    });
  }
  return attachments;
}
