import { openSqliteDatabase } from "../../../../../db/sqlite";
import { createTradeReadHandler } from "./handler";

export const runtime = "nodejs";
export const POST = createTradeReadHandler(openSqliteDatabase);
