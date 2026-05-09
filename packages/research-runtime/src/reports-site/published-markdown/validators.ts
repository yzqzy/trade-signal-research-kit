import { PUBLISHED_MARKDOWN_FORBIDDEN } from "./patterns.js";

export function findPublishedMarkdownQualityViolations(markdown: string): string[] {
  return PUBLISHED_MARKDOWN_FORBIDDEN.filter(([, re]) => re.test(markdown)).map(([name]) => name);
}
