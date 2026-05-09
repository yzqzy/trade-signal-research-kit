#!/usr/bin/env node
/**
 * 商业质量 D1 发布门禁烟测（与 plan 3.1/3.3 对齐）。
 */
import assert from "node:assert/strict";
import {
  evaluateBusinessQualityPublishGate,
  evaluateBusinessQualityPublicationHardBlock,
} from "../steps/phase3/report-polish/business-quality-publish-gate.js";

const d1Ok = [
  "## 维度一：商业模式与资本特征",
  "",
  "### 商业模式判定（投资框架）",
  "",
  "L1 示例 2024 年营收 100 亿元，同比 12%，毛利率 35%。",
  "",
  "### 收入质量分解（多年）",
  "",
  "| 年度 | 营业收入 | 同比 |",
  "| 2024 | 100 | 12% |",
  "",
  "### 利润质量分解（多年）",
  "",
  "| 年度 | 毛利率 | 净利 |",
  "| 2024 | 35% | 10 |",
  "",
  "### 资本消耗与杠杆（多年）",
  "",
  "| 年度 | Capex |",
  "| 2024 | 5 |",
  "",
  "### 现金转换与营运资本（多年）",
  "",
  "| 年度 | OCF |",
  "| 2024 | 12 |",
  "",
  "### 监控阈值（可执行）",
  "",
  "| 指标 | 当前 | 触发阈值（示例） |",
  "| a | 1 | < 2% |",
  "| b | 2 | > 3× |",
  "| c | 3 | 连续 2 年 |",
  "",
  "### 趋势结论降级规则（确定性）",
  "",
  "- 当前状态：**base_allowed**。未发现关键数据回退告警，可按四条线输出基础趋势结论。",
  "",
  "## 维度二：竞争优势与护城河",
].join("\n");

function main(): void {
  const g1 = evaluateBusinessQualityPublishGate(d1Ok, { hasBusinessModel: true });
  assert.equal(g1.passed, true, g1.reasons.join("; "));

  const g2 = evaluateBusinessQualityPublishGate(d1Ok, { hasBusinessModel: false });
  assert.equal(g2.passed, false);
  assert.ok(g2.reasons.some((r) => r.includes("businessModel")));

  const marketWarn = ["## §13 Warnings", "", "- [WARN] 外推复制"].join("\n");
  const hardFail = evaluateBusinessQualityPublicationHardBlock(
    d1Ok.replace("趋势结论降级", "其他标题"),
    marketWarn,
    undefined,
  );
  assert.equal(hardFail.blocked, true);

  const hardOk = evaluateBusinessQualityPublicationHardBlock(d1Ok, marketWarn, undefined);
  assert.equal(hardOk.blocked, false);

  const hardPdf = evaluateBusinessQualityPublicationHardBlock(
    d1Ok.replace("未发现关键", "未发现关键；抽取质量 CRITICAL 须降级"),
    "",
    "CRITICAL",
  );
  assert.equal(hardPdf.blocked, false);

  console.log("[test:business-quality-publish-gate] ok");
}

main();
