import { createHash } from "node:crypto";
import type { StorageBootstrap } from "./sqlite-contracts";
import { materializeStoredTradeSnapshot } from "./stored-trade-snapshot";
import { encodeTradeRead, type TradeReadPage } from "./trade-read-contract";

/** Unit fixture only. Real persistence/enumeration is covered by the SQLite protocol tests. */
export function homepageTestSnapshot(bootstrap: StorageBootstrap) {
  const snapshot = materializeStoredTradeSnapshot({
    bookVersion: { databaseId: "unit-fixture", epoch: "fixture-epoch", sequence: 0 },
    states: [], source: { materials: [], versions: [], observations: [], links: [], mappings: [], revisions: [] },
    facts: bootstrap.executions.map(e => ({
      id: e.id, instrument_id: e.instrument.id, account: e.accountId, side: e.side,
      executed_at: e.executedAt, quantity: e.quantity, price: e.price, fee: e.fee,
      currency: e.instrument.currency, trade_nature: null,
      simulation_run_id: null, import_batch_id: null,
      evidence_json: JSON.stringify({ accountLabel: e.accountLabel, source: e.source }),
      joined_instrument_id: e.instrument.id, instrument_symbol: e.instrument.symbol,
      instrument_name: e.instrument.name, instrument_market: e.instrument.market,
      instrument_currency: e.instrument.currency,
    })),
  }, { pageSize: 1000 });
  const display = { executions: bootstrap.executions, instruments: bootstrap.instruments, importHistory: bootstrap.importHistory };
  const page: TradeReadPage = { snapshot, display,
    payloadDigest: `sha256:${createHash("sha256").update(encodeTradeRead({ snapshot, display })).digest("hex")}` };
  return { bookVersion: snapshot.bookVersion, tradeReadPages: [page] };
}
