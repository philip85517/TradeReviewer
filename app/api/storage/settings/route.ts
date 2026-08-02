import { openSqliteDatabase } from "../../../../db/sqlite";
import type { ChartSettings } from "../../../lib/storage/chart-settings";
import { getSqliteStore } from "../../../lib/storage/sqlite-store";

export const runtime = "nodejs";
function response(body: unknown, status = 200) { return Response.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function valid(value: unknown): value is ChartSettings { if (!value || typeof value !== "object" || Array.isArray(value)) return false; const v = value as Record<string, unknown>; return v.version === 1 && typeof v.showGrid === "boolean" && typeof v.showVolume === "boolean" && typeof v.showExecutions === "boolean" && typeof v.showAverageCost === "boolean" && ["teal-red", "green-red", "blue-orange"].includes(String(v.colorScheme)); }
export async function GET() { try { return response(getSqliteStore(openSqliteDatabase()).getSettings()); } catch { return response({ error: { code: "storage-unavailable", message: "storage unavailable" } }, 503); } }
export async function PUT(request: Request) { let value: unknown; try { value = await request.json(); } catch { return response({ error: { code: "invalid-request", message: "invalid request" } }, 400); } if (!valid(value)) return response({ error: { code: "invalid-request", message: "invalid request" } }, 400); try { getSqliteStore(openSqliteDatabase()).putSettings(value); return response(value); } catch { return response({ error: { code: "storage-unavailable", message: "storage unavailable" } }, 503); } }
