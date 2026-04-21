/** 独立静态页 `index.html` 外壳（与 docs emerald 主色对齐） */
export function wrapStandaloneReportHtml(input: {
  title: string;
  /** 已含语义化 HTML 的正文片段 */
  bodyInnerHtml: string;
}): string {
  const title = escapeHtmlAttr(input.title);
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  :root {
    --ts-accent: #059669;
    --ts-accent-2: #0d9488;
    --ts-bg: #fafafa;
    --ts-fg: #111827;
    --ts-muted: #6b7280;
    --ts-border: #e5e7eb;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --ts-bg: #030712;
      --ts-fg: #f9fafb;
      --ts-muted: #9ca3af;
      --ts-border: #1f2937;
    }
  }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    background: var(--ts-bg);
    color: var(--ts-fg);
    line-height: 1.6;
  }
  header {
    border-bottom: 1px solid var(--ts-border);
    padding: 16px 20px;
    background: linear-gradient(90deg, var(--ts-accent), var(--ts-accent-2));
    color: #fff;
  }
  header h1 { margin: 0; font-size: 1.05rem; font-weight: 600; }
  main { max-width: 1100px; margin: 0 auto; padding: 24px 20px 48px; }
  .meta { font-size: 0.85rem; color: var(--ts-muted); margin-top: 8px; }
  article { font-size: 0.95rem; }
  article pre { white-space: pre-wrap; background: rgba(5, 150, 105, 0.06); border: 1px solid var(--ts-border); border-radius: 8px; padding: 12px; }
  article table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 0.9rem; }
  article th, article td { border: 1px solid var(--ts-border); padding: 6px 8px; text-align: left; }
</style>
</head>
<body>
<header><h1>${title}</h1></header>
<main><article>${input.bodyInnerHtml}</article></main>
</body>
</html>`;
}

function escapeHtmlAttr(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
