export type Timeframe = "15m" | "1h" | "4h" | "1D" | "1W";

export type Candle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
