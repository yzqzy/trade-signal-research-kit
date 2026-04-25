# trade-signal-schema-kit

面向 A 股与港股的 **TypeScript 研究编排框架**：统一字段契约（`schema-core`）+ **HTTP Feed Provider** + 编排（采集、PDF 提取、外部证据、策略评估、估值、发布）。**V2 默认数据通道为 HTTP-only**（主链路语义与门禁以 HTTP 为准）。

> 快速原则：README 负责入口导航；参数细节与流程真源在 `docs/guides/workflows.md`；**对象模型与分层真源**在 `docs/architecture/v2-*.md`。

## 核心边界（先看）

- **`/workflow-analysis`**：产出 Phase3 规则报告 + **report-polish** → 对应 V2 的 **TopicReport** 集合（多页 Markdown + `report_view_model.json`），经 `reports-site:emit` 进入站点。
- **`/business-analysis`**：产出证据包并在 Claude 会话完成 **`topic:business-six-dimension` 终稿写回**（落地文件仍为 `qualitative_report.md` / `qualitative_d1_d6.md`）。
- **选股（Screener）**：V2 中为 **Selection 分支**，与 Topic 并列；候选池可再按需触发专题下钻，**不是** Topic 子分支。
- **`analysis_report.md`**：规则审计产物，不是站点最终排版页。

更多定义见：
- [架构 V2：领域契约](docs/architecture/v2-domain-contract.md) · [流程拓扑](docs/architecture/v2-flow-topology.md) · [插件模型](docs/architecture/v2-plugin-model.md)
- [入口与叙事契约](docs/guides/entrypoint-narrative-contract.md)
- [report-polish 约束](docs/guides/report-polish-narrative-contract.md)

## 简版架构图（与 V2 对齐）

```mermaid
flowchart TD
  raw[RawDataPack] --> feat[FeatureLayer]
  feat --> pol[PolicyLayer]
  feat --> top[TopicLayer]
  pol --> top
  pol --> sel[SelectionLayer]
  top --> pub[Publisher]
  sel --> pub
  pub --> site[SiteOutput]
```

**全流程发布侧**：站点可发布专题集合以 **TopicReport** 为准；**含六维** = 发布集合中包含 `topic:business-six-dimension`（见 [v2-flow-topology](docs/architecture/v2-flow-topology.md)）。

## 入口矩阵

| 目标 | Slash | Root CLI | 关键产物 |
|------|-------|----------|----------|
| 全流程（严格） | `/workflow-analysis` | `pnpm run workflow:run -- --mode turtle-strict ...` | `analysis_report.md`、`valuation_computed.json`、`workflow_manifest.json`、report-polish（TopicReport 形态）四页 + `report_view_model.json` |
| PDF-first 商业分析 | `/business-analysis` | `pnpm run business-analysis:run -- ...` | `data_pack_*`、`business_analysis_manifest.json`、`qualitative_*`（CLI 可为草稿，终稿由 Claude 会话写回） |
| 独立估值 | `/valuation` | `pnpm run valuation:run -- ...` | `valuation_computed.json`、`valuation_summary.md` |
| 年报下载 | `/download-annual-report` | `pnpm run phase0:download -- ...` | 本地 PDF |
| 研报站聚合发布 | — | `pnpm run reports-site:emit -- --run-dir ...` → `pnpm run sync:reports-to-app` | `output/site/reports/**` → `apps/research-hub/public/reports` |

## 三种上手（Claude Code）

```text
/workflow-analysis 600887
/business-analysis 600887
/valuation 600887
```

策略切换示例：

```text
/workflow-analysis 600887 --strategy value_v1
```

## 最小命令集（CLI）

```bash
pnpm install
pnpm run build
pnpm run test:linkage
pnpm run workflow:run -- --code <CODE> --mode turtle-strict [--pdf ...] [--output-dir ...]
pnpm run business-analysis:run -- --code <CODE> [--strict] [--output-dir ...]
pnpm run reports-site:emit -- --run-dir ./output/workflow/<code>/<runId>
pnpm run sync:reports-to-app
```

更多（`typecheck`、`quality:all`、screener、output v2、续跑）统一见 [workflows.md](docs/guides/workflows.md)。

## 数据通道说明（HTTP-only）

- **V2 口径**：主链路以 **HTTP Feed** 为唯一默认数据通道；文档与门禁统一以 HTTP 真源为准。
- 数据通道仅保留 HTTP；新能力与叙事统一以 HTTP 为准（详见 [v2-domain-contract](docs/architecture/v2-domain-contract.md)）。

## 质量门禁

```bash
pnpm run quality:all
pnpm run test:linkage
```

说明：`quality:all` 覆盖 conformance/contract/regression/phase3-golden（`cn_a` + `hk`）。

## 文档导航

- [架构 V2（领域 / 拓扑 / 插件）](docs/architecture/v2-domain-contract.md)
- [流程与 CLI 真源](docs/guides/workflows.md)
- [入口与 AI 叙事契约](docs/guides/entrypoint-narrative-contract.md)
- [数据源与环境变量](docs/guides/data-source.md)
- [研报站发布链路](docs/guides/reports-site-publish.md)
- [文档总索引](docs/README.md)
- [Claude Code 仓库内指引](CLAUDE.md)

## 参考与许可

- 参考工程：[Turtle_investment_framework](https://github.com/terancejiang/Turtle_investment_framework)（本仓库镜像路径：`references/projects/Turtle_investment_framework/`）
- License: MIT
