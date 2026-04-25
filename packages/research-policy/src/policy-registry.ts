import type { FeatureSet, PolicyResult } from "@trade-signal/research-contracts";

export type PolicyPluginContext = {
  policyId: string;
  runId: string;
  code: string;
  featureSet?: FeatureSet;
  payload?: Record<string, unknown>;
};

export type PolicyPlugin = {
  id: string;
  version: string;
  evaluate(ctx: PolicyPluginContext): PolicyResult | Promise<PolicyResult>;
};

export type PolicyPluginFactory = () => PolicyPlugin;

const policyFactories = new Map<string, PolicyPluginFactory>();

export function registerPolicyPlugin(id: string, factory: PolicyPluginFactory): void {
  policyFactories.set(id, factory);
}

export function listRegisteredPolicyIds(): string[] {
  return [...policyFactories.keys()].sort();
}

export function resolvePolicyPlugin(id: string): PolicyPlugin {
  const factory = policyFactories.get(id);
  if (!factory) throw new Error(`[research-policy] 未注册 Policy 插件: ${id}`);
  return factory();
}

export function createStubPolicyResult(policyId: string, runId: string, code: string): PolicyResult {
  return {
    policyId,
    runId,
    code,
    payload: { stub: true },
    reasonRefs: [],
  };
}
