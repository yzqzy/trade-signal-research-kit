# 架构 V2：插件模型（Feature / Policy / Topic / Selection）

[返回文档索引](../README.md) · [领域契约](./v2-domain-contract.md) · [流程拓扑](./v2-flow-topology.md)

本文定义 **插件契约形状**（实现可渐进落地），与 [v2-domain-contract](./v2-domain-contract.md) 中的对象一一对应。

## 命名空间

| 类型 | ID 示例 |
|------|---------|
| Feature | `feature:penetration.R` |
| Policy | `policy:turtle`、`policy:value_v1` |
| Topic | `topic:business-six-dimension`、`topic:valuation`、`topic:penetration-return`、`topic:turtle-strategy-explainer`、`topic:financial-minesweeper`、`topic:earnings-alert` |
| Selection | `selection:turtle:cn_a_universe` |

## FeatureContract（特征插件）

- **requiredRaw**：声明依赖的 RawDataPack 子集键。
- **compute(ctx) -> FeatureSlice**：输出数值/向量 + **sourceRefs**（指向原始文件路径、章节或 JSONPath）。
- **version**：特征定义版本，用于缓存失效。

## PolicyContract（策略插件）

- **requiredFeatures**：声明依赖的 `featureId` 列表（按需触发 Feature 计算）。
- **evaluate(ctx) -> PolicyResult**：输出决策、分数、标签等 + **reasonRefs**（指向 Feature 或 sourceRefs）。
- **不得**依赖 Topic 渲染文本。

## TopicContract（专题插件）

- **requiredFeatures**：可选。
- **requiredPolicyOutputs**：声明依赖的 `policyId` 列表（可为空，如纯叙述专题）。
- **render(ctx) -> TopicReport**：输出 Markdown/HTML 元信息 + **evidenceRefs**（文件路径、PolicyResult 片段引用）。
- **不得**在 render 内重新实现策略公式；若需展示公式，引用 PolicyResult 中的结构化字段。

## SelectionContract（选股插件）

- **requiredPolicies**：参与组合的策略 ID 列表。
- **compose(ctx) -> SelectionResult**：投票/加权/阈值过滤/行业约束等。
- **可选**：`drillDownTopicPlan` — 对 TopN 触发哪些 TopicReport。

## 龟龟双角色（防口径漂移）

| 角色 | ID | 产出 |
|------|-----|------|
| 决策 | `policy:turtle` | `PolicyResult` |
| 解读 | `topic:turtle-strategy-explainer` | `TopicReport`（消费同一 PolicyResult） |

## 证据追踪字段（契约级）

- `FeatureSlice.sourceRefs`
- `PolicyResult.reasonRefs`
- `TopicReport.evidenceRefs`

缺证据时必须在 Topic 或 Policy 输出中显式 **TODO/缺口** 标记，规则同 [skill-shared-final-narrative-criteria](../guides/skill-shared-final-narrative-criteria.md) 精神（不静默造数）。

## topic_manifest（发布侧）

Publisher 消费 **`topic_manifest.json`**（`manifestVersion: "1.0"`），由 `reports-site:emit` 在 run 根目录**自动生成/更新**，列出：

- `v2TopicId`（如 `topic:valuation`）
- `siteTopicType`（站点 slug）
- `entryId`、`requiredFieldsStatus`
- `sourceMarkdownRelative`（run 内相对路径）
- 可选 `outputLayout` / `publishedAt` / `runProfile`（支持 **publish_only**：仅 manifest + Markdown 再 emit）

## 相关文档

- [v2-domain-contract.md](./v2-domain-contract.md)
- [v2-flow-topology.md](./v2-flow-topology.md)
- [reports-site-publish.md](../guides/reports-site-publish.md)

## 现状索引（已注册真实插件）

策略注册入口统一在 `packages/research-runtime/src/strategy/definitions.ts`。新增或调整选股策略时，先维护 `StrategyDefinition`（`strategyId / policyId / selectionId / markets / requiredEnrichment / defaultRankingsTopN`），再实现对应 Policy / Selection；`screener` 只负责 universe 获取、缓存、enrichment 与运行入口，不再维护独立策略路由。

- **Policy**
  - `policy:turtle`（薄 adapter，承接 runtime 策略输出）
  - `policy:value_v1`（薄 adapter，承接 runtime 策略输出）
  - `policy:high_dividend`（薄 adapter，承接 `strategy/high-dividend` 输出）
- **Selection**
  - `selection:turtle:cn_a_universe`（消费 `policy:turtle` 的 PolicyResult 排序）
  - `selection:high_dividend:cn_a`（真实组合：过滤 + 排序 + topN）
- **Topic**
  - `topic:business-six-dimension`
  - `topic:valuation`
  - `topic:penetration-return`
  - `topic:turtle-strategy-explainer`
  - `topic:earnings-alert`
