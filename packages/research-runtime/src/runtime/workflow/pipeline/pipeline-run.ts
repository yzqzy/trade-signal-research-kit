import type { WorkflowGraphState } from "./workflow-state.js";
import {
  nodeFinalizeManifest,
  nodeInitPrep,
  nodePreflight3,
  nodeReportPolish,
  nodeStageB,
  nodeStageC,
  nodeStageD,
  nodeStageE,
  routeAfterB,
  routeAfterInit,
} from "./workflow-nodes.js";

function mergeWorkflowState(
  base: WorkflowGraphState,
  patch: Partial<WorkflowGraphState>,
): WorkflowGraphState {
  const left = base.completedStages ?? [];
  const right = patch.completedStages ?? [];
  const completedStages = [...new Set([...left, ...right])];
  return { ...base, ...patch, completedStages };
}

/**
 * Phase0–1B +（条件）2A/2B + Phase3 preflight，与旧 LangGraph pipeline 图等价。
 */
export async function runWorkflowPipeline(initial: WorkflowGraphState): Promise<WorkflowGraphState> {
  let state = mergeWorkflowState(initial, await nodeInitPrep(initial));
  const afterInit = routeAfterInit(state);
  if (afterInit === "stageB") {
    state = mergeWorkflowState(state, await nodeStageB(state));
    const afterB = routeAfterB(state);
    if (afterB === "stageD") {
      state = mergeWorkflowState(state, await nodeStageD(state));
    }
  } else {
    state = mergeWorkflowState(state, await nodeStageD(state));
  }
  state = mergeWorkflowState(state, await nodeStageC(state));
  state = mergeWorkflowState(state, await nodePreflight3(state));
  return state;
}

/** 完整 workflow：pipeline + Stage E + ReportPolish + manifest。 */
export async function runWorkflowFull(initial: WorkflowGraphState): Promise<WorkflowGraphState> {
  let state = await runWorkflowPipeline(initial);
  state = mergeWorkflowState(state, await nodeStageE(state));
  state = mergeWorkflowState(state, await nodeReportPolish(state));
  state = mergeWorkflowState(state, await nodeFinalizeManifest(state));
  return state;
}
