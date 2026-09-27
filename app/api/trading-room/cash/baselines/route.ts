import { openSqliteDatabase } from "../../../../../db/sqlite";
import {
  CASH_SETTINGS_KEY,
  normalizeCashBaselineDraft,
  parseCashBaselineState,
  upsertCashBaseline,
  type CashBaselineState,
  type CashNature,
} from "../../../../../app/lib/cash/cash-model";
import { getSqliteStore } from "../../../../../app/lib/storage/sqlite-store";

export const runtime = "nodejs";

export type CashSettingsStore = {
  getSettings: () => Record<string, unknown>;
  putSettings: (settings: Record<string, unknown>) => void;
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function error(code: "invalid-request" | "storage-unavailable", message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}

function parseFilter(request: Request): { accountId?: string; nature?: CashNature; simulationRunId?: string | null } | Response {
  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId")?.trim() || undefined;
  const nature = url.searchParams.get("nature");
  const run = url.searchParams.get("simulationRunId");
  if (nature === null && run === null) return { accountId };
  if (nature !== "live" && nature !== "simulation") return error("invalid-request", "现金范围无效", 400);
  if (nature === "live" && run !== null) return error("invalid-request", "实盘范围不能指定模拟运行", 400);
  if (nature === "simulation" && !run?.trim()) return error("invalid-request", "模拟范围必须指定运行", 400);
  return { accountId, nature, simulationRunId: nature === "simulation" ? run!.trim() : null };
}

function filteredState(state: CashBaselineState, filter: Exclude<ReturnType<typeof parseFilter>, Response>): CashBaselineState {
  if (!filter.nature && !filter.accountId) return state;
  return {
    version: state.version,
    records: state.records.filter((record) =>
      (!filter.nature || record.scope.nature === filter.nature) &&
      (!filter.nature || record.scope.simulationRunId === filter.simulationRunId) &&
      (!filter.accountId || record.accountId === filter.accountId),
    ),
  };
}

function readState(store: CashSettingsStore): CashBaselineState {
  return parseCashBaselineState(store.getSettings()[CASH_SETTINGS_KEY]);
}

export function createCashBaselineHandlers(store: CashSettingsStore) {
  return {
    async GET(request: Request): Promise<Response> {
      const filter = parseFilter(request);
      if (filter instanceof Response) return filter;
      try {
        return json(filteredState(readState(store), filter));
      } catch {
        return error("storage-unavailable", "现金基准暂时不可用", 503);
      }
    },
    async PUT(request: Request): Promise<Response> {
      let body: unknown;
      try { body = await request.json(); } catch { return error("invalid-request", "现金基准请求无效", 400); }
      const draft = normalizeCashBaselineDraft(body);
      if (!draft) return error("invalid-request", "账户、原币、金额或截至时间无效", 400);
      try {
        const next = upsertCashBaseline(readState(store), draft);
        store.putSettings({ [CASH_SETTINGS_KEY]: next });
        return json(next);
      } catch (cause) {
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
  return getSqliteStore(openSqliteDatabase());
}

export async function GET(request: Request): Promise<Response> {
  try { return await createCashBaselineHandlers(defaultStore()).GET(request); }
  catch { return error("storage-unavailable", "现金基准暂时不可用", 503); }
}

export async function PUT(request: Request): Promise<Response> {
  try { return await createCashBaselineHandlers(defaultStore()).PUT(request); }
  catch { return error("storage-unavailable", "现金基准暂时不可用", 503); }
}
