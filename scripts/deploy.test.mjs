import { chmod, cp, mkdtemp, mkdir, readdir, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { describe, expect, test } from "vitest";
import {
  buildAndStartRelease,
  createComposeRunner,
  DEFAULT_DEPLOY_ROOT,
  createReleaseId,
  getSyncPolicy,
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
    cp(join(root, "deploy", "ops"), join(targetDir, "deploy", "ops"), { recursive: true }),
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

async function runOperationalScript(scriptPath, args, binDir) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(scriptPath, args, {
      env: { ...process.env, PATH: `${binDir}:${process.env.PATH}`, LC_ALL: "C", LANG: "C" },
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

describe("deployment templates", () => {
  test("provide the repository deployment contract", async () => {
    const [makefile, compose, envExample, dockerfile, dockerfileIgnore] = await Promise.all([
      readManifest("Makefile"),
      readManifest("deploy/compose.yaml"),
      readManifest("deploy/config/.env.example"),
      readManifest("deploy/Dockerfile"),
      readManifest("deploy/Dockerfile.dockerignore"),
    ]);

    expect(makefile).toContain("deploy-code:");
    expect(makefile).toContain("/Users/zhoulin/projects/TradeReview");
    expect(compose).toContain("name: ${COMPOSE_PROJECT_NAME:-tradereview}");
    expect(compose).toContain("./data/sqlite:/var/lib/tradereview");
    expect(envExample).toContain("APP_BIND=127.0.0.1");
    expect(dockerfile).toContain("npm run assets:ocr");
    expect(dockerfileIgnore).toContain(".env");
    expect(dockerfileIgnore).toContain("data");
  });
});

describe("SQLite operations", () => {
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
    expect(backup).not.toMatch(/\bcp\b|\brsync\b/);

    expect(restore).toContain('"$backup_path" == /*');
    expect(restore).toContain("-f");
    expect(restore).toContain("-L");
    expect(restore).toContain("checksum");
    expect(restore).toContain("pre-restore");
    expect(restore).toContain(".restore");
    expect(restore).toContain("compose stop");
    expect(restore).toContain("healthcheck.sh");

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
          command: join(canonicalTargetDir, "deploy", "ops", "restore-db.sh"),
          args: [backupPath],
          options: { cwd: canonicalTargetDir },
        },
      ]);
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  });

  test("includes the SQLite CLI in the Compose runtime image", async () => {
    const dockerfile = await readManifest("deploy/Dockerfile");

    expect(dockerfile).toContain("sqlite3");
  });

  test("reports a missing SQLite directory instead of failing status", async () => {
    const fixture = await createOperationalSandbox();

    try {
      const result = await runOperationalScript(join(fixture.targetDir, "deploy", "ops", "status.sh"), [], fixture.binDir);

      expect(result).toMatchObject({ exitCode: 0 });
      expect(result.stdout).toContain("database: missing");
    } finally {
      await rm(fixture.sandbox, { recursive: true, force: true });
    }
  });

  test("rejects unsafe restore inputs before touching the database", async () => {
    const fixture = await createOperationalSandbox();
    const restore = join(fixture.targetDir, "deploy", "ops", "restore-db.sh");
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
    const restore = join(fixture.targetDir, "deploy", "ops", "restore-db.sh");
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
      opsDir: "/srv/tradereview/deploy",
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
        "build",
        ".next",
        ".wrangler",
        "data",
        "logs",
        "config",
        "trades",
        ".superpowers",
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
      await expect(readFile(join(targetDir, "deploy", "config", ".env.example"), "utf8")).resolves.toBe(
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
    const recording = createRecordingCommandRunner([{ exitCode: 1 }, { exitCode: 0 }, { exitCode: 0 }]);

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
      expect(recording.calls.map(({ args }) => args.at(-1))).toEqual(["build", "build", "--detach"]);
      expect(recording.calls[1].env).toMatchObject({
        APP_RELEASE_CONTEXT: `./app/releases/${fixture.previousRelease}`,
      });
      expect(recording.calls[2].env).toMatchObject({
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
        { args: ["build"], context: previousContext },
        { args: ["up", "--detach"], context: previousContext },
      ]);
      expect(recording.calls[3].env).toMatchObject({
        APP_RELEASE_CONTEXT: previousContext,
      });
      expect(recording.calls[4].env).toMatchObject({
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
      expect(recording.calls).toHaveLength(5);
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
  test("full integration copies Compose configuration to a clean target", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "tradereview-clean-target-"));
    const sourceDir = join(sandbox, "source");
    const targetDir = join(sandbox, "target");

    try {
      await mkdir(join(sourceDir, "deploy"), { recursive: true });
      await Promise.all([
        writeFile(join(sourceDir, "package.json"), "{}\n"),
        writeFile(join(sourceDir, "deploy", "Dockerfile"), "FROM node:22\n"),
        writeFile(join(sourceDir, "deploy", "compose.yaml"), "services: {}\n"),
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
