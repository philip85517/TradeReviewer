import { createHash, randomUUID } from "node:crypto";
import { chmod, cp, lstat, mkdir, readFile, readdir, readlink, rename, rm, symlink, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { spawn } from "node:child_process";
import { hostname as osHostname } from "node:os";
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_DEPLOY_ROOT = "/Users/zhoulin/projects/TradeReview";

const APPLICATION_ROOT_EXCLUSIONS = new Set([
  ".git",
  "node_modules",
  "dist",
  ".next",
  ".vinext",
  ".wrangler",
  "data",
  "logs",
  "config",
  "trades",
  ".superpowers",
]);

const PRIVATE_CREDENTIAL_NAMES = new Set([
  ".dockercfg",
  ".netrc",
  ".npmrc",
  "credentials.json",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "id_rsa",
  "service-account.json",
]);

const PRIVATE_CREDENTIAL_EXTENSIONS = [".der", ".jks", ".key", ".keystore", ".p12", ".pem", ".pfx", ".pkcs8", ".pkcs12"];

const OPERATION_SCRIPTS = Object.freeze({
  status: "status.sh",
  backup: "backup-db.sh",
  restore: "restore-db.sh",
  healthcheck: "healthcheck.sh",
});

const TARGET_OPERATION_FILES = Object.freeze([
  "backup-db.sh",
  "deploy.sh",
  "healthcheck.sh",
  "restore-db.sh",
  "run-command.mjs",
  "status.sh",
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
    opsDir: join(rootDir, "ops"),
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
  const sourceRelativeToTarget = relative(targetPath, sourcePath);
  const sourceSegments = sourceRelativeToTarget.split(sep);
  const sourceIsManagedRelease =
    sourceSegments.length === 3 &&
    sourceSegments[0] === "app" &&
    sourceSegments[1] === "releases" &&
    basename(sourceSegments[2]) === sourceSegments[2];
  if (isDescendant(targetPath, sourcePath) || (isDescendant(sourcePath, targetPath) && !sourceIsManagedRelease)) {
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
    const [rootSegment] = sourceRelativePath.split(sep);
    if (APPLICATION_ROOT_EXCLUSIONS.has(rootSegment)) return false;

    const filename = basename(sourceRelativePath).toLowerCase();
    if (filename === ".env.example") return true;
    if (filename === ".env" || filename.startsWith(".env.")) return false;
    if (PRIVATE_CREDENTIAL_NAMES.has(filename)) return false;
    return !PRIVATE_CREDENTIAL_EXTENSIONS.some((extension) => filename.endsWith(extension));
  };
}

async function copyIfPresent(sourcePath, targetPath) {
  try {
    await cp(sourcePath, targetPath, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function assertRegularFile(path, label) {
  const details = await lstat(path);
  if (details.isSymbolicLink() || !details.isFile()) throw new Error(`${label} must be a regular file`);
}

async function copyRuntimeFiles({ sourceDir, targetDir, paths }) {
  await mkdir(paths.opsDir, { recursive: true, mode: 0o700 });
  await assertSafeStagingPath(paths.opsDir, targetDir, "Deployment operations path");

  const targetMakefile = join(sourceDir, "deploy", "target", "Makefile");
  let makefileSource = targetMakefile;
  try {
    await assertRegularFile(targetMakefile, "Target deployment Makefile");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    makefileSource = join(sourceDir, "Makefile");
  }

  await Promise.all([
    copyIfPresent(join(sourceDir, "deploy", "compose.yaml"), join(targetDir, "compose.yaml")),
    copyIfPresent(makefileSource, join(targetDir, "Makefile")),
    copyIfPresent(join(sourceDir, "deploy", "DEPLOYMENT.md"), join(targetDir, "DEPLOYMENT.md")),
    copyIfPresent(join(sourceDir, "scripts", "deploy.mjs"), join(paths.opsDir, "deploy.mjs")),
    ...TARGET_OPERATION_FILES.map((filename) =>
      copyIfPresent(join(sourceDir, "deploy", "ops", filename), join(paths.opsDir, filename)),
    ),
  ]);
}

async function initializeConfigFiles({ sourceDir, targetDir, paths }) {
  await assertSafeStagingPath(paths.configDir, targetDir, "Deployment config path");
  await mkdir(paths.configDir, { recursive: true, mode: 0o700 });
  await assertSafeStagingPath(paths.configDir, targetDir, "Deployment config path");

  const templatePath = join(sourceDir, "deploy", "config", ".env.example");
  await assertRegularFile(templatePath, "Deployment configuration template");
  const targetTemplatePath = join(paths.configDir, ".env.example");
  await cp(templatePath, targetTemplatePath, { force: true });

  const envPath = join(paths.configDir, ".env");
  try {
    await assertRegularFile(envPath, "Deployment configuration");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await cp(templatePath, envPath, { force: false });
  }
  await chmod(envPath, 0o600);
  return envPath;
}

async function initializeFullDeployment({ sourceDir, targetDir, paths }) {
  await initializeConfigFiles({ sourceDir, targetDir, paths });
  for (const [path, label] of [
    [paths.dataDir, "Deployment data path"],
    [join(paths.dataDir, "sqlite"), "Deployment SQLite path"],
    [paths.backupsDir, "Deployment backups path"],
    [paths.logsDir, "Deployment logs path"],
  ]) {
    await assertSafeStagingPath(path, targetDir, label);
    await mkdir(path, { recursive: true, mode: 0o700 });
    await assertSafeStagingPath(path, targetDir, label);
  }

  const databasePath = join(paths.dataDir, "sqlite", "tradereview.sqlite");
  try {
    await assertRegularFile(databasePath, "Deployment SQLite database");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeFile(databasePath, "", { flag: "wx", mode: 0o600 });
  }
  await chmod(databasePath, 0o600);
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

async function beginRuntimeTransaction({ targetDir, paths }) {
  const snapshotDir = join(targetDir, `.runtime-snapshot-${process.pid}-${Date.now()}`);
  await mkdir(snapshotDir, { mode: 0o700 });
  const entries = [
    { name: "compose.yaml", targetPath: join(targetDir, "compose.yaml"), kind: "file" },
    { name: "Makefile", targetPath: join(targetDir, "Makefile"), kind: "file" },
    { name: "DEPLOYMENT.md", targetPath: join(targetDir, "DEPLOYMENT.md"), kind: "file" },
    { name: "env.example", targetPath: join(paths.configDir, ".env.example"), kind: "file" },
    { name: "ops", targetPath: paths.opsDir, kind: "directory" },
  ];
  const captured = [];

  try {
    for (const entry of entries) {
      let details;
      try {
        details = await lstat(entry.targetPath);
      } catch (error) {
        if (error.code === "ENOENT") {
          captured.push({ ...entry, existed: false });
          continue;
        }
        throw error;
      }
      if (details.isSymbolicLink()) throw new Error(`Runtime path must not be a symlink: ${entry.targetPath}`);
      if (entry.kind === "file" && !details.isFile()) {
        throw new Error(`Runtime path must be a regular file: ${entry.targetPath}`);
      }
      if (entry.kind === "directory" && !details.isDirectory()) {
        throw new Error(`Runtime path must be a directory: ${entry.targetPath}`);
      }
      const snapshotPath = join(snapshotDir, entry.name);
      await cp(entry.targetPath, snapshotPath, { recursive: entry.kind === "directory", force: false });
      captured.push({ ...entry, existed: true, snapshotPath });
    }
  } catch (error) {
    await rm(snapshotDir, { recursive: true, force: true });
    throw error;
  }

  let finished = false;
  return {
    async restore() {
      if (finished) return;
      for (const entry of captured) {
        try {
          const details = await lstat(entry.targetPath);
          if (details.isSymbolicLink()) throw new Error(`Runtime path became a symlink: ${entry.targetPath}`);
          await rm(entry.targetPath, { recursive: details.isDirectory(), force: true });
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
        if (entry.existed) {
          await mkdir(dirname(entry.targetPath), { recursive: true });
          await cp(entry.snapshotPath, entry.targetPath, {
            recursive: entry.kind === "directory",
            force: false,
          });
        }
      }
      await rm(snapshotDir, { recursive: true, force: true });
      finished = true;
    },
    async discard() {
      if (finished) return;
      await rm(snapshotDir, { recursive: true, force: true });
      finished = true;
    },
  };
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

function localProcessIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    if (error.code === "EPERM") return true;
    throw error;
  }
}

async function recoverStaleDeploymentLock(lockDir, rootDir, options) {
  const now = options.now?.getTime?.() ?? Date.now();
  const staleAfterMs = options.staleAfterMs ?? 24 * 60 * 60 * 1_000;
  const localHostname = options.hostname ?? osHostname();
  const isProcessAlive = options.isProcessAlive ?? localProcessIsAlive;
  const lockDetails = await lstat(lockDir);
  if (lockDetails.isSymbolicLink() || !lockDetails.isDirectory()) {
    throw new Error(`Deployment lock path is unsafe for ${rootDir}`);
  }

  let stale = false;
  try {
    const ownerPath = join(lockDir, "owner.json");
    const ownerDetails = await lstat(ownerPath);
    if (ownerDetails.isSymbolicLink() || !ownerDetails.isFile()) {
      throw new Error("Deployment lock owner metadata is unsafe");
    }
    const owner = JSON.parse(await readFile(ownerPath, "utf8"));
    const createdAt = Date.parse(owner.createdAt);
    if (
      !Number.isSafeInteger(owner.pid) ||
      owner.pid <= 0 ||
      typeof owner.hostname !== "string" ||
      typeof owner.token !== "string" ||
      !Number.isFinite(createdAt)
    ) {
      throw new Error("Deployment lock owner metadata is invalid");
    }
    stale =
      owner.hostname === localHostname
        ? !isProcessAlive(owner.pid)
        : now - createdAt > staleAfterMs;
  } catch (error) {
    if (!["ENOENT", "SyntaxError"].includes(error.code) && !(error instanceof SyntaxError)) throw error;
    stale = now - lockDetails.mtimeMs > staleAfterMs;
  }

  if (!stale) throw new Error(`Deployment operation is already running for ${rootDir}`);
  const quarantine = join(rootDir, `.deploy-lock.stale-${randomUUID()}`);
  await rename(lockDir, quarantine);
  await rm(quarantine, { recursive: true, force: true });
}

export async function acquireDeploymentLock(targetDir, options = {}) {
  const rootDir = await validateMutatingTarget(targetDir);
  const lockDir = join(rootDir, ".deploy-lock");
  const ownerPath = join(lockDir, "owner.json");
  const token = randomUUID();

  await mkdir(rootDir, { recursive: true });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let lockCreated = false;
    try {
      await mkdir(lockDir, { mode: 0o700 });
      lockCreated = true;
      await writeFile(
        ownerPath,
        `${JSON.stringify({
          pid: process.pid,
          hostname: options.hostname ?? osHostname(),
          createdAt: (options.now ?? new Date()).toISOString(),
          token,
        })}\n`,
        { flag: "wx", mode: 0o600 },
      );
      break;
    } catch (error) {
      if (lockCreated) await rm(lockDir, { recursive: true, force: true });
      if (error.code !== "EEXIST") throw error;
      try {
        await recoverStaleDeploymentLock(lockDir, rootDir, options);
      } catch (recoveryError) {
        if (recoveryError.code === "ENOENT") continue;
        throw recoveryError;
      }
      if (attempt === 2) throw new Error(`Unable to replace stale deployment lock for ${rootDir}`);
    }
  }

  let released = false;
  return async () => {
    if (released) return;
    const ownerDetails = await lstat(ownerPath);
    if (ownerDetails.isSymbolicLink() || !ownerDetails.isFile()) {
      throw new Error(`Deployment lock ownership changed for ${rootDir}`);
    }
    const owner = JSON.parse(await readFile(ownerPath, "utf8"));
    if (owner.token !== token || owner.pid !== process.pid) {
      throw new Error(`Deployment lock ownership changed for ${rootDir}`);
    }
    const quarantine = join(rootDir, `.deploy-lock.release-${token}`);
    await rename(lockDir, quarantine);
    await rm(quarantine, { recursive: true, force: true });
    released = true;
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

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
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
    let timedOut = false;
    const timeout = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGKILL");
        }, options.timeoutMs)
      : undefined;
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (timeout) clearTimeout(timeout);
      rejectCommand(error);
    });
    child.on("close", (exitCode) => {
      if (timeout) clearTimeout(timeout);
      resolveCommand({ exitCode, stdout, stderr, timedOut });
    });
  });
}

