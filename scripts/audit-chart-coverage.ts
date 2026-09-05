// Read-only audit: npx tsx scripts/audit-chart-coverage.ts [http://localhost:3000]
import { createSqliteHttpClient } from "../app/lib/storage/sqlite-http-client";
import { ApiMarketDataRepository } from "../app/lib/storage/sqlite-repositories";
import { dailyRecordToChartCandle, marketRecordToChartCandle } from "../app/lib/market/types";
import { mapExecutionsToCandles } from "../app/lib/replay/execution-markers";
import { requiredMarketDataRange } from "../app/lib/market/sync-range";
import { expectedTradingDates } from "../app/lib/market/calendar";
import { marketTradingDate } from "../app/lib/market/trading-date";
import type { SupportedMarket } from "../app/lib/market/contracts";

const base = process.argv[2] ?? "http://localhost:3000";
const client = createSqliteHttpClient((url, init) => fetch(new URL(url, base), init));
const repository = new ApiMarketDataRepository(client);
const bootstrap = await client.getBootstrap();
const now = new Date();
const rows = [];
for (const id of [...new Set(bootstrap.executions.map(execution => execution.instrument.id))]) {
  const executions = bootstrap.executions.filter(execution => execution.instrument.id === id)
    .sort((a, b) => a.executedAt.localeCompare(b.executedAt));
  const market = executions[0].instrument.market as SupportedMarket;
  const range = requiredMarketDataRange(executions[0].executedAt, executions.at(-1)!.executedAt, { market, now });
  const daily = await repository.getDailyCandles(id, range.startDate, range.endDate);
  const hourly = await repository.getCandles(id, "1h", `${range.startDate}T00:00:00Z`, `${range.endDate}T23:59:59Z`);
  const dailyMarkers = mapExecutionsToCandles(daily.map(dailyRecordToChartCandle), executions);
  const hourlyMarkers = mapExecutionsToCandles(hourly.map(marketRecordToChartCandle), executions);
  const matched = new Set(dailyMarkers.map(marker => marker.executionId));
  const lastTradeDate = marketTradingDate(executions.at(-1)!.executedAt, market);
  const expected = expectedTradingDates(market, lastTradeDate, range.endDate).filter(date => date > lastTradeDate);
  const dates = new Set(daily.map(candle => candle.tradingDate));
  const missing = expected.filter(date => !dates.has(date));
  rows.push({ id, name: executions[0].instrument.name, executions: executions.length,
    dailyBars: daily.length, dailyStart: daily[0]?.tradingDate, dailyEnd: daily.at(-1)?.tradingDate,
    dailyMarkers: dailyMarkers.length, hourlyBars: hourly.length, hourlyMarkers: hourlyMarkers.length,
    forwardActual: expected.length - missing.length, forwardRequired: expected.length,
    missingForwardDates: missing,
    unmatchedDaily: executions.filter(execution => !matched.has(execution.id)).map(execution => ({
      id: execution.id, time: execution.executedAt, exchangeDate: marketTradingDate(execution.executedAt, market),
      hasDailyBar: dates.has(marketTradingDate(execution.executedAt, market)),
    })),
  });
}
console.log(JSON.stringify({ checkedAt: now.toISOString(), note: "Marker counts are mapping candidates; browser verification is still required for rendering and viewport.", rows }, null, 2));
