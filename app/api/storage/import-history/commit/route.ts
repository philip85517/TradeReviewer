import { openSqliteDatabase } from "../../../../../db/sqlite";
import { createImportHistoryCommitHandler } from "./handler";

export const runtime = "nodejs";
export const POST = createImportHistoryCommitHandler(openSqliteDatabase);
