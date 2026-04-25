import type { Market } from "@trade-signal/schema-core";

/** 展示用「交易代码」后缀（A 股启发式；HK 原样） */
export function formatListedCode(code: string, market: Market | undefined): string {
  const digits = code.replace(/\D/g, "");
  if (market === "HK") {
    return `${digits || code}.HK`;
  }
  if (market === "CN_A" || !market) {
    const c = digits || code;
    if (c.startsWith("6")) return `${c}.SH`;
    return `${c}.SZ`;
  }
  return code;
}
