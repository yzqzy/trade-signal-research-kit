export function selectionId(policyId: string, universe: string): string {
  const u = universe.replace(/[^a-zA-Z0-9_-]+/g, "_");
  return `selection:${policyId.replace(/^policy:/u, "")}:${u}`;
}
