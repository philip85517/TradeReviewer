import { it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { replayPositionAtPrice } from "../../../../../../app/lib/replay/position-ledger";
import type { TradeExecution } from "../../../../../../app/lib/trades/types";
const fill = (id: string, side: "buy" | "sell", quantity: string, price: string, fee = "1"): TradeExecution => ({ id, accountId: "a", accountLabel: "A", instrument: { id: "US:AAPL", market: "US", symbol: "AAPL", name: "Apple", currency: "USD" }, side, quantity, price, fee, executedAt: `2026-01-${String(Number(id)+5).padStart(2,"0")}T15:00:00Z`, source: { platform: "original-oracle", row: Number(id), tradeNature: "live", positionEffect: side === "buy" ? "open-long" : "open-short" } });
it("records complete original canonical snapshots before extraction", () => {
 const executions = [fill("0","buy","1","100"),fill("1","buy","1","200"),fill("2","sell","1","180"),fill("3","sell","2","190"),fill("4","buy","0.5","180")];
 const inputs = [
  ...executions.map((_,i)=>({executions,markPrice:"160",visibleExecutionIds:executions.slice(0,i+1).map(e=>e.id),cursor:"2026-01-01T00:00:00Z"})),
  {executions,markPrice:"160",visibleExecutionIds:["2"],cursor:"2026-01-01T00:00:00Z"},
  {executions:[{...executions[0],source:{...executions[0].source,feeStatus:"unknown" as const}}],markPrice:"160"},
  {executions:[{...executions[0],source:{...executions[0].source,historyIncomplete:["prior"]}}],markPrice:"160"},
  {executions:[executions[0],{...executions[1],id:"0"}],markPrice:"160",visibleExecutionIds:["0"]},
  {executions:[executions[0],{...executions[1],executedAt:executions[0].executedAt}],markPrice:"160"},
 ];
 const results=inputs.map(input=>({input,result:replayPositionAtPrice(input)}));
 writeFileSync(".scratch/homepage-v25-implementation/evidence/P2/data/p2-a/12-canonical-original-oracles.json",JSON.stringify(results,null,2));
 expect(results[1].result).toMatchObject({quantity:"2",averageCost:"150",fees:"2"});
});
