/** 从 Phase3 全页 HTML 中取出 `<body>` 内层（用于拼接专题页） */
export function extractInnerBodyFromFullHtml(html: string): string {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return m?.[1]?.trim() ?? html;
}
