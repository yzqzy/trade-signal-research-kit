import type { MarkdownTransform } from "../pipeline.js";

export const stripFinalStatus: MarkdownTransform = (markdown) =>
  markdown
    .replace(/^\s*\[终稿状态:\s*(?:完成|complete)\]\s*\n*/imu, "")
    .trim();
