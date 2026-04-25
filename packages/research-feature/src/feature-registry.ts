import type { FeatureSet } from "@trade-signal/research-contracts";

export type FeaturePluginContext = {
  runId: string;
  code: string;
  rawData?: unknown;
};

export type FeaturePlugin = {
  id: string;
  version: string;
  compute(ctx: FeaturePluginContext): FeatureSet | Promise<FeatureSet>;
};

export type FeaturePluginFactory = () => FeaturePlugin;

const featureFactories = new Map<string, FeaturePluginFactory>();

export function registerFeaturePlugin(id: string, factory: FeaturePluginFactory): void {
  featureFactories.set(id, factory);
}

export function listRegisteredFeatureIds(): string[] {
  return [...featureFactories.keys()].sort();
}

export function resolveFeaturePlugin(id: string): FeaturePlugin {
  const factory = featureFactories.get(id);
  if (!factory) throw new Error(`[research-feature] 未注册 Feature 插件: ${id}`);
  return factory();
}

export function createStubFeatureSet(runId: string, code: string): FeatureSet {
  return {
    runId,
    code,
    features: {},
    sourceRefs: [],
  };
}
