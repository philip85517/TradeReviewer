import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url).pathname;

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

async function waitForServer(child, url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`dev server exited with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(`${url}/api/storage/status`);
      return response;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("timed out waiting for the dev server");
}

test("dev server exposes a working SQLite storage API", async () => {
  const port = await freePort();
  const directory = mkdtempSync(join(tmpdir(), "tradereview-dev-storage-"));
  const child = spawn(
    "npm",
    ["run", "dev", "--", "--port", String(port)],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        TRADEREVIEW_DB_PATH: join(directory, "tradereview.sqlite"),
      },
      stdio: "ignore",
    },
  );

  try {
    const response = await waitForServer(child, `http://localhost:${port}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.schemaVersion, 3);
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});
