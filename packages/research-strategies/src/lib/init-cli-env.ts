import { existsSync } from "node:fs";
import path from "node:path";

import { config as loadDotenv } from "dotenv";

/**
 * 在 CLI / 可执行脚本启动时加载仓库根或当前工作目录下的 `.env`。
 *
 * - 候选顺序：`cwd/.env` → `cwd/../../.env`（与 monorepo 下从 `packages/research-strategies` 执行时指向仓库根一致）
 * - 命中第一个存在的文件后即停止（与历史 `initPhase0CliEnv` / Phase1B `initEnv` 行为一致）
 * - dotenv 默认不覆盖已在 `process.env` 中的变量
 */
export function initCliEnv(cwd: string = process.cwd()): void {
  const candidates = [path.resolve(cwd, ".env"), path.resolve(cwd, "../../.env")];
  for (const filePath of candidates) {
    if (existsSync(filePath)) {
      loadDotenv({ path: filePath });
      break;
    }
  }
}
