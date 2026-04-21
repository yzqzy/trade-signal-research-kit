/** 从完整 HTML 文档中提取 `<body>` 内层 */
export function extractInnerBodyHtml(html: string): string {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return (m?.[1] ?? html).trim();
}

/** 优先取 `<article>` 内层（与 CLI 生成的 index.html 结构对齐），否则退回 body 内层 */
export function extractReportArticleHtml(html: string): string {
  const body = extractInnerBodyHtml(html);
  const am = body.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  return (am?.[1] ?? body).trim();
}
