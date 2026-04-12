export type Phase1BChannel = "http" | "mcp";

export interface Phase1BInput {
  stockCode: string;
  companyName: string;
  marketDataPackPath?: string;
  year?: string;
  channel?: Phase1BChannel;
  limitPerQuery?: number;
}

export type McpToolCaller = (toolName: string, args: Record<string, unknown>) => Promise<unknown>;

export interface Phase1BEvidence {
  title: string;
  url: string;
  source?: string;
  publishedAt?: string;
  snippet?: string;
}

export interface Phase1BItem {
  item: string;
  content: string;
  evidences: Phase1BEvidence[];
}

export interface Phase1BMdaSection {
  heading: string;
  points: string[];
  evidences: Phase1BEvidence[];
}

export interface Phase1BQualitativeSupplement {
  stockCode: string;
  companyName: string;
  year?: string;
  generatedAt: string;
  channel: Phase1BChannel;
  section7: Phase1BItem[];
  section8: Phase1BItem[];
  section10: Phase1BMdaSection[];
}
