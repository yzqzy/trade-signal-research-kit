export declare const SELECTION_MANIFEST_VERSION: "1.0";
export type SelectionManifestV1 = {
    manifestVersion: typeof SELECTION_MANIFEST_VERSION;
    schema: "selection-result-v2";
    runProfile: "selection_fast";
    selectionId: string;
    runId: string;
    universe: string;
    generatedAt: string;
    candidates: Array<{
        code: string;
        score?: number;
        decision?: string;
        policyContributions?: Record<string, number>;
    }>;
    drillDownTopicIds?: string[];
};
export type SelectionSourceLike = {
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
export declare function buildSelectionManifestV1(output: SelectionSourceLike, runId: string): SelectionManifestV1;
