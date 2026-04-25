import type { SelectionResult } from "@trade-signal/research-contracts";

export type SelectionPluginFactory = () => { id: string; version: string };

const selectionFactories = new Map<string, SelectionPluginFactory>();

export function registerSelectionPlugin(id: string, factory: SelectionPluginFactory): void {
  selectionFactories.set(id, factory);
}

export function listRegisteredSelectionIds(): string[] {
  return [...selectionFactories.keys()].sort();
}

export function createStubSelectionResult(
  selectionId: string,
  runId: string,
  universe: string,
): SelectionResult {
  return {
    selectionId,
    runId,
    universe,
    candidates: [],
  };
}
