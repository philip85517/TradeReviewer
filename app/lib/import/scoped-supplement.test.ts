import { expect, it } from "vitest";
import { scopedRecords, supplementChanges } from "./scoped-supplement";
import type { TradeExecution } from "../trades/types";
const original: TradeExecution = { id: "a", accountId:"account-a", accountLabel:"账户A", instrument:{id:"US:CTVA",symbol:"CTVA",name:"Corteva",market:"US",currency:"USD"},executedAt:"2026-07-24T13:48:50Z",side:"buy",quantity:"100",price:"88.77",fee:"0",source:{platform:"tiger",row:0} };
const scope = {instrumentId:"US:CTVA",accountId:"account-a",accountLabel:"账户A",kind:"file" as const};
const otherAccount = {...original,id:"b",accountId:"account-b"};
const otherStock = {...original,id:"c",instrument:{...original.instrument,id:"US:AAPL",symbol:"AAPL"}};
it("excludes mixed stocks and statement accounts without modifying the evidence",()=>{
 const records=[original,otherAccount,otherStock]; expect(scopedRecords(records,scope)).toEqual([original]); expect(records).toEqual([original,otherAccount,otherStock]);
});
it("maps screenshot records only to the explicitly selected stock account",()=>{
 expect(scopedRecords([otherAccount,otherStock],{...scope,kind:"screenshot"})).toEqual([{...otherAccount,accountId:scope.accountId,accountLabel:scope.accountLabel}]);
});
it("audits replacements and rejects off-scope mutations even after preview",()=>{
 const before=[original,otherAccount,otherStock];
 expect(supplementChanges(before,before,scope)).toEqual([]);
 expect(supplementChanges(before,[{...original,quantity:"200"},otherAccount,otherStock],scope)).toEqual([{before:original,after:{...original,quantity:"200"}}]);
 expect(()=>supplementChanges(before,[original,otherStock],scope)).toThrow(/范围/);
});
