import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, parse, resolve, sep } from "node:path";

export const DEFAULT_PORT = 3022;
export const DEFAULT_HOSTNAME = "127.0.0.1";
export const DEFAULT_PRODUCTION_DATABASE_PATH = "/var/lib/tradereview/tradereview.sqlite";

function fail(message) {
  throw new Error(`Invalid TradeReview runtime config: ${message}`);
}

function validateDatabasePath(value, label) {
  if (typeof value !== "string" || !value.trim() || !isAbsolute(value) || value.includes("\0")) {
    fail(`${label}.databasePath must be an absolute path`);
  }
  if (value === parse(value).root || value.endsWith(sep) || value.split(sep).includes("..")) {
    fail(`${label}.databasePath is unsafe`);
  }
  return resolve(value);
}

function validatePort(value) {
  if (!Number.isInteger(value) || value < 1 || value > 65535) fail("port must be an integer between 1 and 65535");
  return value;
}

function validateHostname(value) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) fail("hostname must be a non-empty string");
  return value.trim();
}

/**
 * Resolve the process-wide runtime settings. Explicit database paths are
 * intentionally handled before reading any config file so isolated tests and
 * one-off commands cannot be affected by a broken machine config.
 */
export function resolveRuntimeConfig(options = {}) {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const nodeEnv = options.nodeEnv ?? env.NODE_ENV ?? process.env.NODE_ENV;
  const read = options.readFile ?? ((path) => readFileSync(path, "utf8"));
  const exists = options.exists ?? existsSync;
  const explicitDatabasePath = env.TRADEREVIEW_DB_PATH?.trim();
  if (explicitDatabasePath) {
    return {
      databasePath: validateDatabasePath(explicitDatabasePath, "TRADEREVIEW_DB_PATH"),
      databasePathSource: "environment",
      port: DEFAULT_PORT,
      hostname: DEFAULT_HOSTNAME,
      configPath: undefined,
    };
  }

  const explicitConfigPath = env.TRADEREVIEW_RUNTIME_CONFIG?.trim();
  const defaultConfigPath = join(options.homeDir ?? env.HOME ?? homedir(), ".config", "tradereview", "runtime.json");
  const projectConfigPath = join(cwd, "conf", "runtime.json");
  const configPath = explicitConfigPath
    || (nodeEnv === "test" ? undefined : (exists(projectConfigPath) ? projectConfigPath : defaultConfigPath));
  let parsed;
  if (configPath && (explicitConfigPath || exists(configPath))) {
    let text;
    try {
      text = read(configPath);
    } catch (error) {
      fail(`cannot read ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      fail(`cannot parse ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail(`${configPath} must contain a JSON object`);
  }

  if (parsed) {
    const databasePath = validateDatabasePath(parsed.databasePath, configPath);
    return {
      databasePath,
      databasePathSource: "config",
      port: parsed.port === undefined ? DEFAULT_PORT : validatePort(parsed.port),
      hostname: parsed.hostname === undefined ? DEFAULT_HOSTNAME : validateHostname(parsed.hostname),
      configPath,
    };
  }

  return {
    databasePath: nodeEnv === "production" ? DEFAULT_PRODUCTION_DATABASE_PATH : resolve(cwd, ".data", "tradereview.sqlite"),
    databasePathSource: "fallback",
    port: DEFAULT_PORT,
    hostname: DEFAULT_HOSTNAME,
    configPath: undefined,
  };
}
