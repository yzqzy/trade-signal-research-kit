---
description: 将 Markdown 转为语义化 HTML（版式渲染；不生成或改写叙事正文）
argument-hint: [--input-md] [--output-html] [--toc] [--legacy-pre]
---

在 **monorepo 根目录**执行（需已 `pnpm run build`）。

> **职责边界**：仅 **MD→HTML**；不执行证据采集、估值或 **final-narrative**。输入 `.md` 须已由编排或 Claude 事先写好。

## Slash → CLI（脚本 / CI）

```bash
pnpm run report-to-html:run -- \
  --input-md "./output/workflow/600887/analysis_report.md" \
  [--output-html "./output/workflow/600887/analysis_report.custom.html"] \
  [--toc] [--legacy-pre]
```

未指定 `--output-html` 时，在与输入同目录生成同名 `.html`。默认语义化渲染；`--legacy-pre` 回退为整页 `<pre>`。

## Slash 对应

`/report-to-html` → 本 CLI。
