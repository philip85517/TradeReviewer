import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readdir, readlink, rename, rm, symlink } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { spawn } from "node:child_process";
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
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

const OPERATION_SCRIPTS = Object.freeze({
  status: "status.sh",
  backup: "backup-db.sh",
  restore: "restore-db.sh",
  healthcheck: "healthcheck.sh",
});

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
    if (target) options.targetDir = target.value;
    if (backup) options.backupPath = backup.value;
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
    backupsDir: join(rootDir, "data", "backups"),
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

export async function validateMutatingTarget(targetDir) {
  if (!targetDir || !isAbsolute(targetDir)) {
    throw new Error("Deployment target path must be absolute");
  }

  const configuredTarget = resolve(targetDir);
  if (configuredTarget === parse(configuredTarget).root) {
    throw new Error("Deployment target must not be the filesystem root");
  }

  try {
    const details = await lstat(configuredTarget);
    if (details.isSymbolicLink() || !details.isDirectory()) {
      throw new Error("Deployment target must be a non-symlink directory");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const canonicalTarget = canonicalizePath(configuredTarget);
  if (canonicalTarget === parse(canonicalTarget).root) {
    throw new Error("Deployment target must not be the filesystem root");
  }
  return canonicalTarget;
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

export async function readActiveRelease(targetDir) {
  return readPreviousRelease(resolveDeploymentPaths(resolve(targetDir)).currentLink);
}

export async function acquireDeploymentLock(targetDir) {
  const rootDir = await validateMutatingTarget(targetDir);
  const lockDir = join(rootDir, ".deploy-lock");

  try {
    await mkdir(rootDir, { recursive: true });
    await mkdir(lockDir);
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(`Deployment operation is already running for ${rootDir}`);
    }
    throw error;
  }

  let released = false;
  return async () => {
    if (released) return;
    released = true;
    await rm(lockDir, { recursive: true, force: true });
  };
}

async function withDeploymentLock(targetDir, operation) {
  const releaseLock = await acquireDeploymentLock(targetDir);
  try {
    return await operation();
  } finally {
    await releaseLock();
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

export async function runOperationalCommand({ targetDir, mode, backupPath }, { operationRunner = defaultCommandRunner } = {}) {
  const scriptName = OPERATION_SCRIPTS[mode];
  if (!scriptName) throw new Error(`Unsupported deployment operation: ${mode}`);

  let safeBackupPath;
  if (mode === "restore") {
    if (!backupPath || !isAbsolute(backupPath)) {
      throw new Error("Restore requires an absolute regular file backup path");
    }
    try {
      const details = await lstat(backupPath);
      if (details.isSymbolicLink() || !details.isFile()) {
        throw new Error("Restore requires an absolute regular file backup path");
      }
    } catch (error) {
      if (error.code === "ENOENT") throw new Error("Restore requires an absolute regular file backup path");
      throw error;
    }
    safeBackupPath = resolve(backupPath);
  }

  const rootDir =
    mode === "status" || mode === "healthcheck" ? resolve(targetDir) : await validateMutatingTarget(targetDir);
  const scriptPath = join(rootDir, "deploy", "ops", scriptName);
  const args = mode === "restore" ? [safeBackupPath] : [];

  const result = await operationRunner(scriptPath, args, { cwd: rootDir });
  if (commandExitCode(result) !== 0) throw new Error(`Deployment operation ${mode} failed`);
  return result;
}

function createTargetComposeRunner(targetDir, dependencies) {
  return (
    dependencies.composeRunner ??
    createComposeRunner({ targetDir, env: dependencies.env, commandRunner: dependencies.commandRunner })
  );
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
  const composeRunner = createTargetComposeRunner(targetDir, dependencies);

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

async function releaseDirectories(paths) {
  try {
    const entries = await readdir(paths.releasesDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
      .map((entry) => validateReleaseId(entry.name))
      .sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function rollbackToPreviousRelease({ targetDir, healthTimeoutMs }, dependencies = {}) {
  const rootDir = await validateMutatingTarget(targetDir);
  const paths = resolveDeploymentPaths(rootDir);
  await assertSafeStagingRoots(paths, rootDir);
  const activeRelease = await readActiveRelease(rootDir);
  if (!activeRelease) throw new Error("Cannot roll back without an active release");

  const releases = await releaseDirectories(paths);
  const activeIndex = releases.indexOf(activeRelease);
  const previousRelease = activeIndex > 0 ? releases[activeIndex - 1] : undefined;
  if (!previousRelease) throw new Error("Cannot roll back without a previous release");

  const composeRunner = createTargetComposeRunner(rootDir, dependencies);
  await buildAndStartRelease({ targetDir: rootDir, releaseId: previousRelease, composeRunner });
  await waitForHealthy({ targetDir: rootDir, timeoutMs: healthTimeoutMs, composeRunner });
  await pointCurrentAtRelease(paths, previousRelease);
  return { targetDir: rootDir, activeRelease: previousRelease, previousRelease: activeRelease };
}

export async function stopDeployment({ targetDir }, dependencies = {}) {
  const rootDir = await validateMutatingTarget(targetDir);
  const composeRunner = createTargetComposeRunner(rootDir, dependencies);
  await composeRunner(["down"]);
  return { targetDir: rootDir, activeRelease: await readActiveRelease(rootDir) };
}

async function initializeDeploymentConfig({ sourceDir, targetDir }) {
  const resolvedPaths = validateDeploymentPaths(sourceDir, targetDir);
  const paths = resolveDeploymentPaths(resolvedPaths.targetDir);
  await assertSafeStagingPath(paths.configDir, resolvedPaths.targetDir, "Deployment config path");
  await mkdir(paths.configDir, { recursive: true });
  await assertSafeStagingPath(paths.configDir, resolvedPaths.targetDir, "Deployment config path");

  const envPath = join(paths.configDir, ".env");
  try {
    const envDetails = await lstat(envPath);
    if (envDetails.isSymbolicLink() || !envDetails.isFile()) {
      throw new Error("Deployment configuration must be a regular file");
    }
    return { targetDir: resolvedPaths.targetDir, configPath: envPath, created: false };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const templatePath = join(resolvedPaths.sourceDir, "deploy", "config", ".env.example");
  const templateDetails = await lstat(templatePath);
  if (templateDetails.isSymbolicLink() || !templateDetails.isFile()) {
    throw new Error("Deployment configuration template must be a regular file");
  }
  await cp(templatePath, envPath, { force: false });
  return { targetDir: resolvedPaths.targetDir, configPath: envPath, created: true };
}

function isMutatingMode(mode) {
  return mode === "full" || mode === "deploy" || mode === "code" || mode === "backup" || mode === "restore" || mode === "rollback" || mode === "down" || mode === "config";
}

export async function runDeployment(options, dependencies = {}) {
  const { mode = "full", sourceDir = process.cwd(), targetDir = DEFAULT_DEPLOY_ROOT, dryRun = false } = options;
  if (OPERATION_SCRIPTS[mode]) {
    const operation = () =>
      runOperationalCommand(
        { targetDir, mode, backupPath: options.backupPath },
        { operationRunner: dependencies.operationRunner ?? dependencies.commandRunner },
      );
    return mode === "status" || mode === "healthcheck" ? operation() : withDeploymentLock(targetDir, operation);
  }
  if (mode === "rollback") {
    return withDeploymentLock(targetDir, () =>
      rollbackToPreviousRelease({ targetDir, healthTimeoutMs: options.healthTimeoutMs }, dependencies),
    );
  }
  if (mode === "down") return withDeploymentLock(targetDir, () => stopDeployment({ targetDir }, dependencies));
  if (mode === "config") {
    const safeTargetDir = await validateMutatingTarget(targetDir);
    const resolvedPaths = validateDeploymentPaths(sourceDir, safeTargetDir);
    return withDeploymentLock(resolvedPaths.targetDir, () =>
      initializeDeploymentConfig({ sourceDir: resolvedPaths.sourceDir, targetDir: resolvedPaths.targetDir }),
    );
  }
  const policy = getSyncPolicy(mode);
  const safeTargetDir = await validateMutatingTarget(targetDir);
  const resolvedPaths = validateDeploymentPaths(sourceDir, safeTargetDir);
  const paths = resolveDeploymentPaths(resolvedPaths.targetDir);
  await assertSafeStagingRoots(paths, resolvedPaths.targetDir);

  if (dryRun) {
    const releaseId = createReleaseId(resolvedPaths.sourceDir, options.now);
    return { mode, policy, paths, releaseId, releaseDir: join(paths.releasesDir, releaseId), dryRun: true };
  }

  return withDeploymentLock(resolvedPaths.targetDir, async () => {
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
          copyIfPresent(join(resolvedPaths.sourceDir, "deploy", "compose.yaml"), join(resolvedPaths.targetDir, "compose.yaml")),
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
        (dependencies.commandRunner || dependencies.composeRunner
          ? lifecycleAcceptance(resolvedPaths.targetDir, dependencies)
          : undefined);
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
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2));
  runDeployment(options, { commandRunner: defaultCommandRunner })
    .then(async (result) => {
      process.stdout.write(`${JSON.stringify(result)}\n`);
      if (isMutatingMode(options.mode)) {
        const activeRelease = result.activeRelease ?? (await readActiveRelease(options.targetDir)) ?? "none";
        process.stdout.write(`Deployment target: ${resolve(options.targetDir)}\nActive release: ${activeRelease}\n`);
      }
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
