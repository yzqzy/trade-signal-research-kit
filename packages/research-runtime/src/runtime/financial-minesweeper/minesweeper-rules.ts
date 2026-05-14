import type { FinancialQualityTrend, FinancialSnapshot } from "@trade-signal/schema-core";

import type { MinesweeperEvaluation, MinesweeperRuleContext, RuleResultRow } from "./minesweeper-types.js";

const WARN_W: Record<number, number> = { 0: 0, 1: 2, 2: 3, 3: 2, 4: 3, 5: 1, 6: 1 };
const FAIL_W: Record<number, number> = { 0: 0, 1: 5, 2: 6, 3: 5, 4: 7, 5: 3, 6: 3 };

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function pickNum(row: Record<string, unknown> | undefined, keys: string[]): number | undefined {
  if (!row) return undefined;
  for (const k of keys) {
    const v = asNumber(row[k]);
    if (v !== undefined) return v;
  }
  return undefined;
}

function yoyPct(cur?: number, prev?: number): number | undefined {
  if (cur === undefined || prev === undefined) return undefined;
  if (prev === 0) return undefined;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function ppDelta(cur?: number, prev?: number): number | undefined {
  if (cur === undefined || prev === undefined) return undefined;
  return cur - prev;
}

function yearList(ctx: MinesweeperRuleContext): string[] {
  return Object.keys(ctx.annualMetaByYear).sort((a, b) => b.localeCompare(a));
}

function yearN(ctx: MinesweeperRuleContext, i: number): string | undefined {
  return yearList(ctx)[i];
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

function skip(id: string, layer: number, title: string, detail: string): RuleResultRow {
  return { id, layer, title, verdict: "SKIP", detail };
}

function sectionText(ctx: MinesweeperRuleContext, keys: string[]): string {
  if (ctx.pdfSections) {
    const chunks = keys
      .map((k) => (ctx.pdfSections as unknown as Record<string, { content?: string }>)[k]?.content ?? "")
      .filter(Boolean);
    if (chunks.length) return chunks.join("\n");
  }
  if (ctx.dataPackReportSections) {
    const chunks = keys
      .map((k) => ctx.dataPackReportSections?.[k] ?? "")
      .filter(Boolean);
    if (chunks.length) return chunks.join("\n");
  }
  return ctx.dataPackReportMarkdown ?? "";
}

function countKeyword(text: string, words: string[]): number {
  return words.reduce((sum, w) => sum + (text.match(new RegExp(w, "giu"))?.length ?? 0), 0);
}

function rule01(ctx: MinesweeperRuleContext): RuleResultRow {
  const a = ctx.snapshots[0]?.auditResult?.trim() || ctx.annualMetaByYear[String(ctx.anchorYear)]?.auditResult;
  if (!a) return { id: "0.1", layer: 0, title: "审计意见（一票否决）", verdict: "SKIP", detail: "缺少审计意见字段" };
  const ok = /标准无保留|无保留意见/u.test(a) && !/(?!标准)保留意见|无法表示|否定|拒绝/u.test(a);
  if (ok) return { id: "0.1", layer: 0, title: "审计意见（一票否决）", verdict: "PASS", detail: `审计意见：${a}` };
  return { id: "0.1", layer: 0, title: "审计意见（一票否决）", verdict: "FAIL", detail: `审计意见异常：${a}` };
}

function rule02(ctx: MinesweeperRuleContext): RuleResultRow {
  const y = String(ctx.anchorYear);
  const ann = ctx.annualMetaByYear[y]?.annDate?.replace(/\D/g, "");
  if (!ann || ann.length < 8) return skip("0.2", 0, "年报按时披露", "缺少公告日期 annDate");
  const due = `${ctx.anchorYear + 1}0430`;
  if (ann <= due) return { id: "0.2", layer: 0, title: "年报按时披露", verdict: "PASS", detail: `annDate=${ann}，截止=${due}` };
  return { id: "0.2", layer: 0, title: "年报按时披露", verdict: "FAIL", detail: `annDate=${ann} 晚于截止=${due}` };
}

function rule11(ctx: MinesweeperRuleContext): RuleResultRow {
  const tmap = byYearTrends(ctx);
  const y0 = String(ctx.anchorYear);
  const y1 = String(ctx.anchorYear - 1);
  const gm0 = tmap.get(y0)?.grossMarginPct;
  const gm1 = tmap.get(y1)?.grossMarginPct;
  if (gm0 === undefined || gm1 === undefined) return skip("1.1", 1, "毛利率异常波动", "缺少多年毛利率序列");
  const d = ppDelta(gm0, gm1);
  if (d === undefined) return skip("1.1", 1, "毛利率异常波动", "无法计算毛利率同比");
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
  if (!c || !p) return skip("1.2", 1, "毛利率↑+应收↑+应付↓", "趋势数据不足两期");
  const gmUp = (c.grossMarginPct ?? 0) > (p.grossMarginPct ?? 0);
  const arG = yoyPct(c.accountsReceivable, p.accountsReceivable);
  const revG = yoyPct(c.revenue, p.revenue);
  const apG = yoyPct(c.accountsPayable, p.accountsPayable);
  const condB =
    arG !== undefined && revG !== undefined && revG > 0
      ? arG > revG
      : Boolean(arG && revG !== undefined && revG <= 0 && arG > 5);
  const condC = apG !== undefined && apG < 0;
  const n = (gmUp ? 1 : 0) + (condB ? 1 : 0) + (condC ? 1 : 0);
  if (n <= 1) return { id: "1.2", layer: 1, title: "毛利率↑+应收↑+应付↓", verdict: "PASS", detail: `组合命中数=${n}` };
  if (n === 2) return { id: "1.2", layer: 1, title: "毛利率↑+应收↑+应付↓", verdict: "WARN", detail: "三信号命中 2 个" };
  return { id: "1.2", layer: 1, title: "毛利率↑+应收↑+应付↓", verdict: "FAIL", detail: "三信号同时成立" };
}

function rule13(ctx: MinesweeperRuleContext): RuleResultRow {
  const text = sectionText(ctx, ["OPERATING", "MDA", "BUSINESS"]).toLowerCase();
  if (!text.trim()) return skip("1.3", 1, "运费与收入匹配（附注）", "无 PDF/附注文本");
  const hasFreight = /(运费|运输费|装卸费)/u.test(text);
  if (!hasFreight) return skip("1.3", 1, "运费与收入匹配（附注）", "未识别运费相关文本");
  const freightDown = /(运费|运输费).{0,12}(下降|减少|下滑)/u.test(text);
  const revenueUp = /(营收|收入).{0,12}(增长|上升|提升)/u.test(text);
  const severe = /(运费|运输费).{0,15}(下降|减少).{0,15}(明显|大幅)/u.test(text) && revenueUp;
  if (severe) return { id: "1.3", layer: 1, title: "运费与收入匹配（附注）", verdict: "FAIL", detail: "附注提示运费显著下降而收入增长" };
  if (freightDown && revenueUp) return { id: "1.3", layer: 1, title: "运费与收入匹配（附注）", verdict: "WARN", detail: "附注提示运费下降且收入增长，需复核口径" };
  return { id: "1.3", layer: 1, title: "运费与收入匹配（附注）", verdict: "PASS", detail: "附注未见明显运费-收入背离信号" };
}

function rule14(ctx: MinesweeperRuleContext): RuleResultRow {
  const y0 = String(ctx.anchorYear);
  const y1 = String(ctx.anchorYear - 1);
  const c = ctx.incomeByYear[y0];
  const p = ctx.incomeByYear[y1];
  const curRevenue = pickNum(c, ["revenue", "total_operate_income", "totalOperateIncome"]);
  const prevRevenue = pickNum(p, ["revenue", "total_operate_income", "totalOperateIncome"]);
  const curOther = pickNum(c, ["oth_biz_income", "otherBusinessIncome", "other_operating_income", "othBizIncome"]);
  const prevOther = pickNum(p, ["oth_biz_income", "otherBusinessIncome", "other_operating_income", "othBizIncome"]);
  if (curRevenue === undefined || prevRevenue === undefined || curOther === undefined || prevOther === undefined || curRevenue <= 0 || prevRevenue <= 0) {
    return skip("1.4", 1, "其他业务收入占比突增", "缺少 other business income 或 revenue");
  }
  const ratio = (curOther / curRevenue) * 100;
  const ratioPrev = (prevOther / prevRevenue) * 100;
  const change = ratio - ratioPrev;
  if (ratio > 15 || change > 10) return { id: "1.4", layer: 1, title: "其他业务收入占比突增", verdict: "FAIL", detail: `占比 ${ratio.toFixed(1)}%，同比 +${change.toFixed(1)}pp` };
  if (ratio > 5 && change > 3) return { id: "1.4", layer: 1, title: "其他业务收入占比突增", verdict: "WARN", detail: `占比 ${ratio.toFixed(1)}%，同比 +${change.toFixed(1)}pp` };
  return { id: "1.4", layer: 1, title: "其他业务收入占比突增", verdict: "PASS", detail: `占比 ${ratio.toFixed(1)}%，同比 ${change.toFixed(1)}pp` };
}

function rule15(ctx: MinesweeperRuleContext): RuleResultRow {
  const ys = ctx.trends.map((t) => t.year).filter(Boolean) as string[];
  if (ys.length < 3) return skip("1.5", 1, "费用率异常下降", "不足 3 年费用率序列");
  const sorted = [...new Set(ys)].sort((a, b) => b.localeCompare(a)).slice(0, 3);
  const tmap = byYearTrends(ctx);
  const cur = tmap.get(sorted[0]!);
  if (!cur) return skip("1.5", 1, "费用率异常下降", "无最新期趋势");
  const exp = (cur.salesExpenseRatioPct ?? 0) + (cur.adminExpenseRatioPct ?? 0) + (cur.financialExpenseRatioPct ?? 0);
  const prevs = sorted.slice(1).map((y) => tmap.get(y)).filter(Boolean) as FinancialQualityTrend[];
  if (prevs.length < 2) return skip("1.5", 1, "费用率异常下降", "历史费用率不足");
  const avgPrev =
    prevs.reduce((s, p) => s + (p.salesExpenseRatioPct ?? 0) + (p.adminExpenseRatioPct ?? 0) + (p.financialExpenseRatioPct ?? 0), 0) /
    prevs.length;
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
  if (c?.impairmentLoss === undefined && c?.impairmentLoss !== 0) return skip("1.6", 1, "资产/信用减值异常", "缺少减值损失序列");
  const imp = Math.abs(c!.impairmentLoss ?? 0);
  const impP = p ? Math.abs(p.impairmentLoss ?? 0) : undefined;
  const ni = Math.abs(c!.netProfit ?? 0);
  const impairYoy = impP !== undefined && impP > 0 ? ((imp - impP) / impP) * 100 : undefined;
  const ratio = ni > 0 ? (imp / ni) * 100 : undefined;
  if (impairYoy !== undefined && impairYoy > 100) return { id: "1.6", layer: 1, title: "资产/信用减值异常", verdict: "FAIL", detail: `减值同比 ${impairYoy.toFixed(0)}%` };
  if ((impairYoy !== undefined && impairYoy > 50) || (ratio !== undefined && ratio > 5)) return { id: "1.6", layer: 1, title: "资产/信用减值异常", verdict: "WARN", detail: `减值同比 ${impairYoy?.toFixed(0) ?? "—"}%` };
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
  if (snaps.length < 3) return skip("2.1", 2, "经营现金流与投资扩张匹配", "多年现金流量表数据不足");
  if (hit <= 1) return { id: "2.1", layer: 2, title: "经营现金流与投资扩张匹配", verdict: "PASS", detail: `强投资扩张年数=${hit}` };
  if (hit <= 3) return { id: "2.1", layer: 2, title: "经营现金流与投资扩张匹配", verdict: "WARN", detail: `强投资扩张年数=${hit}` };
  return { id: "2.1", layer: 2, title: "经营现金流与投资扩张匹配", verdict: "FAIL", detail: `强投资扩张年数=${hit}` };
}

function rule22(ctx: MinesweeperRuleContext): RuleResultRow {
  const snaps = ctx.snapshots.slice(0, 5);
  if (snaps.length < 3) return skip("2.2", 2, "经营现金流为负", "近五年 OCF 数据不足");
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
  if (!s) return skip("2.3", 2, "高现金与高息负债并存", "无财报快照");
  const cash = s.cashAndEquivalents;
  const debt = s.interestBearingDebt;
  if (cash === undefined || debt === undefined || debt === 0) return skip("2.3", 2, "高现金与高息负债并存", "缺少货币资金或有息负债");
  const y0 = String(ctx.anchorYear);
  const income = ctx.incomeByYear[y0];
  const finExp = Math.abs(pickNum(income, ["fin_exp", "finance_expense", "finExp"]) ?? 0);
  const impliedRate = finExp > 0 ? (finExp / debt) * 100 : undefined;
  const highCash = cash > debt * 0.5;
  const veryHighCash = cash > debt;
  if (!highCash) return { id: "2.3", layer: 2, title: "高现金与高息负债并存", verdict: "PASS", detail: `现金/有息负债=${(cash / debt).toFixed(2)}` };
  if (impliedRate !== undefined && impliedRate > 7 && veryHighCash) return { id: "2.3", layer: 2, title: "高现金与高息负债并存", verdict: "FAIL", detail: `现金/负债=${(cash / debt).toFixed(2)}，隐含利率≈${impliedRate.toFixed(1)}%` };
  return { id: "2.3", layer: 2, title: "高现金与高息负债并存", verdict: veryHighCash ? "FAIL" : "WARN", detail: `货币资金 ${cash.toFixed(0)} 百万 vs 有息负债 ${debt.toFixed(0)} 百万${impliedRate !== undefined ? `；隐含利率≈${impliedRate.toFixed(1)}%` : ""}` };
}

function rule31(ctx: MinesweeperRuleContext): RuleResultRow {
  const tmap = byYearTrends(ctx);
  const y0 = String(ctx.anchorYear);
  const y1 = String(ctx.anchorYear - 1);
  const c = tmap.get(y0);
  const p = tmap.get(y1);
  if (!c || !p || c.revenue === undefined || p.revenue === undefined) return skip("3.1", 3, "应收增速相对营收", "缺少营收或应收序列");
  const arG = yoyPct(c.accountsReceivable, p.accountsReceivable);
  const revG = yoyPct(c.revenue, p.revenue);
  if (arG === undefined || revG === undefined) return skip("3.1", 3, "应收增速相对营收", "无法计算增速");
  if (revG <= 0 && arG > 0) return { id: "3.1", layer: 3, title: "应收增速相对营收", verdict: "WARN", detail: `营收同比 ${revG.toFixed(1)}% 应收同比 ${arG.toFixed(1)}%` };
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
  if (!c || !p || c.inventoryDays === undefined || p.inventoryDays === undefined) return skip("3.2", 3, "存货周转与毛利率组合", "缺少存货周转天数");
  const idChange = yoyPct(c.inventoryDays, p.inventoryDays);
  const gmChange = ppDelta(c.grossMarginPct, p.grossMarginPct);
  if (idChange === undefined || gmChange === undefined) return skip("3.2", 3, "存货周转与毛利率组合", "无法计算同比");
  if (idChange > 20 && gmChange > 3) return { id: "3.2", layer: 3, title: "存货周转与毛利率组合", verdict: "FAIL", detail: `存货周转天数同比升 ${idChange.toFixed(1)}%，毛利率升 ${gmChange.toFixed(1)}pp` };
  if (idChange > 10 && gmChange > 0) return { id: "3.2", layer: 3, title: "存货周转与毛利率组合", verdict: "WARN", detail: `存货周转天数同比升 ${idChange.toFixed(1)}%，毛利率升 ${gmChange.toFixed(1)}pp` };
  return { id: "3.2", layer: 3, title: "存货周转与毛利率组合", verdict: "PASS", detail: "未触发高风险组合" };
}

function rule33(ctx: MinesweeperRuleContext): RuleResultRow {
  const y0 = String(ctx.anchorYear);
  const y1 = String(ctx.anchorYear - 1);
  const y2 = String(ctx.anchorYear - 2);
  const b0 = ctx.balanceByYear[y0];
  const b1 = ctx.balanceByYear[y1];
  const b2 = ctx.balanceByYear[y2];
  const cip0 = pickNum(b0, ["cip", "construction_in_progress", "constructionInProgress"]);
  const cip1 = pickNum(b1, ["cip", "construction_in_progress", "constructionInProgress"]);
  const cip2 = pickNum(b2, ["cip", "construction_in_progress", "constructionInProgress"]);
  const fix0 = pickNum(b0, ["fix_assets", "fixed_assets", "fixedAssets"]);
  const fix1 = pickNum(b1, ["fix_assets", "fixed_assets", "fixedAssets"]);
  const fix2 = pickNum(b2, ["fix_assets", "fixed_assets", "fixedAssets"]);
  if (cip0 === undefined || cip1 === undefined || fix0 === undefined || fix1 === undefined) return skip("3.3", 3, "在建工程转固节奏", "缺少 CIP 或固定资产字段");
  const cipG = yoyPct(cip0, cip1);
  const fixG = yoyPct(fix0, fix1);
  const prevCipG = cip2 !== undefined ? yoyPct(cip1, cip2) : undefined;
  const prevFixG = fix2 !== undefined ? yoyPct(fix1, fix2) : undefined;
  const oneYearWarn = (cipG ?? 0) > 30 && (fixG ?? 0) < ((cipG ?? 0) * 0.5);
  const twoYearWarn = oneYearWarn && (prevCipG ?? 0) > 30 && (prevFixG ?? 0) < ((prevCipG ?? 0) * 0.5);
  if (twoYearWarn) return { id: "3.3", layer: 3, title: "在建工程转固节奏", verdict: "FAIL", detail: `CIP 同比 ${cipG?.toFixed(1)}%，固定资产同比 ${fixG?.toFixed(1)}%，且已连续两年` };
  if (oneYearWarn) return { id: "3.3", layer: 3, title: "在建工程转固节奏", verdict: "WARN", detail: `CIP 同比 ${cipG?.toFixed(1)}%，固定资产同比 ${fixG?.toFixed(1)}%` };
  return { id: "3.3", layer: 3, title: "在建工程转固节奏", verdict: "PASS", detail: "在建工程与转固节奏未见明显背离" };
}

function rule34(ctx: MinesweeperRuleContext): RuleResultRow {
  const y0 = String(ctx.anchorYear);
  const y1 = String(ctx.anchorYear - 1);
  const b0 = ctx.balanceByYear[y0];
  const b1 = ctx.balanceByYear[y1];
  const lde0 = pickNum(b0, ["lt_amort_deferred_exp", "long_term_deferred_expenses", "longTermDeferredExpense"]);
  const lde1 = pickNum(b1, ["lt_amort_deferred_exp", "long_term_deferred_expenses", "longTermDeferredExpense"]);
  const ta0 = pickNum(b0, ["total_assets", "totalAssets", "tot_assets"]);
  if (lde0 === undefined || lde1 === undefined) return skip("3.4", 3, "长期待摊费用", "缺少长期待摊费用字段");
  const g = yoyPct(lde0, lde1);
  const ratio = ta0 && ta0 > 0 ? (lde0 / ta0) * 100 : undefined;
  if ((g ?? 0) > 100 && (ratio ?? 0) >= 1) return { id: "3.4", layer: 3, title: "长期待摊费用", verdict: "FAIL", detail: `同比 ${g?.toFixed(1)}%，占总资产 ${ratio?.toFixed(2)}%` };
  if ((g ?? 0) > 50) return { id: "3.4", layer: 3, title: "长期待摊费用", verdict: "WARN", detail: `同比 ${g?.toFixed(1)}%` };
  return { id: "3.4", layer: 3, title: "长期待摊费用", verdict: "PASS", detail: `同比 ${g?.toFixed(1) ?? "—"}%` };
}

function rule35(ctx: MinesweeperRuleContext): RuleResultRow {
  const y0 = String(ctx.anchorYear);
  const b0 = ctx.balanceByYear[y0];
  const i0 = ctx.incomeByYear[y0];
  const ar = pickNum(b0, ["accounts_receiv", "accountsReceivable", "ar"]);
  const badDebt = Math.abs(pickNum(i0, ["credit_impa_loss", "creditImpairmentLoss", "bad_debt_loss"]) ?? 0);
  if (ar === undefined || ar <= 0) return skip("3.5", 3, "坏账计提与同业", "缺少应收账款");
  const ratio = (badDebt / ar) * 100;
  const text = sectionText(ctx, ["P3", "MDA"]);
  const hasAgingHint = /账龄|坏账准备|信用减值/u.test(text);
  if (ratio < 0.15 && hasAgingHint) return { id: "3.5", layer: 3, title: "坏账计提与同业", verdict: "FAIL", detail: `坏账计提/应收=${ratio.toFixed(2)}%，附注存在账龄披露` };
  if (ratio < 0.3) return { id: "3.5", layer: 3, title: "坏账计提与同业", verdict: "WARN", detail: `坏账计提/应收=${ratio.toFixed(2)}%（缺同业基准）` };
  return { id: "3.5", layer: 3, title: "坏账计提与同业", verdict: "PASS", detail: `坏账计提/应收=${ratio.toFixed(2)}%` };
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
  if (recent.length < 3) return skip("4.1", 4, "经营现金流/净利润", "趋势样本不足");
  if (maxRun >= 3) return { id: "4.1", layer: 4, title: "经营现金流/净利润", verdict: "FAIL", detail: `连续 ${maxRun} 年 OCF/净利润<1` };
  if (badYears >= 2) return { id: "4.1", layer: 4, title: "经营现金流/净利润", verdict: "WARN", detail: `${badYears} 年 OCF/净利润<1` };
  return { id: "4.1", layer: 4, title: "经营现金流/净利润", verdict: "PASS", detail: "利润现金含量尚可" };
}

function rule42(ctx: MinesweeperRuleContext): RuleResultRow {
  const y0 = String(ctx.anchorYear);
  const c0 = ctx.cashflowByYear[y0];
  const i0 = ctx.incomeByYear[y0];
  const cashReceived = pickNum(c0, ["c_recp_prov_sg_act", "cashReceivedFromSales", "cash_received_from_sales"]);
  const revenue = pickNum(i0, ["revenue", "total_operate_income", "totalOperateIncome"]);
  if (cashReceived === undefined || revenue === undefined || revenue <= 0) return skip("4.2", 4, "销售收现比", "缺少销售收现或营收字段");
  const ratio = cashReceived / (revenue * 1.13);
  if (ratio < 0.8) return { id: "4.2", layer: 4, title: "销售收现比", verdict: "FAIL", detail: `收现/营收(含税)=${ratio.toFixed(2)}` };
  if (ratio < 0.9) return { id: "4.2", layer: 4, title: "销售收现比", verdict: "WARN", detail: `收现/营收(含税)=${ratio.toFixed(2)}` };
  return { id: "4.2", layer: 4, title: "销售收现比", verdict: "PASS", detail: `收现/营收(含税)=${ratio.toFixed(2)}` };
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
  if (assetG === undefined || revG === undefined) return skip("4.3", 4, "资产增速相对营收", "缺少总资产或营收");
  const profitUp = (profitG ?? 0) > 0;
  if (!profitUp) return { id: "4.3", layer: 4, title: "资产增速相对营收", verdict: "PASS", detail: "净利润未增长" };
  if (assetG > revG * 3) return { id: "4.3", layer: 4, title: "资产增速相对营收", verdict: "FAIL", detail: `资产同比 ${assetG.toFixed(1)}% vs 营收 ${revG.toFixed(1)}%` };
  if (assetG > revG * 2) return { id: "4.3", layer: 4, title: "资产增速相对营收", verdict: "WARN", detail: "资产扩张快于营收" };
  return { id: "4.3", layer: 4, title: "资产增速相对营收", verdict: "PASS", detail: "正常" };
}

function rule44(ctx: MinesweeperRuleContext): RuleResultRow {
  const y0 = String(ctx.anchorYear);
  const income = ctx.incomeByYear[y0];
  const revenue = pickNum(income, ["revenue", "total_operate_income", "totalOperateIncome"]);
  const cost = pickNum(income, ["oper_cost", "operate_cost", "operatingCost"]);
  const sell = pickNum(income, ["sell_exp", "sale_expense", "saleExpense"]);
  const admin = pickNum(income, ["admin_exp", "manage_expense", "adminExpense"]);
  const fin = pickNum(income, ["fin_exp", "finance_expense", "financialExpense"]);
  const ni = pickNum(income, ["n_income_attr_p", "netProfit", "net_profit"]);
  if ([revenue, cost, sell, admin, fin, ni].some((v) => v === undefined)) return skip("4.4", 4, "核心利润与净利润背离", "缺少构造 core profit 的利润表字段");
  const core = (revenue as number) - (cost as number) - (sell as number) - (admin as number) - (fin as number);
  const divergence = Math.abs(core - (ni as number)) / Math.max(Math.abs(ni as number), 1) * 100;
  if (divergence > 40) return { id: "4.4", layer: 4, title: "核心利润与净利润背离", verdict: "FAIL", detail: `背离 ${divergence.toFixed(1)}%` };
  if (divergence > 20) return { id: "4.4", layer: 4, title: "核心利润与净利润背离", verdict: "WARN", detail: `背离 ${divergence.toFixed(1)}%` };
  return { id: "4.4", layer: 4, title: "核心利润与净利润背离", verdict: "PASS", detail: `背离 ${divergence.toFixed(1)}%` };
}

function rule45(ctx: MinesweeperRuleContext): RuleResultRow {
  const tmap = byYearTrends(ctx);
  const y0 = String(ctx.anchorYear);
  const y1 = String(ctx.anchorYear - 1);
  const c = tmap.get(y0);
  const p = tmap.get(y1);
  if (!c || !p) return skip("4.5", 4, "利润增长与自由现金流", "趋势不足");
  const niUp = (c.netProfit ?? 0) > (p.netProfit ?? 0) && (p.netProfit ?? 0) > 0;
  if (!niUp) return { id: "4.5", layer: 4, title: "利润增长与自由现金流", verdict: "PASS", detail: "未出现利润增长组合" };
  if (c.freeCashFlow !== undefined && c.freeCashFlow < 0) return { id: "4.5", layer: 4, title: "利润增长与自由现金流", verdict: "WARN", detail: "净利润增长但 FCF 为负" };
  return { id: "4.5", layer: 4, title: "利润增长与自由现金流", verdict: "PASS", detail: "FCF 未与利润背离" };
}

function rule51(ctx: MinesweeperRuleContext): RuleResultRow {
  const years = yearList(ctx).slice(0, 5);
  if (years.length < 2) return skip("5.1", 5, "更换审计机构", "年度样本不足");
  const agencies = years.map((y) => ctx.annualMetaByYear[y]?.auditAgency).filter((x): x is string => Boolean(x && x.trim()));
  if (agencies.length < 2) return skip("5.1", 5, "更换审计机构", "缺少审计机构字段");
  let changes = 0;
  for (let i = 0; i + 1 < agencies.length; i += 1) {
    if (agencies[i] !== agencies[i + 1]) changes += 1;
  }
  if (changes >= 2) return { id: "5.1", layer: 5, title: "更换审计机构", verdict: "FAIL", detail: `近年更换次数=${changes}` };
  if (changes === 1) return { id: "5.1", layer: 5, title: "更换审计机构", verdict: "WARN", detail: "近年存在 1 次更换" };
  return { id: "5.1", layer: 5, title: "更换审计机构", verdict: "PASS", detail: "审计机构保持稳定" };
}

function rule52(ctx: MinesweeperRuleContext): RuleResultRow {
  const years = yearList(ctx).slice(0, 3);
  if (years.length < 2) return skip("5.2", 5, "大股东减持", "年度样本不足");
  const ratios = years.map((y) => ctx.annualMetaByYear[y]?.topHolderRatio).filter((x): x is number => typeof x === "number");
  if (ratios.length < 2) return skip("5.2", 5, "大股东减持", "缺少 top holder ratio");
  const drop = ratios[0]! - ratios[ratios.length - 1]!;
  if (drop < -5) return { id: "5.2", layer: 5, title: "大股东减持", verdict: "FAIL", detail: `近 ${ratios.length} 期持股下降 ${Math.abs(drop).toFixed(2)}pp` };
  if (drop < -1) return { id: "5.2", layer: 5, title: "大股东减持", verdict: "WARN", detail: `持股下降 ${Math.abs(drop).toFixed(2)}pp` };
  return { id: "5.2", layer: 5, title: "大股东减持", verdict: "PASS", detail: "未见明显减持" };
}

function rule53(ctx: MinesweeperRuleContext): RuleResultRow {
  const text = sectionText(ctx, ["MDA", "BUSINESS", "SUB"]).toLowerCase();
  if (!text.trim()) return skip("5.3", 5, "财务总监更换", "无 PDF/附注文本");
  const cfoHit = countKeyword(text, ["财务总监", "首席财务官", "cfo"]);
  const leaveHit = countKeyword(text, ["离任", "辞职", "变更", "更换"]);
  if (cfoHit === 0) return skip("5.3", 5, "财务总监更换", "未检出 CFO 相关语句");
  if (leaveHit >= 2) return { id: "5.3", layer: 5, title: "财务总监更换", verdict: "FAIL", detail: "CFO 变更信号较强（多关键词并发）" };
  if (leaveHit >= 1) return { id: "5.3", layer: 5, title: "财务总监更换", verdict: "WARN", detail: "检测到 CFO 变更或离任线索" };
  return { id: "5.3", layer: 5, title: "财务总监更换", verdict: "PASS", detail: "未检出 CFO 异动线索" };
}

function rule54(ctx: MinesweeperRuleContext): RuleResultRow {
  const text = sectionText(ctx, ["MDA", "SUB", "BUSINESS"]).toLowerCase();
  if (!text.trim()) return skip("5.4", 5, "独董辞职", "无 PDF/附注文本");
  const indep = countKeyword(text, ["独立董事", "独董"]);
  const leave = countKeyword(text, ["辞职", "离任"]);
  if (indep === 0) return skip("5.4", 5, "独董辞职", "未检出独董相关文本");
  if (leave >= 2) return { id: "5.4", layer: 5, title: "独董辞职", verdict: "FAIL", detail: "独董离任词频较高" };
  if (leave >= 1) return { id: "5.4", layer: 5, title: "独董辞职", verdict: "WARN", detail: "检测到独董辞职线索" };
  return { id: "5.4", layer: 5, title: "独董辞职", verdict: "PASS", detail: "未检出独董辞职线索" };
}

function rule55(ctx: MinesweeperRuleContext): RuleResultRow {
  const text = sectionText(ctx, ["SEGMENT", "BUSINESS", "MDA"]).toLowerCase();
  if (!text.trim()) return skip("5.5", 5, "客户供应商集中度", "无 PDF/附注文本");
  const singleClient = text.match(/(前五大客户|客户集中度|客户占比).{0,30}?([5-9]\d(?:\.\d+)?|100)\s*%/u);
  const top5 = text.match(/前五大(客户|供应商).{0,30}?([3-9]\d(?:\.\d+)?)\s*%/u);
  if (singleClient) return { id: "5.5", layer: 5, title: "客户供应商集中度", verdict: "FAIL", detail: `检测到高集中度线索：${singleClient[0].slice(0, 50)}` };
  if (top5) return { id: "5.5", layer: 5, title: "客户供应商集中度", verdict: "WARN", detail: `检测到集中度偏高线索：${top5[0].slice(0, 50)}` };
  return { id: "5.5", layer: 5, title: "客户供应商集中度", verdict: "PASS", detail: "未检出高集中度明显线索" };
}

function rule56(ctx: MinesweeperRuleContext): RuleResultRow {
  const text = sectionText(ctx, ["MDA", "BUSINESS", "OPERATING"]).toLowerCase();
  if (!text.trim()) return skip("5.6", 5, "跨行业收购", "无 PDF/附注文本");
  const acq = countKeyword(text, ["收购", "并购", "并表", "投资"]);
  const cross = countKeyword(text, ["跨界", "新业务", "与主营无关", "多元化转型"]);
  if (acq === 0) return { id: "5.6", layer: 5, title: "跨行业收购", verdict: "PASS", detail: "未检测到显著并购线索" };
  if (acq >= 2 && cross >= 2) return { id: "5.6", layer: 5, title: "跨行业收购", verdict: "FAIL", detail: "检测到跨行业并购叙事线索" };
  if (cross >= 1) return { id: "5.6", layer: 5, title: "跨行业收购", verdict: "WARN", detail: "检测到跨界并购/投资线索" };
  return { id: "5.6", layer: 5, title: "跨行业收购", verdict: "PASS", detail: "并购活动未显示明显跨行业风险" };
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
  const pdfText = sectionText(ctx, ["MDA", "BUSINESS"]).toLowerCase();
  const pdfHigh = /(立案|调查|公开谴责|纪律处分)/u.test(pdfText);
  const pdfMed = /(警示函|行政处罚|监管措施|通报批评)/u.test(pdfText);
  if (!ev.length && !pdfHigh && !pdfMed) return { id: "5.9", layer: 5, title: "监管处罚与立案线索", verdict: "PASS", detail: "治理事件与 PDF 均未命中" };
  const high = ev.filter((e) => e.severity === "high" || /立案|调查/u.test(e.summary));
  const med = ev.filter((e) => e.severity === "medium" || /处罚|警示/u.test(e.summary));
  if (high.length || pdfHigh) return { id: "5.9", layer: 5, title: "监管处罚与立案线索", verdict: "FAIL", detail: [...high.map((e) => e.summary), ...(pdfHigh ? ["PDF 命中立案/调查关键词"] : [])].join("；") };
  if (med.length || pdfMed) return { id: "5.9", layer: 5, title: "监管处罚与立案线索", verdict: "WARN", detail: [...med.map((e) => e.summary), ...(pdfMed ? ["PDF 命中警示/处罚关键词"] : [])].join("；") };
  return { id: "5.9", layer: 5, title: "监管处罚与立案线索", verdict: "PASS", detail: "低敏记录" };
}

function rule61(ctx: MinesweeperRuleContext): RuleResultRow {
  const ind = (ctx.industry ?? "").trim();
  if (!ind) return skip("6.1", 6, "行业特有风险（农林牧渔等）", "缺少行业名称");
  if (/农|林|渔|牧|养殖|种植|饲料|水产/u.test(ind)) return { id: "6.1", layer: 6, title: "行业特有风险（农林牧渔等）", verdict: "WARN", detail: `行业「${ind}」为敏感行业` };
  return { id: "6.1", layer: 6, title: "行业特有风险（农林牧渔等）", verdict: "PASS", detail: `行业：${ind}` };
}

function rule62(ctx: MinesweeperRuleContext): RuleResultRow {
  const y0 = String(ctx.anchorYear);
  const text = sectionText(ctx, ["CAPEX", "OPERATING", "MDA"]).toLowerCase();
  const fromText = text.match(/资本化率.{0,8}?(\d{1,2}(?:\.\d+)?)\s*%/u);
  const capRate = fromText ? Number(fromText[1]) : undefined;
  if (capRate !== undefined) {
    if (capRate > 50) return { id: "6.2", layer: 6, title: "研发资本化比例", verdict: "FAIL", detail: `附注资本化率≈${capRate.toFixed(1)}%` };
    if (capRate > 30) return { id: "6.2", layer: 6, title: "研发资本化比例", verdict: "WARN", detail: `附注资本化率≈${capRate.toFixed(1)}%` };
    return { id: "6.2", layer: 6, title: "研发资本化比例", verdict: "PASS", detail: `附注资本化率≈${capRate.toFixed(1)}%` };
  }
  const income = ctx.incomeByYear[y0];
  const rdCap = pickNum(income, ["rd_capitalized", "rdCapitalized", "dev_exp_capitalized"]);
  const rdExp = pickNum(income, ["rd_expensed", "rdExpensed", "research_expense", "rd_exp"]);
  if (rdCap === undefined || rdExp === undefined || rdCap + rdExp <= 0) return skip("6.2", 6, "研发资本化比例", "缺少研发资本化/费用化字段");
  const ratio = rdCap / (rdCap + rdExp) * 100;
  if (ratio > 50) return { id: "6.2", layer: 6, title: "研发资本化比例", verdict: "FAIL", detail: `资本化率=${ratio.toFixed(1)}%` };
  if (ratio > 30) return { id: "6.2", layer: 6, title: "研发资本化比例", verdict: "WARN", detail: `资本化率=${ratio.toFixed(1)}%` };
  return { id: "6.2", layer: 6, title: "研发资本化比例", verdict: "PASS", detail: `资本化率=${ratio.toFixed(1)}%` };
}

export function evaluateMinesweeperRules(ctx: MinesweeperRuleContext): MinesweeperEvaluation {
  const rows: RuleResultRow[] = [
    rule01(ctx),
    rule02(ctx),
    rule11(ctx),
    rule12(ctx),
    rule13(ctx),
    rule14(ctx),
    rule15(ctx),
    rule16(ctx),
    rule21(ctx),
    rule22(ctx),
    rule23(ctx),
    rule31(ctx),
    rule32(ctx),
    rule33(ctx),
    rule34(ctx),
    rule35(ctx),
    rule41(ctx),
    rule42(ctx),
    rule43(ctx),
    rule44(ctx),
    rule45(ctx),
    rule51(ctx),
    rule52(ctx),
    rule53(ctx),
    rule54(ctx),
    rule55(ctx),
    rule56(ctx),
    rule57(ctx),
    rule58(ctx),
    rule59(ctx),
    rule61(ctx),
    rule62(ctx),
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
  if (failed.has("5.9") && failed.has("0.1")) combo += 6;
  if (failed.has("5.5") && failed.has("3.1")) combo += 4;
  total += combo;

  let riskBand: MinesweeperEvaluation["riskBand"] = "低";
  if (layer0Fail) riskBand = "直接排除";
  else if (total >= 46) riskBand = "极高";
  else if (total >= 26) riskBand = "高";
  else if (total >= 11) riskBand = "中";
  else riskBand = "低";

  return { rows, totalScore: total, riskBand, layer0Fail, comboBonus: combo };
}
