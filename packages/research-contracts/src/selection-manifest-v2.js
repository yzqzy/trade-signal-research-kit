export const SELECTION_MANIFEST_VERSION = "1.0";
export function buildSelectionManifestV1(output, runId) {
    const selectionId = `selection:screener:${output.market}:${output.mode}`;
    const universe = `${String(output.market).toLowerCase()}_${output.mode}`;
    return {
        manifestVersion: SELECTION_MANIFEST_VERSION,
        schema: "selection-result-v2",
        runProfile: "selection_fast",
        selectionId,
        runId,
        universe,
        generatedAt: output.generatedAt,
        candidates: output.results.map((r) => ({
            code: r.code,
            score: r.totalScore,
            decision: r.decision,
            policyContributions: {
                tier1Score: r.tier1Score ?? 0,
                screenerScore: r.screenerScore ?? 0,
            },
        })),
        drillDownTopicIds: ["topic:business-six-dimension", "topic:turtle-strategy-explainer"],
    };
}
