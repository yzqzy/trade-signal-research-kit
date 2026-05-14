import type { MinesweeperEvaluation, RuleResultRow } from "./minesweeper-types.js";

function verdictZh(v: RuleResultRow["verdict"]): string {
  switch (v) {
    case "PASS":
      return "通过";
    case "WARN":
      return "预警";
    case "FAIL":
      return "未通过";
    case "SKIP":
      return "跳过";
    default: {
      const _e: never = v;
      return _e;
    }
  }
}

function tableRows(rows: RuleResultRow[]): string {
  const header = "| 规则 | 层级 | 判定 | 说明 |\n|:--|:--:|:--:|:--|";
  const body = rows
    .map((r) => `| ${r.id} ${r.title} | L${r.layer} | ${verdictZh(r.verdict)} | ${r.detail.replace(/\|/g, "\\|")} |`)
    .join("\n");
  return `${header}\n${body}`;
}

export function renderFinancialMinesweeperMarkdown(input: {
  companyName: string;
  code: string;
  anchorYear: number;
  evaluation: MinesweeperEvaluation;
}): string {
  const { companyName, code, anchorYear, evaluation: ev } = input;
  const scoreLine = `综合得分（加权后含组合加分）为 **${ev.totalScore}** 分，风险档为 **${ev.riskBand}**。`;
  const verdictLine =
    ev.riskBand === "直接排除"
      ? "排雷结论为「直接排除」：审计意见或一票否决项触发，不建议在未澄清前继续下沉研究。"
      : ev.riskBand === "极高" || ev.riskBand === "高"
        ? "排雷结论偏负面：多项现金流与资产负债表交叉验证亮起，建议收缩假设并提高证据要求。"
        : ev.riskBand === "中"
          ? "排雷结论为中性偏观察：存在若干预警信号，尚未形成单一决定性造假链条。"
          : "排雷结论相对温和：在现有可核验数据下未形成显著财务异常组合。";

  return [
    `- confidence: medium`,
    "",
    `# ${companyName}（${code}）· 财报排雷（${anchorYear} 年报锚年）`,
    "",
    "## 排雷结论摘要",
    scoreLine,
    verdictLine,
    "本页基于公开 Feed 的结构化财报与经营质量趋势接口，对常见造假与激进会计组合做规则化扫描；未覆盖附注级细节与全文检索。",
    "",
    "## 综合风险判断与 Verdict",
    `风险档 **${ev.riskBand}** 对应 checklist 权重表与组合加分（本次组合加分 **${ev.comboBonus}** 分）。`,
    "若风险档为「中」及以上，应在估值与商业叙事中同步下调置信度，并优先核对经营现金流、应收与资本开支相关附注。",
    "",
    "## 反证与数据局限",
    "当规则判定为「跳过」时，通常表示当前 HTTP 数据源缺少附注或多年明细字段，不等价于通过审计。",
    "若后续补充年报全文抽取或监管事件数据库命中，应重新运行本流程并覆盖历史结论。",
    "任何单一财务比率都可能受行业周期、并表范围变更或准则调整影响，结论仅作为初筛而非法律责任判断。",
    "",
    "## 关键财务口径说明",
    "经营现金流与净利润比值用于观察利润含金量；应收与营收增速比用于观察收入质量；毛利率与存货周转天数组合用于识别异常「量价背离」。",
    "商誉与其他应收款依赖资产负债表科目，若字段缺失则无法自动评分。",
    "有息负债与货币资金并用用于粗判「存贷双高」线索，未接入财务费用推算隐含融资利率。",
    "",
    "## 后续观察与人工复核",
    "建议将「预警」与「未通过」规则映射到公司最近一次业绩说明会问答、审计师变更说明及主要客户集中度披露。",
    "对敏感行业（农林牧渔、养殖等）应额外关注生物资产与存货监盘相关披露。",
    "",
    "## 分层规则明细",
    tableRows(ev.rows),
    "",
    "## 分析置信度",
    "当前证据包以结构化数值为主，置信度标记为中等：足以支持组合筛查，不足以替代完整年报阅读与现场信息验证。",
  ].join("\n");
}
