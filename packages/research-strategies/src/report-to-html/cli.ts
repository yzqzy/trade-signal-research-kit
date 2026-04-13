#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveInputPath, resolveOutputPath } from "../pipeline/resolve-monorepo-path.js";
import { renderPhase3Html } from "../phase3/report-renderer.js";

type CliArgs = {
  inputMdPath?: string;
  outputHtmlPath?: string;
};

function parseArgs(argv: string[]): CliArgs {
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--") continue;
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for argument: ${key}`);
    values[name] = value;
    i += 1;
  }
  return {
    inputMdPath: values["input-md"] ?? values["markdown"],
    outputHtmlPath: values["output-html"] ?? values["output"],
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.inputMdPath) {
    throw new Error("Missing required argument: --input-md <path-to-report.md> [--output-html <path>]");
  }

  const mdAbs = resolveInputPath(args.inputMdPath);
  const markdown = await readFile(mdAbs, "utf-8");
  const html = renderPhase3Html(markdown);

  const outHtml =
    args.outputHtmlPath !== undefined
      ? resolveOutputPath(args.outputHtmlPath)
      : path.join(path.dirname(mdAbs), `${path.basename(mdAbs, path.extname(mdAbs))}.html`);

  await mkdir(path.dirname(outHtml), { recursive: true });
  await writeFile(outHtml, html, "utf-8");

  console.log(`[report-to-html] wrote -> ${outHtml}`);
}

void main();
