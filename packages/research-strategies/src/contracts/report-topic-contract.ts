export type ReportTopicType =
  | "business_quality"
  | "valuation"
  | "penetration_quant"
  | "turtle_strategy";

export type RequiredFieldsStatus = "pass" | "degraded" | "fail";

export interface TopicFieldContract {
  requiredFields: string[];
  optionalFields: string[];
  degradedFallback: string[];
}

export interface TopicInputContract {
  topicType: ReportTopicType;
  displayName: string;
  primaryInputs: string[];
  secondaryInputs: string[];
  fields: TopicFieldContract;
}

export const TOPIC_INPUT_CONTRACTS: Record<ReportTopicType, TopicInputContract> = {
  business_quality: {
    topicType: "business_quality",
    displayName: "商业质量评估",
    primaryInputs: ["qualitative_report.md", "qualitative_d1_d6.md"],
    secondaryInputs: ["phase1b_qualitative.md"],
    fields: {
      requiredFields: [
        "title",
        "code",
        "verdict",
        "dimensionSummaries",
        "evidenceSummary",
        "confidenceBoundary",
      ],
      optionalFields: ["governanceHighlights", "missingDataNotice"],
      degradedFallback: [
        "missingDataNotice",
        "confidenceBoundary",
      ],
    },
  },
  valuation: {
    topicType: "valuation",
    displayName: "估值分析",
    primaryInputs: ["valuation_computed.json", "analysis_report.md"],
    secondaryInputs: ["data_pack_market.md"],
    fields: {
      requiredFields: [
        "title",
        "code",
        "valuation.methods",
        "valuation.range.central",
        "assumptionSummary",
      ],
      optionalFields: [
        "valuation.range.conservative",
        "valuation.range.optimistic",
        "crossValidation",
      ],
      degradedFallback: [
        "missingDataNotice",
      ],
    },
  },
  penetration_quant: {
    topicType: "penetration_quant",
    displayName: "穿透回报率定量分析",
    primaryInputs: ["analysis_report.md", "data_pack_market.md"],
    secondaryInputs: ["valuation_computed.json"],
    fields: {
      requiredFields: [
        "title",
        "code",
        "ownerEarnings",
        "roughPenetrationRate",
        "finePenetrationRate",
        "thresholdCompare",
      ],
      optionalFields: ["factorBreakdown", "riskFlags"],
      degradedFallback: ["missingDataNotice"],
    },
  },
  turtle_strategy: {
    topicType: "turtle_strategy",
    displayName: "龟龟投资策略分析",
    primaryInputs: ["topic_aggregate"],
    secondaryInputs: ["phase3_preflight.md"],
    fields: {
      requiredFields: [
        "title",
        "code",
        "finalDecision",
        "topicLinks",
        "riskSummary",
        "confidenceBoundary",
      ],
      optionalFields: ["positionSuggestion", "watchlistSignals"],
      degradedFallback: ["missingDataNotice", "confidenceBoundary"],
    },
  },
};

export interface TopicValidationResult {
  status: RequiredFieldsStatus;
  missingRequiredFields: string[];
  missingOptionalFields: string[];
  degradedFallbackFields: string[];
}

export function validateTopicFields(
  contract: TopicFieldContract,
  data: Record<string, unknown>,
): TopicValidationResult {
  const hasValue = (fieldPath: string): boolean => {
    const segments = fieldPath.split(".");
    let cursor: unknown = data;
    for (const seg of segments) {
      if (
        typeof cursor !== "object" ||
        cursor === null ||
        !(seg in (cursor as Record<string, unknown>))
      ) {
        return false;
      }
      cursor = (cursor as Record<string, unknown>)[seg];
    }
    return cursor !== undefined && cursor !== null && cursor !== "";
  };

  const missingRequiredFields = contract.requiredFields.filter((f) => !hasValue(f));
  const missingOptionalFields = contract.optionalFields.filter((f) => !hasValue(f));
  const degradedFallbackFields = contract.degradedFallback.filter((f) => !hasValue(f));

  if (missingRequiredFields.length > 0) {
    return {
      status: "fail",
      missingRequiredFields,
      missingOptionalFields,
      degradedFallbackFields,
    };
  }

  if (missingOptionalFields.length > 0 || degradedFallbackFields.length > 0) {
    return {
      status: "degraded",
      missingRequiredFields,
      missingOptionalFields,
      degradedFallbackFields,
    };
  }

  return {
    status: "pass",
    missingRequiredFields,
    missingOptionalFields,
    degradedFallbackFields,
  };
}
