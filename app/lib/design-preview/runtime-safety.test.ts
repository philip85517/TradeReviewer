import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkDesignPreviewRuntime, expectedDesignPreviewDatabasePath } from "./runtime-safety";

const temporaryDirectories: string[] = [];

function makeIsolatedDatabase(): { cwd: string; databasePath: string } {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), "tradereview-design-preview-")));
  temporaryDirectories.push(cwd);
  const databasePath = expectedDesignPreviewDatabasePath(cwd);
  mkdirSync(dirname(databasePath), { recursive: true });
  writeFileSync(databasePath, "temporary test database");
  return { cwd, databasePath };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("checkDesignPreviewRuntime", () => {
  it("allows only the explicit isolated flag and matching ordinary file", () => {
    const { cwd, databasePath } = makeIsolatedDatabase();

    expect(checkDesignPreviewRuntime({
      cwd,
      env: {
        NODE_ENV: "test",
        TRADEREVIEW_DESIGN_PREVIEW: "isolated",
        TRADEREVIEW_DB_PATH: databasePath,
      },
    })).toMatchObject({ allowed: true, expectedDatabasePath: databasePath });
  });

  it("rejects missing or non-isolated preview flags", () => {
    const { cwd, databasePath } = makeIsolatedDatabase();

    expect(checkDesignPreviewRuntime({ cwd, env: { NODE_ENV: "test", TRADEREVIEW_DB_PATH: databasePath } }).allowed).toBe(false);
    expect(checkDesignPreviewRuntime({
      cwd,
      env: { NODE_ENV: "test", TRADEREVIEW_DESIGN_PREVIEW: "true", TRADEREVIEW_DB_PATH: databasePath },
    }).allowed).toBe(false);
  });

  it("rejects an absent isolated database file", () => {
    const cwd = realpathSync(mkdtempSync(join(tmpdir(), "tradereview-design-preview-missing-")));
    temporaryDirectories.push(cwd);
    const databasePath = expectedDesignPreviewDatabasePath(cwd);

    expect(checkDesignPreviewRuntime({
      cwd,
      env: { NODE_ENV: "test", TRADEREVIEW_DESIGN_PREVIEW: "isolated", TRADEREVIEW_DB_PATH: databasePath },
    }).allowed).toBe(false);
  });

  it("rejects a relative, formal, or otherwise mismatched database path", () => {
    const { cwd } = makeIsolatedDatabase();
    const formalPath = join(cwd, "formal.sqlite");
    writeFileSync(formalPath, "formal test database");

    expect(checkDesignPreviewRuntime({
      cwd,
      env: { NODE_ENV: "test", TRADEREVIEW_DESIGN_PREVIEW: "isolated", TRADEREVIEW_DB_PATH: "./.scratch/local-review-20261006/review.sqlite" },
    }).allowed).toBe(false);
    expect(checkDesignPreviewRuntime({
      cwd,
      env: { NODE_ENV: "test", TRADEREVIEW_DESIGN_PREVIEW: "isolated", TRADEREVIEW_DB_PATH: formalPath },
    }).allowed).toBe(false);
    expect(checkDesignPreviewRuntime({
      cwd,
      env: { NODE_ENV: "test", TRADEREVIEW_DESIGN_PREVIEW: "isolated", TRADEREVIEW_DB_PATH: join(cwd, "other.sqlite") },
    }).allowed).toBe(false);
  });

  it("rejects symlinks and non-files even when the configured path text matches", () => {
    const symlinkRoot = mkdtempSync(join(tmpdir(), "tradereview-design-preview-link-"));
    temporaryDirectories.push(symlinkRoot);
    const symlinkDatabasePath = expectedDesignPreviewDatabasePath(symlinkRoot);
    mkdirSync(dirname(symlinkDatabasePath), { recursive: true });
    const target = join(symlinkRoot, "target.sqlite");
    writeFileSync(target, "target database");
    symlinkSync(target, symlinkDatabasePath);

    expect(checkDesignPreviewRuntime({
      cwd: symlinkRoot,
      env: { NODE_ENV: "test", TRADEREVIEW_DESIGN_PREVIEW: "isolated", TRADEREVIEW_DB_PATH: symlinkDatabasePath },
    }).allowed).toBe(false);

    const directoryRoot = mkdtempSync(join(tmpdir(), "tradereview-design-preview-directory-"));
    temporaryDirectories.push(directoryRoot);
    const directoryDatabasePath = expectedDesignPreviewDatabasePath(directoryRoot);
    mkdirSync(directoryDatabasePath, { recursive: true });
    expect(checkDesignPreviewRuntime({
      cwd: directoryRoot,
      env: { NODE_ENV: "test", TRADEREVIEW_DESIGN_PREVIEW: "isolated", TRADEREVIEW_DB_PATH: directoryDatabasePath },
    }).allowed).toBe(false);
  });

  it("rejects a regular file reached through a symlinked parent directory", () => {
    const cwd = realpathSync(mkdtempSync(join(tmpdir(), "tradereview-design-preview-parent-link-")));
    const outsideRoot = realpathSync(mkdtempSync(join(tmpdir(), "tradereview-design-preview-parent-target-")));
    temporaryDirectories.push(cwd, outsideRoot);
    const targetScratch = join(outsideRoot, ".scratch", "local-review-20261006");
    mkdirSync(targetScratch, { recursive: true });
    const targetDatabasePath = join(targetScratch, "review.sqlite");
    writeFileSync(targetDatabasePath, "target database");
    symlinkSync(join(outsideRoot, ".scratch"), join(cwd, ".scratch"), "dir");
    const configuredDatabasePath = expectedDesignPreviewDatabasePath(cwd);

    expect(checkDesignPreviewRuntime({
      cwd,
      env: { NODE_ENV: "test", TRADEREVIEW_DESIGN_PREVIEW: "isolated", TRADEREVIEW_DB_PATH: configuredDatabasePath },
    }).allowed).toBe(false);
  });
});
