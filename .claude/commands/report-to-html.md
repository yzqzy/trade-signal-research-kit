---
description: （已移除）原 Markdown→HTML CLI；请使用研报站 Markdown 协议
argument-hint: —
---

**本命令对应的 `report-to-html:run` 已从仓库移除。**

- Phase3 / workflow 主产物为 **`analysis_report.md`**（不再写 `analysis_report.html`）。
- 研报中心详情正文为 **`entries/<entryId>/content.md`**（协议 v2），见 `docs/guides/reports-site-publish.md`。
- 聚合发布：`pnpm run reports-site:emit -- --run-dir <run>` → `pnpm run sync:reports-to-app`。
