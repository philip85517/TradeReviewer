import { openSqliteDatabase } from "../../../../../db/sqlite";
import {
  CASH_SETTINGS_KEY,
  normalizeCashBaselineDraft,
  parseCashBaselineState,
  upsertCashBaseline,
  type CashBaselineState,
} from "../../../../../app/lib/cash/cash-model";
import {
  CashBaselineRevisionConflictError,
  CashBaselineStore,
  CashBaselineValidationError,
} from "../../../../../app/lib/cash/cash-baseline-store";
import { TRADINGVIEW_CANONICAL_ACCOUNT_ID } from "../../../../../app/lib/trades/tradingview-account-identity";
import type {
  CashBaselineFilter,
  CashBaselineMutation,
  CashBaselineStorageState,
} from "../../../../../app/lib/cash/cash-baseline-contracts";

export const runtime = "nodejs";

export type CashSettingsStore = {
  getSettings?: () => Record<string, unknown>;
  putSettings?: (settings: Record<string, unknown>) => void;
  read?: (filter?: CashBaselineFilter) => CashBaselineStorageState;
  save?: (mutation: CashBaselineMutation) => { state: CashBaselineStorageState; record: CashBaselineStorageState["records"][number]; previous: CashBaselineStorageState["records"][number] | null };
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function error(code: string, message: string, status: number, details?: Record<string, unknown>): Response {
  return json({ error: { code, message }, ...details }, status);
}

function parseFilter(request: Request): CashBaselineFilter | Response {
  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId")?.trim() || undefined;
  const nature = url.searchParams.get("nature");
  const hasRun = url.searchParams.has("simulationRunId");
  const run = url.searchParams.get("simulationRunId");
  if (nature === null && !hasRun) return { accountId };
  if (nature !== "live" && nature !== "simulation") return error("invalid-request", "现金范围无效", 400);
  if (nature === "live" && hasRun) return error("invalid-request", "实盘范围不能指定模拟运行", 400);
  if (nature === "simulation" && hasRun) {
    if (!run?.trim()) return error("invalid-request", "模拟运行无效", 400);
    return { accountId, nature, simulationRunId: run.trim() };
  }
  if (nature === "simulation" && accountId === TRADINGVIEW_CANONICAL_ACCOUNT_ID) return { accountId, nature, simulationRunId: null };
  if (nature === "simulation") return { accountId, nature };
  return { accountId, nature, simulationRunId: null };
}

function filteredState(state: CashBaselineState, filter: Exclude<ReturnType<typeof parseFilter>, Response>): CashBaselineState {
  if (!filter.nature && !filter.accountId) return state;
  return {
    version: state.version,
    records: state.records.filter((record) =>
      (!filter.nature || record.scope.nature === filter.nature) &&
      (filter.nature !== "simulation" || filter.simulationRunId === undefined || record.scope.simulationRunId === filter.simulationRunId) &&
      (filter.nature !== "live" || filter.simulationRunId === undefined || record.scope.simulationRunId === null) &&
      (!filter.accountId || record.accountId === filter.accountId),
    ),
  };
}

function readLegacyState(store: CashSettingsStore): CashBaselineState {
  if (!store.getSettings) throw new Error("Cash settings reader unavailable");
  return parseCashBaselineState(store.getSettings()[CASH_SETTINGS_KEY]);
}

export function createCashBaselineHandlers(store: CashSettingsStore) {
  return {
    async GET(request: Request): Promise<Response> {
      const filter = parseFilter(request);
      if (filter instanceof Response) return filter;
      try {
        if (store.read) return json(store.read(filter));
        return json(filteredState(readLegacyState(store), filter));
      } catch {
        return error("storage-unavailable", "现金基准暂时不可用", 503);
      }
    },
    async PUT(request: Request): Promise<Response> {
      let body: unknown;
      try { body = await request.json(); } catch { return error("invalid-request", "现金基准请求无效", 400); }
      const draft = normalizeCashBaselineDraft(body);
      if (!draft) return error("invalid-request", "账户、原币、金额或截至时间无效", 400);
      if (!draft.source || draft.expectedRevision === undefined) return error("invalid-request", "现金基准必须提供来源和 expectedRevision", 400);
      try {
        if (store.save) {
          const result = store.save({
            ...draft,
            source: draft.source,
            expectedRevision: draft.expectedRevision,
          });
          return json(result.state);
        }
        if (!store.getSettings || !store.putSettings) throw new Error("Cash settings store unavailable");
        const legacyDraft = { ...draft, source: draft.source ?? "legacy" };
        const next = upsertCashBaseline(readLegacyState(store), legacyDraft);
        store.putSettings({ [CASH_SETTINGS_KEY]: next });
        return json(next);
      } catch (cause) {
        if (cause instanceof CashBaselineRevisionConflictError) {
          return error("revision-conflict", cause.message, 409, { current: cause.current, currentRecord: cause.current });
        }
        if (cause instanceof CashBaselineValidationError) return error("invalid-request", cause.message, 400);
        if (
          cause instanceof Error &&
          ["Unknown cash baseline id", "Cash baseline scope already exists", "Duplicate cash baseline id"].includes(cause.message)
        ) {
          return error("invalid-request", "现金基准身份或范围冲突", 400);
        }
        return error("storage-unavailable", "现金基准暂时不可用", 503);
      }
    },
  };
}

function defaultStore(): CashSettingsStore {
  return new CashBaselineStore(openSqliteDatabase());
}

export async function GET(request: Request): Promise<Response> {
  try { return await createCashBaselineHandlers(defaultStore()).GET(request); }
  catch { return error("storage-unavailable", "现金基准暂时不可用", 503); }
}

export async function PUT(request: Request): Promise<Response> {
  try { return await createCashBaselineHandlers(defaultStore()).PUT(request); }
  catch { return error("storage-unavailable", "现金基准暂时不可用", 503); }
}
