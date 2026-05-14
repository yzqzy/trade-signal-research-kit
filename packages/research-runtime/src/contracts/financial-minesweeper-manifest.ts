/**
 * 财报排雷单次 run 清单（与 workflow / business-analysis manifest 同级，供 `reports-site:emit` 识别）。
 */
export type FinancialMinesweeperManifestV1 = {
  manifestVersion: "1.0";
  generatedAt: string;
  outputLayout: {
    code: string;
    runId: string;
    area: "financial-minesweeper";
  };
  input: {
    code: string;
    year: string;
    companyName?: string;
    fiscalYearResolved?: string;
    reportUrlResolved?: string;
  };
  outputs: {
    reportMarkdownPath: string;
    analysisJsonPath: string;
    rawDataJsonPath?: string;
    pdfPath?: string;
    phase2aJsonPath?: string;
    phase2bMarkdownPath?: string;
  };
  summary?: {
    totalScore: number;
    riskBand: "低" | "中" | "高" | "极高" | "直接排除";
    failCount: number;
    warnCount: number;
    skipCount: number;
  };
};
