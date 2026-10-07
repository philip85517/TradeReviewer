import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm, symlink, readFile, lstat } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import { createNativeRuntime } from "./deploy-native-runtime.mjs";

const children = new Set();
const scratch = new Set();

afterEach(async () => {
  for (const child of children) {
    try { process.kill(-child.pid, "SIGTERM"); } catch {}
  }
  children.clear();
  await Promise.all([...scratch].map((path) => rm(path, { recursive: true, force: true })));
  scratch.clear();
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "tradereview-runtime-"));
  scratch.add(root);
  const release = join(root, "release with spaces", "发布版");
  await mkdir(join(release, "node_modules", ".bin"), { recursive: true });
  await writeFile(join(release, "server.mjs"), `
    import http from "node:http";
    const port = Number(process.argv[process.argv.indexOf("--port") + 1]);
    const host = process.argv[process.argv.indexOf("--hostname") + 1];
    const server = http.createServer((req, res) => {
      res.writeHead(req.url === "/api/storage/status" || req.url === "/" ? 200 : 404);
      res.end("ok");
    });
    server.listen(port, host);
  `);
  const config = { databasePath: join(root, "db.sqlite"), port: await freePort(), hostname: "127.0.0.1", configPath: join(root, "runtime.json") };
  return { root, release, config };
}

