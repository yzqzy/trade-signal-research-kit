#!/usr/bin/env node
import assert from "node:assert/strict";

import { parseFinancialMinesweeperArgs } from "../cli/financial-minesweeper-args.js";

function main(): void {
  const parsed = parseFinancialMinesweeperArgs([
    "--code",
    "600000",
    "--year",
    "2024",
    "--report-url",
    "https://example.com/a.pdf",
    "--company-name",
    "测试公司",
  ]);

  assert.equal(parsed.code, "600000");
  assert.equal(parsed.year, "2024");
  assert.equal(parsed.reportUrl, "https://example.com/a.pdf");
  assert.equal(parsed.companyName, "测试公司");
  console.log("[test:financial-minesweeper-cli-contract] ok");
}

main();
