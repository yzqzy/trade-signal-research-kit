import type { FinancialQualityTrend, FinancialSnapshot } from "@trade-signal/schema-core";

import type { MinesweeperEvaluation, MinesweeperRuleContext, RuleResultRow } from "./minesweeper-types.js";

const WARN_W: Record<number, number> = { 0: 0, 1: 2, 2: 3, 3: 2, 4: 3, 5: 1, 6: 1 };
const FAIL_W: Record<number, number> = { 0: 0, 1: 5, 2: 6, 3: 5, 4: 7, 5: 3, 6: 3 };

function yoyPct(cur?: number, prev?: number): number | undefined {
  if (cur === undefined || prev === undefined) return undefined;
  if (prev === 0) return undefined;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function ppDelta(cur?: number, prev?: number): number | undefined {
  if (cur === undefined || prev === undefined) return undefined;
  return cur - prev;
}

function byYearTrends(ctx: MinesweeperRuleContext): Map<string, FinancialQualityTrend> {
  const m = new Map<string, FinancialQualityTrend>();
  for (const t of ctx.trends) {
    if (t.year && /^20\d{2}$/.test(t.year)) m.set(t.year, t);
  }
  return m;
}

function byYearSnaps(ctx: MinesweeperRuleContext): Map<string, FinancialSnapshot> {
  const m = new Map<string, FinancialSnapshot>();
  for (const s of ctx.snapshots) {
    const y = (s.period.match(/^(20\d{2})/)?.[1] ?? s.period.slice(0, 4)).trim();
    if (y) m.set(y, s);
  }
  return m;
}

function pickNum(row: Record<string, unknown> | undefined, keys: string[]): number | undefined {
  if (!row) return undefined;
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function skip(id: string, layer: number, title: string, detail: string): RuleResultRow {
  return { id, layer, title, verdict: "SKIP", detail };
}

function rule01(ctx: MinesweeperRuleContext): RuleResultRow {
  const a = ctx.snapshots[0]?.auditResult?.trim();
  if (!a) return { id: "0.1", layer: 0, title: "审计意见（一票否决）", verdict: "SKIP", detail: "缺少审计意见字段" };
  const ok = /标准无保留|无保留意见/u.test(a) && !/(?!标准)保留意见|无法表示|否定|拒绝/u.test(a);
  if (ok) return { id: "0.1", layer: 0, title: "审计意见（一票否决）", verdict: "PASS", detail: `审计意见：${a}` };
  return { id: "0.1", layer: 0, title: "审计意见（一票否决）", verdict: "FAIL", detail: `审计意见异常：${a}` };
}

function rule11(ctx: MinesweeperRuleContext): RuleResultRow {
  const tmap = byYearTrends(ctx);
  const y0 = String(ctx.anchorYear);
  const y1 = String(ctx.anchorYear - 1);
  const gm0 = tmap.get(y0)?.grossMarginPct;
  const gm1 = tmap.get(y1)?.grossMarginPct;
  if (gm0 === undefined || gm1 === undefined) {
    return { id: "1.1", layer: 1, title: "毛利率异常波动", verdict: "SKIP", detail: "缺少多年毛利率序列" };
  }
  const d = ppDelta(gm0, gm1);
  if (d === undefined) return { id: "1.1", layer: 1, title: "毛利率异常波动", verdict: "SKIP", detail: "无法计算毛利率同比" };
  const abs = Math.abs(d);
  if (abs <= 5) return { id: "1.1", layer: 1, title: "毛利率异常波动", verdict: "PASS", detail: `毛利率同比变动 ${d.toFixed(1)}pp` };
  if (abs <= 10) return { id: "1.1", layer: 1, title: "毛利率异常波动", verdict: "WARN", detail: `毛利率同比变动 ${d.toFixed(1)}pp` };
  return { id: "1.1", layer: 1, title: "毛利率异常波动", verdict: "WARN", detail: `毛利率同比大幅波动 ${d.toFixed(1)}pp（无同业中位数）` };
}

function rule12(ctx: MinesweeperRuleContext): RuleResultRow {
  const tmap = byYearTrends(ctx);
  const y0 = String(ctx.anchorYear);
  const y1 = String(ctx.anchorYear - 1);
  const c = tmap.get(y0);
  const p = tmap.get(y1);
  if (!c || !p) return { id: "1.2", layer: 1, title: "毛利率↑+应收↑+应付↓", verdict: "SKIP", detail: "趋势数据不足两期" };
  const gmUp = (c.grossMarginPct ?? 0) > (p.grossMarginPct ?? 0);
  const arG = yoyPct(c.accountsReceivable, p.accountsReceivable);
  const revG = yoyPct(c.revenue, p.revenue);
  const apG = yoyPct(c.accountsPayable, p.accountsPayable);
  const condB =
    arG !== undefined && revG !== undefined && revG > 0 ? arG > revG : Boolean(arG && revG !== undefined && revG <= 0 && arG > 5);
  const condC = apG !== undefined && apG < 0;
  const n = (gmUp ? 1 : 0) + (condB ? 1 : 0) + (condC ? 1 : 0);
  if (n <= 1) return { id: "1.2", layer: 1, title: "毛利率↑+应收↑+应付↓", verdict: "PASS", detail: `组合命中数=${n}` };
  if (n === 2) return { id: "1.2", layer: 1, title: "毛利率↑+应收↑+应付↓", verdict: "WARN", detail: "三信号命中 2 个" };
  return { id: "1.2", layer: 1, title: "毛利率↑+应收↑+应付↓", verdict: "FAIL", detail: "三信号同时成立" };
}

function rule15(ctx: MinesweeperRuleContext): RuleResultRow {
  const ys = ctx.trends.map((t) => t.year).filter(Boolean) as string[];
  if (ys.length < 3) return { id: "1.5", layer: 1, title: "费用率异常下降", verdict: "SKIP", detail: "不足 3 年费用率序列" };
  const sorted = [...new Set(ys)].sort((a, b) => b.localeCompare(a)).slice(0, 3);
  const tmap = byYearTrends(ctx);
  const cur = tmap.get(sorted[0]!);
  if (!cur) return { id: "1.5", layer: 1, title: "费用率异常下降", verdict: "SKIP", detail: "无最新期趋势" };
  const exp =
    (cur.salesExpenseRatioPct ?? 0) + (cur.adminExpenseRatioPct ?? 0) + (cur.financialExpenseRatioPct ?? 0);
  const prevs = sorted.slice(1).map((y) => tmap.get(y)).filter(Boolean) as FinancialQualityTrend[];
  if (prevs.length < 2) return { id: "1.5", layer: 1, title: "费用率异常下降", verdict: "SKIP", detail: "历史费用率不足" };
  const avgPrev =
    prevs.reduce(
      (s, p) => s + (p.salesExpenseRatioPct ?? 0) + (p.adminExpenseRatioPct ?? 0) + (p.financialExpenseRatioPct ?? 0),
      0,
    ) / prevs.length;
  const drop = avgPrev - exp;
  if (drop <= 3) return { id: "1.5", layer: 1, title: "费用率异常下降", verdict: "PASS", detail: `费用率较近三年均值变化 ${drop.toFixed(1)}pp` };
  if (drop <= 5) return { id: "1.5", layer: 1, title: "费用率异常下降", verdict: "WARN", detail: `费用率下降 ${drop.toFixed(1)}pp` };
  return { id: "1.5", layer: 1, title: "费用率异常下降", verdict: "FAIL", detail: `费用率下降 ${drop.toFixed(1)}pp` };
}

function rule16(ctx: MinesweeperRuleContext): RuleResultRow {
  const tmap = byYearTrends(ctx);
  const y0 = String(ctx.anchorYear);
  const y1 = String(ctx.anchorYear - 1);
  const c = tmap.get(y0);
  const p = tmap.get(y1);
  if (c?.impairmentLoss === undefined && c?.impairmentLoss !== 0) {
    return { id: "1.6", layer: 1, title: "资产/信用减值异常", verdict: "SKIP", detail: "缺少减值损失序列" };
  }
  const imp = Math.abs(c!.impairmentLoss ?? 0);
  const impP = p ? Math.abs(p.impairmentLoss ?? 0) : undefined;
  const ni = Math.abs(c!.netProfit ?? 0);
  const impairYoy = impP !== undefined && impP > 0 ? ((imp - impP) / impP) * 100 : undefined;
  const ratio = ni > 0 ? (imp / ni) * 100 : undefined;
  if (impairYoy !== undefined && impairYoy > 100) {
    return { id: "1.6", layer: 1, title: "资产/信用减值异常", verdict: "FAIL", detail: `减值同比 ${impairYoy.toFixed(0)}%` };
  }
  if ((impairYoy !== undefined && impairYoy > 50) || (ratio !== undefined && ratio > 5)) {
    return { id: "1.6", layer: 1, title: "资产/信用减值异常", verdict: "WARN", detail: `减值同比 ${impairYoy?.toFixed(0) ?? "—"}%` };
  }
  return { id: "1.6", layer: 1, title: "资产/信用减值异常", verdict: "PASS", detail: "减值波动温和" };
}

function rule21(ctx: MinesweeperRuleContext): RuleResultRow {
  const snaps = ctx.snapshots.slice(0, 8);
  let hit = 0;
  for (const s of snaps) {
    const ocf = s.operatingCashFlow;
    const capex = s.capitalExpenditure;
    if (ocf === undefined || capex === undefined) continue;
    if (ocf > 0 && Math.abs(capex) > ocf * 0.8) hit += 1;
  }
  if (snaps.length < 3) return { id: "2.1", layer: 2, title: "经营现金流与投资扩张匹配", verdict: "SKIP", detail: "多年现金流量表数据不足" };
  if (hit <= 1) return { id: "2.1", layer: 2, title: "经营现金流与投资扩张匹配", verdict: "PASS", detail: `强投资扩张年数=${hit}` };
  if (hit <= 3) return { id: "2.1", layer: 2, title: "经营现金流与投资扩张匹配", verdict: "WARN", detail: `强投资扩张年数=${hit}` };
  return { id: "2.1", layer: 2, title: "经营现金流与投资扩张匹配", verdict: "FAIL", detail: `强投资扩张年数=${hit}` };
}

function rule22(ctx: MinesweeperRuleContext): RuleResultRow {
  const snaps = ctx.snapshots.slice(0, 5);
  if (snaps.length < 3) return { id: "2.2", layer: 2, title: "经营现金流为负", verdict: "SKIP", detail: "近五年 OCF 数据不足" };
  const negs = snaps.filter((s) => (s.operatingCashFlow ?? 0) < 0).length;
  let maxRun = 0;
  let run = 0;
  for (const s of [...snaps].reverse()) {
    if ((s.operatingCashFlow ?? 0) < 0) {
      run += 1;
      maxRun = Math.max(maxRun, run);
    } else run = 0;
  }
  if (maxRun >= 3) return { id: "2.2", layer: 2, title: "经营现金流为负", verdict: "FAIL", detail: `连续 ${maxRun} 年为负` };
  if (negs >= 2) return { id: "2.2", layer: 2, title: "经营现金流为负", verdict: "WARN", detail: `${negs} 年为负` };
  return { id: "2.2", layer: 2, title: "经营现金流为负", verdict: "PASS", detail: "OCF 未见持续恶化" };
}

function rule23(ctx: MinesweeperRuleContext): RuleResultRow {
  const s = ctx.snapshots[0];
  if (!s) return { id: "2.3", layer: 2, title: "高现金与高息负债并存", verdict: "SKIP", detail: "无财报快照" };
  const cash = s.cashAndEquivalents;
  const debt = s.interestBearingDebt;
  if (cash === undefined || debt === undefined || debt === 0) {
    return { id: "2.3", layer: 2, title: "高现金与高息负债并存", verdict: "SKIP", detail: "缺少货币资金或有息负债" };
  }
  const highCash = cash > debt * 0.5;
  const veryHighCash = cash > debt;
  if (!highCash) return { id: "2.3", layer: 2, title: "高现金与高息负债并存", verdict: "PASS", detail: `现金/有息负债=${(cash / debt).toFixed(2)}` };
  return {
    id: "2.3",
    layer: 2,
    title: "高现金与高息负债并存",
    verdict: veryHighCash ? "FAIL" : "WARN",
    detail: `货币资金 ${cash.toFixed(0)} 百万 vs 有息负债 ${debt.toFixed(0)} 百万（未接财务费用推算隐含利率）`,
  };
}

function rule31(ctx: MinesweeperRuleContext): RuleResultRow {
  const tmap = byYearTrends(ctx);
  const y0 = String(ctx.anchorYear);
  const y1 = String(ctx.anchorYear - 1);
  const c = tmap.get(y0);
  const p = tmap.get(y1);
  if (!c || !p || c.revenue === undefined || p.revenue === undefined) {
    return { id: "3.1", layer: 3, title: "应收增速相对营收", verdict: "SKIP", detail: "缺少营收或应收序列" };
  }
  const arG = yoyPct(c.accountsReceivable, p.accountsReceivable);
  const revG = yoyPct(c.revenue, p.revenue);
  if (arG === undefined || revG === undefined) return { id: "3.1", layer: 3, title: "应收增速相对营收", verdict: "SKIP", detail: "无法计算增速" };
  if (revG <= 0 && arG > 0) {
    return { id: "3.1", layer: 3, title: "应收增速相对营收", verdict: "WARN", detail: `营收同比 ${revG.toFixed(1)}% 应收同比 ${arG.toFixed(1)}%` };
  }
  if (revG > 0) {
    const ratio = arG / revG;
    if (ratio > 2) return { id: "3.1", layer: 3, title: "应收增速相对营收", verdict: "FAIL", detail: `应收/营收增速比≈${ratio.toFixed(2)}` };
    if (ratio > 1.5) return { id: "3.1", layer: 3, title: "应收增速相对营收", verdict: "WARN", detail: `应收/营收增速比≈${ratio.toFixed(2)}` };
  }
  return { id: "3.1", layer: 3, title: "应收增速相对营收", verdict: "PASS", detail: "应收与营收增速关系正常" };
}

function rule32(ctx: MinesweeperRuleContext): RuleResultRow {
  const tmap = byYearTrends(ctx);
  const y0 = String(ctx.anchorYear);
  const y1 = String(ctx.anchorYear - 1);
  const c = tmap.get(y0);
  const p = tmap.get(y1);
  if (!c || !p || c.inventoryDays === undefined || p.inventoryDays === undefined) {
    return { id: "3.2", layer: 3, title: "存货周转与毛利率组合", verdict: "SKIP", detail: "缺少存货周转天数" };
  }
  const idChange = yoyPct(c.inventoryDays, p.inventoryDays);
  const gmChange = ppDelta(c.grossMarginPct, p.grossMarginPct);
  if (idChange === undefined || gmChange === undefined) return { id: "3.2", layer: 3, title: "存货周转与毛利率组合", verdict: "SKIP", detail: "无法计算同比" };
  if (idChange > 20 && gmChange > 3) {
    return { id: "3.2", layer: 3, title: "存货周转与毛利率组合", verdict: "FAIL", detail: `存货周转天数同比升 ${idChange.toFixed(1)}%，毛利率升 ${gmChange.toFixed(1)}pp` };
  }
  if (idChange > 10 && gmChange > 0) {
    return { id: "3.2", layer: 3, title: "存货周转与毛利率组合", verdict: "WARN", detail: `存货周转天数同比升 ${idChange.toFixed(1)}%，毛利率升 ${gmChange.toFixed(1)}pp` };
  }
  return { id: "3.2", layer: 3, title: "存货周转与毛利率组合", verdict: "PASS", detail: "未触发高风险组合" };
}

function rule41(ctx: MinesweeperRuleContext): RuleResultRow {
  const recent = ctx.trends.slice(0, 5);
  let badYears = 0;
  let maxRun = 0;
  let run = 0;
  for (const t of recent) {
    const r = t.ocfToNetProfit;
    if (r === undefined || t.netProfit === undefined || t.netProfit <= 0) {
      run = 0;
      continue;
    }
    if (r < 1) {
      badYears += 1;
      run += 1;
      maxRun = Math.max(maxRun, run);
    } else run = 0;
  }
  if (recent.length < 3) return { id: "4.1", layer: 4, title: "经营现金流/净利润", verdict: "SKIP", detail: "趋势样本不足" };
  if (maxRun >= 3) return { id: "4.1", layer: 4, title: "经营现金流/净利润", verdict: "FAIL", detail: `连续 ${maxRun} 年 OCF/净利润<1` };
  if (badYears >= 2) return { id: "4.1", layer: 4, title: "经营现金流/净利润", verdict: "WARN", detail: `${badYears} 年 OCF/净利润<1` };
  return { id: "4.1", layer: 4, title: "经营现金流/净利润", verdict: "PASS", detail: "利润现金含量尚可" };
}

function rule43(ctx: MinesweeperRuleContext): RuleResultRow {
  const tmap = byYearTrends(ctx);
  const smap = byYearSnaps(ctx);
  const y0 = String(ctx.anchorYear);
  const y1 = String(ctx.anchorYear - 1);
  const c = tmap.get(y0);
  const p = tmap.get(y1);
  const s0 = smap.get(y0);
  const s1 = smap.get(y1);
  const assetG = yoyPct(s0?.totalAssets, s1?.totalAssets);
  const revG = yoyPct(c?.revenue, p?.revenue);
  const profitG = yoyPct(c?.netProfit, p?.netProfit);
  if (assetG === undefined || revG === undefined) return { id: "4.3", layer: 4, title: "资产增速相对营收", verdict: "SKIP", detail: "缺少总资产或营收" };
  const profitUp = (profitG ?? 0) > 0;
  if (!profitUp) return { id: "4.3", layer: 4, title: "资产增速相对营收", verdict: "PASS", detail: "净利润未增长" };
  if (assetG > revG * 3) return { id: "4.3", layer: 4, title: "资产增速相对营收", verdict: "FAIL", detail: `资产同比 ${assetG.toFixed(1)}% vs 营收 ${revG.toFixed(1)}%` };
  if (assetG > revG * 2) return { id: "4.3", layer: 4, title: "资产增速相对营收", verdict: "WARN", detail: `资产扩张快于营收` };
  return { id: "4.3", layer: 4, title: "资产增速相对营收", verdict: "PASS", detail: "正常" };
}

function rule45(ctx: MinesweeperRuleContext): RuleResultRow {
  const tmap = byYearTrends(ctx);
  const y0 = String(ctx.anchorYear);
  const y1 = String(ctx.anchorYear - 1);
  const c = tmap.get(y0);
  const p = tmap.get(y1);
  if (!c || !p) return { id: "4.5", layer: 4, title: "利润增长与自由现金流", verdict: "SKIP", detail: "趋势不足" };
  const niUp = (c.netProfit ?? 0) > (p.netProfit ?? 0) && (p.netProfit ?? 0) > 0;
  if (!niUp) return { id: "4.5", layer: 4, title: "利润增长与自由现金流", verdict: "PASS", detail: "未出现利润增长组合" };
  if (c.freeCashFlow !== undefined && c.freeCashFlow < 0) {
    return { id: "4.5", layer: 4, title: "利润增长与自由现金流", verdict: "WARN", detail: "净利润增长但 FCF 为负" };
  }
  return { id: "4.5", layer: 4, title: "利润增长与自由现金流", verdict: "PASS", detail: "FCF 未与利润背离" };
}

function rule57(ctx: MinesweeperRuleContext): RuleResultRow {
  const b = ctx.latestBalance;
  if (!b) return skip("5.7", 5, "商誉占净资产比例", "未获取合并资产负债表附表行");
  const gw = pickNum(b, ["goodwill", "GOODWILL", "goodWill"]);
  const eq = pickNum(b, ["totalHldrEqyExcMinInt", "total_hldr_eqy_exc_min_int", "parentNetAssets", "totalEquity"]);
  if (gw === undefined || !eq || eq === 0) return skip("5.7", 5, "商誉占净资产比例", "缺少商誉或净资产字段");
  const ratio = (gw / eq) * 100;
  if (ratio <= 20) return { id: "5.7", layer: 5, title: "商誉占净资产比例", verdict: "PASS", detail: `商誉/净资产=${ratio.toFixed(1)}%` };
  if (ratio <= 40) return { id: "5.7", layer: 5, title: "商誉占净资产比例", verdict: "WARN", detail: `商誉/净资产=${ratio.toFixed(1)}%` };
  return { id: "5.7", layer: 5, title: "商誉占净资产比例", verdict: "FAIL", detail: `商誉/净资产=${ratio.toFixed(1)}%` };
}

function rule58(ctx: MinesweeperRuleContext): RuleResultRow {
  const b = ctx.latestBalance;
  if (!b) return skip("5.8", 5, "其他应收款异常", "未获取合并资产负债表附表行");
  const oth = pickNum(b, ["othReceiv", "oth_receiv", "otherReceivables", "OTHER_RECEIV"]);
  const ta = pickNum(b, ["totalAssets", "TOTAL_ASSETS", "tot_assets"]);
  if (oth === undefined || ta === undefined || ta === 0) return skip("5.8", 5, "其他应收款异常", "缺少其他应收或总资产");
  const ratio = (oth / ta) * 100;
  if (ratio <= 3) return { id: "5.8", layer: 5, title: "其他应收款异常", verdict: "PASS", detail: `其他应收/总资产=${ratio.toFixed(2)}%` };
  if (ratio <= 5) return { id: "5.8", layer: 5, title: "其他应收款异常", verdict: "WARN", detail: `其他应收/总资产=${ratio.toFixed(2)}%` };
  return { id: "5.8", layer: 5, title: "其他应收款异常", verdict: "FAIL", detail: `其他应收/总资产=${ratio.toFixed(2)}%` };
}

function rule59(ctx: MinesweeperRuleContext): RuleResultRow {
  const ev = ctx.governanceEvents;
  if (!ev.length) return { id: "5.9", layer: 5, title: "监管处罚与立案线索", verdict: "PASS", detail: "治理事件接口无命中或未启用" };
  const high = ev.filter((e) => e.severity === "high" || /立案|调查/u.test(e.summary));
  const med = ev.filter((e) => e.severity === "medium" || /处罚|警示/u.test(e.summary));
  if (high.length) return { id: "5.9", layer: 5, title: "监管处罚与立案线索", verdict: "FAIL", detail: high.map((e) => e.summary).join("；") };
  if (med.length) return { id: "5.9", layer: 5, title: "监管处罚与立案线索", verdict: "WARN", detail: med.map((e) => e.summary).join("；") };
  return { id: "5.9", layer: 5, title: "监管处罚与立案线索", verdict: "PASS", detail: "低敏记录" };
}

function rule61(ctx: MinesweeperRuleContext): RuleResultRow {
  const ind = (ctx.industry ?? "").trim();
  if (!ind) return { id: "6.1", layer: 6, title: "行业特有风险（农林牧渔等）", verdict: "SKIP", detail: "缺少行业名称" };
  if (/农|林|渔|牧|养殖|种植|饲料|水产/u.test(ind)) {
    return { id: "6.1", layer: 6, title: "行业特有风险（农林牧渔等）", verdict: "WARN", detail: `行业「${ind}」为敏感行业` };
  }
  return { id: "6.1", layer: 6, title: "行业特有风险（农林牧渔等）", verdict: "PASS", detail: `行业：${ind}` };
}

export function evaluateMinesweeperRules(ctx: MinesweeperRuleContext): MinesweeperEvaluation {
  const rows: RuleResultRow[] = [
    rule01(ctx),
    {
      id: "0.2",
      layer: 0,
      title: "年报按时披露",
      verdict: "SKIP",
      detail: "Feed 未提供 ann_date 口径，无法自动核对披露截止日",
    },
    rule11(ctx),
    rule12(ctx),
    skip("1.3", 1, "运费与收入匹配（附注）", "依赖年报附注"),
    skip("1.4", 1, "其他业务收入占比突增", "需利润表其他收益分项"),
    rule15(ctx),
    rule16(ctx),
    rule21(ctx),
    rule22(ctx),
    rule23(ctx),
    rule31(ctx),
    rule32(ctx),
    skip("3.3", 3, "在建工程转固节奏", "需多年在建工程与固定资产明细"),
    skip("3.4", 3, "长期待摊费用", "需资产负债表科目明细"),
    skip("3.5", 3, "坏账计提与同业", "需附注坏账政策与同业对比"),
    rule41(ctx),
    skip("4.2", 4, "销售收现比", "需现金流量表销售收现字段"),
    rule43(ctx),
    skip("4.4", 4, "核心利润与净利润背离", "需完整利润表构造 core profit"),
    rule45(ctx),
    skip("5.1", 5, "更换审计机构", "需多年审计师字段"),
    skip("5.2", 5, "大股东减持", "需股东持股序列"),
    skip("5.3", 5, "财务总监更换", "依赖 PDF"),
    skip("5.4", 5, "独董辞职", "依赖 PDF"),
    skip("5.5", 5, "客户供应商集中度", "依赖 PDF"),
    skip("5.6", 5, "跨行业收购", "依赖 PDF"),
    rule57(ctx),
    rule58(ctx),
    rule59(ctx),
    rule61(ctx),
    skip("6.2", 6, "研发资本化比例", "依赖 PDF 附注"),
  ];

  const layer0Fail = rows.some((r) => r.layer === 0 && r.verdict === "FAIL");
  let total = 0;
  for (const r of rows) {
    if (r.verdict === "WARN") total += WARN_W[r.layer] ?? 1;
    if (r.verdict === "FAIL") total += FAIL_W[r.layer] ?? 3;
  }
  const failed = new Set(rows.filter((x) => x.verdict === "FAIL").map((x) => x.id));
  let combo = 0;
  if (failed.has("3.2")) combo += 10;
  if (failed.has("2.3") && failed.has("4.1")) combo += 8;
  if (failed.has("1.2") && failed.has("3.1")) combo += 6;
  total += combo;

  let riskBand: MinesweeperEvaluation["riskBand"] = "低";
  if (layer0Fail) riskBand = "直接排除";
  else if (total >= 46) riskBand = "极高";
  else if (total >= 26) riskBand = "高";
  else if (total >= 11) riskBand = "中";
  else riskBand = "低";

  return { rows, totalScore: total, riskBand, layer0Fail, comboBonus: combo };
}
