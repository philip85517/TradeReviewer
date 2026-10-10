import { lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

export const DESIGN_PREVIEW_FLAG = "isolated";
export const DESIGN_PREVIEW_DATABASE_RELATIVE_PATH = ".scratch/local-review-20261006/review.sqlite";

type RuntimeFileStats = {
  isFile: () => boolean;
  isSymbolicLink: () => boolean;
};

export type RuntimeFileSystem = {
  lstatSync: (path: string) => RuntimeFileStats;
  realpathSync: (path: string) => string;
};

export type DesignPreviewRuntimeResult = {
  allowed: boolean;
  expectedDatabasePath: string;
  reason?: string;
};

export function expectedDesignPreviewDatabasePath(cwd: string = process.cwd()): string {
  return resolve(cwd, DESIGN_PREVIEW_DATABASE_RELATIVE_PATH);
}

function rejected(expectedDatabasePath: string, reason: string): DesignPreviewRuntimeResult {
  return { allowed: false, expectedDatabasePath, reason };
}

export function checkDesignPreviewRuntime(options: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  fileSystem?: RuntimeFileSystem;
} = {}): DesignPreviewRuntimeResult {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const fileSystem = options.fileSystem ?? { lstatSync, realpathSync };
  const expectedDatabasePath = expectedDesignPreviewDatabasePath(cwd);

  if (env.TRADEREVIEW_DESIGN_PREVIEW !== DESIGN_PREVIEW_FLAG) {
    return rejected(expectedDatabasePath, "设计预览未启用：需要明确设置隔离预览标记。");
  }

  const configuredDatabasePath = env.TRADEREVIEW_DB_PATH;
  if (!configuredDatabasePath || !isAbsolute(configuredDatabasePath) || configuredDatabasePath !== expectedDatabasePath) {
    return rejected(expectedDatabasePath, "设计预览未启用：数据库路径必须精确指向当前工作树的隔离副本。");
  }

  let stats: RuntimeFileStats;
  try {
    stats = fileSystem.lstatSync(expectedDatabasePath);
  } catch {
    return rejected(expectedDatabasePath, "设计预览未启用：隔离数据库文件不存在。");
  }

  if (stats.isSymbolicLink()) {
    return rejected(expectedDatabasePath, "设计预览未启用：隔离数据库必须是非符号链接普通文件。");
  }

  if (!stats.isFile()) {
    return rejected(expectedDatabasePath, "设计预览未启用：隔离数据库必须是普通文件。");
  }

  let actualDatabasePath: string;
  try {
    actualDatabasePath = fileSystem.realpathSync(expectedDatabasePath);
  } catch {
    return rejected(expectedDatabasePath, "设计预览未启用：无法确认隔离数据库的真实路径。");
  }

  if (actualDatabasePath !== expectedDatabasePath) {
    return rejected(expectedDatabasePath, "设计预览未启用：隔离数据库的真实路径必须与预期副本一致。");
  }

  return { allowed: true, expectedDatabasePath };
}
