import Decimal from "decimal.js";
import { TradeChangeRuleError } from "./sqlite-contracts";
import { Temporal } from "@js-temporal/polyfill";
import type { TradeExecution } from "../trades/types";

const DECIMAL_TEXT = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

/** Validate new facts without normalizing their precision or evidence. */
export function assertTradeExecutionSemantics(
  execution: TradeExecution,
  options: { allowUnknownFee?: boolean } = {},
): void {
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(execution.executedAt)) {
      Temporal.PlainDate.from(execution.executedAt, { overflow: "reject" });
    } else {
      Temporal.Instant.from(execution.executedAt);
    }
  } catch {
    throw new TradeChangeRuleError("input", "Invalid execution time");
  }

  for (const field of ["quantity", "price", "fee"] as const) {
    const raw = execution[field];
    // Only detached historical projection opts in. A reported fee must have a
    // value; whitespace and invalid amounts never become unknown evidence.
    if (field === "fee" && options.allowUnknownFee && execution.source.feeStatus !== "reported"
      && (raw === null || raw === "")) continue;
    try {
      if (typeof raw !== "string" || !DECIMAL_TEXT.test(raw)) throw new Error();
      const value = new Decimal(raw);
      if (!value.isFinite() || (field === "quantity" ? value.lte(0) : value.lt(0))) throw new Error();
    } catch {
      throw new TradeChangeRuleError("input", `Invalid execution ${field}`);
    }
  }
}
