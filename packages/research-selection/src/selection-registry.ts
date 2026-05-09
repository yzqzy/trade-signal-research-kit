import type { PolicyResult, SelectionResult } from "@trade-signal/research-contracts";

export type SelectionPluginContext = {
  selectionId: string;
  runId: string;
  universe: string;
  policyResults?: PolicyResult[];
  maxCandidates?: number;
};

export type SelectionPlugin = {
  id: string;
  version: string;
  compose(ctx: SelectionPluginContext): SelectionResult | Promise<SelectionResult>;
};

export type SelectionPluginFactory = () => SelectionPlugin;

const selectionFactories = new Map<string, SelectionPluginFactory>();

export function registerSelectionPlugin(id: string, factory: SelectionPluginFactory): void {
  selectionFactories.set(id, factory);
}

export function listRegisteredSelectionIds(): string[] {
  return [...selectionFactories.keys()].sort();
}

export function resolveSelectionPlugin(id: string): SelectionPlugin {
  const factory = selectionFactories.get(id);
  if (!factory) throw new Error(`[research-selection] 未注册 Selection 插件: ${id}`);
  return factory();
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
