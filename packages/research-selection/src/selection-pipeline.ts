import {
  buildSelectionManifestV1,
  type SelectionManifestV1,
  type SelectionSourceLike,
} from "@trade-signal/research-contracts";

export type ScreenerLikeOutput = SelectionSourceLike;

export function buildSelectionManifestFromScreener(
  output: ScreenerLikeOutput,
  runId: string,
): SelectionManifestV1 {
  return buildSelectionManifestV1(output, runId);
}
