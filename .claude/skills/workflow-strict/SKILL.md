---
name: workflow-strict
description: "`workflow:run --mode turtle-strict` 严格编排：全流程，关键输入与 data_pack_report 缺失时 fail-fast；与 Slash `/workflow-analysis` 语义对齐。"
---

# workflow-strict 执行规范

## 目标

- 与仓库根 **`/workflow-analysis`**（等价 `pnpm run workflow:run -- --mode turtle-strict ...`）一致：**PDF 链 + 报告包 + Pre-flight + Phase3**。
- **策略可切换**：Stage E 由 `--strategy turtle|value_v1` 决定；入口名不含策略名。

## 顺序与检查

1. **initPrep**：无 `--pdf`/`--report-url` 时按 Feed 自动发现（`turtle-strict` 下失败即抛错）。
2. 在 **`turtle-strict`** 下：
   - Phase1A 后跑 **Pre-flight**（`[strict:preflight]`）。
   - 缺 `data_pack_report.md` 时 **fail-fast**（`[strict:workflow:strict]`）。

## 关键差异（`standard` vs `turtle-strict`）

| 项 | standard | turtle-strict |
|----|----------|---------------|
| 自动发现年报 | 否（除非显式 URL / 其他入口） | 是（无 PDF/URL 时） |
| Phase1A Pre-flight 默认 | off | strict |
| 缺 `data_pack_report` 进 Phase3 | 可能继续 | 禁止 |

## 入口映射

- **Claude Code**：`/workflow-analysis`（语义为 `workflow:run --mode turtle-strict`）
- **CLI**：`pnpm run workflow:run -- --mode turtle-strict ...`

## 产物速查

- `analysis_report.md` / `analysis_report.html`
- `valuation_computed.json`
- `workflow_manifest.json`

## 质量门禁（可选）

- `pnpm run test:linkage`
- `pnpm run quality:all`