async function freePort() {
  const net = await import("node:net");
  return await new Promise((resolve, reject) => {
    const server = net.createServer().listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function startFixture({ releaseDir, env, hostname, port }) {
  return spawn(process.execPath, [join(releaseDir, "server.mjs"), "--hostname", hostname, "--port", String(port)], {
    cwd: releaseDir,
    env,
    detached: true,
    stdio: "ignore",
  });
}

async function waitForListening(child, url, timeoutMs = 3_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`fixture exited before listening: ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.status >= 200 && response.status < 500) return;
    } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`fixture did not listen: ${lastError?.message || "timeout"}`);
}

test("starts, health-checks, and stops a real detached release process", async () => {
  const { root, release, config } = await fixture();
  const runtime = createNativeRuntime({ targetDir: root, runtimeConfig: config, healthTimeoutMs: 3_000,
    startCommand: ({ releaseDir, env, hostname, port }) => startFixture({ releaseDir, env, hostname, port }) });
  assert.equal(await runtime.inspect(), null);
  const service = await runtime.start(release);
  children.add(service);
  const healthy = await runtime.waitHealthy(release);
  assert.equal(healthy.cwd, realpathSync.native(release));
  assert.equal((await fetch(`http://${config.hostname}:${config.port}/`)).status, 200);
  await runtime.stop(service);
  children.delete(service);
  assert.equal(await runtime.inspect(), null);
});

test("does not stop or adopt a foreign listener on the configured port", async () => {
  const { root, release, config } = await fixture();
  const foreign = startFixture({ releaseDir: release, env: process.env, hostname: config.hostname, port: config.port });
  children.add(foreign);
  await waitForListening(foreign, `http://${config.hostname}:${config.port}/`);
  const runtime = createNativeRuntime({ targetDir: root, runtimeConfig: config, healthTimeoutMs: 500,
    startCommand: ({ releaseDir, env, hostname, port }) => startFixture({ releaseDir, env, hostname, port }) });
  await assert.rejects(() => runtime.start(release), /foreign|owned|listener|port/i);
  assert.equal((await fetch(`http://${config.hostname}:${config.port}/`)).status, 200);
});

test("refuses to stop a foreign process even when its cwd matches the release", async () => {
  const { root, release, config } = await fixture();
  const foreign = startFixture({ releaseDir: release, env: process.env, hostname: config.hostname, port: config.port });
  children.add(foreign);
  await waitForListening(foreign, `http://${config.hostname}:${config.port}/`);
  const runtime = createNativeRuntime({ targetDir: root, runtimeConfig: config });
  const inspected = await runtime.inspect();
  await assert.rejects(() => runtime.stop(inspected), /unrelated|stale/i);
  assert.equal((await fetch(`http://${config.hostname}:${config.port}/`)).status, 200);
});

test("rejects a listener that never provides both health endpoints and cleans up", async () => {
  const { root, release, config } = await fixture();
  await writeFile(join(release, "bad.mjs"), `import http from "node:http"; const p=Number(process.argv.at(-1)); http.createServer((q,r)=>{r.writeHead(q.url==="/api/storage/status"?500:200);r.end("bad")}).listen(p,"127.0.0.1");`);
  const runtime = createNativeRuntime({ targetDir: root, runtimeConfig: config, healthTimeoutMs: 300,
    startCommand: ({ releaseDir, env, port }) => {
      return spawn(process.execPath, [join(releaseDir, "bad.mjs"), String(port)], { cwd: releaseDir, env, detached: true, stdio: "ignore" });
    } });
  const service = await runtime.start(release);
  children.add(service);
  await assert.rejects(() => runtime.waitHealthy(release), /health|unhealthy|timeout/i);
  await runtime.stop(service);
  children.delete(service);
});

test("health-checks a listener spawned by the detached wrapper process", async () => {
  const { root, release, config } = await fixture();
  await writeFile(join(release, "wrapper.mjs"), `
    import { spawn } from "node:child_process";
    import { fileURLToPath } from "node:url";
    const child = spawn(process.execPath, [fileURLToPath(new URL("./server.mjs", import.meta.url)), "--hostname", process.argv[2], "--port", process.argv[3]], { stdio: "ignore" });
    child.on("exit", (code) => process.exit(code ?? 0));
    setInterval(() => {}, 1000);
  `);
  const runtime = createNativeRuntime({ targetDir: root, runtimeConfig: config, healthTimeoutMs: 3_000,
    startCommand: ({ releaseDir, env, hostname, port }) => spawn(process.execPath, [join(releaseDir, "wrapper.mjs"), hostname, String(port)], { cwd: releaseDir, env, detached: true, stdio: "ignore" }) });
  const service = await runtime.start(release);
  children.add(service);
  const healthy = await runtime.waitHealthy(release);
  assert.notEqual(healthy.pid, service.pid);
  await runtime.stop(service);
  children.delete(service);
  assert.equal(await runtime.inspect(), null);
});

test("rejects a healthy listener when its wrapper exits before first health", async () => {
  const { root, release, config } = await fixture();
  await writeFile(join(release, "early-wrapper.mjs"), `
    import { spawn } from "node:child_process";
    import { fileURLToPath } from "node:url";
    const child = spawn(process.execPath, [fileURLToPath(new URL("./server.mjs", import.meta.url)), "--hostname", process.argv[2], "--port", process.argv[3]], { stdio: "ignore" });
    setTimeout(() => child.kill("SIGTERM"), 1200);
  `);
  const runtime = createNativeRuntime({ targetDir: root, runtimeConfig: config, healthTimeoutMs: 300,
    startCommand: ({ releaseDir, env, hostname, port }) => spawn(process.execPath, [join(releaseDir, "early-wrapper.mjs"), hostname, String(port)], { cwd: releaseDir, env, detached: true, stdio: "ignore" }) });
  const service = await runtime.start(release);
  children.add(service);
  await assert.rejects(() => runtime.waitHealthy(release), /health|timeout|listener/i);
  await new Promise((resolve) => setTimeout(resolve, 1300));
  assert.equal(await runtime.inspect(), null);
  children.delete(service);
});

test("stops an orphan listener after its wrapper parent exits", async () => {
  const { root, release, config } = await fixture();
  await writeFile(join(release, "wrapper.mjs"), `
    import { spawn } from "node:child_process";
    import { fileURLToPath } from "node:url";
    spawn(process.execPath, [fileURLToPath(new URL("./server.mjs", import.meta.url)), "--hostname", process.argv[2], "--port", process.argv[3]], { stdio: "ignore" });
    setTimeout(() => process.exit(0), 1000);
  `);
  const runtime = createNativeRuntime({ targetDir: root, runtimeConfig: config, healthTimeoutMs: 3_000,
    startCommand: ({ releaseDir, env, hostname, port }) => spawn(process.execPath, [join(releaseDir, "wrapper.mjs"), hostname, String(port)], { cwd: releaseDir, env, detached: true, stdio: "ignore" }) });
  const service = await runtime.start(release);
  children.add(service);
  await runtime.waitHealthy(release);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await runtime.stop(service);
  children.delete(service);
  assert.equal(await runtime.inspect(), null);
});

test("startup failure retains a cleanup handle and leaves the port free", async () => {
  const { root, release, config } = await fixture();
  await writeFile(join(release, "exit.mjs"), "process.exit(1);");
  const runtime = createNativeRuntime({ targetDir: root, runtimeConfig: config, healthTimeoutMs: 300,
    startCommand: ({ releaseDir, env }) => spawn(process.execPath, [join(releaseDir, "exit.mjs")], { cwd: releaseDir, env, detached: true, stdio: "ignore" }) });
  const service = await runtime.start(release);
  children.add(service);
  await assert.rejects(() => runtime.waitHealthy(release), /health|timeout/i);
  await runtime.stop(service);
  children.delete(service);
  assert.equal(await runtime.inspect(), null);
});

test("never stops a same-command replacement after a null startup identity", async () => {
  const { root, release, config } = await fixture();
  let started = false;
  const runtime = createNativeRuntime({ targetDir: root, runtimeConfig: config, healthTimeoutMs: 100,
    commandRunner: async (command, args) => {
      if (command === "lsof" && args.includes("-iTCP:")) return started ? { code: 0, stdout: "p123\n" } : { code: 1, stdout: "" };
      if (command === "ps") {
        if (!started) return { code: 1, stdout: "" };
        return { code: 0, stdout: "123 1 123 Mon Oct  6 10:00:00 2026 node start-local.mjs\n" };
      }
      if (command === "lsof" && args.includes("cwd")) return { code: 0, stdout: `n${release}\n` };
      return { code: 1, stdout: "" };
    },
    startCommand: async () => ({ pid: 123, unref() {}, once() {} }),
  });
  const service = await runtime.start(release);
  started = true;
  await assert.rejects(() => runtime.stop(service), /unrelated|stale|ambiguous/i);
});

test("build runs npm ci and npm run build with production runtime environment", async () => {
  const { root, release, config } = await fixture();
  const calls = [];
  const runtime = createNativeRuntime({ targetDir: root, runtimeConfig: config, commandRunner: async (command, args, options) => {
    calls.push({ command, args, options });
    return { code: 0, stdout: "", stderr: "" };
  } });
  await runtime.build(release);
  const npmCli = join(dirname(process.execPath), "..", "libexec", "lib", "node_modules", "npm", "bin", "npm-cli.js");
  assert.deepEqual(calls.map((call) => [call.command, call.args]), [[process.execPath, [npmCli, "ci", "--include=dev"]], [process.execPath, [npmCli, "run", "build"]]]);
  assert.equal(calls[0].options.cwd, realpathSync.native(release));
  assert.equal(calls[0].options.env.NODE_ENV, "production");
  assert.equal(calls[0].options.env.TRADEREVIEW_DB_PATH, config.databasePath);
  assert.equal(calls[0].options.env.TRADEREVIEW_RUNTIME_CONFIG, undefined);
});

test("build failure is finite and leaves the old service untouched", async () => {
  const { root, release, config } = await fixture();
  const runtime = createNativeRuntime({ targetDir: root, runtimeConfig: config, commandRunner: async () => ({ code: 1, stdout: "", stderr: "build failed" }) });
  await assert.rejects(() => runtime.build(release), /npm ci|build failed|exit 1/i);
});

test("rejects a mismatched runtime before build or log side effects", async () => {
  const { root, release, config } = await fixture();
  let commands = 0;
  const runtime = createNativeRuntime({ targetDir: root, runtimeConfig: config, nativeEnvironmentOptions: { versions: { node: "25.0.0", sqlite: "3.53.0" }, execPath: "/wrong/node" }, commandRunner: async () => { commands += 1; return { code: 0 }; } });
  await assert.rejects(() => runtime.build(release), /Node\.js 26\.0\.0/);
  assert.equal(commands, 0);
  await assert.rejects(() => lstat(join(root, "logs")), { code: "ENOENT" });
});

test("rejects a mismatched runtime before service inspection or start", async () => {
  const { root, release, config } = await fixture();
  let inspected = 0; let started = 0;
  const runtime = createNativeRuntime({ targetDir: root, runtimeConfig: config, nativeEnvironmentOptions: { versions: { node: "26.0.0", sqlite: "3.52.0" }, execPath: process.execPath, getSqliteVersion: () => "3.52.0" }, commandRunner: async () => { inspected += 1; return { code: 0, stdout: "" }; }, startCommand: async () => { started += 1; return { pid: 1 }; } });
  await assert.rejects(() => runtime.start(release), /SQLite 3\.53\.0/);
  assert.equal(inspected, 0);
  assert.equal(started, 0);
});

test("retains build stdout and stderr in the target build log", async () => {
  const { root, release, config } = await fixture();
  const runtime = createNativeRuntime({ targetDir: root, runtimeConfig: config, commandRunner: async () => ({ code: 0, stdout: "build stdout\n", stderr: "build stderr\n" }) });
  await runtime.build(release);
  const log = await readFile(join(root, "logs", `build-${release.split("/").at(-1)}.log`), "utf8");
  assert.match(log, /build stdout/);
  assert.match(log, /build stderr/);
});

test("retains failed build diagnostics and refuses symlinked log paths", async () => {
  const { root, release, config } = await fixture();
  const runtime = createNativeRuntime({ targetDir: root, runtimeConfig: config, commandRunner: async () => ({ code: 1, stdout: "failed stdout\n", stderr: "failed stderr\n" }) });
  await assert.rejects(() => runtime.build(release), /exited 1/);
  const log = await readFile(join(root, "logs", `build-${release.split("/").at(-1)}.log`), "utf8");
  assert.match(log, /failed stdout/);
  assert.match(log, /failed stderr/);

  const linkedRoot = await mkdtemp(join(tmpdir(), "tradereview-runtime-log-link-"));
  const outsider = await mkdtemp(join(tmpdir(), "tradereview-runtime-log-outside-"));
  await symlink(outsider, join(linkedRoot, "logs"));
  const linkedDirectoryRuntime = createNativeRuntime({ targetDir: linkedRoot, runtimeConfig: { ...config, port: await freePort() }, commandRunner: async () => ({ code: 0, stdout: "", stderr: "" }) });
  await assert.rejects(() => linkedDirectoryRuntime.build(release), /logs|symlink|ordinary/i);
  assert.equal((await lstat(outsider)).isDirectory(), true);
  await rm(linkedRoot, { recursive: true, force: true });

  const wranglerRoot = await mkdtemp(join(tmpdir(), "tradereview-runtime-wrangler-link-"));
  const wranglerOutsider = await mkdtemp(join(tmpdir(), "tradereview-runtime-wrangler-outside-"));
  await mkdir(join(wranglerRoot, "logs"), { recursive: true });
  await symlink(join(wranglerOutsider, "wrangler.log"), join(wranglerRoot, "logs", "wrangler.log"));
  let startCalls = 0;
  let npmCalls = 0;
  const linkedRuntime = createNativeRuntime({ targetDir: wranglerRoot, runtimeConfig: { ...config, port: await freePort() }, commandRunner: async (command) => { if (command === "npm") npmCalls += 1; return { code: 1, stdout: "", stderr: "" }; }, startCommand: async () => { startCalls += 1; return { pid: 1 }; } });
  await assert.rejects(() => linkedRuntime.build(release), /logs|symlink|ordinary/i);
  await assert.rejects(() => linkedRuntime.start(release), /logs|symlink|ordinary/i);
  assert.equal(npmCalls, 0);
  assert.equal(startCalls, 0);
  assert.equal((await lstat(join(wranglerOutsider, "wrangler.log")).catch(() => null)), null);
  assert.equal((await lstat(wranglerOutsider)).isDirectory(), true);
  await rm(wranglerRoot, { recursive: true, force: true }); await rm(wranglerOutsider, { recursive: true, force: true });
});
