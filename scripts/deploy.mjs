import { createHash } from "node:crypto";
import { cp, mkdir, readlink, rename, rm, symlink } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_DEPLOY_ROOT = "/Users/zhoulin/projects/TradeReview";

const APPLICATION_EXCLUSIONS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".wrangler",
  "data",
  "logs",
  "config",
  "trades",
  ".superpowers",
]);

function optionValue(argv, index, flag) {
  const argument = argv[index];
  if (argument === flag) {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
    return { value, nextIndex: index + 1 };
  }

  const prefix = `${flag}=`;
  if (argument.startsWith(prefix)) {
    const value = argument.slice(prefix.length);
    if (!value) throw new Error(`${flag} requires a value`);
    return { value, nextIndex: index };
  }

  return undefined;
}

export function parseArgs(argv) {
  const options = {
    mode: "full",
    sourceDir: resolve(process.cwd()),
    targetDir: DEFAULT_DEPLOY_ROOT,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    const mode = optionValue(argv, index, "--mode");
    const source = optionValue(argv, index, "--source");
    const target = optionValue(argv, index, "--target");
    const backup = optionValue(argv, index, "--backup");
    const option = mode ?? source ?? target ?? backup;

    if (!option) throw new Error(`Unknown deployment option: ${argument}`);
    index = option.nextIndex;
    if (mode) options.mode = mode.value;
    if (source) options.sourceDir = resolve(source.value);
    if (target) options.targetDir = resolve(target.value);
    if (backup) options.backupPath = resolve(backup.value);
  }

  return options;
}

export function resolveDeploymentPaths(targetDir) {
  const rootDir = resolve(targetDir);
  const appDir = join(rootDir, "app");

  return {
    appDir,
    releasesDir: join(appDir, "releases"),
    currentLink: join(appDir, "current"),
    configDir: join(rootDir, "config"),
    dataDir: join(rootDir, "data"),
    backupsDir: join(rootDir, "backups"),
    logsDir: join(rootDir, "logs"),
    opsDir: join(rootDir, "deploy"),
  };
}

function canonicalizePath(inputPath) {
  const absolutePath = resolve(inputPath);
  const missingSegments = [];
  let candidate = absolutePath;

  while (true) {
    try {
      return resolve(realpathSync(candidate), ...missingSegments.reverse());
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = dirname(candidate);
      if (parent === candidate) return absolutePath;
      missingSegments.push(basename(candidate));
      candidate = parent;
    }
  }
}

function isDescendant(childPath, parentPath) {
  const pathRelativeToParent = relative(parentPath, childPath);
  return (
    pathRelativeToParent !== "" &&
    pathRelativeToParent !== ".." &&
    !pathRelativeToParent.startsWith(`..${sep}`) &&
    !pathRelativeToParent.startsWith(`..${"/"}`)
  );
}

export function validateDeploymentPaths(sourceDir, targetDir) {
  if (!sourceDir || !targetDir) throw new Error("Deployment source and target paths are required");

  const sourcePath = canonicalizePath(sourceDir);
  const targetPath = canonicalizePath(targetDir);
  if (sourcePath === targetPath) throw new Error("Deployment source and target paths must differ");
  if (isDescendant(targetPath, sourcePath) || isDescendant(sourcePath, targetPath)) {
    throw new Error("Deployment source and target paths must not be inside one another");
  }

  return { sourceDir: sourcePath, targetDir: targetPath };
}

export function getSyncPolicy(mode) {
  if (mode === "full" || mode === "deploy") {
    return {
      copyApplication: true,
      copyRuntimeFiles: true,
      preserveStorage: true,
      preserveConfig: true,
    };
  }
  if (mode === "code") {
    return {
      copyApplication: true,
      copyRuntimeFiles: false,
      preserveStorage: true,
      preserveConfig: true,
    };
  }
  throw new Error(`Unsupported deployment mode: ${mode}`);
}

export function createReleaseId(sourceDir, now = new Date()) {
  if (Number.isNaN(now.getTime())) throw new Error("Release time must be valid");
  const timestamp = [
    now.getUTCFullYear().toString().padStart(4, "0"),
    (now.getUTCMonth() + 1).toString().padStart(2, "0"),
    now.getUTCDate().toString().padStart(2, "0"),
  ].join("");
  const time = [
    now.getUTCHours().toString().padStart(2, "0"),
    now.getUTCMinutes().toString().padStart(2, "0"),
    now.getUTCSeconds().toString().padStart(2, "0"),
    now.getUTCMilliseconds().toString().padStart(3, "0"),
  ].join("");
  const sourceHash = createHash("sha256").update(resolve(sourceDir)).digest("hex").slice(0, 10);
  return `${timestamp}T${time}Z-${sourceHash}`;
}

function applicationFilter(sourceDir) {
  return (sourcePath) => {
    const sourceRelativePath = relative(sourceDir, sourcePath);
    if (sourceRelativePath === "") return true;
    return !sourceRelativePath.split(sep).some((segment) => APPLICATION_EXCLUSIONS.has(segment));
  };
}

async function copyIfPresent(sourcePath, targetPath) {
  try {
    await cp(sourcePath, targetPath, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function readPreviousRelease(currentLink) {
  try {
    return basename(await readlink(currentLink));
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

async function shouldAcceptRelease(acceptRelease, release) {
  if (typeof acceptRelease === "function") return Boolean(await acceptRelease(release));
  return acceptRelease === true;
}

export async function runDeployment(options, dependencies = {}) {
  const { mode = "full", sourceDir = process.cwd(), targetDir = DEFAULT_DEPLOY_ROOT, dryRun = false } = options;
  const policy = getSyncPolicy(mode);
  const resolvedPaths = validateDeploymentPaths(sourceDir, targetDir);
  const paths = resolveDeploymentPaths(resolvedPaths.targetDir);
  const releaseId = createReleaseId(resolvedPaths.sourceDir, options.now);
  const releaseDir = join(paths.releasesDir, releaseId);

  if (dryRun) {
    return { mode, policy, paths, releaseId, releaseDir, dryRun: true };
  }

  await mkdir(paths.releasesDir, { recursive: true });
  await cp(resolvedPaths.sourceDir, releaseDir, {
    recursive: true,
    force: false,
    errorOnExist: true,
    filter: applicationFilter(resolvedPaths.sourceDir),
  });

  if (policy.copyRuntimeFiles) {
    await Promise.all([
      copyIfPresent(join(resolvedPaths.sourceDir, "deploy"), paths.opsDir),
      copyIfPresent(join(resolvedPaths.sourceDir, "Makefile"), join(resolvedPaths.targetDir, "Makefile")),
    ]);
  }

  const previousRelease = await readPreviousRelease(paths.currentLink);
  const temporaryLink = join(paths.appDir, `.current-${releaseId}-${process.pid}.tmp`);
  await symlink(join("releases", releaseId), temporaryLink);

  const release = {
    mode,
    policy,
    paths,
    releaseId,
    releaseDir,
    previousRelease,
    activeRelease: previousRelease,
    staged: true,
  };
  const acceptRelease = options.acceptRelease ?? dependencies.acceptRelease;
  const accepted = await shouldAcceptRelease(acceptRelease, release);

  if (accepted) {
    await rename(temporaryLink, paths.currentLink);
    return { ...release, activeRelease: releaseId, accepted: true };
  }

  await rm(temporaryLink, { force: true });
  return { ...release, accepted: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runDeployment(parseArgs(process.argv.slice(2)))
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
