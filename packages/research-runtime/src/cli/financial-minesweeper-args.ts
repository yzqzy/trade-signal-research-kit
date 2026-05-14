export type FinancialMinesweeperCliArgs = {
  code?: string;
  year?: string;
  companyName?: string;
  outputDir?: string;
  reportUrl?: string;
  reportsSiteDir?: string;
};

export function parseFinancialMinesweeperArgs(argv: string[]): FinancialMinesweeperCliArgs {
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--") continue;
    if (!key.startsWith("--")) continue;
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for argument: ${key}`);
    values[key.slice(2)] = value;
    i += 1;
  }
  return {
    code: values.code,
    year: values.year,
    companyName: values["company-name"],
    outputDir: values["output-dir"],
    reportUrl: values["report-url"],
    reportsSiteDir: values["reports-site-dir"]?.trim() || undefined,
  };
}
