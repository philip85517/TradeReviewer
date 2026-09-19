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
