import { bootstrapFeatureRegistry } from "@trade-signal/research-feature";
import { bootstrapPolicyRegistry, registerPolicyEvaluator, POLICY_IDS } from "@trade-signal/research-policy";
import { bootstrapSelectionRegistry } from "@trade-signal/research-selection";
import { bootstrapTopicRegistry } from "@trade-signal/research-topic";
import { resolvePolicyPayloadEvaluator } from "../strategy/registry.js";

/**
 * 跨层编排：顺序启动 Feature / Policy / Topic / Selection 注册；领域注册逻辑在各层包内。
 */
export function bootstrapV2PluginRegistry(): void {
  bootstrapFeatureRegistry();
  bootstrapPolicyRegistry();
  registerPolicyEvaluator(POLICY_IDS.highDividend, ({ featureSet }) =>
    featureSet
      ? resolvePolicyPayloadEvaluator(POLICY_IDS.highDividend)(featureSet)
      : { strategyId: "high_dividend", stub: true },
  );
  registerPolicyEvaluator(POLICY_IDS.turtle, ({ featureSet }) =>
    featureSet
      ? resolvePolicyPayloadEvaluator(POLICY_IDS.turtle)(featureSet)
      : { strategyId: "turtle", stub: true },
  );
  registerPolicyEvaluator(POLICY_IDS.valueV1, ({ featureSet }) =>
    featureSet
      ? resolvePolicyPayloadEvaluator(POLICY_IDS.valueV1)(featureSet)
      : { strategyId: "value_v1", stub: true },
  );
  registerPolicyEvaluator(POLICY_IDS.valueFactor, ({ featureSet }) =>
    featureSet
      ? resolvePolicyPayloadEvaluator(POLICY_IDS.valueFactor)(featureSet)
      : { strategyId: "value_factor", stub: true },
  );
  registerPolicyEvaluator(POLICY_IDS.qualityFactor, ({ featureSet }) =>
    featureSet
      ? resolvePolicyPayloadEvaluator(POLICY_IDS.qualityFactor)(featureSet)
      : { strategyId: "quality_factor", stub: true },
  );
  registerPolicyEvaluator(POLICY_IDS.dividendFactor, ({ featureSet }) =>
    featureSet
      ? resolvePolicyPayloadEvaluator(POLICY_IDS.dividendFactor)(featureSet)
      : { strategyId: "dividend_factor", stub: true },
  );
  registerPolicyEvaluator(POLICY_IDS.qualityValue, ({ featureSet }) =>
    featureSet
      ? resolvePolicyPayloadEvaluator(POLICY_IDS.qualityValue)(featureSet)
      : { strategyId: "quality_value", stub: true },
  );
  registerPolicyEvaluator(POLICY_IDS.defensiveFactor, ({ featureSet }) =>
    featureSet
      ? resolvePolicyPayloadEvaluator(POLICY_IDS.defensiveFactor)(featureSet)
      : { strategyId: "defensive_factor", stub: true },
  );
  registerPolicyEvaluator(POLICY_IDS.multiFactorCore, ({ featureSet }) =>
    featureSet
      ? resolvePolicyPayloadEvaluator(POLICY_IDS.multiFactorCore)(featureSet)
      : { strategyId: "multi_factor_core", stub: true },
  );
  bootstrapTopicRegistry();
  bootstrapSelectionRegistry();
}
