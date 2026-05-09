export declare const SELECTION_MANIFEST_VERSION: "1.0";
export type SelectionManifestV1 = {
    manifestVersion: typeof SELECTION_MANIFEST_VERSION;
    schema: "selection-result-v2";
    runProfile: "selection_fast";
    strategyId: string;
    strategyLabel: string;
    selectionId: string;
    runId: string;
    universe: string;
    generatedAt: string;
    candidates: Array<{
        code: string;
        score?: number;
        decision?: string;
        confidence?: "high" | "medium" | "low" | "unknown";
        policyContributions?: Record<string, number>;
    }>;
    policyResults?: Array<{
        policyId: string;
        code: string;
        payload: Record<string, unknown>;
    }>;
    drillDownTopicIds?: string[];
    rankingsTopN?: number;
};
export type SelectionSourceLike = {
    strategyId?: string;
    strategyLabel?: string;
    selectionId?: string;
    universe?: string;
    market: string;
    mode: string;
    generatedAt: string;
    results: Array<{
        code: string;
        totalScore?: number;
        decision?: string;
        tier1Score?: number;
        screenerScore?: number;
    }>;
};
export type SelectionManifestBuildOptions = {
    rankingsTopN?: number;
};
export declare function buildSelectionManifestV1(output: SelectionSourceLike, runId: string, options?: SelectionManifestBuildOptions): SelectionManifestV1;
