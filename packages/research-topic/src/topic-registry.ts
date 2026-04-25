import type { FeatureSet, PolicyResult, TopicReport } from "@trade-signal/research-contracts";

export type TopicPluginContext = {
  topicId: string;
  runId: string;
  code: string;
  featureSet?: FeatureSet;
  policyResult?: PolicyResult;
  markdownPath?: string;
  siteTopicType?: string;
  evidenceRefs?: TopicReport["evidenceRefs"];
};

export type TopicPlugin = {
  id: string;
  version: string;
  render(ctx: TopicPluginContext): TopicReport | Promise<TopicReport>;
};

export type TopicPluginFactory = () => TopicPlugin;

const topicFactories = new Map<string, TopicPluginFactory>();

export function registerTopicPlugin(id: string, factory: TopicPluginFactory): void {
  topicFactories.set(id, factory);
}

export function listRegisteredTopicIds(): string[] {
  return [...topicFactories.keys()].sort();
}

export function resolveTopicPlugin(id: string): TopicPlugin {
  const factory = topicFactories.get(id);
  if (!factory) throw new Error(`[research-topic] 未注册 Topic 插件: ${id}`);
  return factory();
}

export function createStubTopicReport(topicId: string, runId: string, code: string): TopicReport {
  return {
    topicId,
    runId,
    code,
    evidenceRefs: [],
  };
}
