import { randomUUID } from "node:crypto";
import { TradeChangeError, TradeChangeRuleError } from "../../../lib/storage/sqlite-contracts";
import { BookVersionChangedError, BookVersionUnavailableError } from "../../../lib/storage/trade-book-version";

export function tradeResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function invalidTradeRequest() {
  return tradeFailure(new TradeChangeError("INVALID_INPUT", "prepare", "Invalid request", randomUUID()));
}

/** Classify explicit error authorities; exception prose never controls HTTP status. */
export function tradeFailure(error: unknown) {
  if (error instanceof TradeChangeError) {
    const status = error.code === "PLAN_NOT_FOUND" || error.code === "INSTRUMENT_NOT_FOUND" ? 404
      : error.code === "PLAN_EXPIRED" ? 410
      : error.category === "input" ? 400
      : error.category === "conflict" ? 409
      : error.category === "domain" ? 422
      : error.category === "unexpected" ? 500 : 503;
    return tradeResponse({ error: error.toJSON() }, status);
  }
  if (error instanceof BookVersionChangedError) {
    return tradeResponse({ error: { code: error.code, category: "conflict", phase: error.phase, message: "账本版本已变化，请重新读取。", retryable: false, expected: error.expected, actual: error.actual } }, 409);
  }
  if (error instanceof BookVersionUnavailableError) {
    return tradeResponse({ error: { code: error.code, category: "storage-unavailable", phase: error.phase, message: "账本版本暂不可用。", retryable: true } }, 503);
  }
  if (error instanceof TradeChangeRuleError) {
    return tradeFailure(new TradeChangeError(error.category === "input" ? "INVALID_INPUT" : "DOMAIN_REVIEW", "compatibility", "Trade change requires review", randomUUID(), [], { category: error.category }));
  }
  const sqliteCode = error && typeof error === "object" && "errcode" in error ? error.errcode : undefined;
  const busy = typeof sqliteCode === "number" && ((sqliteCode & 255) === 5 || (sqliteCode & 255) === 6);
  return tradeFailure(new TradeChangeError(busy ? "STORAGE_BUSY" : "UNEXPECTED_FAILURE", "prepare", "Trade storage request failed", randomUUID()));
}
