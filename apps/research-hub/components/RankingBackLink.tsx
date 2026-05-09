"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function RankingBackLink() {
  const sp = useSearchParams();
  const query = new URLSearchParams();
  const strategy = sp.get("strategy")?.trim();
  const market = sp.get("market")?.trim();
  if (strategy) query.set("strategy", strategy);
  if (market) query.set("market", market);
  const qs = query.toString();
  return (
    <Link className="rh-back-link" href={qs ? `/rankings?${qs}` : "/rankings"}>
      ← 策略榜单中心
    </Link>
  );
}
