import "server-only";

import type { TradeExecution } from "../lib/trades/types";
import { demoCandles15m } from "./demo-market";

const instrument = {
  id: "US:XPEV",
  symbol: "XPEV",
  name: "小鹏汽车",
  market: "US",
  currency: "USD",
};

export const demoExecutions: TradeExecution[] = [
  {
    id: "demo-buy-1",
    source: { platform: "demo", row: 1 },
    accountId: "demo-account",
    accountLabel: "Tiger · 5793",
    instrument,
    side: "buy",
    executedAt: demoCandles15m[390].time,
    quantity: "120",
    price: demoCandles15m[390].close.toString(),
    fee: "2.05",
  },
  {
    id: "demo-buy-2",
    source: { platform: "demo", row: 2 },
    accountId: "demo-account",
    accountLabel: "Tiger · 5793",
    instrument,
    side: "buy",
    executedAt: demoCandles15m[610].time,
    quantity: "80",
    price: demoCandles15m[610].close.toString(),
    fee: "2.05",
  },
  {
    id: "demo-sell-1",
    source: { platform: "demo", row: 3 },
    accountId: "demo-account",
    accountLabel: "Tiger · 5793",
    instrument,
    side: "sell",
    executedAt: demoCandles15m[980].time,
    quantity: "200",
    price: demoCandles15m[980].close.toString(),
    fee: "2.05",
  },
];
