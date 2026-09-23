import { openSqliteDatabase } from "../../../../db/sqlite";
import { getSqliteStore } from "../../../lib/storage/sqlite-store";
import { deleteReferenceCapital, emptyReferenceCapitalState, normalizeReferenceCapitalState, normalizeReferenceCapitalDraft, REFERENCE_CAPITAL_SETTINGS_KEY, upsertReferenceCapital, validateReferenceCapitalDraft, validateReferenceCapitalState, type ReferenceCapitalState } from "../../../lib/principal/reference-capital-model";

export const runtime = "nodejs";
type Store = { getSettings: () => Record<string, unknown>; putSettings: (settings: Record<string, unknown>) => void };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const error = (code: string, message: string, status: number) => json({ error: { code, message } }, status);
const read = (store: Store): ReferenceCapitalState => { const raw = store.getSettings()[REFERENCE_CAPITAL_SETTINGS_KEY] ?? emptyReferenceCapitalState(); const problem = validateReferenceCapitalState(raw); if (problem) throw new Error(problem); return normalizeReferenceCapitalState(raw); };

export function createReferenceCapitalHandlers(store: Store) {
  return {
    async GET(): Promise<Response> { try { return json(read(store)); } catch { return error("storage-unavailable", "参考资本暂时不可用", 503); } },
    async PUT(request: Request): Promise<Response> {
      let body: unknown; try { body = await request.json(); } catch { return error("invalid-request", "参考资本请求无效", 400); }
      const draft = normalizeReferenceCapitalDraft(body); if (!draft) return error("invalid-request", "账户、币种、期间或金额无效", 400);
      try { const current = read(store); const conflict = validateReferenceCapitalDraft(current, draft, draft.id); if (conflict) return error("overlap", conflict, 409); const next = upsertReferenceCapital(current, draft); store.putSettings({ [REFERENCE_CAPITAL_SETTINGS_KEY]: next }); return json(next); } catch (caught) { return error("storage-unavailable", caught instanceof Error ? caught.message : "参考资本暂时不可用", 503); }
    },
    async DELETE(request: Request): Promise<Response> {
      let body: unknown; try { body = await request.json(); } catch { return error("invalid-request", "参考资本请求无效", 400); }
      if (!body || typeof body !== "object" || typeof (body as Record<string, unknown>).id !== "string" || !(body as Record<string, unknown>).id) return error("invalid-request", "缺少参考资本记录 id", 400);
      try { const next = deleteReferenceCapital(read(store), (body as Record<string, unknown>).id as string); store.putSettings({ [REFERENCE_CAPITAL_SETTINGS_KEY]: next }); return json(next); } catch { return error("storage-unavailable", "参考资本暂时不可用", 503); }
    },
  };
}
const store = () => getSqliteStore(openSqliteDatabase());
export async function GET(request: Request) { void request; try { return createReferenceCapitalHandlers(store()).GET(); } catch { return error("storage-unavailable", "参考资本暂时不可用", 503); } }
export async function PUT(request: Request) { try { return createReferenceCapitalHandlers(store()).PUT(request); } catch { return error("storage-unavailable", "参考资本暂时不可用", 503); } }
export async function DELETE(request: Request) { try { return createReferenceCapitalHandlers(store()).DELETE(request); } catch { return error("storage-unavailable", "参考资本暂时不可用", 503); } }
