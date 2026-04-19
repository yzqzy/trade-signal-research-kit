# 入口与 AI 叙事契约（单一路径）

[返回文档索引](../README.md) · [流程真源](./workflows.md)

本仓库与参考项目（`references/projects/Turtle_investment_framework`）对齐：**确定性证据管线由 TypeScript/CLI 执行；六维定性终稿与叙事收口在 Claude Code（Slash / Skills / 会话内 Agent）完成。**`@trade-signal/research-strategies` **不包含**直连 Anthropic/OpenAI 等模型厂商 HTTP/SDK 的「自动叙事」能力。

## 术语

| 术语 | 含义 |
|------|------|
| **evidence-pack（证据包）** | `data_pack_market.md`、可选 `data_pack_report.md`、`phase1b_qualitative.*` 等可重复、可门禁的产物 |
| **cli-evidence-only** | 仅通过 `pnpm run …` 跑编排时的语义：产出证据与工程合并稿，**不宣称**已完成「AI 六维终稿」 |
| **final-narrative（终稿叙事）** | 基于证据包，由 **Claude** 写回的 `qualitative_report.md`（六维叙事终稿）与已填充的 `qualitative_d1_d6.md`（无「待补全正文」类占位） |

## 入口矩阵

| 入口 | 主要职责 | 是否终稿叙事入口 |
|------|-----------|------------------|
| `/business-analysis` / `business-analysis:run` | PDF 链 + Phase1A/1B/2A/2B，产出证据与定性草稿文件 | **Slash 路径**：默认包含你在会话中执行的 **AI 收口**（见下节）；**纯 CLI**：cli-evidence-only |
| `/workflow-analysis` / `workflow:run` | 全链路至 `analysis_report`、估值、manifest | 全链路终稿以 **Phase3 规则报告**为主；深度六维定性补强仍在 **Claude** 侧（与 [agent-framework-comparison](../strategy/agent-framework-comparison.md) 一致） |
| `/valuation` / `valuation:run` | 估值 JSON/摘要（可选 full report） | **否** |
| `/download-annual-report` / `phase0:download` | 年报 PDF 获取与缓存 | **否** |
| `/report-to-html` / `report-to-html:run` | Markdown → HTML | **否** |

## 推荐执行顺序（与 reference 一致）

### 商业分析（`/business-analysis`）

1. **证据产物**（CLI 或 Slash 触发的同一套编排）：`data_pack_market.md` +（有 PDF 时）`data_pack_report.md` + `phase1b_qualitative.{json,md}` 等。
2. **AI 六维叙事收口（Claude）**：在 Claude Code 会话中，执行 skill `business-analysis-finalize`（文件：`.claude/skills/business-analysis-finalize/SKILL.md`），用证据包与 Phase1B 结构生成终稿叙事，**写回** run 目录下的：
   - `qualitative_report.md`（终稿）
   - `qualitative_d1_d6.md`（填充稿，替换仅表格/骨架占位）
3. 若需全链路或估值，再按 manifest 建议命令衔接 `/workflow-analysis` 或 `/valuation`。

### 全流程（`/workflow-analysis`）

1. 跑 CLI 编排至 manifest 与 `analysis_report` 等产物。
2. 若要对齐 Turtle 六维叙事深度，仍在 Claude 会话中对照证据包与策略 skill 做增补（本仓不在 TS 内调模型完成该步）。

## 输出矩阵（证据包 vs 终稿）

| 文件 | CLI 典型内容 | Claude 收口后期望 |
|------|----------------|-------------------|
| `data_pack_market.md` | 结构化市场证据 | 保持为证据源，一般不覆盖叙事 |
| `data_pack_report.md` | 年报提取证据（若有） | 同上 |
| `qualitative_report.md` | Phase1B 合并与模板段落（**非**终稿叙事承诺） | 六维叙事终稿，**不再**仅为 Phase1B 表格占位 |
| `qualitative_d1_d6.md` | 契约骨架 + 摘录 | 各维正文已填充，无「待补全」类占位 |

## 失败语义

| 场景 | 行为 |
|------|------|
| **Claude 路径**：证据不足或无法负责任写终稿 | **不得**宣称「已完成终稿」；应明确列出缺失证据或需用户补充的输入 |
| **CLI 路径**：编排 fail-fast（strict、preflight 等） | 按既有前缀报错（`[strict:business-analysis]`、`[strict:workflow:strict]` 等），产物可能不完整；**不**将 CLI 成功等同于终稿叙事完成 |

## 000021 验收示例（人工核对）

在任意一次以 `000021` 为标的的 run 目录下（如 `output/business-analysis/000021/<runId>/`）：

1. **保留证据**：存在 `data_pack_market.md`；若 PDF 链成功则存在 `data_pack_report.md`。
2. **终稿形态**（须经过 Claude 收口，非仅 CLI）：打开 `qualitative_report.md`，确认主体为 **六维叙事终稿**，而非大面积 Phase1B 原始表格占位。
3. **D1–D6**：打开 `qualitative_d1_d6.md`，确认各维 **有实质正文**，无大面积「待补全正文」类提示。

> CI 门禁无法代替上述人工终稿验收；门禁负责证据结构与链路回归。

## 相关文档

- [workflows.md](./workflows.md) — Stage/Phase、产物路径、续跑
- [agent-llm-and-env.md](./agent-llm-and-env.md) — Feed 与 Slash 三步法
- 根目录 [README.md](../../README.md) — 首屏入口
