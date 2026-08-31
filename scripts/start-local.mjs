import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const SYSTEM_CA_CANDIDATES = [
  "/etc/ssl/cert.pem",
  "/etc/ssl/certs/ca-certificates.crt",
  "/etc/pki/tls/certs/ca-bundle.crt",
];

export function resolveExtraCaCertificates({
  env = process.env,
  exists = existsSync,
} = {}) {
  const configured = env.NODE_EXTRA_CA_CERTS?.trim();
  if (configured) return configured;
  return SYSTEM_CA_CANDIDATES.find((path) => exists(path));
}

export function buildStartEnvironment(options = {}) {
  const env = { ...(options.env ?? process.env) };
  const caPath = resolveExtraCaCertificates(options);
  if (caPath) env.NODE_EXTRA_CA_CERTS = caPath;
  if (env.TRADEREVIEW_DB_PATH === undefined) {
    env.TRADEREVIEW_DB_PATH = resolve(
      options.cwd ?? process.cwd(),
      ".data/tradereview.sqlite",
    );
  }
  return env;
}

export function buildVinextArguments(args = []) {
  return args[0] === "--dev"
    ? ["dev", ...args.slice(1)]
    : ["start", ...args];
}

export function startLocalServer(args = process.argv.slice(2)) {
  const command = process.platform === "win32" ? "vinext.cmd" : "vinext";
  const child = spawn(command, buildVinextArguments(args), {
    env: buildStartEnvironment(),
    stdio: "inherit",
  });

  const signalHandlers = new Map(
    ["SIGINT", "SIGTERM"].map((signal) => {
      const handler = () => child.kill(signal);
      process.on(signal, handler);
      return [signal, handler];
    }),
  );
  child.on("error", (error) => {
    console.error(`无法启动本地服务：${error.message}`);
    process.exitCode = 1;
  });
  child.on("close", (code, signal) => {
    for (const [name, handler] of signalHandlers) process.off(name, handler);
    if (signal) process.exitCode = 1;
    process.exitCode = code ?? 1;
  });
}

if (import.meta.url === `file://${process.argv[1]}`) startLocalServer();
