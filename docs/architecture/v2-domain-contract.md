# 架构 V2：领域对象契约（真源）

[返回文档索引](../README.md) · [流程拓扑](./v2-flow-topology.md) · [插件模型](./v2-plugin-model.md)

本文冻结 **V2 五对象** 与 **依赖方向**，供实现与文档统一引用。与旧 Phase 命名对照见 [workflows.md](../guides/workflows.md)。

## 五对象定义

| 对象 | 职责 | 典型产物形态 |
|------|------|----------------|
| **RawDataPack** | 原始证据与结构化输入（Feed、PDF 抽取、外部检索等） | 文件/JSON/Markdown 缓冲 |
| **FeatureSet** | 按需计算的特征与公共指标（可缓存、可版本化） | `featureId` → 数值/向量 + `sourceRefs` |
| **PolicyResult** | 策略插件对单标的的决策输出（打分/通过/理由） | `policyId` + `reasonRefs` + 结构化字段 |
| **TopicReport** | 可发布专题页（解释与展示，含证据锚点） | Markdown + 元数据 + `evidenceRefs` |
| **SelectionResult** | 多标的筛选与排序（候选池、排名、组合约束） | 候选列表 + 分数 + 可选下钻配置 |

## 依赖强约束（必须遵守）

1. **TopicReport** 不得重算策略公式、不得从 RawDataPack 直接推导结论；只能消费 **FeatureSet** 与 **PolicyResult**（及显式声明的其它 Topic 摘要）。
2. **SelectionResult** 不得直接消费 RawDataPack；必须经过 **FeatureSet → PolicyResult**。
3. **PolicyResult** 不得依赖 **TopicReport** 的渲染结果（单向：Policy → Topic）。
4. **发布层（Publisher）** 只消费 **TopicReport** 与发布清单；不得把 Policy/Selection 内部对象原样暴露为站点终稿。

## 市场与策略（非 Topic）

- **Universe（市场/股票池）**：如 `CN_A`、`HK`；决定数据源与池边界，**不是** Topic。
- **Policy（策略）**：如 `policy:turtle`；是决策内核，**不是**专题页本身。

## 六维与商业报告

- **商业六维专题**：`topic:business-six-dimension`（六维叙事作为**站点专题**之一）。
- 不再将「六维完成态」绑定到独立 `qualitative_*.md` 文件作为**唯一**对外终态；若过渡期仍生成此类文件，须在 manifest 中标注为 **非发布终态**（见 [v2-plugin-model](./v2-plugin-model.md)）。

## 最小运行状态（Run State）

统一使用以下状态位（布尔或阶段枚举均可，但语义必须一致）：

| 状态 | 含义 |
|------|------|
| `feature_ready` | 本次 run 所需特征已计算或可复用 |
| `policy_ready` | 已执行策略插件并得到 PolicyResult |
| `selection_ready` | 若本 profile 启用选股，则候选池已产出（未启用可跳过） |
| `topic_ready` | 已生成计划内全部 TopicReport |
| `publish_ready` | 已写入站点或等价发布产物 |

禁止使用未定义的口语（如「报告好了」）替代上述状态。

## Run Profile（最小集）

| Profile | 说明 |
|---------|------|
| `stock_full` | 个股：全量专题渲染 + 发布 |
| `selection_fast` | 批量：策略筛选 + SelectionResult；可选对 TopN 触发专题下钻 |
| `publish_only` | 仅消费已有 TopicReport / manifest 做发布 |

每次 run 必须在元数据中记录 `runProfile`，避免「本次到底跑了什么」歧义。

## 证据追踪（对象级字段）

| 对象 | 字段 | 要求 |
|------|------|------|
| FeatureSet | `sourceRefs` | 每个特征值可追溯到 RawDataPack 中的路径或片段 |
| PolicyResult | `reasonRefs` | 每条关键结论可追溯到 Feature 或 sourceRefs |
| TopicReport | `evidenceRefs` | 正文结论可追溯到证据文件与 PolicyResult 片段 |

缺证据时必须显式标记为 **证据缺口**，禁止静默造数。

## 数据通道（V2 默认）

- **HTTP-only**：主链路数据适配仅使用 HTTP Feed（实现与文档统一收口）。

## 相关文档

- [v2-flow-topology.md](./v2-flow-topology.md)
- [v2-plugin-model.md](./v2-plugin-model.md)
- [strategy-orchestration-architecture.md](./strategy-orchestration-architecture.md)
