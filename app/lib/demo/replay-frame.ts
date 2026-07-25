import type { Candle } from "../market/types";
import type { TradeExecution } from "../trades/types";

export type DemoReplayFrame = {
  cursorIndex: number;
  cursor: string;
  candles15m: Candle[];
  executions: TradeExecution[];
  canGoBack: boolean;
  canGoForward: boolean;
};

export type DemoReplayMode =
  | "next"
  | "previous"
  | "next-execution"
  | "restore";
