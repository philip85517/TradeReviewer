import { expect, it } from "vitest";
import { episodeViewport } from "./episode-viewport";

it("focuses a short episode within long history and clamps to revealed candles", () => {
  const candles = Array.from({length:100}, (_,i) => ({time:new Date(Date.UTC(2026,0,i+1)).toISOString()}));
  expect(episodeViewport(candles,{start:"2026-02-20T00:00:00.000Z",end:"2026-02-25T00:00:00.000Z"})).toEqual({from:47,to:58});
  expect(episodeViewport(candles.slice(0,52),{start:"2026-02-20T00:00:00.000Z",end:"2026-02-25T00:00:00.000Z"})).toEqual({from:47,to:54});
});
