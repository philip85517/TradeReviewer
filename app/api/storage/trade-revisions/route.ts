import { openSqliteDatabase } from "../../../../db/sqlite";
import { getSqliteStore } from "../../../lib/storage/sqlite-store";
export const runtime = "nodejs";
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request) {
  const instrumentId = new URL(request.url).searchParams.get("instrumentId");
  if (!instrumentId) return reply({ error: { message: "缺少股票范围" } }, 400);
  try { return reply(getSqliteStore(openSqliteDatabase()).getTradeRevisions(instrumentId)); }
  catch { return reply({ error: { message: "无法读取修订记录" } }, 503); }
}
export async function POST(request: Request) {
  let input;
  try { input = await request.json(); } catch { return reply({ error: { message: "无效修订请求" } }, 400); }
  try { return reply(getSqliteStore(openSqliteDatabase()).reviseTrades(input)); }
  catch (error) {
    if (error instanceof Error && /conflict/i.test(error.message)) return reply({ error: { message: "记录已变化，请重新打开数据检查核对后再提交。" } }, 409);
    if (error instanceof Error && error.message.startsWith("Invalid")) return reply({ error: { message: "股票、账户或成交字段无效，请检查输入。" } }, 400);
    return reply({ error: { message: "修订未保存，请重试；原记录未改变。" } }, 503);
  }
}
