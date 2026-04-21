import { Suspense } from "react";

import { ReportsTimelineClient } from "./ReportsTimelineClient";
import { readTimelineData } from "./read-timeline";

export default async function ReportsIndexPage() {
  const { index, items } = await readTimelineData();
  const indexMeta = index
    ? { version: index.version, generatedAt: index.generatedAt, entryCount: index.entryCount }
    : null;

  return (
    <Suspense
      fallback={
        <div className="rh-suspense-fallback">加载报告列表…</div>
      }
    >
      <ReportsTimelineClient items={items} indexMeta={indexMeta} />
    </Suspense>
  );
}
