import { Suspense } from "react";

import { RankingsClient } from "./RankingsClient";
import { readRankingsData } from "./read-rankings";

export default async function RankingsPage() {
  const data = await readRankingsData();

  return (
    <Suspense
      fallback={
        <div className="rh-suspense-fallback">加载榜单中…</div>
      }
    >
      <RankingsClient data={data} />
    </Suspense>
  );
}
