import type { PolicyResult } from "@trade-signal/research-contracts";

export type PolicyPluginFactory = () => { id: string; version: string };

const policyFactories = new Map<string, PolicyPluginFactory>();

export function registerPolicyPlugin(id: string, factory: PolicyPluginFactory): void {
  policyFactories.set(id, factory);
}

export function listRegisteredPolicyIds(): string[] {
  return [...policyFactories.keys()].sort();
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
