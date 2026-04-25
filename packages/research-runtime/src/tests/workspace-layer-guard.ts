#!/usr/bin/env node
/**
 * workspace 拆包依赖守卫：防止跨包反向依赖。
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path, { join } from "node:path";

type GuardRule = {
  packageName: string;
  forbiddenImportRe: RegExp;
};

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTsFiles(p));
    else if (entry.isFile() && entry.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

function runRule(root: string, rule: GuardRule): void {
  const src = join(root, "packages", rule.packageName, "src");
  const files = walkTsFiles(src);
  assert.ok(files.length > 0, `[workspace-layer-guard] empty package src: ${rule.packageName}`);
  for (const f of files) {
    const txt = readFileSync(f, "utf-8");
    const m = txt.match(rule.forbiddenImportRe);
    assert.equal(
      m,
      null,
      `[workspace-layer-guard] forbidden import in ${f}: ${m?.[0] ?? ""}`,
    );
  }
}

function main(): void {
  const cwd = process.cwd();
  const root = path.basename(cwd) === "research-runtime" ? path.resolve(cwd, "../..") : cwd;
  const rules: GuardRule[] = [
    {
      packageName: "research-contracts",
      forbiddenImportRe:
        /from\s+["']@trade-signal\/research-(registry|pipelines|adapters|runtime)["']/u,
    },
    {
      packageName: "research-registry",
      forbiddenImportRe: /from\s+["']@trade-signal\/research-(pipelines|adapters|runtime)["']/u,
    },
    {
      packageName: "research-adapters",
      forbiddenImportRe: /from\s+["']@trade-signal\/research-(pipelines|registry|runtime)["']/u,
    },
    {
      packageName: "research-pipelines",
      forbiddenImportRe: /from\s+["']@trade-signal\/research-runtime["']/u,
    },
  ];
  for (const r of rules) runRule(root, r);
  console.log("[test:workspace-layer-guard] ok");
}

main();
