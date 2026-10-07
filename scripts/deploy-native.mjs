import { lstat, mkdir, mkdtemp, readFile, readlink, rename, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import {
  DEFAULT_DEPLOY_ROOT,
  acquireDeploymentLock,
  validateMutatingTarget,
  validateDeploymentPaths,
  readActiveRelease,
  resolveDeploymentPaths,
  runDeployment,
} from "./deploy.mjs";
import { createSourceSnapshot, resolveReleaseSource } from "./deploy-source.mjs";
import { createNativeRuntime } from "./deploy-native-runtime.mjs";
import { beginNativeToolkitTransaction } from "./deploy-native-toolkit.mjs";
import { assertNativeEnvironment } from "./native-environment.mjs";

function optionValue(argv, index, flag) {
  const arg = argv[index];
  if (arg === flag) {
    if (!argv[index + 1] || argv[index + 1].startsWith("--")) throw new Error(`${flag} requires a value`);
    return { value: argv[index + 1], nextIndex: index + 1 };
  }
  if (arg?.startsWith(`${flag}=`)) {
    const value = arg.slice(flag.length + 1);
    if (!value) throw new Error(`${flag} requires a value`);
    return { value, nextIndex: index };
  }
}

export function parseArgs(argv) {
  const options = { mode: "deploy", sourceDir: process.cwd(), targetDir: DEFAULT_DEPLOY_ROOT, ref: "current", dryRun: process.env.DRY_RUN === "1" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dry-run" || argv[i] === "DRY_RUN=1") { options.dryRun = true; continue; }
    const pairs = ["--mode", "--source", "--target", "--ref"].map((flag) => [flag, optionValue(argv, i, flag)]);
    const found = pairs.find(([, value]) => value);
    if (!found) throw new Error(`Unknown deployment option: ${argv[i]}`);
    i = found[1].nextIndex;
    const [flag, value] = found;
    options[{ "--mode": "mode", "--source": "sourceDir", "--target": "targetDir", "--ref": "ref" }[flag]] = value.value;
  }
  if (!["deploy", "code", "status", "rollback", "down"].includes(options.mode)) throw new Error(`Unknown deployment mode: ${options.mode}`);
  return options;
}

function readRuntimeConfig(targetDir) {
  return readFile(join(resolve(targetDir), "config", "runtime.json"), "utf8").then((text) => JSON.parse(text));
}

async function validateRuntimeConfig(targetDir) {
  const configPath = join(resolve(targetDir), "config", "runtime.json");
  for (const ancestor of [dirname(configPath), dirname(dirname(configPath))]) {
    const ancestorStat = await lstat(ancestor);
    if (ancestorStat.isSymbolicLink()) throw new Error("runtime config ancestors must not be symlinks");
  }
  const configDetails = await lstat(configPath);
  if (configDetails.isSymbolicLink() || !configDetails.isFile()) throw new Error("runtime.json must be an existing regular file");
  const config = await readRuntimeConfig(targetDir);
  return validateRuntimeObject(config);
}

async function validateCurrent(paths) {
  let target;
  try { target = await readlink(paths.currentLink); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
  const resolved = resolve(dirname(paths.currentLink), target);
  if (dirname(resolved) !== resolve(paths.releasesDir)) throw new Error("current must point directly inside releases");
  const details = await lstat(resolved);
  if (details.isSymbolicLink() || !details.isDirectory()) throw new Error("current target must be an ordinary release directory");
  return resolved;
}

async function validateRuntimeObject(config) {
  if (!config || config.hostname !== "127.0.0.1" || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error("runtime.json must configure loopback hostname and valid port");
  if (!config.databasePath || !isAbsolute(config.databasePath)) throw new Error("runtime.json databasePath must be absolute");
  const details = await lstat(config.databasePath);
  if (details.isSymbolicLink() || !details.isFile()) throw new Error("runtime database must be an existing regular file");
  return config;
}

async function ensureRuntimeConfig(options, write = true) {
  const targetConfig = join(resolve(options.targetDir), "config", "runtime.json");
  try {
    const details = await lstat(targetConfig);
    if (details.isSymbolicLink() || !details.isFile()) throw new Error("runtime.json must be an existing regular file");
    return JSON.parse(await readFile(targetConfig, "utf8"));
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const sourceConfig = join(resolve(options.sourceDir), "conf", "runtime.json");
  const sourceText = await readFile(sourceConfig, "utf8");
  const config = JSON.parse(sourceText);
  await validateRuntimeObject(config);
  if (write) {
    await mkdir(dirname(targetConfig), { recursive: true });
    await writeFile(targetConfig, sourceText, { mode: 0o600 });
  }
  return config;
}

async function configExists(targetDir) {
  try { const details = await lstat(join(resolve(targetDir), "config", "runtime.json")); return details.isFile() && !details.isSymbolicLink(); }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

async function metadata(release, selection, previousRelease, sourceDir, runtimeEvidence = assertNativeEnvironment()) {
  let version;
  try { version = JSON.parse(await readFile(join(sourceDir, "package.json"), "utf8")).version; } catch { /* optional */ }
  const value = { schema: 1, fullcommit: selection.commit, ref: selection.requestedRef, branch: selection.branch, resolvedRef: selection.resolvedRef, buildtimestamp: new Date().toISOString(), packageversion: version, runtime: runtimeEvidence, previousRelease: previousRelease ?? null, accepted: false };
  await writeFile(join(release.releaseDir, "release.json"), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  return value;
}

async function releaseMetadata(targetDir, releaseId) {
  try { return JSON.parse(await readFile(join(resolveDeploymentPaths(targetDir).releasesDir, releaseId, "release.json"), "utf8")); }
  catch { return { fullcommit: "UNKNOWN", previousRelease: null, accepted: "unknown" }; }
}

export async function nativeStatus({ targetDir }, dependencies = {}) {
  const root = realpathSync.native(resolve(targetDir));
  const config = await validateRuntimeConfig(root);
  const paths = resolveDeploymentPaths(root);
  for (const parent of [paths.appDir, paths.releasesDir]) { const details = await lstat(parent); if (details.isSymbolicLink() || !details.isDirectory()) throw new Error("native release parents must be ordinary directories"); }
  await validateCurrent(paths);
  const activeRelease = await readActiveRelease(root);
  const runtime = (dependencies.runtimeFactory ?? (() => createNativeRuntime({ targetDir: root, runtimeConfig: config, env: dependencies.env, healthTimeoutMs: dependencies.healthTimeoutMs ?? 3000, commandRunner: dependencies.commandRunner, startCommand: dependencies.startCommand, nativeEnvironmentOptions: dependencies.nativeEnvironmentOptions })))();
  const observed = await runtime.inspect();
  const currentPath = activeRelease ? resolve(paths.releasesDir, activeRelease) : null;
  let healthy = false;
  if (observed && currentPath && resolve(observed.cwd) === currentPath && typeof runtime.waitHealthy === "function") {
    try { await runtime.waitHealthy(currentPath, observed); healthy = true; } catch { healthy = false; }
  }
  const consistent = Boolean(observed && currentPath && resolve(observed.cwd) === currentPath && healthy);
  const measuredRuntime = assertNativeEnvironment(dependencies.nativeEnvironmentOptions);
  const serviceRuntime = observed?.executable === measuredRuntime.nodeExecutable ? measuredRuntime : null;
  return { targetDir: root, activeRelease: activeRelease ?? null, metadata: activeRelease ? await releaseMetadata(root, activeRelease) : null, toolingRuntime: measuredRuntime, serviceRuntime, observed, healthy, consistent: consistent && Boolean(serviceRuntime), port: config.port, databasePath: config.databasePath };
}

async function pointCurrent(paths, releaseId) {
  const temporary = join(paths.appDir, `.current-native-${process.pid}.tmp`);
  await rm(temporary, { force: true });
  await symlink(join("releases", releaseId), temporary);
  await rename(temporary, paths.currentLink);
}

export async function runNativeDeployment(options, dependencies = {}) {
  const opts = { mode: "deploy", ref: "current", sourceDir: process.cwd(), targetDir: DEFAULT_DEPLOY_ROOT, ...options };
  if (!["deploy", "code", "status", "rollback", "down"].includes(opts.mode)) throw new Error(`Unknown deployment mode: ${opts.mode}`);
  if (["deploy", "code", "rollback", "down"].includes(opts.mode) && (process.env.TRADEREVIEW_DB_PATH || process.env.TRADEREVIEW_RUNTIME_CONFIG)) throw new Error("ambient runtime overrides are refused for native deployment");
  const requestedTarget = resolve(opts.targetDir);
  const measuredRuntime = assertNativeEnvironment(dependencies.nativeEnvironmentOptions);
  const requestedStat = await lstat(requestedTarget).catch((error) => error.code === "ENOENT" ? null : Promise.reject(error));
  if (requestedStat?.isSymbolicLink()) throw new Error("Deployment target must not be a symlink");
  await validateMutatingTarget(requestedTarget);
  let targetDir = requestedTarget;
  try { targetDir = realpathSync.native(targetDir); } catch { /* new target is validated by runDeployment */ }
  if (opts.mode === "status") return nativeStatus({ targetDir }, dependencies);
  const runtimeFromSource = await ensureRuntimeConfig(opts, false);
  let runtimeConfig;
  try {
    runtimeConfig = await validateRuntimeConfig(targetDir);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    runtimeConfig = runtimeFromSource;
  }
  const paths = resolveDeploymentPaths(targetDir);
  const runtimeFactory = dependencies.runtimeFactory ?? (() => createNativeRuntime({ targetDir, runtimeConfig, env: dependencies.env, healthTimeoutMs: dependencies.healthTimeoutMs, commandRunner: dependencies.commandRunner, startCommand: dependencies.startCommand, nativeEnvironmentOptions: dependencies.nativeEnvironmentOptions }));
  let active;
  if (opts.dryRun && (opts.mode === "down" || opts.mode === "rollback")) return { dryRun: true, mode: opts.mode, targetDir, activeRelease: active ?? null, port: runtimeConfig.port, databasePath: runtimeConfig.databasePath };
  if (opts.mode === "down") {
    const releaseLock = await acquireDeploymentLock(targetDir);
    try {
      runtimeConfig = await validateRuntimeConfig(targetDir);
      for (const parent of [paths.appDir, paths.releasesDir]) { const details = await lstat(parent); if (details.isSymbolicLink() || !details.isDirectory()) throw new Error("native release parents must be ordinary directories"); }
      await validateCurrent(paths);
      active = await readActiveRelease(targetDir);
      await validateCurrent(paths);
      const runtime = runtimeFactory();
      const service = await runtime.inspect();
      const currentPath = active ? resolve(paths.releasesDir, active) : null;
      if (service && (!currentPath || resolve(service.cwd) !== currentPath)) throw new Error("Refusing to stop service outside active native release");
      if (service) await runtime.stop(service);
      return { targetDir, stopped: Boolean(service) };
    } finally { await releaseLock(); }
  }
  if (opts.mode === "rollback") {
    const releaseLock = await acquireDeploymentLock(targetDir);
    try {
    runtimeConfig = await validateRuntimeConfig(targetDir);
    for (const parent of [paths.appDir, paths.releasesDir]) { const details = await lstat(parent); if (details.isSymbolicLink() || !details.isDirectory()) throw new Error("native release parents must be ordinary directories"); }
    active = await readActiveRelease(targetDir);
    await validateCurrent(paths);
    if (!active) throw new Error("Cannot roll back without an active release");
    const currentMeta = await releaseMetadata(targetDir, active);
    if (currentMeta.accepted === false) throw new Error("Cannot roll back from an unaccepted release");
    const previous = currentMeta.previousRelease;
    if (!previous || previous.includes("/") || previous.includes("\\")) throw new Error("Cannot roll back without a safe recorded previous release");
    if (currentMeta.accepted !== true || !/^[0-9a-f]{40}$/i.test(String(currentMeta.fullcommit || ""))) throw new Error("Cannot roll back from incomplete release metadata");
    const previousPath = resolve(paths.releasesDir, previous);
    if (!previousPath.startsWith(`${resolve(paths.releasesDir)}${resolve("/")}`)) throw new Error("Refusing unsafe rollback release path");
    const previousDetails = await lstat(previousPath);
    if (previousDetails.isSymbolicLink() || !previousDetails.isDirectory()) throw new Error("Recorded rollback release is not a directory");
    const previousMeta = await releaseMetadata(targetDir, previous);
    if (previousMeta.accepted !== true || !/^[0-9a-f]{40}$/i.test(String(previousMeta.fullcommit || ""))) throw new Error("Cannot roll back to incomplete release metadata");
    const runtime = runtimeFactory(); const currentService = await runtime.inspect();
    const currentPath = resolve(paths.releasesDir, active);
    if (currentService && resolve(currentService.cwd) !== currentPath) throw new Error("Refusing rollback with foreign active service");
    if (currentService) await runtime.stop(currentService);
    let rollbackCandidate;
    try { rollbackCandidate = await runtime.start(previousPath); await runtime.waitHealthy(previousPath, rollbackCandidate); await pointCurrent(paths, previous); return { targetDir, activeRelease: previous, previousRelease: active }; }
    catch (error) {
      try {
        if (rollbackCandidate) await runtime.stop(rollbackCandidate);
        await pointCurrent(paths, active);
        const service = await runtime.start(join(paths.releasesDir, active));
        await runtime.waitHealthy(join(paths.releasesDir, active), service);
      } catch (recovery) { throw new Error(`${error.message}; recovery failed: ${recovery.message}`, { cause: error }); }
      throw error;
    }
    } finally { await releaseLock(); }
  }
  const resolveSource = dependencies.resolveReleaseSource ?? resolveReleaseSource;
  validateDeploymentPaths(opts.sourceDir, targetDir);
  const selection = await resolveSource({ sourceDir: opts.sourceDir, ref: opts.ref });
  if (opts.dryRun) return { dryRun: true, sourceSHA: selection.commit, requestedRef: selection.requestedRef, resolvedRef: selection.resolvedRef, port: runtimeConfig.port, databasePath: runtimeConfig.databasePath, targetDir };
  const temp = await mkdtemp(join(tmpdir(), "tradereview-native-source-"));
  let toolkitTransaction;
  let acceptedRuntime;
  let acceptedCandidateService;
  let acceptedCandidateHandle;
  let createdRuntimeConfig = false;
  try {
    const snapshot = dependencies.createSourceSnapshot ?? createSourceSnapshot;
    const selectedSource = await snapshot({ sourceDir: opts.sourceDir, selection, destinationDir: temp });
    const release = await runDeployment({ mode: "code", sourceDir: selectedSource, targetDir, beforeStage: async () => {
      runtimeConfig = await validateRuntimeConfig(targetDir).catch(async (error) => {
        if (error.code !== "ENOENT") throw error;
        return runtimeFromSource;
      });
      await validateCurrent(paths);
      toolkitTransaction = await beginNativeToolkitTransaction({ targetDir });
      if (!await configExists(targetDir)) { await ensureRuntimeConfig(opts, true); createdRuntimeConfig = true; }
    }, acceptRelease: async (candidate) => {
      const runtime = runtimeFactory(); const oldService = await runtime.inspect();
      if (oldService && (!candidate.previousRelease || resolve(oldService.cwd) !== resolve(paths.releasesDir, candidate.previousRelease))) throw new Error("Refusing to stop service outside active native release");
      await metadata(candidate, selection, candidate.previousRelease, selectedSource, measuredRuntime);
      await runtime.build(candidate.releaseDir);
      const serviceAfterBuild = await runtime.inspect();
      if (oldService && (!serviceAfterBuild || serviceAfterBuild.pid !== oldService.pid || serviceAfterBuild.startTime !== oldService.startTime || resolve(serviceAfterBuild.cwd) !== resolve(oldService.cwd))) throw new Error("Active service changed during build");
      if (!oldService && serviceAfterBuild) throw new Error("Unexpected native listener appeared during build");
      let candidateService;
      try { if (oldService) await runtime.stop(oldService); candidateService = await runtime.start(candidate.releaseDir); const healthy = await runtime.waitHealthy(candidate.releaseDir, candidateService); acceptedRuntime = runtime; acceptedCandidateService = healthy; acceptedCandidateHandle = candidateService; const text = await readFile(join(candidate.releaseDir, "release.json"), "utf8"); await writeFile(join(candidate.releaseDir, "release.json"), text.replace('"accepted": false', '"accepted": true')); return true; }
      catch (error) {
        let stopError;
        try { if (candidateService) await runtime.stop(candidateService); } catch (candidateStopError) { stopError = candidateStopError; error.preserveRelease = true; }
        try {
          if (oldService && candidate.previousRelease) {
            const recovery = await runtime.start(join(paths.releasesDir, candidate.previousRelease));
            await runtime.waitHealthy(join(paths.releasesDir, candidate.previousRelease), recovery);
          }
        } catch (recoveryError) { error.preserveRelease = true; const combined = new Error(`${error.message}; recovery failed: ${recoveryError.message}`, { cause: error }); combined.preserveRelease = true; throw combined; }
        if (stopError) { const combined = new Error(`${error.message}; candidate stop failed: ${stopError.message}`, { cause: error }); combined.preserveRelease = true; throw combined; }
        throw error;
      }
    }, afterPublish: async () => { await toolkitTransaction?.discard(); toolkitTransaction = undefined; createdRuntimeConfig = false; }, onFailure: async () => {
      await toolkitTransaction?.restore();
      toolkitTransaction = undefined;
      if (createdRuntimeConfig) { await rm(join(targetDir, "config", "runtime.json"), { force: true }); createdRuntimeConfig = false; }
    } }, { recoverAcceptedRelease: async ({ release: candidate }) => {
      const runtime = acceptedRuntime ?? runtimeFactory();
      const service = await runtime.inspect();
      if (service && (!acceptedCandidateService || service.pid !== acceptedCandidateService.pid || service.startTime !== acceptedCandidateService.startTime || resolve(service.cwd) !== resolve(acceptedCandidateService.cwd))) throw new Error("Refusing recovery of foreign native service");
      if (service) await runtime.stop(acceptedCandidateHandle ?? service);
      if (candidate.previousRelease) {
        await pointCurrent(paths, candidate.previousRelease);
        const restored = await runtime.start(join(paths.releasesDir, candidate.previousRelease));
        await runtime.waitHealthy(join(paths.releasesDir, candidate.previousRelease), restored);
      } else {
        await rm(paths.currentLink, { force: true });
      }
    } });
    await toolkitTransaction?.discard();
    return { ...release, sourceSHA: selection.commit, requestedRef: selection.requestedRef, resolvedRef: selection.resolvedRef, runtimeConfig };
  } finally { await rm(temp, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runNativeDeployment(parseArgs(process.argv.slice(2))).then((result) => process.stdout.write(`${JSON.stringify(result)}\n`)).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
