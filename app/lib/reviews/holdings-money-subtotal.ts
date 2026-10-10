import Decimal from "decimal.js";
import {
  buildRoomMoneyView,
  roomMoneyValue,
  type RoomFxSnapshot,
  type RoomMoneyAmount,
  type RoomTargetCurrency,
} from "./trading-room-scope";

export type RoomMoneyMemberAmount = RoomMoneyAmount & {
  /** Stable identity for the holding/row contributing to this subtotal. */
  memberKey: string;
};

export type RoomMoneySubtotal = {
  value: string | null;
  currency: RoomTargetCurrency | null;
  available: number;
  total: number;
  complete: boolean;
  /** Keys of rows whose values were successfully converted and included. */
  memberKeys: readonly string[];
  reason: string | null;
};

/**
 * Converts each holding independently, preserving usable rows when another
 * holding has a missing amount, currency, or FX rate. The existing aggregate
 * converter remains intentionally strict for report-level money views.
 */
export function buildRoomMoneySubtotal(
  amounts: readonly RoomMoneyMemberAmount[],
  snapshot?: RoomFxSnapshot,
  targetCurrency: RoomTargetCurrency = "CNY",
): RoomMoneySubtotal {
  const memberKeys: string[] = [];
  const reasons = new Set<string>();
  let value = new Decimal(0);

  for (const amount of amounts) {
    const view = buildRoomMoneyView([amount], snapshot, targetCurrency);
    const converted = roomMoneyValue(view);
    if (converted === null) {
      reasons.add(view.note);
      continue;
    }
    value = value.plus(converted);
    memberKeys.push(amount.memberKey);
  }

  const available = memberKeys.length;
  return {
    value: available > 0 ? value.toString() : null,
    currency: available > 0 ? targetCurrency : null,
    available,
    total: amounts.length,
    complete: available === amounts.length,
    memberKeys,
    reason: reasons.size > 0 ? [...reasons].join("；") : null,
  };
}
