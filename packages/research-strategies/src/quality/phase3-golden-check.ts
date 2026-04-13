#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

type ManifestEntry = {
  sha256: string;
  bytes: number;
};

type GoldenManifest = Record<string, ManifestEntry>;

function resolveArg(argv: string[], key: string, defaultValue: string): string {
  const idx = argv.indexOf(key);
  if (idx >= 0) {
    const value = argv[idx + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
    return value;
  }
  return defaultValue;
}

async function checksum(filePath: string): Promise<{ sha256: string; bytes: number }> {
  const buf = await readFile(filePath);
  return {
    sha256: createHash("sha256").update(buf).digest("hex"),
    bytes: buf.byteLength,
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const explicit = argv.includes("--manifest")
    ? path.resolve(resolveArg(argv, "--manifest", "output/phase3_golden/run/golden_manifest.json"))
    : undefined;
  const manifestPath =
    explicit ??
    [
      path.resolve(process.cwd(), "output/phase3_golden/run/golden_manifest.json"),
      path.resolve(process.cwd(), "../../output/phase3_golden/run/golden_manifest.json"),
    ].find((candidate) => existsSync(candidate));

  if (!manifestPath) {
    throw new Error(
      "Cannot find golden_manifest.json. Try --manifest <absolute-or-relative-path>.",
    );
  }

  const manifestRaw = await readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(manifestRaw) as GoldenManifest;
  const baseDir = path.dirname(manifestPath);

  const failures: string[] = [];
  for (const [name, expected] of Object.entries(manifest)) {
    const filePath = path.join(baseDir, name);
    const actual = await checksum(filePath);
    if (actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes) {
      failures.push(
        `${name}: expected sha256=${expected.sha256},bytes=${expected.bytes}; got sha256=${actual.sha256},bytes=${actual.bytes}`,
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(`Phase3 golden check failed\n${failures.join("\n")}`);
  }

  console.log(`[quality] phase3 golden check passed (${Object.keys(manifest).length} files)`);
}

void main();
