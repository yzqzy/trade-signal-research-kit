# 龟龟投资策略 · 选股分析报告：华特达因（000915）

## 投资结论

> 核心判断一览；下方「一、Executive Summary」含完整指标表。

```rh-metadata
decision: avoid
decision_source: early_reject_unknown
confidence: medium
confidence_source: early_reject_default
analysis_stage: early_reject
trap_risk: not_evaluated
trap_risk_source: not_evaluated_due_to_early_reject
position: —
```

> **结果：前置筛选结束（非异常）** — 因子2-S4（穿透收益率不足），当前为前置筛选结论。

### 否决摘要（前置筛选结束）

因子3-S11：精算结果与因子1预期背离且无法解释

### Checkpoint 轨迹

Step1: 已完成 data_pack 读取与关键字段校验。

因子1A: 通过

因子1B: 通过

因子2: 通过

因子3: 因子3-S11：精算结果与因子1预期背离且无法解释

### 证据与数据缺口 / 补救建议

- 主因定位：本次前置筛选结束触发于**因子2（穿透收益率不足）**，请优先复核 `R`、`rf`、`II` 与市值口径。
- 核对 [市场与行业证据摘要 · 可展开/下载](#attachment-market-pack)：财务口径（合并/母公司）、OCF/Capex/净利润等关键行是否可解析。
- 若已进入 PDF 分支：查看 [年报证据包 · 可展开/下载](#attachment-annual-report-pack) 顶部 **PDF 抽取缺陷摘要** 与 证据质量预检摘要，见“证据质量与限制” 的 PDF 门禁提示。
- 外部证据：查看 `phase1b_evidence_quality.json`（§8 `topicHitRatio` / `crossItemDuplicateUrlRatio`）与 内部证据包摘要，已转写入正文 的 `retrievalDiagnostics`（宽召回 / AI 重排标记）。
- 解决否决原因后使用同一 `--output-dir` 续跑或重新发起 workflow。

---

*本模板由 `reportMode=reject` 触发；若需完整因子3/4结论，请先修复穿透收益率阈值问题后重跑。*

## 数据缺口与补齐建议

> **Feed-first**：下列项表示当前数据包或工程占位无法满足发布级/深度分析之处；**禁止**用虚构数值静默填平。

| 级别 | 缺口目标 | 影响 | 补齐建议 |
|:---|:---|:---|:---|
| 降级级 | §8 重大事件与公告 | 事件驱动与治理突发风险难以量化进 Phase3/定性叙事。 | 在 feed 增加公告/大事接口并由编排写入 §8；或依赖 外部证据 检索在会话中手工补齐并引用 URL。 `pnpm run workflow:run -- --code <CODE> --mode turtle-strict` |
| 降级级 | §4P 母公司资产负债表 | 表内表外杠杆与母公司偿债路径分析不完整。 | 在 instrument/financialHistory 中补齐 `parentTotalAssets` / `parentTotalLiabilities` 等字段后刷新 [市场与行业证据摘要 · 可展开/下载](#attachment-market-pack)。 |
| 降级级 | financialHistory 多年序列 | 多年表可能由单期复制，趋势与 CAGR 类指标不可靠。 | 在 Phase1A 数据包提供真实 `financialHistory` 多年快照后重新生成市场包。 |
| 提示级 | §14 管理层与治理 | D4 治理维度缺少结构化行情侧输入。 | 会话侧结合年报「公司治理」章与 外部证据 证据撰写；feed 侧可扩展治理字段。 |
| 提示级 | §15 风险提示汇总 | 风险汇总依赖人工整合 §2/§13 与 MD&A。 | 在终稿中汇总；或扩展 feed 风险标签写入 §15。 |
| 提示级 | §7 前十大股东明细 | 股权集中度与筹码结构分析缺少结构化序列。 | 扩展 feed 股东持股接口并接入 `build-market-pack` §7。 |
| 提示级 | 无风险利率 rf | DCF/要求回报率敏感性分析基准可能偏离市场。 | 设置环境变量（见 `build-market-pack` 注释）或在上游数据包提供无风险利率。 |
| 提示级 | 同业竞争格局（结构化可比池） | 发布级「同业对标」段落缺少统一可比公司与指标映射。 | 在 feed 增加「同业可比池 + 指标宽表」契约前，仅在会话中定性描述并保留本缺口提示；禁止编造对标数值。 |
