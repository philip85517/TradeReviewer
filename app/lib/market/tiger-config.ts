import * as fs from "node:fs";
import * as path from "node:path";

export type TigerPropertiesSummary = {
  hasPrivateKeyPk1: boolean;
  hasPrivateKeyPk8: boolean;
  hasTigerId: boolean;
  hasAccount: boolean;
  hasLicense: boolean;
  hasEnv: boolean;
};

export type TigerOpenApiConfig = TigerPropertiesSummary & {
  configPath: string;
};

type TigerConfigEnvironment = {
  TIGER_OPENAPI_CONFIG?: string;
};

const EMPTY_SUMMARY: TigerPropertiesSummary = {
  hasPrivateKeyPk1: false,
  hasPrivateKeyPk8: false,
  hasTigerId: false,
  hasAccount: false,
  hasLicense: false,
  hasEnv: false,
};

function setPresenceFlag(
  summary: TigerPropertiesSummary,
  key: string,
  value: string,
) {
  if (!value) {
    return;
  }

  switch (key) {
    case "private_key_pk1":
      summary.hasPrivateKeyPk1 = true;
      break;
    case "private_key_pk8":
      summary.hasPrivateKeyPk8 = true;
      break;
    case "tiger_id":
      summary.hasTigerId = true;
      break;
    case "account":
      summary.hasAccount = true;
      break;
    case "license":
      summary.hasLicense = true;
      break;
    case "env":
      summary.hasEnv = true;
      break;
  }
}

export function parseTigerProperties(
  contents: string,
): TigerPropertiesSummary {
  const summary: TigerPropertiesSummary = { ...EMPTY_SUMMARY };

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    setPresenceFlag(summary, key, value);
  }

  return summary;
}

function isValidTigerConfig(summary: TigerPropertiesSummary) {
  return (
    summary.hasTigerId &&
    summary.hasAccount &&
    (summary.hasPrivateKeyPk1 || summary.hasPrivateKeyPk8)
  );
}

export function readTigerOpenApiConfig(
  environment: TigerConfigEnvironment = process.env as TigerConfigEnvironment,
): TigerOpenApiConfig | undefined {
  const configuredPath = environment.TIGER_OPENAPI_CONFIG?.trim();
  if (!configuredPath) {
    return undefined;
  }

  const configPath = path.resolve(configuredPath);

  try {
    if (!fs.statSync(configPath).isFile()) {
      return undefined;
    }
    const summary = parseTigerProperties(fs.readFileSync(configPath, "utf8"));
    if (!isValidTigerConfig(summary)) {
      return undefined;
    }

    return {
      configPath,
      ...summary,
    };
  } catch {
    return undefined;
  }
}
