---
description: 将任意 Markdown 报告转为 HTML（与 Phase3 报告 HTML 包装一致）
argument-hint: [--input-md] [--output-html]
---

在 **monorepo 根目录**执行（需已 `pnpm run build`）。

## 映射 CLI

```bash
pnpm run report-to-html:run -- \
  --input-md "./output/workflow/600887/analysis_report.md" \
  [--output-html "./output/workflow/600887/analysis_report.custom.html"]
```

未指定 `--output-html` 时，在与输入同目录生成同名 `.html`。

## Slash 对应

`/report-to-html` → 本 CLI。
