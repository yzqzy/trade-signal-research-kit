"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function ReportBackLink() {
  const sp = useSearchParams();
  const query = new URLSearchParams();
  const topic = sp.get("topic")?.trim();
  const code = sp.get("code")?.trim();
  if (topic) query.set("topic", topic);
  if (code) query.set("code", code);
  const qs = query.toString();
  return (
    <Link className="rh-back-link" href={qs ? `/reports?${qs}` : "/reports"}>
      ← 报告中心
    </Link>
  );
}
