import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import type { DatabaseSync } from "node:sqlite";

import { withSqliteTransaction } from "../../../db/sqlite";

import {
  assertFxSnapshot,
  isFxSnapshot,
  type FxSnapshot,
} from "./contracts";

export const FX_SETTINGS_KEY = "fx.rates.snapshot.v1";

type SettingRow = { value_json: string };

export function readFxSnapshot(database: DatabaseSync): FxSnapshot | null {
  const row = database
    .prepare("select value_json from app_settings where key = ?")
    .get(FX_SETTINGS_KEY) as SettingRow | undefined;
  if (!row) return null;
  try {
    const value: unknown = JSON.parse(row.value_json);
    return isFxSnapshot(value) ? value : null;
  } catch {
    return null;
  }
}

export function replaceFxSnapshot(
  database: DatabaseSync,
  snapshot: FxSnapshot,
): void {
  assertFxSnapshot(snapshot);
  const json = JSON.stringify(snapshot);
  withSqliteTransaction(database, () => {
    // Preserve the day on which the rate became knowable, never backfill its
    // provider rateDate into earlier financial snapshots.
    const knownAt = new Date(snapshot.fetchedAt).toISOString();
    const businessDate = new Date(Date.parse(knownAt) + 8 * 3600000).toISOString().slice(0, 10);
    const D = Decimal.clone({precision:48});
    const rates = Object.fromEntries(Object.entries(snapshot.rates).map(([currency, rate]) => [currency, {
      rate: new D(String(rate)).toFixed(), source:snapshot.source.id, asOf:snapshot.rateDate,
    }]));
    const id = createHash('sha256').update(JSON.stringify([knownAt, snapshot.source.id, snapshot.rateDate, rates])).digest('hex');
    database.prepare("INSERT OR IGNORE INTO home_fx_history(observation_id,business_date,known_at,rates_json,convention) VALUES(?,?,?,?,'CNY-per-unit-v1')").run(id,businessDate,knownAt,JSON.stringify(rates));
    database
      .prepare(
        `insert into app_settings (key, value_json, updated_at)
         values (?, ?, current_timestamp)
         on conflict(key) do update set
           value_json = excluded.value_json,
           updated_at = current_timestamp`,
      )
      .run(FX_SETTINGS_KEY, json);
  });
}
