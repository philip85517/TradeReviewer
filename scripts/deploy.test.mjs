import { mkdtemp, mkdir, readdir, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  buildAndStartRelease,
  createComposeRunner,
  DEFAULT_DEPLOY_ROOT,
  createReleaseId,
  getSyncPolicy,
  parseArgs,
  rollbackRelease,
  resolveDeploymentPaths,
  runDeployment,
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
      backupsDir: "/srv/tradereview/backups",
      logsDir: "/srv/tradereview/logs",
      opsDir: "/srv/tradereview/deploy",
    });
  });

  test("rejects equal and nested source/target paths", () => {
    expect(() => validateDeploymentPaths("/repo", "/repo")).toThrow(/must differ/i);
    expect(() => validateDeploymentPaths("/repo", "/repo/releases")).toThrow(/inside/i);
    expect(() => validateDeploymentPaths("/repo/source", "/repo")).toThrow(/inside/i);
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
      /^20260801T030405678Z-[a-z0-9-]+$/,
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
          { mode: "code", sourceDir: fixture.sourceDir, targetDir: fixture.targetDir },
          { commandRunner: recording.commandRunner },
        ),
      ).rejects.toThrow("Docker Compose service is unhealthy");

      await expect(readlink(join(fixture.targetDir, "app", "current"))).resolves.toBe(
        join("releases", fixture.previousRelease),
      );
      expect(recording.calls.map(({ args }) => args.at(-1))).toEqual(["build", "--detach", "json", "build", "--detach"]);
      expect(recording.calls[3].env).toMatchObject({
        APP_RELEASE_CONTEXT: `./app/releases/${fixture.previousRelease}`,
      });
      expect(recording.calls[4].env).toMatchObject({
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
