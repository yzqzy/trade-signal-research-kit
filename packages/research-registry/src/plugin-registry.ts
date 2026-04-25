import type { PolicyResult, SelectionResult, TopicReport } from "@trade-signal/research-contracts";

export type PolicyPluginFactory = () => { id: string; version: string };
export type TopicPluginFactory = () => { id: string; version: string };
export type SelectionPluginFactory = () => { id: string; version: string };

const policyFactories = new Map<string, PolicyPluginFactory>();
const topicFactories = new Map<string, TopicPluginFactory>();
const selectionFactories = new Map<string, SelectionPluginFactory>();

export function registerPolicyPlugin(id: string, factory: PolicyPluginFactory): void {
  policyFactories.set(id, factory);
}

export function registerTopicPlugin(id: string, factory: TopicPluginFactory): void {
  topicFactories.set(id, factory);
}

export function registerSelectionPlugin(id: string, factory: SelectionPluginFactory): void {
  selectionFactories.set(id, factory);
}

export function listRegisteredPolicyIds(): string[] {
  return [...policyFactories.keys()].sort();
}

export function listRegisteredTopicIds(): string[] {
  return [...topicFactories.keys()].sort();
}

export function listRegisteredSelectionIds(): string[] {
  return [...selectionFactories.keys()].sort();
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

export function createStubTopicReport(topicId: string, runId: string, code: string): TopicReport {
  return {
    topicId,
    runId,
    code,
    evidenceRefs: [],
  };
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
