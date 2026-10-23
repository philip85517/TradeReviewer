// Root-run acceptance data only. Never defaults to, reads, or writes the business DB.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks } from "node:module";
import ts from "typescript";

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const argv = process.argv.slice(2);
const option = name => { const i = argv.indexOf(name); return i < 0 ? undefined : argv[i + 1]; };
const supplied = option("--db");
const asOf = option("--as-of");
if (!supplied || !asOf || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error("Explicit --db ABSOLUTE_ISOLATED_PATH and --as-of YYYY-MM-DD required");
const dbPath = resolve(supplied);
const isolatedRoot = resolve(workspace, ".data");
if (supplied !== dbPath || !dbPath.startsWith(isolatedRoot + sep) || !/^(tradereview-test|homepage-p1[-\w]*)\.sqlite$/.test(dbPath.split(sep).at(-1))) throw new Error("Only this worktree .data/tradereview-test.sqlite or homepage-p1*.sqlite is allowed");
if (existsSync(isolatedRoot) && realpathSync(isolatedRoot) !== isolatedRoot) throw new Error("Symlinked isolated directory refused");
if (existsSync(dbPath) && realpathSync(dbPath) !== dbPath) throw new Error("Symlinked database refused");
if (!argv.includes("--dry-run") && process.env.TRADEREVIEW_DB_PATH !== dbPath) throw new Error("TRADEREVIEW_DB_PATH must explicitly equal --db");
const day = offset => new Date(Date.parse(asOf + "T12:00:00Z") + offset * 86400000).toISOString().slice(0, 10);
const prefix = "homepage-p1-acceptance-v1";
if (Date.parse(asOf + "T00:10:00+08:00") > Date.now()) throw new Error("Acceptance timestamps must already be in the past");
const fx = option("--fx");
if (fx && !["complete", "partial", "missing"].includes(fx)) throw new Error("--fx must be complete, partial or missing");
const instruments = [];
const executions = [];
const candles = [];
const coverage = [];
const counts = [0, 1, 5, 8, 9, 50];
function addFill(accountId, instrument, suffix, side, quantity, price, date, extras = {}) {
  executions.push({ id: `${prefix}:${accountId}:${instrument.id}:${suffix}`, accountId, accountLabel: `P1 ${accountId.replace("p1-count-", "")} 行`, instrument,
    source: { platform: prefix, fileName: "ISOLATED_ACCEPTANCE_ONLY", row: executions.length + 1, tradeNature: "live", positionEffect: side === "buy" ? "open-long" : "close-long", ...extras },
    side, quantity, price, fee: "1", executedAt: new Date(date + "T00:05:00+08:00").toISOString() });
}
for (let i = 0; i < 50; i++) {
  const symbol = String(600100 + i);
  const instrument = { id: `CN-SH:${symbol}`, symbol, name: `P1 持仓 ${String(i + 1).padStart(2, "0")}${i === 4 ? " 超长证券名称用于真实宽度和截断验证" : ""}`, market: "CN-SH", currency: "CNY" };
  instruments.push(instrument);
  const price = String(100 + i);
  for (const count of counts) {
    if (i >= Math.max(count, 1)) continue;
    const account = `p1-count-${String(count).padStart(2, "0")}`;
    addFill(account, instrument, "buy", "buy", "20.125", price, i === 2 ? asOf : day(-2), i === 3 ? { historyIncomplete: ["isolated acceptance: missing continuous start evidence"] } : {});
    if (count === 0) addFill(account, instrument, "close", "sell", "20.125", String(110 + i), day(-1));
    else if (i === 1) addFill(account, instrument, "partial", "sell", "10", String(105 + i), day(-1));
  }
  if (i !== 5) {
    candles.push({ instrumentId: instrument.id, tradingDate: day(-1), open: price, high: String(125 + i), low: String(95 + i), close: String(110 + i), volume: "100000", currency: "CNY", provider: "tencent", providerSymbol: `sh${symbol}`, adjustmentMode: "raw", fetchedAt: new Date(asOf + "T00:10:00+08:00").toISOString() });
    coverage.push({ instrumentId: instrument.id, adjustmentMode: "raw", segments: [{ startDate: day(-2), endDate: asOf, status: "complete", provider: "tencent", fetchedAt: new Date(asOf + "T00:10:00+08:00").toISOString(), missingTradingDates: [] }] });
  }
}
// Additional account exposes signed short; same CN identity exists in count accounts.
addFill("p1-edge-short", instruments[0], "short", "sell", "3.5", "100", day(-1), { positionEffect: "open-short", positionEffectEvidence: { kind: "explicit", confidence: "high", reason: "isolated acceptance fixture explicitly opens short" } });
for (const [symbol, market, currency, name] of [["00700", "HK", "HKD", "P1 港股"], ["AAPL", "US", "USD", "P1 美股可信目录"], ["UNRESOLVED", "US", "USD", "P1 美股交易所未知"]]) {
  const instrument = { id: `${market}:${symbol}`, symbol, name, market, currency };
  instruments.push(instrument);
  addFill("p1-edge-markets", instrument, "buy", "buy", "2", "100", day(-1));
  candles.push({ instrumentId: instrument.id, tradingDate: day(-1), open: "100", high: "115", low: "95", close: "110", volume: "10000", currency, provider: market === "US" ? "yahoo" : "tencent", providerSymbol: symbol, adjustmentMode: "raw", fetchedAt: new Date(asOf + "T00:10:00+08:00").toISOString() });
  coverage.push({ instrumentId: instrument.id, adjustmentMode: "raw", segments: [{ startDate: day(-1), endDate: asOf, status: "complete", missingTradingDates: [] }] });
}
const plan = { database: dbPath, asOf, source: prefix, mode: argv.includes("--dry-run") ? "dry-run/no database opened" : "idempotent append via SqliteStore", accounts: counts.map(count => ({ id: `p1-count-${String(count).padStart(2, "0")}`, activeHoldingRows: count })), instruments: instruments.length, executions: executions.length, persistedDailyCandles: candles.length, officialExchangeRecords: 1, officialExchangeSource: "https://www.sec.gov/files/company_tickers_exchange.json", excludedQuoteInstrument: "CN-SH:600105", additionalAccounts: ["p1-edge-short", "p1-edge-markets"], note: "Synthetic acceptance records are explicitly isolated and persist through production repositories. Existing records are preserved. AAPL official exchange evidence is the SEC row captured in official-exchange-source.md; UNRESOLVED stays unknown. Fresh FX is seeded only with --fx complete|missing|partial; business DB is never opened." };
if (argv.includes("--dry-run")) { console.log(JSON.stringify(plan, null, 2)); process.exit(0); }
// Node 26 native module hook: transpile existing TS without bundling or a server.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
    try { return nextResolve(specifier, context); } catch (error) {
      if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
        for (const suffix of [".ts", "/index.ts"]) { const url = new URL(specifier + suffix, context.parentURL); if (existsSync(url)) return { url: url.href, shortCircuit: true }; }
      }
      throw error;
    }
  },
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && url.endsWith(".ts")) return { format: "module", source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: true } }).outputText, shortCircuit: true };
    return nextLoad(url, context);
  },
});
const { openSqliteDatabase } = await import(pathToFileURL(resolve(workspace, "db/sqlite.ts")).href);
const { SqliteStore } = await import(pathToFileURL(resolve(workspace, "app/lib/storage/sqlite-store.ts")).href);
const { parseSecCompanyTickers } = await import(pathToFileURL(resolve(workspace, "app/lib/instruments/providers/sec-company-tickers.ts")).href);
// Exact limited official SEC row, verified 2026-10-23. The production parser,
// validator and metadata repository retain the evidence; no US/provider guess.
const apple = parseSecCompanyTickers({ fields: ["cik", "name", "ticker", "exchange"], data: [[320193, "Apple Inc.", "AAPL", "Nasdaq"]] }, new Date(asOf + "T00:10:00+08:00").toISOString()).get("AAPL");
if (!apple) throw new Error("Official AAPL exchange evidence failed parsing");
const database = openSqliteDatabase(dbPath);
try {
  const store = new SqliteStore(database);
  const result = store.mergeTradeData({ executions, instruments });
  store.putInstrumentMetadata(apple);
  store.putMarketData({ dailyCandles: candles, coverage });
  if (fx) store.putSettings({ "trading-room.fx": { id: `fx:${prefix}:${fx}`, baseCurrency: "CNY", source: "BOC", publishedAt: new Date(asOf + "T00:01:00+08:00").toISOString(), publishedAtByCurrency: fx === "missing" ? {} : { USD: new Date(asOf + "T00:01:00+08:00").toISOString(), ...(fx === "complete" ? { HKD: new Date(asOf + "T00:01:00+08:00").toISOString() } : {}) }, fetchedAt: new Date(asOf + "T00:02:00+08:00").toISOString(), rates: fx === "missing" ? {} : { USD: "7", ...(fx === "complete" ? { HKD: "0.875" } : {}) }, lastAttemptDay: asOf, status: fx, error: null } });
  console.log(JSON.stringify({ ...plan, result, status: store.getStatus() }, null, 2));
} finally { database.close(); }
