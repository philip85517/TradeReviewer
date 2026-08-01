import { chmod, cp, mkdtemp, mkdir, readdir, readFile, readlink, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { hostname, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { describe, expect, test } from "vitest";
import {
  buildAndStartRelease,
  acquireDeploymentLock,
  createComposeRunner,
  DEFAULT_DEPLOY_ROOT,
  createReleaseId,
  getSyncPolicy,
  assertDeploymentPortAvailable,
  parseArgs,
  rollbackRelease,
  runOperationalCommand,
  resolveDeploymentPaths,
  runDeployment,
  validateMutatingTarget,
  validateDeploymentPaths,
  waitForHealthy,
} from "./deploy.mjs";

const root = resolve(import.meta.dirname, "..");

async function readManifest(relativePath) {
  try {
    return await readFile(resolve(root, relativePath), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

async function createOperationalSandbox() {
  const sandbox = await mkdtemp(join(tmpdir(), "tradereview-operations-"));
  const targetDir = join(sandbox, "target");
  const binDir = join(sandbox, "bin");

  await Promise.all([
    cp(join(root, "deploy", "ops"), join(targetDir, "ops"), { recursive: true }),
    mkdir(join(targetDir, "config"), { recursive: true }),
    mkdir(join(targetDir, "data"), { recursive: true }),
    mkdir(binDir, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(targetDir, "config", ".env"), "APP_BIND=127.0.0.1\nAPP_PORT=3000\n"),
    writeFile(join(binDir, "docker"), "#!/usr/bin/env bash\nprintf '[]\\n'\n"),
  ]);
  await chmod(join(binDir, "docker"), 0o755);

  return { sandbox, targetDir, binDir };
}

async function runOperationalScript(scriptPath, args, binDir, environment = {}) {
  return runProcess(scriptPath, args, {
    env: { PATH: `${binDir}:${process.env.PATH}`, LC_ALL: "C", LANG: "C", ...environment },
  });
}

async function runProcess(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", rejectRun);
    child.on("close", (exitCode) => resolveRun({ exitCode, stdout, stderr }));
  });
}

const fakeDockerSource = `#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--project-directory");
const deployRoot = rootIndex >= 0 ? args[rootIndex + 1] : process.cwd();
const operations = new Set(["build", "down", "logs", "ps", "run", "stop", "up"]);
const operationIndex = args.findIndex((argument) => operations.has(argument));
const operation = args[operationIndex];
const mappings = [[join(deployRoot, "data", "sqlite"), "/var/lib/tradereview"]];

for (let index = 0; index < args.length; index += 1) {
  if (args[index] !== "--volume") continue;
  const match = args[index + 1].match(/^(.*?):(\\/[^:]*)(?::.*)?$/);
  if (match) mappings.push([match[1], match[2]]);
}

function translate(value) {
  let translated = value;
  for (const [hostPath, containerPath] of mappings.sort((left, right) => right[1].length - left[1].length)) {
    translated = translated.split(containerPath).join(hostPath);
  }
  return translated;
}

if (operation === "run") {
  const sqliteIndex = args.indexOf("sqlite3", operationIndex);
  const databasePath = translate(args[sqliteIndex + 1]);
  const sqliteCommand = translate(args[sqliteIndex + 2]);
  const backupMatch = sqliteCommand.match(/^\\.backup '([^']+)'$/);
  if (process.env.FAKE_CORRUPT_BACKUP === "1" && backupMatch) {
    mkdirSync(dirname(backupMatch[1]), { recursive: true });
    writeFileSync(backupMatch[1], "corrupt sqlite sentinel");
    process.exit(0);
  }
  if (process.env.FAKE_QUICK_CHECK_FAILURE === "1" && sqliteCommand.includes("quick_check")) {
    process.stdout.write("malformed\\n");
    process.exit(0);
  }
  if (process.env.FAKE_RESTORE_FAILURE === "1" && sqliteCommand.startsWith(".restore")) {
    writeFileSync(databasePath, "partial restore sentinel");
    process.stderr.write("synthetic restore failure\\n");
    process.exit(43);
  }
  const result = spawnSync("/usr/bin/sqlite3", [databasePath, sqliteCommand], { encoding: "utf8" });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  process.exit(result.status ?? 1);
}

if (operation === "ps") {
  const unhealthyCountPath = join(deployRoot, ".fake-compose-unhealthy-count");
  const unhealthyCount = existsSync(unhealthyCountPath) ? Number(readFileSync(unhealthyCountPath, "utf8")) : 0;
  const unhealthy = existsSync(join(deployRoot, ".fake-compose-unhealthy")) || unhealthyCount > 0;
  if (unhealthyCount > 0) writeFileSync(unhealthyCountPath, String(unhealthyCount - 1));
  process.stdout.write(JSON.stringify([{ Health: unhealthy ? "unhealthy" : "healthy" }]) + "\\n");
  process.exit(0);
}

if (operation === "logs") {
  const envPath = join(deployRoot, "config", ".env");
  const configured = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const secret = configured.match(/^SECRET=(.*)$/m)?.[1] || "none";
  process.stdout.write("container diagnostic SECRET=" + secret + "\\n");
  process.exit(0);
}

if (operation === "stop") {
  writeFileSync(join(deployRoot, ".fake-compose-state"), "stopped\\n");
  process.exit(0);
}

const upFailureCountPath = join(deployRoot, ".fake-compose-up-failure-count");
const upFailureCount = existsSync(upFailureCountPath) ? Number(readFileSync(upFailureCountPath, "utf8")) : 0;
if (operation === "up" && (process.env.FAKE_UP_FAIL === "1" || upFailureCount > 0)) {
  if (upFailureCount > 0) writeFileSync(upFailureCountPath, String(upFailureCount - 1));
  process.stderr.write("synthetic compose up failure\\n");
  process.exit(42);
}

if (operation === "up") {
  writeFileSync(join(deployRoot, ".fake-compose-state"), "running\\n");
  process.exit(0);
}

process.exit(0);
`;

async function createSqliteOperationalSandbox() {
  const sandbox = await mkdtemp(join(tmpdir(), "tradereview-sqlite-operations-"));
  const targetDir = join(sandbox, "target");
  const binDir = join(sandbox, "bin");
  const databasePath = join(targetDir, "data", "sqlite", "tradereview.sqlite");

  await Promise.all([
    cp(join(root, "deploy", "ops"), join(targetDir, "ops"), { recursive: true }),
    mkdir(join(targetDir, "config"), { recursive: true }),
    mkdir(join(targetDir, "data", "sqlite"), { recursive: true }),
    mkdir(join(targetDir, "data", "backups"), { recursive: true }),
    mkdir(binDir, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(
      join(targetDir, "config", ".env"),
      "APP_BIND=127.0.0.1\nAPP_PORT=3000\nBACKUP_RETENTION_DAYS=30\nSECRET=sentinel-secret\n",
    ),
    writeFile(join(targetDir, "compose.yaml"), "services: {}\n"),
    writeFile(join(targetDir, ".fake-compose-state"), "running\n"),
    writeFile(join(binDir, "docker"), fakeDockerSource),
  ]);
  await chmod(join(binDir, "docker"), 0o755);
  const initialized = await runProcess("/usr/bin/sqlite3", [
    databasePath,
    "CREATE TABLE state(value TEXT NOT NULL); INSERT INTO state VALUES('before');",
  ]);
  if (initialized.exitCode !== 0) throw new Error(initialized.stderr);

  return { sandbox, targetDir, binDir, databasePath };
}

async function startHealthServer() {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("ok");
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Health test server did not bind a TCP port");
  return {
    port: address.port,
    close: () => new Promise((resolveClose, rejectClose) => server.close((error) => (error ? rejectClose(error) : resolveClose()))),
  };
}

async function runDeploymentCli(args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [join(root, "scripts", "deploy.mjs"), ...args], { cwd: root });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", rejectRun);
    child.on("close", (exitCode) => resolveRun({ exitCode, stdout, stderr }));
  });
}

async function runMake(targetDir, target, env = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn("make", ["-C", targetDir, target], {
      env: { ...process.env, ...env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", rejectRun);
    child.on("close", (exitCode) => resolveRun({ exitCode, stdout, stderr }));
  });
}

describe("deployment templates", () => {
  test("provide the repository deployment contract", async () => {
    const [makefile, compose, envExample, dockerfile, dockerfileIgnore, contextIgnore, deploymentDocs, readme] = await Promise.all([
      readManifest("Makefile"),
      readManifest("deploy/compose.yaml"),
      readManifest("deploy/config/.env.example"),
      readManifest("deploy/Dockerfile"),
      readManifest("deploy/Dockerfile.dockerignore"),
      readManifest("deploy/.dockerignore"),
      readManifest("deploy/DEPLOYMENT.md"),
      readManifest("README.md"),
    ]);

    expect(makefile).toContain("deploy-code:");
    expect(makefile).toContain("/Users/zhoulin/projects/TradeReview");
    expect(compose).toContain("name: ${COMPOSE_PROJECT_NAME:-tradereview}");
    expect(compose).toContain("./data/sqlite:/var/lib/tradereview");
    expect(envExample).toContain("APP_BIND=127.0.0.1");
    expect(envExample).toContain("APP_PORT=4317");
    expect(compose).toContain("${APP_BIND:-127.0.0.1}:${APP_PORT:-4317}:3000");
    expect(compose).toContain("PORT: 3000");
    expect(compose).toContain("127.0.0.1:3000");
    expect(deploymentDocs).toContain("127.0.0.1:4317");
    expect(readme).toContain("localhost:4317");
    expect(dockerfile).toContain("npm run assets:ocr");
    expect(dockerfileIgnore).toContain(".env");
    expect(dockerfileIgnore).toBe(contextIgnore);
    expect(dockerfileIgnore).toContain("**/.npmrc");
    expect(dockerfileIgnore).toContain("**/*.pem");
    expect(dockerfileIgnore).toContain("**/*.key");
    expect(dockerfileIgnore).not.toMatch(/^data$/m);
    expect(compose).toContain("restart: unless-stopped");
  });
});

describe("SQLite operations", () => {
  test("terminates target-side operational commands at their configured timeout", async () => {
    const result = await runProcess(process.execPath, [
      join(root, "deploy", "ops", "run-command.mjs"),
      "25",
      process.execPath,
      "-e",
      "setTimeout(() => {}, 60_000)",
    ]);

    expect(result.exitCode).toBe(124);
    expect(result.stderr).toMatch(/timed out/i);
  });

  test("kills command descendants that survive the timeout signal", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-command-timeout-"));
    const descendantPidPath = join(sandbox, "descendant.pid");
    let descendantPid;

    try {
      const commandSource = `
        const { spawn } = require("node:child_process");
        const { writeFileSync } = require("node:fs");
        const descendant = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { stdio: "ignore" });
        writeFileSync(process.argv[1], String(descendant.pid));
        setInterval(() => {}, 1000);
      `;
      const result = await runProcess(process.execPath, [
        join(root, "deploy", "ops", "run-command.mjs"),
        "1500",
        process.execPath,
        "-e",
        commandSource,
        descendantPidPath,
      ]);
      descendantPid = Number(await readFile(descendantPidPath, "utf8"));
      await new Promise((resolveWait) => setTimeout(resolveWait, 200));

      let descendantAlive = true;
      try {
        process.kill(descendantPid, 0);
      } catch (error) {
        if (error.code === "ESRCH") descendantAlive = false;
        else throw error;
      }

      expect(result.exitCode).toBe(124);
      expect(descendantAlive).toBe(false);
    } finally {
      if (Number.isSafeInteger(descendantPid)) {
        try {
          process.kill(descendantPid, "SIGKILL");
        } catch (error) {
          if (error.code !== "ESRCH") throw error;
        }
      }
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("rejects a corrupt SQLite snapshot without publishing backup artifacts", async () => {
    const fixture = await createSqliteOperationalSandbox();

    try {
      const result = await runOperationalScript(
        join(fixture.targetDir, "ops", "backup-db.sh"),
        [],
        fixture.binDir,
        { FAKE_CORRUPT_BACKUP: "1" },
      );

      expect(result.exitCode).not.toBe(0);
      await expect(readdir(join(fixture.targetDir, "data", "backups"))).resolves.toEqual([]);
    } finally {
      await rm(fixture.sandbox, { recursive: true, force: true });
    }
  });

  test("publishes a checked backup and applies config retention only to safe backup pairs", async () => {
    const fixture = await createSqliteOperationalSandbox();
    const backupsDir = join(fixture.targetDir, "data", "backups");
    const expiredBackup = join(backupsDir, "tradereview-20200101T000000Z-101.sqlite");
    const expiredChecksum = `${expiredBackup}.sha256`;
    const unrelatedFile = join(backupsDir, "notes.sqlite");
    const symlinkTarget = join(fixture.sandbox, "outside.sqlite");
    const unsafeLink = join(backupsDir, "tradereview-20200101T000000Z-202.sqlite");

    try {
      await Promise.all([
        writeFile(join(fixture.targetDir, "config", ".env"), "APP_BIND=127.0.0.1\nAPP_PORT=3000\nBACKUP_RETENTION_DAYS=0\n"),
        writeFile(expiredBackup, "expired"),
        writeFile(expiredChecksum, "expired-checksum"),
        writeFile(unrelatedFile, "keep"),
        writeFile(symlinkTarget, "outside"),
      ]);
      await symlink(symlinkTarget, unsafeLink);
      const oldTime = new Date(Date.now() - 3 * 24 * 60 * 60 * 1_000);
      await Promise.all([utimes(expiredBackup, oldTime, oldTime), utimes(expiredChecksum, oldTime, oldTime), utimes(unrelatedFile, oldTime, oldTime)]);

      const result = await runOperationalScript(join(fixture.targetDir, "ops", "backup-db.sh"), [], fixture.binDir);
      const entries = await readdir(backupsDir);
      const publishedBackup = entries.find(
        (entry) => /^tradereview-\d{8}T\d{6}Z-\d+\.sqlite$/.test(entry) && !entry.includes("20200101"),
      );

      expect(result).toMatchObject({ exitCode: 0 });
      expect(publishedBackup).toBeDefined();
      expect(entries).not.toContain(basename(expiredBackup));
      expect(entries).not.toContain(basename(expiredChecksum));
      expect(entries).toContain(basename(unrelatedFile));
      expect(entries).toContain(basename(unsafeLink));
      const publishedPath = join(backupsDir, publishedBackup);
      expect((await stat(publishedPath)).mode & 0o777).toBe(0o600);
      expect((await stat(`${publishedPath}.sha256`)).mode & 0o777).toBe(0o600);
      const backedUpValue = await runProcess("/usr/bin/sqlite3", [publishedPath, "SELECT value FROM state;"]);
      expect(backedUpValue).toMatchObject({ exitCode: 0, stdout: "before\n" });
      expect(entries.some((entry) => entry.includes("partial"))).toBe(false);
    } finally {
      await rm(fixture.sandbox, { recursive: true, force: true });
    }
  });

  test("failed restore keeps the original database and returns the app to health", async () => {
    const fixture = await createSqliteOperationalSandbox();
    const restorePath = join(fixture.sandbox, "restore.sqlite");

    try {
      const initialized = await runProcess("/usr/bin/sqlite3", [
        restorePath,
        "CREATE TABLE state(value TEXT NOT NULL); INSERT INTO state VALUES('after');",
      ]);
      expect(initialized.exitCode).toBe(0);

      const result = await runOperationalScript(
        join(fixture.targetDir, "ops", "restore-db.sh"),
        [restorePath],
        fixture.binDir,
        { FAKE_RESTORE_FAILURE: "1" },
      );
      const liveValue = await runProcess("/usr/bin/sqlite3", [fixture.databasePath, "SELECT value FROM state;"]);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("synthetic restore failure");
      expect(liveValue).toMatchObject({ exitCode: 0, stdout: "before\n" });
      await expect(readFile(join(fixture.targetDir, ".fake-compose-state"), "utf8")).resolves.toBe("running\n");
      expect(await readdir(join(fixture.targetDir, "data", "sqlite"))).toEqual(["tradereview.sqlite"]);
    } finally {
      await rm(fixture.sandbox, { recursive: true, force: true });
    }
  }, 15_000);

  test("restores a checked database through an atomic swap and returns healthy", async () => {
    const fixture = await createSqliteOperationalSandbox();
    const restorePath = join(fixture.sandbox, "restore.sqlite");
    const healthServer = await startHealthServer();

    try {
      await writeFile(
        join(fixture.targetDir, "config", ".env"),
        `APP_BIND=127.0.0.1\nAPP_PORT=${healthServer.port}\nBACKUP_RETENTION_DAYS=30\n`,
      );
      const initialized = await runProcess("/usr/bin/sqlite3", [
        restorePath,
        "CREATE TABLE state(value TEXT NOT NULL); INSERT INTO state VALUES('after');",
      ]);
      expect(initialized.exitCode).toBe(0);

      const result = await runOperationalScript(
        join(fixture.targetDir, "ops", "restore-db.sh"),
        [restorePath],
        fixture.binDir,
      );
      const liveValue = await runProcess("/usr/bin/sqlite3", [fixture.databasePath, "SELECT value FROM state;"]);

      expect(result).toMatchObject({ exitCode: 0 });
      expect(liveValue).toMatchObject({ exitCode: 0, stdout: "after\n" });
      await expect(readFile(join(fixture.targetDir, ".fake-compose-state"), "utf8")).resolves.toBe("running\n");
      expect(await readdir(join(fixture.targetDir, "data", "sqlite"))).toEqual(["tradereview.sqlite"]);
    } finally {
      await healthServer.close();
      await rm(fixture.sandbox, { recursive: true, force: true });
    }
  }, 15_000);

  test("health failure after a restore swap rolls back the database and restarts the original app", async () => {
    const fixture = await createSqliteOperationalSandbox();
    const restorePath = join(fixture.sandbox, "restore.sqlite");
    const healthServer = await startHealthServer();

    try {
      await Promise.all([
        writeFile(
          join(fixture.targetDir, "config", ".env"),
          `APP_BIND=127.0.0.1\nAPP_PORT=${healthServer.port}\nBACKUP_RETENTION_DAYS=30\n`,
        ),
        writeFile(join(fixture.targetDir, ".fake-compose-unhealthy-count"), "1"),
      ]);
      const initialized = await runProcess("/usr/bin/sqlite3", [
        restorePath,
        "CREATE TABLE state(value TEXT NOT NULL); INSERT INTO state VALUES('after');",
      ]);
      expect(initialized.exitCode).toBe(0);

      const result = await runOperationalScript(
        join(fixture.targetDir, "ops", "restore-db.sh"),
        [restorePath],
        fixture.binDir,
      );
      const liveValue = await runProcess("/usr/bin/sqlite3", [fixture.databasePath, "SELECT value FROM state;"]);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Compose service health check failed");
      expect(liveValue).toMatchObject({ exitCode: 0, stdout: "before\n" });
      await expect(readFile(join(fixture.targetDir, ".fake-compose-state"), "utf8")).resolves.toBe("running\n");
      expect(await readdir(join(fixture.targetDir, "data", "sqlite"))).toEqual(["tradereview.sqlite"]);
    } finally {
      await healthServer.close();
      await rm(fixture.sandbox, { recursive: true, force: true });
    }
  }, 30_000);

  test("provide safe, consistent SQLite operational scripts", async () => {
    const [healthcheck, backup, restore, status] = await Promise.all([
      readManifest("deploy/ops/healthcheck.sh"),
      readManifest("deploy/ops/backup-db.sh"),
      readManifest("deploy/ops/restore-db.sh"),
      readManifest("deploy/ops/status.sh"),
    ]);

    for (const script of [healthcheck, backup, restore, status]) {
      expect(script).toContain("set -euo pipefail");
    }

    expect(backup).toContain("data/backups");
    expect(backup).toMatch(/date -u .*%Y%m%dT%H%M%SZ/);
    expect(backup).toContain("sha256");
    expect(backup).toContain(".backup");
    expect(backup).toContain("compose run");
    expect(backup).toContain('--user "$(id -u):$(id -g)"');
    expect(backup).not.toMatch(/\bcp\b|\brsync\b/);

    expect(restore).toContain('"$backup_path" == /*');
    expect(restore).toContain("-f");
    expect(restore).toContain("-L");
    expect(restore).toContain("checksum");
    expect(restore).toContain("pre-restore");
    expect(restore).toContain(".restore");
    expect(restore).toContain("compose stop");
    expect(restore).toContain("healthcheck.sh");
    expect(restore).toContain('--user "$(id -u):$(id -g)"');

    expect(healthcheck).toContain("compose ps");
    expect(healthcheck).toContain("fetch(");
    expect(status).toContain("active release");
    expect(status).toContain("retained releases");
    expect(status).toContain("checksum");
    expect(status).not.toMatch(/cat\s+[^\n]*\.env/);
  });

  test("dispatches each operational mode to its target-side script", async () => {
    const calls = [];
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-operation-dispatch-"));
    const targetDir = join(sandbox, "target");
    const backupPath = join(sandbox, "backup.sqlite");
    const operationRunner = async (command, args, options) => {
      calls.push({ command, args, options });
      return { exitCode: 0 };
    };

    try {
      await writeFile(backupPath, "backup");
      await runOperationalCommand({ targetDir, mode: "restore", backupPath }, { operationRunner });
      const canonicalTargetDir = join(realpathSync(sandbox), "target");

      expect(calls).toEqual([
        {
          command: join(canonicalTargetDir, "ops", "restore-db.sh"),
          args: [backupPath],
          options: { cwd: canonicalTargetDir, timeoutMs: 30 * 60_000 },
        },
      ]);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("provides SQLite operations without an apt repository dependency", async () => {
    const dockerfile = await readManifest("deploy/Dockerfile");
    const sqliteCli = await readManifest("deploy/ops/sqlite-cli.mjs");

    expect(dockerfile).not.toContain("apt-get");
    expect(dockerfile).toContain("sqlite-cli.mjs");
    expect(sqliteCli).toContain("node:sqlite");
    expect(sqliteCli).toContain("backup(");
  });

  test("backs up, checks, and restores SQLite databases with the runtime helper", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-sqlite-cli-"));
    const databasePath = join(sandbox, "source.sqlite");
    const backupPath = join(sandbox, "backup.sqlite");
    const restoredPath = join(sandbox, "restored.sqlite");
    const helperPath = resolve(root, "deploy/ops/sqlite-cli.mjs");

    try {
      const initialized = await runProcess("/usr/bin/sqlite3", [
        databasePath,
        "CREATE TABLE state (value TEXT); INSERT INTO state VALUES ('healthy');",
      ]);
      expect(initialized.exitCode).toBe(0);

      const backup = await runProcess(process.execPath, [
        helperPath,
        databasePath,
        `.backup '${backupPath}'`,
      ]);
      expect(backup.exitCode).toBe(0);

      const quickCheck = await runProcess(process.execPath, [
        helperPath,
        backupPath,
        "PRAGMA quick_check;",
      ]);
      expect(quickCheck.exitCode).toBe(0);
      expect(quickCheck.stdout.trim()).toBe("ok");

      const restore = await runProcess(process.execPath, [
        helperPath,
        restoredPath,
        `.restore '${backupPath}'`,
      ]);
      expect(restore.exitCode).toBe(0);

      const restoredValue = await runProcess("/usr/bin/sqlite3", [
        restoredPath,
        "SELECT value FROM state;",
      ]);
      expect(restoredValue.exitCode).toBe(0);
      expect(restoredValue.stdout.trim()).toBe("healthy");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("reports a missing SQLite directory instead of failing status", async () => {
    const fixture = await createOperationalSandbox();

    try {
      const result = await runOperationalScript(join(fixture.targetDir, "ops", "status.sh"), [], fixture.binDir);

      expect(result).toMatchObject({ exitCode: 0 });
      expect(result.stdout).toContain("database: missing");
    } finally {
      await rm(fixture.sandbox, { recursive: true, force: true });
    }
  });

  test("rejects unsafe restore inputs before touching the database", async () => {
    const fixture = await createOperationalSandbox();
    const restore = join(fixture.targetDir, "ops", "restore-db.sh");
    const missingPath = join(fixture.sandbox, "missing.sqlite");
    const directoryPath = join(fixture.sandbox, "backup-directory");
    const regularPath = join(fixture.sandbox, "backup.sqlite");
    const symlinkPath = join(fixture.sandbox, "backup-link.sqlite");

    try {
      await Promise.all([
        mkdir(directoryPath),
        writeFile(regularPath, "backup"),
        mkdir(join(fixture.targetDir, "data", "sqlite"), { recursive: true }),
      ]);
      await symlink(regularPath, symlinkPath);

      for (const input of ["relative.sqlite", missingPath, directoryPath, symlinkPath]) {
        const result = await runOperationalScript(restore, [input], fixture.binDir);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(/absolute|regular file/);
      }
    } finally {
      await rm(fixture.sandbox, { recursive: true, force: true });
    }
  });

  test("rejects mismatched and unsafe checksum sidecars before restore", async () => {
    const fixture = await createOperationalSandbox();
    const restore = join(fixture.targetDir, "ops", "restore-db.sh");
    const backupPath = join(fixture.sandbox, "backup.sqlite");
    const checksumPath = `${backupPath}.sha256`;
    const checksumTarget = join(fixture.sandbox, "checksum-target.sha256");

    try {
      await Promise.all([
        mkdir(join(fixture.targetDir, "data", "sqlite"), { recursive: true }),
        writeFile(backupPath, "backup"),
      ]);
      await writeFile(checksumPath, "not-the-backup  backup.sqlite\n");
      const mismatch = await runOperationalScript(restore, [backupPath], fixture.binDir);
      expect(mismatch.stderr).toContain("checksum verification failed");
      expect(mismatch.exitCode).toBe(1);

      await writeFile(checksumTarget, "unused\n");
      await rm(checksumPath);
      await symlink(checksumTarget, checksumPath);
      const unsafeSidecar = await runOperationalScript(restore, [backupPath], fixture.binDir);
      expect(unsafeSidecar).toMatchObject({ exitCode: 1 });
      expect(unsafeSidecar.stderr).toContain("checksum sidecar is unsafe");
    } finally {
      await rm(fixture.sandbox, { recursive: true, force: true });
    }
  });
});

describe("deployment port preflight", () => {
  test("accepts an available configured host port", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-port-available-"));
    const targetDir = join(sandbox, "target");
    const server = createTcpServer();

    try {
      await mkdir(join(targetDir, "config"), { recursive: true });
      await new Promise((resolveListen, rejectListen) => {
        server.once("error", rejectListen);
        server.listen(0, "127.0.0.1", resolveListen);
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Port test server did not bind");
      const port = address.port;
      await new Promise((resolveClose, rejectClose) => server.close((error) => (error ? rejectClose(error) : resolveClose())));
      await writeFile(join(targetDir, "config", ".env"), `APP_BIND=127.0.0.1\nAPP_PORT=${port}\n`);

      await expect(assertDeploymentPortAvailable(targetDir)).resolves.toBeUndefined();
    } finally {
      if (server.listening) await new Promise((resolveClose) => server.close(resolveClose));
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("reports an actionable error when the configured host port is occupied", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-port-occupied-"));
    const targetDir = join(sandbox, "target");
    const server = createTcpServer();

    try {
      await mkdir(join(targetDir, "config"), { recursive: true });
      await new Promise((resolveListen, rejectListen) => {
        server.once("error", rejectListen);
        server.listen(0, "127.0.0.1", resolveListen);
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Port test server did not bind");
      await writeFile(join(targetDir, "config", ".env"), `APP_BIND=127.0.0.1\nAPP_PORT=${address.port}\n`);

      await expect(assertDeploymentPortAvailable(targetDir)).rejects.toThrow(/already in use.*APP_PORT/i);
    } finally {
      if (server.listening) await new Promise((resolveClose) => server.close(resolveClose));
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("skips the probe for a target with an active release", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-port-active-"));
    const targetDir = join(sandbox, "target");
    const server = createTcpServer();

    try {
      await mkdir(join(targetDir, "config"), { recursive: true });
      await new Promise((resolveListen, rejectListen) => {
        server.once("error", rejectListen);
        server.listen(0, "127.0.0.1", resolveListen);
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Port test server did not bind");
      await writeFile(join(targetDir, "config", ".env"), `APP_BIND=127.0.0.1\nAPP_PORT=${address.port}\n`);

      await expect(assertDeploymentPortAvailable(targetDir, { skipIfActiveRelease: true })).resolves.toBeUndefined();
    } finally {
      if (server.listening) await new Promise((resolveClose) => server.close(resolveClose));
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("fails before Compose when the first-deployment port probe rejects", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-port-lifecycle-"));
    const sourceDir = join(sandbox, "source");
    const targetDir = join(sandbox, "target");
    let composeStarted = false;

    try {
      await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(join(targetDir, "config"), { recursive: true })]);
      await Promise.all([
        writeFile(join(sourceDir, "package.json"), "{}\n"),
        writeFile(join(targetDir, "config", ".env"), "APP_BIND=127.0.0.1\nAPP_PORT=4317\n"),
      ]);

      await expect(
        runDeployment(
          { mode: "code", sourceDir, targetDir },
          {
            commandRunner: async () => {
              composeStarted = true;
              return { exitCode: 0 };
            },
            portProbe: async () => {
              throw new Error("port already in use");
            },
          },
        ),
      ).rejects.toThrow("port already in use");
      expect(composeStarted).toBe(false);
      await expect(readdir(join(targetDir, "app", "releases"))).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});

describe("deployment path planning", () => {
  test("uses the documented deployment root by default", () => {
    expect(DEFAULT_DEPLOY_ROOT).toBe("/Users/zhoulin/projects/TradeReview");
    expect(parseArgs([])).toMatchObject({
      mode: "full",
      targetDir: DEFAULT_DEPLOY_ROOT,
      dryRun: false,
    });
  });

  test("maps a deployment root to isolated runtime paths", () => {
    expect(resolveDeploymentPaths("/srv/tradereview")).toEqual({
      appDir: "/srv/tradereview/app",
      releasesDir: "/srv/tradereview/app/releases",
      currentLink: "/srv/tradereview/app/current",
      configDir: "/srv/tradereview/config",
      dataDir: "/srv/tradereview/data",
      backupsDir: "/srv/tradereview/data/backups",
      logsDir: "/srv/tradereview/logs",
      opsDir: "/srv/tradereview/ops",
    });
  });

  test("rejects equal and nested source/target paths", () => {
    expect(() => validateDeploymentPaths("/repo", "/repo")).toThrow(/must differ/i);
    expect(() => validateDeploymentPaths("/repo", "/repo/releases")).toThrow(/inside/i);
    expect(() => validateDeploymentPaths("/repo/source", "/repo")).toThrow(/inside/i);
  });

  test("rejects the filesystem root as a mutating deployment target", async () => {
    await expect(validateMutatingTarget("/")).rejects.toThrow(/filesystem root/i);
  });

  test("rejects deploy-down at the filesystem root before Compose runs", async () => {
    let composeStarted = false;

    await expect(
      runDeployment(
        { mode: "down", targetDir: "/" },
        {
          composeRunner: async () => {
            composeStarted = true;
            return { exitCode: 0 };
          },
        },
      ),
    ).rejects.toThrow(/filesystem root/i);
    expect(composeStarted).toBe(false);
  });

  test("CLI options preserve and reject a relative deployment target before Compose runs", async () => {
    const options = parseArgs(["--mode=down", "--target=."]);
    let composeStarted = false;

    expect(options.targetDir).toBe(".");
    await expect(
      runDeployment(options, {
        composeRunner: async () => {
          composeStarted = true;
          return { exitCode: 0 };
        },
      }),
    ).rejects.toThrow(/target path must be absolute/i);
    expect(composeStarted).toBe(false);
  });

  test("deployment CLI rejects a relative target before Docker is invoked", async () => {
    const result = await runDeploymentCli(["--mode=down", "--target=."]);

    expect(result).toMatchObject({ exitCode: 1, stdout: "" });
    expect(result.stderr).toMatch(/target path must be absolute/i);
  });

  test("rejects symlink and non-directory mutating targets", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-target-validation-"));
    const directoryPath = join(sandbox, "directory");
    const symlinkPath = join(sandbox, "symlink");
    const filePath = join(sandbox, "file");

    try {
      await Promise.all([mkdir(directoryPath), writeFile(filePath, "not a directory")]);
      await symlink(directoryPath, symlinkPath);

      await expect(validateMutatingTarget(symlinkPath)).rejects.toThrow(/non-symlink directory/i);
      await expect(validateMutatingTarget(filePath)).rejects.toThrow(/non-symlink directory/i);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});

describe("deployment copy policy", () => {
  test("keeps runtime files exclusive to full deployments", () => {
    expect(getSyncPolicy("full")).toEqual({
      copyApplication: true,
      copyRuntimeFiles: true,
      preserveStorage: true,
      preserveConfig: true,
    });
    expect(getSyncPolicy("code")).toEqual({
      copyApplication: true,
      copyRuntimeFiles: false,
      preserveStorage: true,
      preserveConfig: true,
    });
  });
});

describe("deployment release staging", () => {
  test("creates sortable release identifiers", () => {
    expect(createReleaseId("/repo", new Date("2026-08-01T03:04:05.678Z"))).toMatch(
      /^20260801T030405Z-[a-z0-9-]+$/,
    );
  });

  test("copies only an application build context for code deployments", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-deploy-"));
    const sourceDir = join(sandbox, "source");
    const targetDir = join(sandbox, "target");

    try {
      const excludedDirectories = [
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
        ".worktrees",
      ];
      await Promise.all([
        mkdir(join(sourceDir, "deploy"), { recursive: true }),
        ...excludedDirectories.map((directory) => mkdir(join(sourceDir, directory), { recursive: true })),
      ]);
      await Promise.all([
        writeFile(join(sourceDir, "package.json"), "{}"),
        writeFile(join(sourceDir, "deploy", "Dockerfile"), "FROM node:22"),
        writeFile(join(sourceDir, "deploy", "Dockerfile.dockerignore"), "node_modules"),
        ...excludedDirectories.map((directory) => writeFile(join(sourceDir, directory, "ignored.txt"), "ignored")),
      ]);

      const result = await runDeployment({
        mode: "code",
        sourceDir,
        targetDir,
        now: new Date("2026-08-01T03:04:05.678Z"),
      });
      const releaseDir = join(targetDir, "app", "releases", result.releaseId);

      expect(basename(releaseDir)).toBe(result.releaseId);
      await expect(readFile(join(releaseDir, "package.json"), "utf8")).resolves.toBe("{}");
      await expect(readFile(join(releaseDir, "deploy", "Dockerfile.dockerignore"), "utf8")).resolves.toBe(
        "node_modules",
      );
      await Promise.all(
        excludedDirectories.map((directory) =>
          expect(readFile(join(releaseDir, directory, "ignored.txt"), "utf8")).rejects.toMatchObject({
            code: "ENOENT",
          }),
        ),
      );
      await expect(readFile(join(targetDir, "config", ".env"), "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("stages the tracked build and application data sources from the real repository", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-real-source-stage-"));
    const targetDir = join(sandbox, "target");

    try {
      const result = await runDeployment({
        mode: "code",
        sourceDir: root,
        targetDir,
        now: new Date("2026-08-01T03:04:05.678Z"),
      });

      await expect(readFile(join(result.releaseDir, "build", "sites-vite-plugin.ts"), "utf8")).resolves.toContain(
        "vite",
      );
      await expect(readFile(join(result.releaseDir, "app", "data", "demo-market.ts"), "utf8")).resolves.toContain(
        "export",
      );
      await expect(
        readFile(join(result.releaseDir, "app", "data", "exchange-holidays-2010-2030.json"), "utf8"),
      ).resolves.toContain("2010");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("never stages ignored environment files or private credentials", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-secret-stage-"));
    const sourceDir = join(sandbox, "source");
    const targetDir = join(sandbox, "target");
    const secretPaths = [
      ".env",
      ".env.local",
      ".npmrc",
      "app/.env.production",
      "app/private-key.pem",
      "config/signing.key",
      "config/client.p12",
      "config/client.pfx",
      "config/identity.jks",
      "config/id_ed25519",
      "deploy/config/.env",
    ];

    try {
      await Promise.all([
        mkdir(join(sourceDir, "app"), { recursive: true }),
        mkdir(join(sourceDir, "config"), { recursive: true }),
        mkdir(join(sourceDir, "deploy", "config"), { recursive: true }),
      ]);
      await Promise.all([
        writeFile(join(sourceDir, "package.json"), "{}\n"),
        writeFile(join(sourceDir, ".env.example"), "SAFE_EXAMPLE=value\n"),
        writeFile(join(sourceDir, "deploy", "config", ".env.example"), "APP_PORT=3000\n"),
        ...secretPaths.map((relativePath) => writeFile(join(sourceDir, relativePath), `sentinel:${relativePath}\n`)),
      ]);

      const result = await runDeployment({ mode: "code", sourceDir, targetDir });

      await expect(readFile(join(result.releaseDir, ".env.example"), "utf8")).resolves.toBe(
        "SAFE_EXAMPLE=value\n",
      );
      await expect(readFile(join(result.releaseDir, "deploy", "config", ".env.example"), "utf8")).resolves.toBe(
        "APP_PORT=3000\n",
      );
      for (const relativePath of secretPaths) {
        await expect(readFile(join(result.releaseDir, relativePath), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      }
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("stages a full release and updates current only when accepted", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-deploy-"));
    const sourceDir = join(sandbox, "source");
    const targetDir = join(sandbox, "target");

    try {
      await Promise.all([
        mkdir(join(sourceDir, "deploy", "config"), { recursive: true }),
        mkdir(join(targetDir, "config"), { recursive: true }),
      ]);
      await Promise.all([
        writeFile(join(sourceDir, "package.json"), "{}"),
        writeFile(join(sourceDir, "Makefile"), "deploy:\n\t@true\n"),
        writeFile(join(sourceDir, "deploy", "config", ".env.example"), "APP_PORT=3000\n"),
        writeFile(join(targetDir, "config", ".env"), "APP_PORT=9000\n"),
      ]);

      const staged = await runDeployment({
        mode: "full",
        sourceDir,
        targetDir,
        now: new Date("2026-08-01T03:04:05.678Z"),
      });

      await expect(readlink(join(targetDir, "app", "current"))).rejects.toMatchObject({ code: "ENOENT" });
      expect(staged.previousRelease).toBeUndefined();
      await expect(readFile(join(targetDir, "Makefile"), "utf8")).resolves.toContain("deploy:");
      await expect(readFile(join(targetDir, "config", ".env.example"), "utf8")).resolves.toBe(
        "APP_PORT=3000\n",
      );
      await expect(readFile(join(targetDir, "config", ".env"), "utf8")).resolves.toBe("APP_PORT=9000\n");

      const accepted = await runDeployment({
        mode: "full",
        sourceDir,
        targetDir,
        now: new Date("2026-08-01T03:04:06.678Z"),
        acceptRelease: true,
      });

      await expect(readlink(join(targetDir, "app", "current"))).resolves.toBe(
        join("releases", accepted.releaseId),
      );
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("rejects a symlinked app path before writing into protected target storage", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-deploy-"));
    const sourceDir = join(sandbox, "source");
    const targetDir = join(sandbox, "target");

    try {
      await mkdir(join(sourceDir), { recursive: true });
      await writeFile(join(sourceDir, "package.json"), "{}", "utf8");
      await mkdir(join(targetDir, "data"), { recursive: true });
      await symlink(join(targetDir, "data"), join(targetDir, "app"));

      await expect(
        runDeployment({ mode: "code", sourceDir, targetDir, now: new Date("2026-08-01T03:04:05.678Z") }),
      ).rejects.toThrow(/symlink|deployment path/i);
      await expect(readdir(join(targetDir, "data"))).resolves.toEqual([]);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("rejects a symlinked releases path before staging a release", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-deploy-"));
    const sourceDir = join(sandbox, "source");
    const targetDir = join(sandbox, "target");

    try {
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(sourceDir, "package.json"), "{}", "utf8");
      await mkdir(join(targetDir, "app"), { recursive: true });
      await mkdir(join(targetDir, "config"), { recursive: true });
      await symlink(join(targetDir, "config"), join(targetDir, "app", "releases"));

      await expect(
        runDeployment({ mode: "code", sourceDir, targetDir, now: new Date("2026-08-01T03:04:05.678Z") }),
      ).rejects.toThrow(/symlink|deployment path/i);
      await expect(readdir(join(targetDir, "config"))).resolves.toEqual([]);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("removes staged release artifacts when release acceptance fails", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-deploy-"));
    const sourceDir = join(sandbox, "source");
    const targetDir = join(sandbox, "target");

    try {
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(sourceDir, "package.json"), "{}", "utf8");

      await expect(
        runDeployment({
          mode: "code",
          sourceDir,
          targetDir,
          now: new Date("2026-08-01T03:04:05.678Z"),
          acceptRelease() {
            throw new Error("release rejected");
          },
        }),
      ).rejects.toThrow("release rejected");
      await expect(readdir(join(targetDir, "app", "releases"))).resolves.toEqual([]);
      await expect(readdir(join(targetDir, "app"))).resolves.toEqual(["releases"]);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("allocates a distinct release when retries share a timestamp", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-deploy-"));
    const sourceDir = join(sandbox, "source");
    const targetDir = join(sandbox, "target");
    const now = new Date("2026-08-01T03:04:05.678Z");

    try {
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(sourceDir, "package.json"), "{}", "utf8");

      const first = await runDeployment({ mode: "code", sourceDir, targetDir, now });
      const second = await runDeployment({ mode: "code", sourceDir, targetDir, now });

      expect(second.releaseId).not.toBe(first.releaseId);
      await expect(readFile(join(first.releaseDir, "package.json"), "utf8")).resolves.toBe("{}");
      await expect(readFile(join(second.releaseDir, "package.json"), "utf8")).resolves.toBe("{}");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});

function createRecordingCommandRunner(responses) {
  const calls = [];
  let responseIndex = 0;

  return {
    calls,
    commandRunner: async (command, args, options = {}) => {
      calls.push({ command, args, env: options.env });
      const response = responses[responseIndex];
      responseIndex += 1;
      return typeof response === "function" ? response({ command, args, options }) : response;
    },
  };
}

async function createLifecycleSandbox() {
  const sandbox = await mkdtemp(join(tmpdir(), "tradereview-compose-"));
  const sourceDir = join(sandbox, "source");
  const targetDir = join(sandbox, "target");
  const previousRelease = "previous-release";

  await Promise.all([
    mkdir(sourceDir, { recursive: true }),
    mkdir(join(targetDir, "app", "releases", previousRelease), { recursive: true }),
    mkdir(join(targetDir, "config"), { recursive: true }),
    mkdir(join(targetDir, "data"), { recursive: true }),
    mkdir(join(targetDir, "logs"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(sourceDir, "package.json"), "{}"),
    writeFile(join(targetDir, "compose.yaml"), "services: {}\n"),
    writeFile(join(targetDir, "config", ".env"), "COMPOSE_PROJECT_NAME=target-project\nSECRET=not-for-logs\n"),
    writeFile(join(targetDir, "data", "sentinel"), "data"),
    writeFile(join(targetDir, "logs", "sentinel"), "logs"),
  ]);
  await symlink(join("releases", previousRelease), join(targetDir, "app", "current"));

  return { sandbox, sourceDir, targetDir, previousRelease };
}

function composeArguments(targetDir, command) {
  const rootDir = realpathSync(targetDir);
  return [
    "compose",
    "--project-directory",
    rootDir,
    "--file",
    join(rootDir, "compose.yaml"),
    "--env-file",
    join(rootDir, "config", ".env"),
    ...command,
  ];
}

async function expectRuntimeFilesUntouched(targetDir) {
  await expect(readFile(join(targetDir, "config", ".env"), "utf8")).resolves.toBe(
    "COMPOSE_PROJECT_NAME=target-project\nSECRET=not-for-logs\n",
  );
  await expect(readFile(join(targetDir, "data", "sentinel"), "utf8")).resolves.toBe("data");
  await expect(readFile(join(targetDir, "logs", "sentinel"), "utf8")).resolves.toBe("logs");
}

describe("Compose lifecycle", () => {
  test("times out a Compose command runner that never settles", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-compose-timeout-"));
    const targetDir = join(sandbox, "target");

    try {
      const composeRunner = createComposeRunner({
        targetDir,
        commandTimeoutMs: 20,
        commandRunner: () => new Promise(() => {}),
      });
      const outcome = await Promise.race([
        composeRunner(["build"]).then(
          () => "unexpected success",
          (error) => error.message,
        ),
        new Promise((resolveTimeout) => setTimeout(() => resolveTimeout("no timeout enforced"), 150)),
      ]);

      expect(outcome).toMatch(/timed out/i);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("builds, starts, health-checks, and then switches current", async () => {
    const fixture = await createLifecycleSandbox();
    const recording = createRecordingCommandRunner([
      { exitCode: 0 },
      { exitCode: 0 },
      { exitCode: 0, stdout: '[{"Health":"healthy"}]' },
    ]);

    try {
      const result = await runDeployment(
        { mode: "code", sourceDir: fixture.sourceDir, targetDir: fixture.targetDir },
        { commandRunner: recording.commandRunner },
      );

      await expect(readlink(join(fixture.targetDir, "app", "current"))).resolves.toBe(
        join("releases", result.releaseId),
      );
      expect(recording.calls.map(({ command, args }) => ({ command, args }))).toEqual([
        { command: "docker", args: composeArguments(fixture.targetDir, ["build"]) },
        { command: "docker", args: composeArguments(fixture.targetDir, ["up", "--detach"]) },
        { command: "docker", args: composeArguments(fixture.targetDir, ["ps", "--format", "json"]) },
      ]);
      expect(recording.calls[0].env).toMatchObject({
        APP_RELEASE_CONTEXT: `./app/releases/${result.releaseId}`,
      });
      expect(JSON.stringify(recording.calls)).not.toContain("not-for-logs");
      await expectRuntimeFilesUntouched(fixture.targetDir);
    } finally {
      await rm(fixture.sandbox, { recursive: true, force: true });
    }
  });

  test("leaves current unchanged and restarts the previous release when build fails", async () => {
    const fixture = await createLifecycleSandbox();
    const recording = createRecordingCommandRunner([
      { exitCode: 1 },
      { exitCode: 0 },
      { exitCode: 0 },
      { exitCode: 0 },
      { exitCode: 0, stdout: '[{"Health":"healthy"}]' },
    ]);

    try {
      await expect(
        runDeployment(
          { mode: "code", sourceDir: fixture.sourceDir, targetDir: fixture.targetDir },
          { commandRunner: recording.commandRunner },
        ),
      ).rejects.toThrow("Docker Compose build failed");

      await expect(readlink(join(fixture.targetDir, "app", "current"))).resolves.toBe(
        join("releases", fixture.previousRelease),
      );
      expect(recording.calls.map(({ args }) => args.at(-1))).toEqual(["build", "app", "build", "--detach", "json"]);
      expect(recording.calls[2].env).toMatchObject({
        APP_RELEASE_CONTEXT: `./app/releases/${fixture.previousRelease}`,
      });
      expect(recording.calls[3].env).toMatchObject({
        APP_RELEASE_CONTEXT: `./app/releases/${fixture.previousRelease}`,
      });
      await expect(readdir(join(fixture.targetDir, "app", "releases"))).resolves.toEqual([
        fixture.previousRelease,
      ]);
      await expectRuntimeFilesUntouched(fixture.targetDir);
    } finally {
      await rm(fixture.sandbox, { recursive: true, force: true });
    }
  });

  test("reports both the deployment failure and a failed recovery", async () => {
    const fixture = await createLifecycleSandbox();
    const recording = createRecordingCommandRunner([
      { exitCode: 41, stderr: "candidate build sentinel" },
      { exitCode: 0, stdout: "candidate log sentinel" },
      { exitCode: 42, stderr: "previous build sentinel" },
    ]);

    try {
      await expect(
        runDeployment(
          { mode: "code", sourceDir: fixture.sourceDir, targetDir: fixture.targetDir },
          { commandRunner: recording.commandRunner },
        ),
      ).rejects.toThrow(/candidate build sentinel[\s\S]*recovery[\s\S]*previous build sentinel/i);
      await expect(readlink(join(fixture.targetDir, "app", "current"))).resolves.toBe(
        join("releases", fixture.previousRelease),
      );
    } finally {
      await rm(fixture.sandbox, { recursive: true, force: true });
    }
  });

  test("surfaces sanitized candidate logs, active release, and rollback command on failure", async () => {
    const fixture = await createLifecycleSandbox();
    let healthChecks = 0;
    const commandRunner = async (_command, args) => {
      const composeArgs = args.slice(7);
      if (composeArgs[0] === "logs") {
        return { exitCode: 0, stdout: "candidate container SECRET=not-for-logs\n" };
      }
      if (composeArgs[0] === "ps") {
        healthChecks += 1;
        return {
          exitCode: 0,
          stdout: healthChecks === 1 ? '[{"Health":"unhealthy"}]' : '[{"Health":"healthy"}]',
        };
      }
      return { exitCode: 0 };
    };

    try {
      let failure;
      try {
        await runDeployment(
          { mode: "code", sourceDir: fixture.sourceDir, targetDir: fixture.targetDir },
          { commandRunner },
        );
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(Error);
      expect(failure.message).toContain("candidate container SECRET=[REDACTED]");
      expect(failure.message).toContain(`Active release: ${fixture.previousRelease}`);
      expect(failure.message).toContain("make -C");
      expect(failure.message).not.toContain("not-for-logs");
    } finally {
      await rm(fixture.sandbox, { recursive: true, force: true });
    }
  });

  test("tears down a failed first-release candidate when there is no active release to recover", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-first-release-failure-"));
    const sourceDir = join(sandbox, "source");
    const targetDir = join(sandbox, "target");
    const commands = [];

    try {
      await Promise.all([
        mkdir(sourceDir, { recursive: true }),
        mkdir(join(targetDir, "config"), { recursive: true }),
      ]);
      await Promise.all([
        writeFile(join(sourceDir, "package.json"), "{}\n"),
        writeFile(join(targetDir, "compose.yaml"), "services: {}\n"),
        writeFile(join(targetDir, "config", ".env"), "APP_BIND=127.0.0.1\nAPP_PORT=3000\n"),
      ]);
      const composeRunner = async (args) => {
        commands.push(args[0]);
        if (args[0] === "ps") return { exitCode: 0, stdout: '[{"Health":"unhealthy"}]' };
        if (args[0] === "logs") return { exitCode: 0, stdout: "first candidate failed\n" };
        return { exitCode: 0 };
      };

      await expect(runDeployment({ mode: "code", sourceDir, targetDir }, { composeRunner })).rejects.toThrow(
        "first candidate failed",
      );
      expect(commands).toContain("down");
      await expect(readdir(join(targetDir, "app", "releases"))).resolves.toEqual([]);
      await expect(readlink(join(targetDir, "app", "current"))).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("failed manual rollback restores and health-checks the original active release", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-manual-rollback-"));
    const targetDir = join(sandbox, "target");
    const previousRelease = "20260701T000000Z-0000000001";
    const activeRelease = "20260801T000000Z-0000000002";
    const contexts = [];
    let healthChecks = 0;

    try {
      await Promise.all([
        mkdir(join(targetDir, "app", "releases", previousRelease), { recursive: true }),
        mkdir(join(targetDir, "app", "releases", activeRelease), { recursive: true }),
      ]);
      await symlink(join("releases", activeRelease), join(targetDir, "app", "current"));
      const composeRunner = async (args, env = {}) => {
        if (env.APP_RELEASE_CONTEXT) contexts.push(env.APP_RELEASE_CONTEXT);
        if (args[0] === "ps") {
          healthChecks += 1;
          return {
            exitCode: 0,
            stdout: healthChecks === 1 ? '[{"Health":"unhealthy"}]' : '[{"Health":"healthy"}]',
          };
        }
        if (args[0] === "logs") return { exitCode: 0, stdout: "rollback candidate failed\n" };
        return { exitCode: 0 };
      };

      await expect(
        runDeployment({ mode: "rollback", targetDir, healthTimeoutMs: 50 }, { composeRunner }),
      ).rejects.toThrow(/rollback candidate failed/i);
      await expect(readlink(join(targetDir, "app", "current"))).resolves.toBe(join("releases", activeRelease));
      expect(contexts).toContain(`./app/releases/${previousRelease}`);
      expect(contexts).toContain(`./app/releases/${activeRelease}`);
      expect(healthChecks).toBe(2);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("restores current and starts the previous release when health fails", async () => {
    const fixture = await createLifecycleSandbox();
    const now = new Date("2026-08-01T03:04:05.678Z");
    const candidateRelease = createReleaseId(realpathSync(fixture.sourceDir), now);
    const candidateContext = `./app/releases/${candidateRelease}`;
    const previousContext = `./app/releases/${fixture.previousRelease}`;
    const recording = createRecordingCommandRunner([
      { exitCode: 0 },
      { exitCode: 0 },
      { exitCode: 0, stdout: '[{"Health":"unhealthy"}]' },
      { exitCode: 0 },
      { exitCode: 0 },
      { exitCode: 0 },
      { exitCode: 0, stdout: '[{"Health":"healthy"}]' },
    ]);

    try {
      await expect(
        runDeployment(
          { mode: "code", sourceDir: fixture.sourceDir, targetDir: fixture.targetDir, now },
          { commandRunner: recording.commandRunner },
        ),
      ).rejects.toThrow("Docker Compose service is unhealthy");

      await expect(readlink(join(fixture.targetDir, "app", "current"))).resolves.toBe(
        join("releases", fixture.previousRelease),
      );
      expect(recording.calls.map(({ args, env }) => ({ args: args.slice(7), context: env.APP_RELEASE_CONTEXT }))).toEqual([
        { args: ["build"], context: candidateContext },
        { args: ["up", "--detach"], context: candidateContext },
        { args: ["ps", "--format", "json"], context: undefined },
        { args: ["logs", "--no-color", "--tail", "100", "app"], context: candidateContext },
        { args: ["build"], context: previousContext },
        { args: ["up", "--detach"], context: previousContext },
        { args: ["ps", "--format", "json"], context: undefined },
      ]);
      expect(recording.calls[4].env).toMatchObject({
        APP_RELEASE_CONTEXT: previousContext,
      });
      expect(recording.calls[5].env).toMatchObject({
        APP_RELEASE_CONTEXT: previousContext,
      });
      await expect(readdir(join(fixture.targetDir, "app", "releases"))).resolves.toEqual([
        fixture.previousRelease,
      ]);
      await expectRuntimeFilesUntouched(fixture.targetDir);
    } finally {
      await rm(fixture.sandbox, { recursive: true, force: true });
    }
  });

  test("exposes compose lifecycle helpers for explicit callers", async () => {
    const fixture = await createLifecycleSandbox();
    const recording = createRecordingCommandRunner([
      { exitCode: 0 },
      { exitCode: 0 },
      { exitCode: 0, stdout: '[{"Health":"healthy"}]' },
      { exitCode: 0 },
      { exitCode: 0 },
      { exitCode: 0, stdout: '[{"Health":"healthy"}]' },
    ]);

    try {
      const composeRunner = createComposeRunner({
        targetDir: fixture.targetDir,
        commandRunner: recording.commandRunner,
      });
      await buildAndStartRelease({
        targetDir: fixture.targetDir,
        releaseId: "candidate-release",
        previousRelease: fixture.previousRelease,
        composeRunner,
      });
      await waitForHealthy({ targetDir: fixture.targetDir, timeoutMs: 10, composeRunner });
      await rollbackRelease({
        targetDir: fixture.targetDir,
        releaseId: "candidate-release",
        previousRelease: fixture.previousRelease,
        composeRunner,
      });
      expect(recording.calls).toHaveLength(6);
    } finally {
      await rm(fixture.sandbox, { recursive: true, force: true });
    }
  });
});

async function createIntegrationSandbox() {
  const sandbox = await mkdtemp(join(tmpdir(), "tradereview-deployment-integration-"));
  const sourceDir = join(sandbox, "source");
  const targetDir = join(sandbox, "target");
  const previousRelease = "20260731T010203Z-previous";

  await Promise.all([
    mkdir(join(sourceDir, "deploy"), { recursive: true }),
    mkdir(join(targetDir, "app", "releases", previousRelease), { recursive: true }),
    mkdir(join(targetDir, "config"), { recursive: true }),
    mkdir(join(targetDir, "data", "sqlite"), { recursive: true }),
    mkdir(join(targetDir, "data", "backups"), { recursive: true }),
    mkdir(join(targetDir, "logs"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(sourceDir, "package.json"), "{}\n"),
    writeFile(join(sourceDir, "deploy", "Dockerfile"), "FROM node:22\n"),
    writeFile(join(targetDir, "compose.yaml"), "services: {}\n"),
    writeFile(join(targetDir, "config", ".env"), "APP_BIND=127.0.0.1\nAPP_PORT=3000\n"),
    writeFile(join(targetDir, "data", "sqlite", "tradereview.sqlite"), "database-sentinel"),
    writeFile(join(targetDir, "data", "backups", "backup.sqlite"), "backup-sentinel"),
    writeFile(join(targetDir, "logs", "app.log"), "log-sentinel"),
  ]);
  await symlink(join("releases", previousRelease), join(targetDir, "app", "current"));

  return { sandbox, sourceDir, targetDir, previousRelease };
}

describe("deployment filesystem integration", () => {
  test("recovers a validated lock whose local owner process is gone", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-stale-lock-"));
    const targetDir = join(sandbox, "target");
    const lockDir = join(targetDir, ".deploy-lock");

    try {
      await mkdir(lockDir, { recursive: true });
      await writeFile(
        join(lockDir, "owner.json"),
        `${JSON.stringify({
          pid: 999_999_999,
          hostname: hostname(),
          createdAt: "2020-01-01T00:00:00.000Z",
          token: "abandoned-lock",
        })}\n`,
      );

      const releaseLock = await acquireDeploymentLock(targetDir);
      const owner = JSON.parse(await readFile(join(lockDir, "owner.json"), "utf8"));
      expect(owner.pid).toBe(process.pid);
      expect(owner.token).not.toBe("abandoned-lock");
      await releaseLock();
      await expect(readFile(join(lockDir, "owner.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("successful publication enforces release retention without pruning unsafe entries", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-release-retention-"));
    const sourceDir = join(sandbox, "source");
    const targetDir = join(sandbox, "target");
    const releasesDir = join(targetDir, "app", "releases");
    const retainedBefore = [
      "20260101T000000Z-0000000001",
      "20260201T000000Z-0000000002",
      "20260301T000000Z-0000000003",
      "20260401T000000Z-0000000004",
    ];
    const unsafeTarget = join(sandbox, "outside-release");

    try {
      await Promise.all([
        mkdir(sourceDir, { recursive: true }),
        ...retainedBefore.map((release) => mkdir(join(releasesDir, release), { recursive: true })),
        mkdir(join(targetDir, "config"), { recursive: true }),
        mkdir(join(targetDir, "data"), { recursive: true }),
        mkdir(join(targetDir, "logs"), { recursive: true }),
        mkdir(unsafeTarget, { recursive: true }),
      ]);
      await Promise.all([
        writeFile(join(sourceDir, "package.json"), "{}\n"),
        writeFile(join(unsafeTarget, "sentinel"), "outside\n"),
        writeFile(join(targetDir, "compose.yaml"), "services: {}\n"),
        writeFile(
          join(targetDir, "config", ".env"),
          "APP_BIND=127.0.0.1\nAPP_PORT=3000\nRELEASES_TO_KEEP=3\n",
        ),
      ]);
      await symlink(join("releases", retainedBefore.at(-1)), join(targetDir, "app", "current"));
      await symlink(unsafeTarget, join(releasesDir, "20200101T000000Z-9999999999"));

      const result = await runDeployment(
        { mode: "code", sourceDir, targetDir, now: new Date("2026-08-01T03:04:05Z") },
        {
          composeRunner: async (args) =>
            args[0] === "ps" ? { exitCode: 0, stdout: '[{"Health":"healthy"}]' } : { exitCode: 0 },
        },
      );
      const entries = await readdir(releasesDir);

      expect(entries.sort()).toEqual(
        [retainedBefore[2], retainedBefore[3], result.releaseId, "20200101T000000Z-9999999999"].sort(),
      );
      await expect(readFile(join(unsafeTarget, "sentinel"), "utf8")).resolves.toBe("outside\n");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("full deployment initializes the approved target layout on first run", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-first-deploy-"));
    const sourceDir = join(sandbox, "source");
    const targetDir = join(sandbox, "target");

    try {
      await Promise.all([
        cp(join(root, "deploy"), join(sourceDir, "deploy"), { recursive: true }),
        mkdir(join(sourceDir, "scripts"), { recursive: true }),
      ]);
      await Promise.all([
        writeFile(join(sourceDir, "package.json"), "{}\n"),
        writeFile(join(sourceDir, "deploy", "config", ".env"), "SECRET=must-not-deploy\n"),
        cp(join(root, "scripts", "deploy.mjs"), join(sourceDir, "scripts", "deploy.mjs")),
        cp(join(root, "Makefile"), join(sourceDir, "Makefile")),
      ]);

      const result = await runDeployment(
        { mode: "full", sourceDir, targetDir },
        {
          composeRunner: async (args) =>
            args[0] === "ps" ? { exitCode: 0, stdout: '[{"Health":"healthy"}]' } : { exitCode: 0 },
        },
      );

      await expect(readlink(join(targetDir, "app", "current"))).resolves.toBe(
        join("releases", result.releaseId),
      );
      await expect(readFile(join(targetDir, "config", ".env.example"), "utf8")).resolves.toContain(
        "APP_BIND=127.0.0.1",
      );
      await expect(readFile(join(targetDir, "config", ".env"), "utf8")).resolves.toContain(
        "APP_BIND=127.0.0.1",
      );
      expect((await stat(join(targetDir, "config", ".env"))).mode & 0o777).toBe(0o600);
      expect((await stat(join(targetDir, "data", "sqlite", "tradereview.sqlite"))).mode & 0o777).toBe(0o600);
      await expect(readdir(join(targetDir, "data", "backups"))).resolves.toEqual([]);
      await expect(readdir(join(targetDir, "logs"))).resolves.toEqual([]);
      await expect(readFile(join(targetDir, "compose.yaml"), "utf8")).resolves.toContain("services:");
      await expect(readFile(join(targetDir, "Makefile"), "utf8")).resolves.toContain("deploy-status:");
      await expect(readFile(join(targetDir, "DEPLOYMENT.md"), "utf8")).resolves.toContain("Docker Compose");
      await expect(readFile(join(targetDir, "ops", "deploy.mjs"), "utf8")).resolves.toContain(
        "runDeployment",
      );
      await expect(readFile(join(targetDir, "ops", "backup-db.sh"), "utf8")).resolves.toContain(".backup");
      await expect(readFile(join(result.releaseDir, "deploy", "config", ".env"), "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });

      await Promise.all([
        writeFile(join(targetDir, "config", ".env"), "APP_BIND=127.0.0.1\nAPP_PORT=4321\nSECRET=preserved\n"),
        writeFile(join(targetDir, "data", "sqlite", "tradereview.sqlite"), "database-preserved"),
        writeFile(join(targetDir, "data", "backups", "sentinel.sqlite"), "backup-preserved"),
        writeFile(join(targetDir, "logs", "app.log"), "log-preserved"),
      ]);
      await runDeployment(
        { mode: "full", sourceDir, targetDir, now: new Date("2026-08-01T04:05:06Z") },
        {
          composeRunner: async (args) =>
            args[0] === "ps" ? { exitCode: 0, stdout: '[{"Health":"healthy"}]' } : { exitCode: 0 },
        },
      );
      await expect(readFile(join(targetDir, "config", ".env"), "utf8")).resolves.toBe(
        "APP_BIND=127.0.0.1\nAPP_PORT=4321\nSECRET=preserved\n",
      );
      await expect(readFile(join(targetDir, "data", "sqlite", "tradereview.sqlite"), "utf8")).resolves.toBe(
        "database-preserved",
      );
      await expect(readFile(join(targetDir, "data", "backups", "sentinel.sqlite"), "utf8")).resolves.toBe(
        "backup-preserved",
      );
      await expect(readFile(join(targetDir, "logs", "app.log"), "utf8")).resolves.toBe("log-preserved");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("runs deployed operational Make targets from the target root", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-target-make-"));
    const sourceDir = join(sandbox, "source");
    const targetDir = join(sandbox, "target");
    const binDir = join(sandbox, "bin");

    try {
      await Promise.all([
        cp(join(root, "deploy"), join(sourceDir, "deploy"), { recursive: true }),
        mkdir(join(sourceDir, "scripts"), { recursive: true }),
        mkdir(binDir, { recursive: true }),
      ]);
      await Promise.all([
        writeFile(join(sourceDir, "package.json"), "{}\n"),
        cp(join(root, "scripts", "deploy.mjs"), join(sourceDir, "scripts", "deploy.mjs")),
        cp(join(root, "Makefile"), join(sourceDir, "Makefile")),
        writeFile(
          join(binDir, "docker"),
          "#!/usr/bin/env bash\nif [[ \" $* \" == *\" --format json \"* ]]; then printf '[{\"Health\":\"healthy\"}]\\n'; else printf 'app running healthy\\n'; fi\n",
        ),
      ]);
      await chmod(join(binDir, "docker"), 0o755);
      await runDeployment(
        { mode: "full", sourceDir, targetDir },
        {
          composeRunner: async (args) =>
            args[0] === "ps" ? { exitCode: 0, stdout: '[{"Health":"healthy"}]' } : { exitCode: 0 },
        },
      );

      const environment = { PATH: `${binDir}:${process.env.PATH}` };
      const status = await runMake(targetDir, "deploy-status", environment);
      const code = await runMake(targetDir, "deploy-code", environment);
      const down = await runMake(targetDir, "deploy-down", environment);

      expect(status).toMatchObject({ exitCode: 0 });
      expect(status.stdout).toContain("active release:");
      expect(code).toMatchObject({ exitCode: 0 });
      expect(down).toMatchObject({ exitCode: 0 });
      expect(`${status.stderr}\n${code.stderr}\n${down.stderr}`).not.toContain("scripts/deploy.mjs");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("failed full deployment restores the previous runtime control plane before recovery", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-runtime-rollback-"));
    const sourceDir = join(sandbox, "source");
    const targetDir = join(sandbox, "target");
    const previousRelease = "20260731T010203Z-previous";
    let candidateContext;

    try {
      await Promise.all([
        cp(join(root, "deploy"), join(sourceDir, "deploy"), { recursive: true }),
        mkdir(join(sourceDir, "scripts"), { recursive: true }),
        mkdir(join(targetDir, "app", "releases", previousRelease), { recursive: true }),
        mkdir(join(targetDir, "config"), { recursive: true }),
        mkdir(join(targetDir, "data", "sqlite"), { recursive: true }),
        mkdir(join(targetDir, "data", "backups"), { recursive: true }),
        mkdir(join(targetDir, "logs"), { recursive: true }),
        mkdir(join(targetDir, "ops"), { recursive: true }),
      ]);
      await Promise.all([
        writeFile(join(sourceDir, "package.json"), "{}\n"),
        cp(join(root, "scripts", "deploy.mjs"), join(sourceDir, "scripts", "deploy.mjs")),
        writeFile(join(sourceDir, "deploy", "compose.yaml"), "new-compose\n"),
        writeFile(join(sourceDir, "deploy", "DEPLOYMENT.md"), "new-deployment-doc\n"),
        writeFile(join(targetDir, "compose.yaml"), "old-compose\n"),
        writeFile(join(targetDir, "Makefile"), "old-makefile\n"),
        writeFile(join(targetDir, "DEPLOYMENT.md"), "old-deployment-doc\n"),
        writeFile(join(targetDir, "ops", "status.sh"), "old-status-script\n"),
        writeFile(join(targetDir, "config", ".env"), "APP_BIND=127.0.0.1\nAPP_PORT=3000\n"),
        writeFile(join(targetDir, "config", ".env.example"), "old-env-example\n"),
        writeFile(join(targetDir, "data", "sqlite", "tradereview.sqlite"), "old-database\n"),
      ]);
      await symlink(join("releases", previousRelease), join(targetDir, "app", "current"));

      const composeRunner = async (args, env = {}) => {
        if (args[0] === "logs") return { exitCode: 0, stdout: "candidate log\n" };
        if (args[0] === "build" && env.APP_RELEASE_CONTEXT !== `./app/releases/${previousRelease}`) {
          candidateContext = env.APP_RELEASE_CONTEXT;
          throw new Error("synthetic candidate build failure");
        }
        if (args[0] === "build") {
          expect(await readFile(join(targetDir, "compose.yaml"), "utf8")).toBe("old-compose\n");
          return { exitCode: 0 };
        }
        if (args[0] === "ps") return { exitCode: 0, stdout: '[{"Health":"healthy"}]' };
        return { exitCode: 0 };
      };

      await expect(
        runDeployment({ mode: "full", sourceDir, targetDir }, { composeRunner }),
      ).rejects.toThrow("synthetic candidate build failure");

      expect(candidateContext).toMatch(/^\.\/app\/releases\//);
      await expect(readFile(join(targetDir, "compose.yaml"), "utf8")).resolves.toBe("old-compose\n");
      await expect(readFile(join(targetDir, "Makefile"), "utf8")).resolves.toBe("old-makefile\n");
      await expect(readFile(join(targetDir, "DEPLOYMENT.md"), "utf8")).resolves.toBe("old-deployment-doc\n");
      await expect(readFile(join(targetDir, "ops", "status.sh"), "utf8")).resolves.toBe("old-status-script\n");
      await expect(readFile(join(targetDir, "config", ".env.example"), "utf8")).resolves.toBe(
        "old-env-example\n",
      );
      await expect(readlink(join(targetDir, "app", "current"))).resolves.toBe(join("releases", previousRelease));
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("full integration copies Compose configuration to a clean target", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-clean-target-"));
    const sourceDir = join(sandbox, "source");
    const targetDir = join(sandbox, "target");

    try {
      await mkdir(join(sourceDir, "deploy", "config"), { recursive: true });
      await Promise.all([
        writeFile(join(sourceDir, "package.json"), "{}\n"),
        writeFile(join(sourceDir, "deploy", "Dockerfile"), "FROM node:22\n"),
        writeFile(join(sourceDir, "deploy", "compose.yaml"), "services: {}\n"),
        writeFile(join(sourceDir, "deploy", "config", ".env.example"), "APP_BIND=127.0.0.1\nAPP_PORT=3000\n"),
      ]);

      await runDeployment(
        { mode: "full", sourceDir, targetDir },
        {
          composeRunner: async (args) =>
            args[0] === "ps" ? { exitCode: 0, stdout: '[{"Health":"healthy"}]' } : { exitCode: 0 },
        },
      );

      await expect(readFile(join(targetDir, "compose.yaml"), "utf8")).resolves.toBe("services: {}\n");
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("code-only integration preserves protected storage", async () => {
    const fixture = await createIntegrationSandbox();
    const beforeEnv = await readFile(join(fixture.targetDir, "config", ".env"), "utf8");
    const beforeDatabase = await readFile(join(fixture.targetDir, "data", "sqlite", "tradereview.sqlite"));
    const beforeBackups = await readFile(join(fixture.targetDir, "data", "backups", "backup.sqlite"));
    const beforeLogs = await readFile(join(fixture.targetDir, "logs", "app.log"));

    try {
      const result = await runDeployment(
        { mode: "code", sourceDir: fixture.sourceDir, targetDir: fixture.targetDir },
        {
          composeRunner: async (args) =>
            args[0] === "ps" ? { exitCode: 0, stdout: '[{"Health":"healthy"}]' } : { exitCode: 0 },
        },
      );

      const afterEnv = await readFile(join(fixture.targetDir, "config", ".env"), "utf8");
      const afterDatabase = await readFile(join(fixture.targetDir, "data", "sqlite", "tradereview.sqlite"));
      const afterBackups = await readFile(join(fixture.targetDir, "data", "backups", "backup.sqlite"));
      const afterLogs = await readFile(join(fixture.targetDir, "logs", "app.log"));

      expect(afterEnv).toBe(beforeEnv);
      expect(afterDatabase).toEqual(beforeDatabase);
      expect(afterBackups).toEqual(beforeBackups);
      expect(afterLogs).toEqual(beforeLogs);
      expect(result.activeRelease).toMatch(/^[0-9]{8}T[0-9]{6}Z-/);
    } finally {
      await rm(fixture.sandbox, { recursive: true, force: true });
    }
  });

  test("integration health failure leaves the old release active", async () => {
    const fixture = await createIntegrationSandbox();

    try {
      await expect(
        runDeployment(
          { mode: "code", sourceDir: fixture.sourceDir, targetDir: fixture.targetDir },
          {
            composeRunner: async (args) =>
              args[0] === "ps" ? { exitCode: 0, stdout: '[{"Health":"unhealthy"}]' } : { exitCode: 0 },
          },
        ),
      ).rejects.toThrow("Docker Compose service is unhealthy");

      await expect(readlink(join(fixture.targetDir, "app", "current"))).resolves.toBe(
        join("releases", fixture.previousRelease),
      );
      await expect(readdir(join(fixture.targetDir, "app", "releases"))).resolves.toEqual([fixture.previousRelease]);
    } finally {
      await rm(fixture.sandbox, { recursive: true, force: true });
    }
  });

  test("rejects concurrent deployment lock acquisition", async () => {
    const fixture = await createIntegrationSandbox();
    let beginHealthCheck;
    let finishHealthCheck;
    const healthCheckStarted = new Promise((resolveStarted) => {
      beginHealthCheck = resolveStarted;
    });
    const healthCheckFinished = new Promise((resolveFinished) => {
      finishHealthCheck = resolveFinished;
    });
    const composeRunner = async (args) => {
      if (args[0] !== "ps") return { exitCode: 0 };
      beginHealthCheck();
      await healthCheckFinished;
      return { exitCode: 0, stdout: '[{"Health":"healthy"}]' };
    };

    try {
      const first = runDeployment(
        { mode: "code", sourceDir: fixture.sourceDir, targetDir: fixture.targetDir },
        { composeRunner },
      );
      await healthCheckStarted;

      await expect(
        runDeployment(
          { mode: "code", sourceDir: fixture.sourceDir, targetDir: fixture.targetDir },
          { composeRunner },
        ),
      ).rejects.toThrow(/deployment operation is already running/i);

      finishHealthCheck();
      await expect(first).resolves.toMatchObject({ accepted: true });
    } finally {
      await rm(fixture.sandbox, { recursive: true, force: true });
    }
  });

  test("restore rejects an unsafe backup path before dispatch", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-restore-validation-"));
    const targetDir = join(sandbox, "target");
    const directoryPath = join(sandbox, "backup-directory");
    const regularPath = join(sandbox, "backup.sqlite");
    const symlinkPath = join(sandbox, "backup-link.sqlite");
    let operationStarted = false;

    try {
      await Promise.all([mkdir(directoryPath), writeFile(regularPath, "backup")]);
      await symlink(regularPath, symlinkPath);

      for (const backupPath of ["relative.sqlite", directoryPath, symlinkPath]) {
        await expect(
          runDeployment(
            { mode: "restore", targetDir, backupPath },
            {
              operationRunner: async () => {
                operationStarted = true;
                return { exitCode: 0 };
              },
            },
          ),
        ).rejects.toThrow(/absolute regular file/i);
      }
      expect(operationStarted).toBe(false);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });
});
