import type { TopicReport } from "@trade-signal/research-contracts";

export type TopicPluginFactory = () => { id: string; version: string };

const topicFactories = new Map<string, TopicPluginFactory>();

export function registerTopicPlugin(id: string, factory: TopicPluginFactory): void {
  topicFactories.set(id, factory);
}

export function listRegisteredTopicIds(): string[] {
  return [...topicFactories.keys()].sort();
}

export function createStubTopicReport(topicId: string, runId: string, code: string): TopicReport {
  return {
    topicId,
    runId,
    code,
    evidenceRefs: [],
  };
}
