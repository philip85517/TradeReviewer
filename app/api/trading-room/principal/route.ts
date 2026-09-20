import { openSqliteDatabase } from "../../../../db/sqlite";
import {
  emptyPrincipalState,
  normalizePrincipalState,
  normalizePrincipalValue,
  PRINCIPAL_CATEGORIES,
  PRINCIPAL_SETTINGS_KEY,
  principalScopeKey,
  setPrincipalValue,
  type PrincipalCategory,
  type PrincipalMutation,
  type PrincipalScope,
  type PrincipalState,
} from "../../../lib/principal/principal-model";
import { getSqliteStore } from "../../../lib/storage/sqlite-store";

export const runtime = "nodejs";

export type PrincipalSettingsStore = {
  getSettings: () => Record<string, unknown>;
  putSettings: (settings: Record<string, unknown>) => void;
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function invalidRequest(): Response {
  return json({ error: { code: "invalid-request", message: "本金设置请求无效" } }, 400);
}

function storageError(): Response {
  return json({ error: { code: "storage-unavailable", message: "本金设置暂时不可用" } }, 503);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCategory(value: unknown): value is PrincipalCategory {
  return typeof value === "string" && (PRINCIPAL_CATEGORIES as readonly string[]).includes(value);
}

function parseScope(value: unknown): PrincipalScope | null {
  if (!isRecord(value) || (value.nature !== "live" && value.nature !== "simulation")) return null;
  if (value.nature === "live") return value.simulationRunId === null ? { nature: "live", simulationRunId: null } : null;
  return typeof value.simulationRunId === "string" && value.simulationRunId.trim().length > 0
    ? { nature: "simulation", simulationRunId: value.simulationRunId.trim() }
    : null;
}

function parseMutation(value: unknown): PrincipalMutation | null {
  if (!isRecord(value) || value.version !== 1 || !isCategory(value.category)) return null;
  const scope = parseScope(value.scope);
  if (!scope) return null;
  if (value.value === null) return { version: 1, scope, category: value.category, value: null };
  const principalValue = normalizePrincipalValue(value.value);
  return principalValue ? { version: 1, scope, category: value.category, value: principalValue } : null;
}

function readState(store: PrincipalSettingsStore): PrincipalState {
  return normalizePrincipalState(store.getSettings()[PRINCIPAL_SETTINGS_KEY] ?? emptyPrincipalState());
}

export function createPrincipalHandlers(store: PrincipalSettingsStore) {
  return {
    async GET(request: Request): Promise<Response> {
      void request;
      try {
        return json(readState(store));
      } catch {
        return storageError();
      }
    },
    async PUT(request: Request): Promise<Response> {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return invalidRequest();
      }
      const mutation = parseMutation(body);
      if (!mutation) return invalidRequest();
      try {
        const current = readState(store);
        const next = setPrincipalValue(current, mutation.scope, mutation.category, mutation.value);
        if (principalScopeKey(mutation.scope) === "unknown") return invalidRequest();
        store.putSettings({ [PRINCIPAL_SETTINGS_KEY]: next });
        return json(next);
      } catch {
        return storageError();
      }
    },
  };
}

function getDefaultStore(): PrincipalSettingsStore {
  return getSqliteStore(openSqliteDatabase());
}

export async function GET(request: Request): Promise<Response> {
  try {
    return await createPrincipalHandlers(getDefaultStore()).GET(request);
  } catch {
    return storageError();
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    return await createPrincipalHandlers(getDefaultStore()).PUT(request);
  } catch {
    return storageError();
  }
}
