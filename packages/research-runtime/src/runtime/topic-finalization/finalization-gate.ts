import type { ReportTopicType } from "../../reports-site/types.js";

export type TopicFinalizationStatus = "complete" | "draft";

export type TopicFinalizationGateResult = {
  status: TopicFinalizationStatus;
  blockingReasons: string[];
};

function hasAny(markdown: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(markdown));
}

function countParagraphLikeLines(markdown: string): number {
  return markdown
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length >= 18 && !line.startsWith("|") && !line.startsWith("#")).length;
}

function commonBlockingReasons(markdown: string): string[] {
  const reasons: string[] = [];
  const forbidden: Array<[string, RegExp]> = [
    ["裸露流程词：Phase1B", /\bPhase1B\b/u],
    ["裸露流程词：gateVerdict", /gateVerdict/u],
    ["结构化草稿提示", /结构化预览|draftMarkdown|finalMarkdown|待收口|待重新审计/u],
    ["模板化证据链条", /市场包提供行业和同业上下文，年报包提供经营与财务原始披露/u],
    ["模板化跟踪描述", /当前仅按证据包建立方向性跟踪|验证本维判断是否持续/u],
    ["裸露工程枚举", /(?:周期位置|置信度|行业周期属性)(?:为|\s+)(?:middle|top|bottom|medium|high|low|weak|strong|unknown)\b/iu],
  ];
  for (const [label, re] of forbidden) {
    if (re.test(markdown)) reasons.push(`命中终稿叙事禁区：${label}`);
  }
  if (countParagraphLikeLines(markdown) < 6) {
    reasons.push("自然语言分析段落不足：终稿不能只有标题、表格或短句");
  }
  return reasons;
}

function topicSpecificBlockingReasons(topic: ReportTopicType, markdown: string): string[] {
  const reasons: string[] = [];
  const rules: Record<ReportTopicType, Array<[string, RegExp[]]>> = {
    "turtle-strategy": [
      ["缺少投资结论", [/投资结论|核心结论|Verdict|结论摘要/u]],
      ["缺少触发条件", [/触发|买入条件|观察条件|进入条件/u]],
      ["缺少反证或失败条件", [/反证|失败情景|风险|何时错/u]],
      ["缺少仓位或纪律", [/仓位|纪律|止损|跟踪纪律/u]],
      ["缺少关键指标解释", [/穿透|R\b|ROE|FCF|安全边际|估值/u]],
    ],
    valuation: [
      ["缺少估值结论", [/估值结论|Valuation Verdict|合理价值|目标价/u]],
      ["缺少方法权重解释", [/方法权重|权重|DCF|DDM|PE Band|估值方法/u]],
      ["缺少敏感性含义", [/敏感性|上行情景|下行情景|情景/u]],
      ["缺少分歧原因", [/分歧|一致性|CV|估值差异|方法差异/u]],
      ["缺少反向估值含义", [/反向估值|隐含预期|当前价格隐含/u]],
    ],
    "penetration-return": [
      ["缺少穿透 R 解释", [/穿透\s*R|穿透回报|R\s*的/u]],
      ["缺少 Owner Earnings 质量判断", [/Owner Earnings|所有者收益|股东盈余|现金利润/u]],
      ["缺少 rf/II/安全边际解释", [/rf|无风险|II|安全边际|门槛/u]],
      ["缺少失败情景", [/失败情景|反证|风险|何时错/u]],
    ],
    "business-quality": [
      ["缺少商业质量 verdict", [/verdict|Verdict|商业质量.*(?:较强|偏弱|观察|优秀|一般)|质量判断/u]],
      ["缺少 Quality Snapshot", [/Quality Snapshot|质量快照/u]],
      ["缺少核心发现", [/核心发现|关键发现/u]],
      ["缺少 D1-D6 实质章节", [/D1|维度一/u, /D6|维度六/u]],
    ],
  };
  for (const [label, patterns] of rules[topic]) {
    if (!hasAny(markdown, patterns)) reasons.push(label);
  }
  return reasons;
}

export function validateTopicFinalMarkdown(topic: ReportTopicType, markdown: string): TopicFinalizationGateResult {
  const body = markdown.trim();
  const blockingReasons = [
    ...commonBlockingReasons(body),
    ...topicSpecificBlockingReasons(topic, body),
  ];
  return {
    status: blockingReasons.length === 0 ? "complete" : "draft",
    blockingReasons: Array.from(new Set(blockingReasons)),
  };
}
