import { mkdtemp, mkdir, readdir, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  DEFAULT_DEPLOY_ROOT,
  createReleaseId,
  getSyncPolicy,
  parseArgs,
  resolveDeploymentPaths,
  runDeployment,
  validateDeploymentPaths,
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
