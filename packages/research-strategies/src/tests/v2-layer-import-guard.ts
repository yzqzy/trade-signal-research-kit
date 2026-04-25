#!/usr/bin/env node
/**
 * V2 骨架防反向依赖：`src/v2` 不得直接 import 运行时 / Phase 实现 / 发布站实现。
 * 运行：`pnpm run build && pnpm --filter @trade-signal/research-strategies run test:v2-layer-guard`
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { bootstrapV2PluginRegistry, listRegisteredPolicyIds, listRegisteredTopicIds } from "../v2/index.js";

const FORBIDDEN_IMPORT_RE =
  /from\s+["'](?:\.\.\/)+(runtime|steps|reports-site|strategy|cli|quality)\/[^"']+["']/u;

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) out.push(...walkTsFiles(p));
    else if (name.isFile() && name.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

function main(): void {
  const here = fileURLToPath(new URL(".", import.meta.url));
  const v2Root = join(here, "..", "v2");
  const files = walkTsFiles(v2Root);
  assert.ok(files.length > 0, "expected src/v2/**/*.ts");
  for (const f of files) {
    const txt = readFileSync(f, "utf-8");
    const m = txt.match(FORBIDDEN_IMPORT_RE);
    assert.equal(
      m,
      null,
      `[v2-layer-guard] forbidden import in ${f}: ${m?.[0] ?? ""}`,
    );
  }

  bootstrapV2PluginRegistry();
  assert.ok(listRegisteredPolicyIds().includes("policy:turtle"));
  assert.ok(listRegisteredTopicIds().includes("topic:business-six-dimension"));
  console.log("[test:v2-layer-guard] ok");
}

main();