async function withCommandTimeout(operation, timeoutMs, label) {
  let timeout;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, rejectTimeout) => {
        timeout = setTimeout(() => rejectTimeout(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function commandExitCode(result) {
  if (!result || typeof result !== "object") return 0;
  return result.exitCode ?? result.code ?? result.status ?? 0;
}

function commandOutput(result) {
  if (!result || typeof result !== "object") return "";
  return result.stdout ?? result.output ?? "";
}

function commandErrorOutput(result) {
  if (!result || typeof result !== "object") return "";
  return result.stderr ?? "";
}

async function deploymentSecretValues(rootDir) {
  try {
    const contents = await readFile(join(rootDir, "config", ".env"), "utf8");
    return contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => line.slice(line.indexOf("=") + 1).replace(/^['"]|['"]$/g, ""))
      .filter((value) => value.length >= 4)
      .sort((left, right) => right.length - left.length);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function sanitizeDiagnostic(rootDir, value) {
  let sanitized = String(value ?? "");
  for (const secret of await deploymentSecretValues(rootDir)) {
    sanitized = sanitized.split(secret).join("[REDACTED]");
  }
  sanitized = sanitized
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, "$1[REDACTED]@")
    .replace(/\b(secret|password|passwd|token|api[_-]?key)\s*[:=]\s*[^\s]+/gi, "$1=[REDACTED]");
  return sanitized.slice(0, 16_000).trim();
}

export async function runOperationalCommand(
  { targetDir, mode, backupPath },
  { operationRunner = defaultCommandRunner, operationTimeoutMs = 30 * 60_000 } = {},
) {
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
  const scriptPath = join(rootDir, "ops", scriptName);
  const args = mode === "restore" ? [safeBackupPath] : [];

  const result = await withCommandTimeout(
    () => operationRunner(scriptPath, args, { cwd: rootDir, timeoutMs: operationTimeoutMs }),
    operationTimeoutMs,
    `Deployment operation ${mode}`,
  );
  if (commandExitCode(result) !== 0) {
    const diagnostic = await sanitizeDiagnostic(
      rootDir,
      [commandOutput(result), commandErrorOutput(result)].filter(Boolean).join("\n"),
    );
    throw new Error(`Deployment operation ${mode} failed${diagnostic ? `:\n${diagnostic}` : ""}`);
  }
  return result;
}

function createTargetComposeRunner(targetDir, dependencies) {
  return (
    dependencies.composeRunner ??
    createComposeRunner({
      targetDir,
      env: dependencies.env,
      commandRunner: dependencies.commandRunner,
      commandTimeoutMs: dependencies.commandTimeoutMs,
      healthCommandTimeoutMs: dependencies.healthCommandTimeoutMs,
    })
  );
}

export function createComposeRunner({
  targetDir,
  env = {},
  commandRunner = defaultCommandRunner,
  commandTimeoutMs = 10 * 60_000,
  healthCommandTimeoutMs = 30_000,
}) {
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
    const timeoutMs = ["logs", "ps"].includes(args[0]) ? healthCommandTimeoutMs : commandTimeoutMs;
    const result = await withCommandTimeout(
      () =>
        commandRunner("docker", [...composeArguments, ...args], {
          cwd: rootDir,
          env: { ...env, ...commandEnv },
          timeoutMs,
        }),
      timeoutMs,
      `Docker Compose ${args[0]}`,
    );
    if (commandExitCode(result) !== 0) {
      const diagnostic = await sanitizeDiagnostic(
        rootDir,
        [commandOutput(result), commandErrorOutput(result)].filter(Boolean).join("\n"),
      );
      throw new Error(`Docker Compose ${args[0]} failed${diagnostic ? `:\n${diagnostic}` : ""}`);
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

export async function rollbackRelease({ targetDir, releaseId, previousRelease, composeRunner, healthTimeoutMs }) {
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
    await waitForHealthy({ targetDir: rootDir, timeoutMs: healthTimeoutMs, composeRunner });
  } else {
    await composeRunner(["down"], releaseContext(releaseId));
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
      let diagnostics;
      try {
        const result = await composeRunner(
          ["logs", "--no-color", "--tail", "100", "app"],
          releaseContext(release.releaseId),
        );
        diagnostics = await sanitizeDiagnostic(
          targetDir,
          [commandOutput(result), commandErrorOutput(result)].filter(Boolean).join("\n"),
        );
      } catch (diagnosticError) {
        diagnostics = await sanitizeDiagnostic(targetDir, `Unable to collect Compose logs: ${diagnosticError.message}`);
      }

      const activeRelease = release.previousRelease ?? "none";
      const failureSummary = [
        `Deployment failed: ${error.message}`,
        `Active release: ${activeRelease}`,
        `Rollback command: make -C ${shellQuote(targetDir)} deploy-rollback`,
        `Compose diagnostics:\n${diagnostics || "No Compose logs were available."}`,
      ].join("\n");
      const recoveryErrors = [];
      if (dependencies.restoreRuntime) {
        try {
          await dependencies.restoreRuntime();
        } catch (runtimeError) {
          recoveryErrors.push(`Runtime control-plane recovery failed:\n${runtimeError.message}`);
        }
      }
      try {
        await rollbackRelease({
          ...release,
          targetDir,
          composeRunner,
          healthTimeoutMs: dependencies.healthTimeoutMs,
        });
      } catch (recoveryError) {
        recoveryErrors.push(`Deployment recovery failed:\n${recoveryError.message}`);
      }
      if (recoveryErrors.length > 0) {
        throw new Error(`${failureSummary}\n${recoveryErrors.join("\n")}`, { cause: error });
      }
      throw new Error(failureSummary, { cause: error });
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

const MANAGED_RELEASE_PATTERN = /^\d{8}T\d{6}Z-[a-f0-9]{10}(?:-\d+)?$/;

async function deploymentConfigValue(targetDir, key) {
  try {
    const contents = await readFile(join(targetDir, "config", ".env"), "utf8");
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.startsWith(`${key}=`)) continue;
      return line.slice(key.length + 1).replace(/^['"]|['"]$/g, "");
    }
    return undefined;
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

async function releaseRetentionCount(targetDir) {
  const configured = (await deploymentConfigValue(targetDir, "RELEASES_TO_KEEP")) ?? "5";
  if (!/^\d+$/.test(configured) || Number(configured) < 2 || !Number.isSafeInteger(Number(configured))) {
    throw new Error("RELEASES_TO_KEEP must be an integer of at least 2");
  }
  return Number(configured);
}

async function pruneInactiveReleases({ paths, targetDir, activeRelease, previousRelease }) {
  const keepCount = await releaseRetentionCount(targetDir);
  const entries = await readdir(paths.releasesDir, { withFileTypes: true });
  const managed = entries
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink() && MANAGED_RELEASE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (managed.length <= keepCount) return [];

  const keepers = new Set([activeRelease, previousRelease].filter((releaseId) => managed.includes(releaseId)));
  for (const releaseId of [...managed].reverse()) {
    if (keepers.size >= keepCount) break;
    keepers.add(releaseId);
  }

  const releasesRoot = canonicalizePath(paths.releasesDir);
  const removed = [];
  for (const releaseId of managed) {
    if (keepers.has(releaseId)) continue;
    const releasePath = join(paths.releasesDir, validateReleaseId(releaseId));
    const details = await lstat(releasePath);
    if (details.isSymbolicLink() || !details.isDirectory()) {
      throw new Error(`Refusing to prune unsafe release path: ${releasePath}`);
    }
    const canonicalRelease = canonicalizePath(releasePath);
    if (dirname(canonicalRelease) !== releasesRoot) {
      throw new Error(`Refusing to prune release outside the releases directory: ${releasePath}`);
    }
    await rm(releasePath, { recursive: true, force: false });
    removed.push(releaseId);
  }
  return removed;
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
  try {
    await buildAndStartRelease({ targetDir: rootDir, releaseId: previousRelease, composeRunner });
    await waitForHealthy({ targetDir: rootDir, timeoutMs: healthTimeoutMs, composeRunner });
  } catch (error) {
    let diagnostics;
    try {
      const result = await composeRunner(
        ["logs", "--no-color", "--tail", "100", "app"],
        releaseContext(previousRelease),
      );
      diagnostics = await sanitizeDiagnostic(
        rootDir,
        [commandOutput(result), commandErrorOutput(result)].filter(Boolean).join("\n"),
      );
    } catch (diagnosticError) {
      diagnostics = await sanitizeDiagnostic(rootDir, `Unable to collect Compose logs: ${diagnosticError.message}`);
    }

    const summary = [
      `Rollback failed: ${error.message}`,
      `Active release: ${activeRelease}`,
      `Rollback command: make -C ${shellQuote(rootDir)} deploy-rollback`,
      `Compose diagnostics:\n${diagnostics || "No Compose logs were available."}`,
    ].join("\n");
    try {
      await pointCurrentAtRelease(paths, activeRelease);
      await buildAndStartRelease({ targetDir: rootDir, releaseId: activeRelease, composeRunner });
      await waitForHealthy({ targetDir: rootDir, timeoutMs: healthTimeoutMs, composeRunner });
    } catch (recoveryError) {
      throw new Error(`${summary}\nRollback recovery failed:\n${recoveryError.message}`, { cause: error });
    }
    throw new Error(summary, { cause: error });
  }
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
  const envPath = join(paths.configDir, ".env");
  let created = false;
  try {
    await assertRegularFile(envPath, "Deployment configuration");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    created = true;
  }
  await initializeConfigFiles({ sourceDir: resolvedPaths.sourceDir, targetDir: resolvedPaths.targetDir, paths });
  return { targetDir: resolvedPaths.targetDir, configPath: envPath, created };
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
        {
          operationRunner: dependencies.operationRunner ?? dependencies.commandRunner,
          operationTimeoutMs: dependencies.operationTimeoutMs,
        },
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
    let runtimeTransaction;
    let releaseForRecovery;
    let lifecycleAccepted = false;
    let lifecycleComposeRunner;

    try {
      if (policy.copyRuntimeFiles) {
        runtimeTransaction = await beginRuntimeTransaction({
          targetDir: resolvedPaths.targetDir,
          paths,
        });
        await initializeFullDeployment({
          sourceDir: resolvedPaths.sourceDir,
          targetDir: resolvedPaths.targetDir,
          paths,
        });
      }
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
        await copyRuntimeFiles({
          sourceDir: resolvedPaths.sourceDir,
          targetDir: resolvedPaths.targetDir,
          paths,
        });
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
      releaseForRecovery = release;
      const useDefaultLifecycle =
        options.acceptRelease === undefined &&
        dependencies.acceptRelease === undefined &&
        Boolean(dependencies.commandRunner || dependencies.composeRunner);
      if (useDefaultLifecycle) {
        lifecycleComposeRunner = createTargetComposeRunner(resolvedPaths.targetDir, dependencies);
      }
      const acceptRelease =
        options.acceptRelease ??
        dependencies.acceptRelease ??
        (dependencies.commandRunner || dependencies.composeRunner
          ? lifecycleAcceptance(resolvedPaths.targetDir, {
              ...dependencies,
              restoreRuntime: () => runtimeTransaction?.restore(),
            })
          : undefined);
      const accepted = await shouldAcceptRelease(acceptRelease, release);

      if (accepted) {
        lifecycleAccepted = useDefaultLifecycle;
        await rename(temporaryLink, paths.currentLink);
        temporaryLink = undefined;
        await pruneInactiveReleases({
          paths,
          targetDir: resolvedPaths.targetDir,
          activeRelease: releaseId,
          previousRelease,
        });
        await runtimeTransaction?.discard();
        return { ...release, activeRelease: releaseId, accepted: true };
      }

      await rm(temporaryLink, { force: true });
      temporaryLink = undefined;
      await runtimeTransaction?.discard();
      return { ...release, accepted: false };
    } catch (error) {
      let finalError = error;
      if (runtimeTransaction) {
        try {
          await runtimeTransaction.restore();
        } catch (runtimeError) {
          finalError = new Error(`${error.message}\nRuntime control-plane recovery failed:\n${runtimeError.message}`, {
            cause: error,
          });
        }
      }
      if (lifecycleAccepted && releaseForRecovery && lifecycleComposeRunner) {
        try {
          await rollbackRelease({
            ...releaseForRecovery,
            targetDir: resolvedPaths.targetDir,
            composeRunner: lifecycleComposeRunner,
            healthTimeoutMs: dependencies.healthTimeoutMs,
          });
          releaseReserved = false;
        } catch (recoveryError) {
          finalError = new Error(`${finalError.message}\nPost-publication recovery failed:\n${recoveryError.message}`, {
            cause: finalError,
          });
        }
      }
      if (temporaryLink) await rm(temporaryLink, { force: true }).catch(() => undefined);
      if (releaseReserved) await rm(releaseDir, { recursive: true, force: true }).catch(() => undefined);
      throw finalError;
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
