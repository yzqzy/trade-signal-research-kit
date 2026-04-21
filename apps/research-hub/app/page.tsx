"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 不设首页：`/` 进入研报中心。
 * 静态导出下 RSC `redirect()` 会在 `out/index.html` 留下 error shell，故用客户端 replace。
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/reports");
  }, [router]);

  return null;
}
