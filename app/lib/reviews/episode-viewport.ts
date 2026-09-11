export type EpisodeViewport = {start: string; end?: string};

export function episodeViewport(candles: Array<{time:string}>, range: EpisodeViewport) {
  const start = Math.max(0, candles.findLastIndex(candle => Date.parse(candle.time) <= Date.parse(range.start)));
  const foundEnd = range.end ? candles.findIndex(candle => Date.parse(candle.time) >= Date.parse(range.end!)) : -1;
  const end = foundEnd < 0 ? candles.length - 1 : foundEnd;
  const padding = Math.max(3, Math.ceil((end - start + 1) * 0.25));
  return {from:Math.max(-3, start - padding), to:Math.min(candles.length + 2, end + padding)};
}
