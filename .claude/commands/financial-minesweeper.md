---
description: 财报排雷（HTTP Feed 规则化扫描）；发布走研报站 emit；与 workflow 六维终稿、report-polish 无替代关系
argument-hint: [--code] [--year] [--output-dir] [--reports-site-dir] [--company-name]
---

在 **monorepo 根目录**执行。

## 入口

- **Slash**：`/financial-minesweeper`
- **CLI**：`pnpm run financial-minesweeper:run -- …`

## 与 workflow / business-analysis 的边界

- **TS 主链**：仅拉取 Feed 结构化财报与经营质量趋势，执行确定性规则与加权得分；**不**调用模型厂商叙事 API。
- **发布**：对本次 run 执行 `pnpm run reports-site:emit -- --run-dir <run 根目录>`，再 `pnpm run sync:reports-to-app`；站点专题类型为 **`financial-minesweeper`**。
- **不覆盖**：六维终稿仍走 **`/business-analysis` + `business-analysis-finalize`**；龟龟/估值/穿透仍走 **`/workflow-analysis`** 与各自 finalized 规则。

## Slash → CLI

```bash
pnpm run financial-minesweeper:run -- \
  --code <必填> \
  --year <必填，如 2024> \
  [--company-name "公司简称"] \
  [--output-dir "./output/financial-minesweeper/<code>"] \
  [--reports-site-dir "output/site/reports"]
```

需要环境变量 **`FEED_BASE_URL`**（与 workflow 相同）。可选 **`FEED_API_KEY`**。

## 产物

- `financial_minesweeper_manifest.json`
- `financial_minesweeper_report.md`（站点正文来源）
- `financial_minesweeper_analysis.json`（规则明细）
- `financial_minesweeper_raw.json`（调试摘要，非发布依赖）

## 发布后

```bash
pnpm run reports-site:emit -- --run-dir "./output/financial-minesweeper/<code>/<runId>"
pnpm run sync:reports-to-app
```

契约：[docs/guides/entrypoint-narrative-contract.md](../../docs/guides/entrypoint-narrative-contract.md) · [reports-site-publish.md](../../docs/guides/reports-site-publish.md) · [workflows.md](../../docs/guides/workflows.md)
