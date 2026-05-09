import type { ReportPolishComposeBuffers, ReportViewModelV1, BusinessModelVerdictV1 } from "./report-view-model.js";
import { buildBusinessQualityFacts, netProfitYoYPercent, revenueYoYPercent, type BusinessQualityFacts } from "./business-quality-facts.js";
import { classifyBusinessModel, type BusinessModelVerdict } from "./business-model-classifier.js";

function fmtNum(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const digits = abs >= 100 ? 2 : abs >= 10 ? 2 : 4;
  return n.toLocaleString("zh-CN", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

function fmtPct(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return `${fmtNum(n)}%`;
}

function vmVerdictToClassifier(v: BusinessModelVerdictV1): BusinessModelVerdict {
  return {
    l1Key: v.l1Key as BusinessModelVerdict["l1Key"],
    l1Label: v.l1Label,
    secondary: v.secondary,
    l2Mechanism: v.l2Mechanism,
    l3Constraint: v.l3Constraint,
    damodaran: v.damodaran,
    greenwaldAxes: v.greenwaldAxes,
    buffettHooks: v.buffettHooks,
    evidenceBullets: v.evidenceBullets,
  };
}

function resolveVerdict(vm: ReportViewModelV1, facts: BusinessQualityFacts): BusinessModelVerdict {
  if (vm.businessModel) return vmVerdictToClassifier(vm.businessModel);
  return classifyBusinessModel(facts);
}

function peerRowsFromVm(vm: ReportViewModelV1) {
  return (vm.phase1a.peerComparablePool?.peers ?? []).map((p) => ({
    code: p.code,
    name: p.name,
    revenueAllYear: p.revenueAllYear,
    parentNiAllYear: p.parentNiAllYear,
  }));
}

/** 维度一：商业模式与资本特征（数据化 D1，含真实数字与阈值表） */
export function renderBusinessQualityD1Section(vm: ReportViewModelV1, buffers: ReportPolishComposeBuffers): string {
  const facts = buildBusinessQualityFacts(buffers.marketPackMarkdown, peerRowsFromVm(vm));
  const v = resolveVerdict(vm, facts);
  const industry =
    vm.phase1a.industryProfile?.industryName ??
    vm.phase1a.peerComparablePool?.industryName ??
    vm.market.name ??
    "—";
  const y0 = facts.byYear[0];
  const y1 = facts.byYear[1];
  const revYoy = revenueYoYPercent(facts);
  const niYoy = netProfitYoYPercent(facts);

  const revenueRows = facts.byYear.slice(0, 5).map((row, idx) => {
    const older = facts.byYear[idx + 1];
    const yoy =
      older && row.revenue !== undefined && older.revenue !== undefined && Math.abs(older.revenue) > 0
        ? (((row.revenue ?? 0) - older.revenue) / Math.abs(older.revenue)) * 100
        : undefined;
    return `| ${row.year} | ${fmtNum(row.revenue)} | ${yoy !== undefined ? fmtPct(yoy) : "—"} |`;
  });

  const profitRows = facts.byYear.slice(0, 5).map((row, idx) => {
    const older = facts.byYear[idx + 1];
    const yoyNi =
      older &&
      row.netProfit !== undefined &&
      older.netProfit !== undefined &&
      Math.abs(older.netProfit) > 0
        ? (((row.netProfit ?? 0) - older.netProfit) / Math.abs(older.netProfit)) * 100
        : undefined;
    const fee =
      row.salesExpenseRatioPct !== undefined || row.adminExpenseRatioPct !== undefined
        ? (row.salesExpenseRatioPct ?? 0) + (row.adminExpenseRatioPct ?? 0) + (row.rdExpenseRatioPct ?? 0)
        : undefined;
    return `| ${row.year} | ${row.grossMarginPct !== undefined ? fmtPct(row.grossMarginPct) : "—"} | ${fmtNum(row.netProfit)} | ${yoyNi !== undefined ? fmtPct(yoyNi) : "—"} | ${fee !== undefined ? fmtPct(fee) : "—"} |`;
  });

  const capexRows = facts.byYear.slice(0, 5).map((row) => {
    const ratio =
      row.capex !== undefined && row.netProfit !== undefined && Math.abs(row.netProfit) > 0
        ? Math.abs(row.capex) / (Math.abs(row.netProfit) * 0.15 + 1)
        : undefined;
    return `| ${row.year} | ${fmtNum(row.capex)} | ${fmtNum(row.ocf)} | ${row.leveragePct !== undefined ? fmtPct(row.leveragePct) : "—"} | ${ratio !== undefined ? fmtNum(ratio) : "—"} |`;
  });

  const cashRows = facts.byYear.slice(0, 5).map((row) => {
    const ocfNi =
      row.ocfToNetProfit !== undefined
        ? row.ocfToNetProfit
        : row.ocf !== undefined && row.netProfit !== undefined && row.netProfit !== 0
          ? row.ocf / row.netProfit
          : undefined;
    return `| ${row.year} | ${fmtNum(row.ocf)} | ${fmtNum(row.netProfit)} | ${ocfNi !== undefined ? fmtNum(ocfNi) : "—"} | ${fmtNum(row.accountsReceivable)} | ${fmtNum(row.inventory)} |`;
  });

  const peerSelfRev = y0?.revenue;
  const peerLines = facts.peerRows.slice(0, 6).map((p) => {
    const peerRevMillion = p.revenueAllYear !== undefined ? p.revenueAllYear / 1e6 : undefined;
    const peerNiMillion = p.parentNiAllYear !== undefined ? p.parentNiAllYear / 1e6 : undefined;
    const gap =
      peerSelfRev !== undefined && peerRevMillion !== undefined && peerRevMillion !== 0
        ? ((peerSelfRev - peerRevMillion) / Math.abs(peerRevMillion)) * 100
        : undefined;
    return `| ${p.code} | ${p.name ?? "—"} | ${fmtNum(peerRevMillion)} | ${fmtNum(peerNiMillion)} | ${gap !== undefined ? fmtPct(gap) : "—"} |`;
  });

  const ocfNiLatest =
    y0?.ocfToNetProfit ??
    (y0?.ocf !== undefined && y0?.netProfit !== undefined && y0.netProfit !== 0 ? y0.ocf / y0.netProfit : undefined);

  const monitor = [
    "| 指标 | 当前读数 | 触发阈值（示例） | 含义 |",
    "|:-----|:---------|:-----------------|:-----|",
    `| 营收同比 | ${revYoy !== undefined ? fmtPct(revYoy) : "—"} | 连续 2 年 < -5% | 增长动能转弱 | [M:§3]`,
    `| 归母净利润同比 | ${niYoy !== undefined ? fmtPct(niYoy) : "—"} | 与营收增速背离 >15pct | 利润质量可疑 | [M:§3]`,
    `| OCF/净利润 | ${ocfNiLatest !== undefined ? `${fmtNum(ocfNiLatest)}×` : "—"} | < 1.0× 持续 | 现金利润脱节 | [M:§5][M:§19]`,
    `| 资产负债率 | ${y0?.leveragePct !== undefined ? fmtPct(y0.leveragePct) : "—"} | > 65% | 杠杆压力 | [M:§4][M:§17]`,
    `| 毛利率 | ${y0?.grossMarginPct !== undefined ? fmtPct(y0.grossMarginPct) : "—"} | 连续两年下滑 >2pct | 竞争或结构恶化 | [M:§18]`,
  ];

  const segLines =
    facts.segmentRows.length > 0
      ? facts.segmentRows
          .slice(0, 4)
          .map((s) => `- **${s.category} · ${s.label}**：${s.summary} [M:§20]`)
      : ["> 本次市场包未形成可直接引用的主营结构摘要；收入结构需结合年报分部表与主营业务披露交叉复核。[E4]"];

  return [
    "## 维度一：商业模式与资本特征",
    "",
    "### 商业模式判定（投资框架）",
    "",
    `- **L1（主模型）**：${v.l1Label}（\`${v.l1Key}\`）；**Damodaran 生命周期**：${v.damodaran}。`,
    `- **L2（赚钱机制）**：${v.l2Mechanism}`,
    `- **L3（当前约束）**：${v.l3Constraint}`,
    "",
    "**Greenwald 三轴观察**：",
    ...v.greenwaldAxes.map((x) => `- ${x}`),
    "",
    "**Buffett / Munger 资本观**：",
    ...v.buffettHooks.map((x) => `- ${x}`),
    "",
    "**数据锚点（来自市场包）**：",
    ...v.evidenceBullets.map((x) => `- ${x} [M:§3~§5][M:§17]`),
    "",
    `> 行业标签（Phase1A）：**${industry}**；若与直觉不符，以申万/画像来源为准。[E1][M:§9]`,
    "",
    "### 主营与分部线索（§20）",
    "",
    ...segLines,
    "",
    "### 收入质量分解（多年）",
    "",
    "| 年度 | 营业收入（百万元） | 营收同比 |",
    "| --- | ---: | ---: |",
    ...(revenueRows.length ? revenueRows : ["| — | 数据缺口 | — |"]),
    "",
    "### 利润质量分解（多年）",
    "",
    "| 年度 | 毛利率 | 归母净利润（百万元） | 归母净利同比 | 期间费用率合计（销售+管理+研发，约） |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...(profitRows.length ? profitRows : ["| — | — | — | — | — |"]),
    "",
    "### 资本消耗与杠杆（多年）",
    "",
    "| 年度 | Capex | OCF | 资产负债率 | Capex/(0.15×归母净利) 近似 |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...(capexRows.length ? capexRows : ["| — | — | — | — | — |"]),
    "",
    "### 现金转换与营运资本（多年）",
    "",
    "| 年度 | OCF | 归母净利润 | OCF/净利润 | 应收账款 | 存货 |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    ...(cashRows.length ? cashRows : ["| — | — | — | — | — |"]),
    "",
    "### 同业规模对照（Phase1A 可比池，单位：百万元）",
    "",
    "| 代码 | 名称 | 营收（百万元） | 归母净利（百万元） | 本公司 vs 同行营收差（%） |",
    "| --- | --- | ---: | ---: | ---: |",
    ...(peerLines.length ? peerLines : ["| — | 可比池未形成结构化结果 | — | — | — |"]),
    "",
    "### 监控阈值（可执行）",
    "",
    ...monitor,
    "",
  ].join("\n");
}
