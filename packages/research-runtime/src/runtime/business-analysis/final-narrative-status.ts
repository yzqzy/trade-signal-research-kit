export type FinalNarrativeStatus = "complete" | "blocked" | "draft";

export type FinalNarrativeValidationResult = {
  status: FinalNarrativeStatus;
  blockingReasons: string[];
};

function hasNakedUrlInBody(md: string): boolean {
  const appendixAt = md.search(/^##\s+附录[:：]证据索引/im);
  const body = appendixAt >= 0 ? md.slice(0, appendixAt) : md;
  return /https?:\/\//iu.test(body);
}

/**
 * 检测六维 D1~D6 终稿里是否大面积复用同一句"模板敷衍"。
 * 命中阈值：同一行/同一句出现 ≥3 次，或 D2~D6 五段共享同一段落 ≥3 段。
 *
 * 该检测直接参与 complete 判定：模板稿不能依靠 Publisher 裁切后发布，
 * 必须回到 final-narrative 收口层重写。
 */
export function detectBoilerplateInD1D6(d1d6: string): string[] {
  const reasons: string[] = [];
  const patterns: { re: RegExp; label: string; min?: number }[] = [
    {
      re: /\*\*证据链条\*\*[:：]\s*市场包提供行业和同业上下文，年报包提供经营与财务原始披露/gu,
      label: '"**证据链条**：市场包提供行业和同业上下文..." 模板段',
      min: 3,
    },
    {
      re: /\*\*结论\*\*[:：]\s*[^\n]*?在本维已有可审计证据基础[\s\S]*?应优先调整结论强度。/gu,
      label: '"**结论**：xxx 在本维已有可审计证据基础..." 模板结论句',
      min: 3,
    },
    {
      re: /当前仅按证据包建立方向性跟踪，不扩大为确定预测/gu,
      label: '"当前仅按证据包建立方向性跟踪，不扩大为确定预测" 模板跟踪指标值',
      min: 6,
    },
    {
      re: /验证本维判断是否持续/gu,
      label: '"验证本维判断是否持续" 模板"为何重要"列',
      min: 6,
    },
  ];
  for (const { re, label, min = 3 } of patterns) {
    const hits = (d1d6.match(re) ?? []).length;
    if (hits >= min) {
      reasons.push(`命中模板敷衍：${label}（出现 ${hits} 次，门槛 ${min}）`);
    }
  }
  return reasons;
}

function detectNarrativeForbiddenPatterns(report: string, d1d6: string): string[] {
  const text = `${report}\n\n${d1d6}`;
  const patterns: Array<{ re: RegExp; label: string }> = [
    {
      re: /商业质量终稿基于年报包、市场包和\s*(?:Phase1B\s*)?外部证据完成/u,
      label: "流程说明句：商业质量终稿基于证据包完成",
    },
    {
      re: /不能只看单期利润或榜单排名/u,
      label: "泛化模板句：不能只看单期利润或榜单排名",
    },
    {
      re: /周期位置为\s*(?:middle|top|bottom|unknown)\b/iu,
      label: "裸露工程枚举：周期位置",
    },
    {
      re: /置信度(?:为|\s+)(?:medium|high|low|unknown)\b/iu,
      label: "裸露工程枚举：置信度",
    },
    {
      re: /行业周期属性为\s*(?:weak|strong|unknown)\b/iu,
      label: "裸露工程枚举：行业周期属性",
    },
    {
      re: /当前仅按证据包建立方向性跟踪，不扩大为确定预测/u,
      label: "模板跟踪指标值：当前仅按证据包建立方向性跟踪",
    },
    {
      re: /验证本维判断是否持续/u,
      label: "模板跟踪指标列：验证本维判断是否持续",
    },
    {
      re: /在本维已有可审计证据基础，但仍需后续季报、公告和行业数据复核/u,
      label: "模板结论句：已有可审计证据基础",
    },
  ];
  return patterns.filter(({ re }) => re.test(text)).map(({ label }) => `命中终稿叙事禁区：${label}`);
}

function hasPdfGateDeclaration(md: string, gateVerdict?: string): boolean {
  if (gateVerdict === "DEGRADED") return />\s*PDF\s*抽取质量声明|PDF\s*抽取质量声明/iu.test(md);
  if (gateVerdict === "CRITICAL") return /终稿状态[:：]\s*阻断|PDF.*CRITICAL|抽取.*阻断/iu.test(md);
  return true;
}

export function pickPdfGateVerdict(md: string | undefined): "OK" | "DEGRADED" | "CRITICAL" | undefined {
  const text = md ?? "";
  const m = text.match(/gateVerdict[^`]*`([A-Z_]+)`/u) ?? text.match(/PDF_EXTRACT_QUALITY:\s*\{[\s\S]*?"gateVerdict"\s*:\s*"([A-Z_]+)"/u);
  const v = m?.[1];
  if (v === "OK" || v === "DEGRADED" || v === "CRITICAL") return v;
  return undefined;
}

export function validateFinalNarrativeMarkdown(input: {
  qualitativeReportMarkdown?: string;
  qualitativeD1D6Markdown?: string;
  dataPackReportMarkdown?: string;
}): FinalNarrativeValidationResult {
  const report = input.qualitativeReportMarkdown?.trim() ?? "";
  const d1d6 = input.qualitativeD1D6Markdown?.trim() ?? "";
  const gateVerdict = pickPdfGateVerdict(input.dataPackReportMarkdown);
  const reasons: string[] = [];

  if (!report || !d1d6) {
    reasons.push("缺少 qualitative_report.md 或 qualitative_d1_d6.md");
  }
  if (/\[终稿状态[:：]\s*阻断\]/u.test(report) || /\[终稿状态[:：]\s*阻断\]/u.test(d1d6)) {
    reasons.push("终稿显式标记为阻断");
  }
  if (!/\[终稿状态[:：]\s*完成\]/u.test(report) || !/\[终稿状态[:：]\s*完成\]/u.test(d1d6)) {
    reasons.push("两份终稿未同时标记 [终稿状态: 完成]");
  }
  if (!/^##\s+附录[:：]证据索引/im.test(report) || !/^##\s+附录[:：]证据索引/im.test(d1d6)) {
    reasons.push("缺少 ## 附录：证据索引");
  }
  if (!/^##\s+监管与合规要点/im.test(report)) {
    reasons.push("qualitative_report.md 缺少监管与合规要点");
  }
  for (const dim of ["D1", "D2", "D3", "D4", "D5", "D6"]) {
    const re = new RegExp(`^##\\s+${dim}\\b[\\s\\S]*?(?=^##\\s+D[1-6]\\b|^##\\s+附录|(?![\\s\\S]))`, "imu");
    const section = d1d6.match(re)?.[0] ?? "";
    if (!section) reasons.push(`qualitative_d1_d6.md 缺少 ${dim} 章节`);
    else if (!/\[(?:E\d+|M:§[^ \]]+)\]/u.test(section)) reasons.push(`${dim} 缺少可追溯 [E*] / [M:§x] 引用`);
  }
  if (hasNakedUrlInBody(report) || hasNakedUrlInBody(d1d6)) {
    reasons.push("终稿正文存在裸 URL");
  }
  if (!hasPdfGateDeclaration(report, gateVerdict) || !hasPdfGateDeclaration(d1d6, gateVerdict)) {
    reasons.push(`PDF gate=${gateVerdict ?? "UNKNOWN"} 未按语义声明`);
  }
  if (gateVerdict === "CRITICAL") {
    reasons.push("PDF gate=CRITICAL 不允许完成终稿");
  }
  reasons.push(...detectBoilerplateInD1D6(d1d6));
  reasons.push(...detectNarrativeForbiddenPatterns(report, d1d6));

  if (reasons.some((r) => r.includes("显式标记为阻断") || r.includes("CRITICAL"))) {
    return { status: "blocked", blockingReasons: Array.from(new Set(reasons)) };
  }
  if (reasons.length > 0) return { status: "draft", blockingReasons: Array.from(new Set(reasons)) };
  return { status: "complete", blockingReasons: [] };
}
