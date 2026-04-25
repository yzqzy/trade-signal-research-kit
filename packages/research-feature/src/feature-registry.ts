import type { FeatureSet } from "@trade-signal/research-contracts";

export type FeaturePluginFactory = () => { id: string; version: string };

const featureFactories = new Map<string, FeaturePluginFactory>();

export function registerFeaturePlugin(id: string, factory: FeaturePluginFactory): void {
  featureFactories.set(id, factory);
}

export function listRegisteredFeatureIds(): string[] {
  return [...featureFactories.keys()].sort();
}

export function createStubFeatureSet(runId: string, code: string): FeatureSet {
  return {
    runId,
    code,
    features: {},
    sourceRefs: [],
  };
}
