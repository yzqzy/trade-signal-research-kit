/**
 * 商业模式判定：基于行业标签 + 多年财务结构 + 分部线索的确定性规则（非 LLM）。
 */
import type { BusinessQualityFacts } from "./business-quality-facts.js";
import { netProfitYoYPercent, ocfToNiForLatest, revenueYoYPercent } from "./business-quality-facts.js";

export type BusinessModelL1Key =
  | "utility_toll"
  | "brand_consumer"
  | "scale_manufacturing"
  | "heavy_cyclical"
  | "rd_product"
  | "platform_network"
  | "conglomerate";

export type DamodaranBucket = "stable" | "cyclical" | "growth" | "hybrid";

export type BusinessModelVerdict = {
  l1Key: BusinessModelL1Key;
  l1Label: string;
  secondary?: string;
  l2Mechanism: string;
  l3Constraint: string;
  damodaran: DamodaranBucket;
  greenwaldAxes: string[];
  buffettHooks: string[];
  evidenceBullets: string[];
};

function industryText(facts: BusinessQualityFacts): string {
  return `${facts.industryLabel ?? ""}\n${facts.segmentRows.map((s) => s.summary).join("\n")}`;
}

function latest(facts: BusinessQualityFacts) {
  return facts.byYear[0];
}

function avgNetMargin(facts: BusinessQualityFacts, n = 3): number | undefined {
  const ys = facts.byYear.slice(0, n);
  const vals = ys
    .map((y) => {
      if (y.netMarginPct !== undefined) return y.netMarginPct;
      if (y.revenue && y.netProfit !== undefined && y.revenue !== 0) return (y.netProfit / y.revenue) * 100;
      return undefined;
    })
    .filter((v): v is number => v !== undefined);
  if (!vals.length) return undefined;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function avgRdRatio(facts: BusinessQualityFacts): number | undefined {
  const ys = facts.byYear.slice(0, 3);
  const vals = ys.map((y) => y.rdExpenseRatioPct).filter((v): v is number => v !== undefined);
  if (!vals.length) return undefined;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function leverageLatest(facts: BusinessQualityFacts): number | undefined {
  const y = latest(facts);
  if (!y) return undefined;
  if (y.leveragePct !== undefined) return y.leveragePct;
  if (y.totalAssets && y.totalLiabilities !== undefined && y.totalAssets > 0) {
    return (y.totalLiabilities / y.totalAssets) * 100;
  }
  return undefined;
}

function debtToAssetsLatest(facts: BusinessQualityFacts): number | undefined {
  const y = latest(facts);
  if (!y) return undefined;
  if (y.debtToAssetsPct !== undefined) return y.debtToAssetsPct;
  if (y.totalAssets && y.interestBearingDebt !== undefined && y.totalAssets > 0) {
    return (y.interestBearingDebt / y.totalAssets) * 100;
  }
  return undefined;
}

export function classifyBusinessModel(facts: BusinessQualityFacts): BusinessModelVerdict {
  const text = industryText(facts);
  const y0 = latest(facts);
  const revYoy = revenueYoYPercent(facts);
  const niYoy = netProfitYoYPercent(facts);
  const ocfNi = ocfToNiForLatest(facts);
  const nm = avgNetMargin(facts);
  const rd = avgRdRatio(facts);
  const lev = leverageLatest(facts);
  const dta = debtToAssetsLatest(facts);

  const evidence: string[] = [];
  if (y0?.revenue !== undefined) evidence.push(`最近年营收≈${fmtBn(y0.revenue)} 百万元`);
  if (y0?.netProfit !== undefined) evidence.push(`最近年归母净利润≈${fmtBn(y0.netProfit)} 百万元`);
  if (revYoy !== undefined) evidence.push(`营收同比约 ${revYoy.toFixed(1)}%`);
  if (niYoy !== undefined) evidence.push(`归母净利润同比约 ${niYoy.toFixed(1)}%`);
  if (ocfNi !== undefined) evidence.push(`OCF/净利润约 ${ocfNi.toFixed(2)}×`);
  if (nm !== undefined) evidence.push(`近年净利率中枢约 ${nm.toFixed(1)}%`);
  if (lev !== undefined) evidence.push(`资产负债率约 ${lev.toFixed(1)}%`);

  const isUtility =
    /通信|运营商|宽带|移动|5G|电力|水务|燃气|港口|机场|公路|铁路/u.test(text) && (ocfNi === undefined || ocfNi >= 1.1);
  const isHeavyCyclical =
    /航运|海运|干散货|油运|养殖|猪|煤炭|有色|钢铁|化工原料|建材/u.test(text) ||
    (dta !== undefined && dta > 25 && lev !== undefined && lev > 55);
  const isRdHeavy = (rd !== undefined && rd > 4) || /医药|生物|制药|创新药|半导体|芯片|软件|SaaS/u.test(text);
  const isPlatform = /平台|撮合|双边|电商|流量|抽佣|GMV/u.test(text) && nm !== undefined && nm > 15;
  const isBrandConsumer =
    /家电|食品|饮料|白酒|服装|化妆品|零售|连锁|品牌/u.test(text) && nm !== undefined && nm > 8 && (ocfNi === undefined || ocfNi > 0.9);

  let l1Key: BusinessModelL1Key = "scale_manufacturing";
  let l1Label = "规模制造成本领先型";
  let l2 = "以规模制造与供应链效率赚取价差，增长依赖份额与产品结构。";
  let l3 = "需验证毛利率、费用率与 Capex 对自由现金流的侵蚀。";
  let damodaran: DamodaranBucket = "hybrid";
  const gw: string[] = ["供给侧：规模与成本曲线", "需求侧：品牌与渠道（待分部证据强化）"];
  const bf: string[] = ["资本回报：ROE 与分红/回购纪律", "增量资本：Capex 与营运资本占用"];

  if (isUtility) {
    l1Key = "utility_toll";
    l1Label = "公用事业/基础设施收费站型";
    l2 = "以网络或牌照约束下的规模服务收费为主，边际服务成本相对较低。";
    l3 = "监管与资费政策、资本开支周期决定盈利弹性。";
    damodaran = "stable";
    gw.splice(0, gw.length, "制度侧：牌照/监管壁垒", "供给侧：网络规模与固定成本摊薄");
    bf.splice(0, bf.length, "现金流稳定性与分红承诺", "资本开支峰值与折旧回收节奏");
  } else if (isHeavyCyclical) {
    l1Key = "heavy_cyclical";
    l1Label = "重资产周期型";
    l2 = "利润对价格/运价/猪价等周期变量敏感，规模用于穿越周期。";
    l3 = "杠杆与现金流在周期底部是主要约束。";
    damodaran = "cyclical";
    gw.splice(0, gw.length, "供给侧：成本曲线与资产位置", "需求侧：周期需求（通常较弱）");
    bf.splice(0, bf.length, "下行期现金与债务安全边际", "周期位置与资本开支纪律");
  } else if (isRdHeavy) {
    l1Key = "rd_product";
    l1Label = "研发产品驱动型";
    l2 = "以产品线与研发迭代驱动收入，利润取决于管线兑现与费用结构。";
    l3 = "研发转化与回款质量是主要不确定性。";
    damodaran = "growth";
    gw.splice(0, gw.length, "供给侧：技术与产品壁垒", "需求侧：客户与渠道结构");
    bf.splice(0, bf.length, "研发资本化与费用化口径", "商业化节奏与现金回款");
  } else if (isPlatform) {
    l1Key = "platform_network";
    l1Label = "平台/网络效应型";
    l2 = "以双边网络与规模效应提升变现率与 take rate。";
    l3 = "竞争与监管对平台抽佣与流量的约束。";
    damodaran = "growth";
    gw.splice(0, gw.length, "需求侧：网络效应与迁移成本", "供给侧：规模与数据/技术");
    bf.splice(0, bf.length, "用户与商户双边留存", "货币化率与合规边界");
  } else if (isBrandConsumer) {
    l1Key = "brand_consumer";
    l1Label = "品牌消费复购型";
    l2 = "以品牌与渠道复购驱动收入，利润取决于毛利与费用纪律。";
    l3 = "价格战与渠道结构变化会压缩护城河表达。";
    damodaran = "stable";
    gw.splice(0, gw.length, "需求侧：品牌与渠道", "供给侧：规模采购与制造成本");
    bf.splice(0, bf.length, "毛利率与费用率趋势", "营运资本与渠道占款");
  } else if (/控股|投资|多元化|集团|金融|地产/u.test(text) && /金融|地产|投资/u.test(text)) {
    l1Key = "conglomerate";
    l1Label = "综合经营型（多元控股）";
    l2 = "业务结构跨板块，回报取决于分部资本配置与表内外杠杆。";
    l3 = "分部透明度与关联交易是主要验证成本。";
    damodaran = "hybrid";
    gw.push("制度侧：治理与关联交易");
    bf.push("分部 ROIC 与母子公司现金流");
  }

  if (facts.hasReplicatedFinancialHistory) {
    l3 = `${l3} 多年财务存在外推复制回退，趋势判断需降级为方向性。[M:§13]`;
  }
  if (facts.hasCriticalEstimateRules) {
    l3 = `${l3} 关键科目含估算规则（见 §13 规则=），结论须保守。[M:§13]`;
  }

  return {
    l1Key,
    l1Label,
    l2Mechanism: l2,
    l3Constraint: l3,
    damodaran,
    greenwaldAxes: gw,
    buffettHooks: bf,
    evidenceBullets: evidence.slice(0, 6),
  };
}

function fmtBn(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
  return n.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
}
