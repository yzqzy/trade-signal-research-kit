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

  if (reasons.some((r) => r.includes("显式标记为阻断") || r.includes("CRITICAL"))) {
    return { status: "blocked", blockingReasons: Array.from(new Set(reasons)) };
  }
  if (reasons.length > 0) return { status: "draft", blockingReasons: Array.from(new Set(reasons)) };
  return { status: "complete", blockingReasons: [] };
}
