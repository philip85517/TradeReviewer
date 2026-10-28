import { DatabaseSync } from "node:sqlite";
import { afterEach, expect, it } from "vitest";
import { initializeSqlite } from "../../../db/sqlite-initialization";
import { createTradeChanges } from "./trade-changes";
import { parseTradePlan } from "./trade-change-response";
const databases: DatabaseSync[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
it("publishes a frozen whitelist of the real reconciliation pairs and rejects missing or contradictory summaries", () => {
  const db = new DatabaseSync(":memory:"); databases.push(db); initializeSqlite(db);
  const changes = createTradeChanges(db);
  const fact = { id:"incoming",accountId:"a",accountLabel:"Account",instrument:{id:"US:A",symbol:"A",name:"A",market:"US",currency:"USD"},side:"buy" as const,quantity:"1",price:"2",fee:"0",executedAt:"2026-10-27",source:{platform:"fixture",fileName:"/private/statement.csv",row:1,page:2,feeStatus:"unknown" as const,secret:"never expose"} };
  const plan = changes.prepare({kind:"import",candidates:[fact,fact]});
  const raw = JSON.parse(JSON.stringify(plan));
  expect(raw.summary.importDuplicates).toMatchObject({policy:"import-duplicate-review-v1",count:1,pairs:[{kept:{fee:null,source:{fileName:"statement.csv"}},skipped:{fee:null}}]});
  expect(JSON.stringify(raw.summary.importDuplicates)).not.toContain("secret");
  expect(JSON.stringify(raw.summary.importDuplicates)).not.toContain("/private/");
  expect(parseTradePlan(raw,"import")).toEqual(raw);
  for (const invalid of [undefined,{...raw.summary.importDuplicates,count:0},{...raw.summary.importDuplicates,policy:"unknown"},{...raw.summary.importDuplicates,pairs:[{kept:{},skipped:{}}]}]) {
    expect(() => parseTradePlan({...raw,summary:{...raw.summary,importDuplicates:invalid}},"import")).toThrow();
  }
  const zero = changes.prepare({kind:"import",candidates:[]});
  expect(zero.summary).toHaveProperty("importDuplicates",{policy:"import-duplicate-review-v1",count:0,pairs:[]});
});
