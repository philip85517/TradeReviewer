import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readlink, rename, rm, symlink } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { spawn } from "node:child_process";
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

async function assertSafeStagingPath(path, targetRoot, label) {
  let details;
  try {
    details = await lstat(path);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  if (details.isSymbolicLink()) throw new Error(`${label} must not be a symlink`);
  if (!details.isDirectory()) throw new Error(`${label} must be a directory`);

  const canonicalPath = canonicalizePath(path);
  if (!isDescendant(canonicalPath, targetRoot)) {
    throw new Error(`${label} resolves outside the deployment target`);
  }
}

async function assertSafeStagingRoots(paths, targetRoot) {
  await assertSafeStagingPath(paths.appDir, targetRoot, "Deployment app path");
  await assertSafeStagingPath(paths.releasesDir, targetRoot, "Deployment releases path");
}

async function reserveReleaseDirectory(releasesDir, sourceDir, now) {
  const baseReleaseId = createReleaseId(sourceDir, now);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const releaseId = attempt === 0 ? baseReleaseId : `${baseReleaseId}-${attempt}`;
    const releaseDir = join(releasesDir, releaseId);
    try {
      await mkdir(releaseDir);
      return { releaseId, releaseDir };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  throw new Error(`Unable to allocate a unique release under ${releasesDir}`);
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

function validateReleaseId(releaseId, label = "Release ID") {
  if (!releaseId || basename(releaseId) !== releaseId || releaseId === "." || releaseId === "..") {
    throw new Error(`${label} must name a single release`);
  }
  return releaseId;
}

function releaseContext(releaseId) {
  return { APP_RELEASE_CONTEXT: `./app/releases/${validateReleaseId(releaseId)}` };
}

function defaultCommandRunner(command, args, options = {}) {
  const environment = { ...process.env, ...options.env };
  delete environment.COMPOSE_PROJECT_NAME;

  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", rejectCommand);
    child.on("close", (exitCode) => resolveCommand({ exitCode, stdout, stderr }));
  });
}

function commandExitCode(result) {
  if (!result || typeof result !== "object") return 0;
  return result.exitCode ?? result.code ?? result.status ?? 0;
}

function commandOutput(result) {
  if (!result || typeof result !== "object") return "";
  return result.stdout ?? result.output ?? "";
}

export function createComposeRunner({ targetDir, env = {}, commandRunner = defaultCommandRunner }) {
  const rootDir = resolve(targetDir);
  const composeArguments = [
    "compose",
    "--project-directory",
    rootDir,
    "--file",
    join(rootDir, "compose.yaml"),
    "--env-file",
    join(rootDir, "config", ".env"),
  ];

  return async (args, commandEnv = {}) => {
    const result = await commandRunner("docker", [...composeArguments, ...args], {
      cwd: rootDir,
      env: { ...env, ...commandEnv },
    });
    if (commandExitCode(result) !== 0) {
      throw new Error(`Docker Compose ${args[0]} failed`);
    }
    return result;
  };
}

export async function buildAndStartRelease({ targetDir, releaseId, composeRunner }) {
  resolve(targetDir);
  const context = releaseContext(releaseId);
  await composeRunner(["build"], context);
  await composeRunner(["up", "--detach"], context);
}

function parseComposeServices(output) {
  const text = String(output).trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return text
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
}

function serviceHealth(service) {
  return String(service.Health ?? service.health ?? service.State ?? service.state ?? "").toLowerCase();
}

function sleep(milliseconds) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

export async function waitForHealthy({ targetDir, timeoutMs, composeRunner }) {
  resolve(targetDir);
  const timeout = timeoutMs ?? 60_000;
  const deadline = Date.now() + timeout;

  while (true) {
    const result = await composeRunner(["ps", "--format", "json"]);
    const healthStates = parseComposeServices(commandOutput(result)).map(serviceHealth);
    if (healthStates.includes("unhealthy")) throw new Error("Docker Compose service is unhealthy");
    if (healthStates.length > 0 && healthStates.every((health) => health === "healthy")) return;
    if (Date.now() >= deadline) throw new Error("Docker Compose health check timed out");
    await sleep(Math.min(1_000, deadline - Date.now()));
  }
}

async function pointCurrentAtRelease(paths, releaseId) {
  const temporaryLink = join(paths.appDir, `.current-${releaseId}-${process.pid}.tmp`);
  await rm(temporaryLink, { force: true });
  await symlink(join("releases", releaseId), temporaryLink);
  await rename(temporaryLink, paths.currentLink);
}

export async function rollbackRelease({ targetDir, releaseId, previousRelease, composeRunner }) {
  const rootDir = canonicalizePath(targetDir);
  const paths = resolveDeploymentPaths(rootDir);
  validateReleaseId(releaseId);
  await assertSafeStagingRoots(paths, rootDir);

  if (previousRelease) {
    validateReleaseId(previousRelease, "Previous release ID");
    await pointCurrentAtRelease(paths, previousRelease);
    const previousContext = releaseContext(previousRelease);
    await composeRunner(["build"], previousContext);
    await composeRunner(["up", "--detach"], previousContext);
  }

  await rm(join(paths.releasesDir, releaseId), { recursive: true, force: true });
}

function lifecycleAcceptance(targetDir, dependencies) {
  const composeRunner =
    dependencies.composeRunner ??
    createComposeRunner({ targetDir, env: dependencies.env, commandRunner: dependencies.commandRunner });

  return async (release) => {
    try {
      await buildAndStartRelease({ ...release, targetDir, composeRunner });
      await waitForHealthy({ targetDir, timeoutMs: dependencies.healthTimeoutMs, composeRunner });
      return true;
    } catch (error) {
      await rollbackRelease({ ...release, targetDir, composeRunner }).catch(() => undefined);
      throw error;
    }
  };
}

export async function runDeployment(options, dependencies = {}) {
  const { mode = "full", sourceDir = process.cwd(), targetDir = DEFAULT_DEPLOY_ROOT, dryRun = false } = options;
  const policy = getSyncPolicy(mode);
  const resolvedPaths = validateDeploymentPaths(sourceDir, targetDir);
  const paths = resolveDeploymentPaths(resolvedPaths.targetDir);
  await assertSafeStagingRoots(paths, resolvedPaths.targetDir);

  if (dryRun) {
    const releaseId = createReleaseId(resolvedPaths.sourceDir, options.now);
    return { mode, policy, paths, releaseId, releaseDir: join(paths.releasesDir, releaseId), dryRun: true };
  }

  let releaseDir;
  let temporaryLink;
  let releaseReserved = false;

  try {
    await mkdir(paths.releasesDir, { recursive: true });
    await assertSafeStagingRoots(paths, resolvedPaths.targetDir);
    const allocation = await reserveReleaseDirectory(paths.releasesDir, resolvedPaths.sourceDir, options.now);
    const { releaseId } = allocation;
    releaseDir = allocation.releaseDir;
    releaseReserved = true;

    await cp(resolvedPaths.sourceDir, releaseDir, {
      recursive: true,
      force: true,
      filter: applicationFilter(resolvedPaths.sourceDir),
    });

    if (policy.copyRuntimeFiles) {
      await Promise.all([
        copyIfPresent(join(resolvedPaths.sourceDir, "deploy"), paths.opsDir),
        copyIfPresent(join(resolvedPaths.sourceDir, "Makefile"), join(resolvedPaths.targetDir, "Makefile")),
      ]);
    }

    const previousRelease = await readPreviousRelease(paths.currentLink);
    temporaryLink = join(paths.appDir, `.current-${releaseId}-${process.pid}.tmp`);
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
    const acceptRelease =
      options.acceptRelease ??
      dependencies.acceptRelease ??
      (dependencies.commandRunner || dependencies.composeRunner ? lifecycleAcceptance(resolvedPaths.targetDir, dependencies) : undefined);
    const accepted = await shouldAcceptRelease(acceptRelease, release);

    if (accepted) {
      await rename(temporaryLink, paths.currentLink);
      temporaryLink = undefined;
      return { ...release, activeRelease: releaseId, accepted: true };
    }

    await rm(temporaryLink, { force: true });
    temporaryLink = undefined;
    return { ...release, accepted: false };
  } catch (error) {
    if (temporaryLink) await rm(temporaryLink, { force: true }).catch(() => undefined);
    if (releaseReserved) await rm(releaseDir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runDeployment(parseArgs(process.argv.slice(2)))
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
