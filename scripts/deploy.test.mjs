import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

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
    const [makefile, compose, envExample, dockerfile] = await Promise.all([
      readManifest("Makefile"),
      readManifest("deploy/compose.yaml"),
      readManifest("deploy/config/.env.example"),
      readManifest("deploy/Dockerfile"),
    ]);

    expect(makefile).toContain("deploy-code:");
    expect(makefile).toContain("/Users/zhoulin/projects/TradeReview");
    expect(compose).toContain("name: ${COMPOSE_PROJECT_NAME:-tradereview}");
    expect(compose).toContain("./data/sqlite:/var/lib/tradereview");
    expect(envExample).toContain("APP_BIND=127.0.0.1");
    expect(dockerfile).toContain("npm run assets:ocr");
  });
});
