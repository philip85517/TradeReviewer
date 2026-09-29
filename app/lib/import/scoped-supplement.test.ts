import { expect, it } from "vitest";
import {
  applyScopedMonthlyEvidence,
  scopeMonthlyStatement,
  scopeStatementParseResult,
  scopedRecords,
  supplementChangeSummary,
  supplementChanges,
} from "./scoped-supplement";
import type { StatementParseResult } from "./contracts";
import { isMonthlyStatement, type MonthlyStatement } from "./monthly-statement";
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

const monthly: MonthlyStatement = {
 documentId: "china-merchants:document",
 templateIds: ["china-merchants/pdf/monthly-v1"],
 accountId: "account-a",
 month: "2026-03",
 positions: [
  { documentId: "china-merchants:document", accountId: "account-a", market: "US", symbol: "CTVA", phase: "opening", date: "2026-03-01", quantity: "100", source: [{ page: 1, row: 2 }] },
  { documentId: "china-merchants:document", accountId: "account-a", market: "US", symbol: "AAPL", phase: "opening", date: "2026-03-01", quantity: "200", source: [{ page: 1, row: 3 }] },
  { documentId: "china-merchants:document", accountId: "account-b", market: "US", symbol: "CTVA", phase: "opening", date: "2026-03-01", quantity: "300", source: [{ page: 1, row: 4 }] },
 ],
 events: [
  { documentId: "china-merchants:document", id: "target-event", accountId: "account-a", market: "US", symbol: "CTVA", date: "2026-03-06", kind: "corporate-action", quantity: "10", description: "目标公司行动", source: [{ page: 2, row: 2 }] },
  { documentId: "china-merchants:document", id: "other-event", accountId: "account-a", market: "US", symbol: "AAPL", date: "2026-03-06", kind: "corporate-action", quantity: "20", description: "其他公司行动", source: [{ page: 2, row: 3 }] },
 ],
 reviewRequired: true,
 incompleteInstruments: [{ market: "US", symbol: "CTVA" }, { market: "US", symbol: "AAPL" }],
};

it("rejects malformed or noncanonical persisted evidence scopes", () => {
 expect(isMonthlyStatement({ ...monthly, evidenceScope: { instrumentId: "HK:0700", accountId: "account-a" } })).toBe(false);
 expect(isMonthlyStatement({ ...monthly, evidenceScope: { instrumentId: "US:CTVA", accountId: "" } })).toBe(false);
 expect(() => scopeMonthlyStatement(monthly, { ...scope, instrumentId: "HK:0700" })).toThrow(/scope/i);
});

it("scopes monthly evidence and diagnostics while preserving the source document identity", () => {
 const parsed: StatementParseResult = {
  broker: "tiger",
  records: [
   {
    ...original,
    source: {
     ...original.source,
     statementPositions: monthly.positions,
     positionEvents: monthly.events,
    },
   },
   otherStock,
  ],
  candidates: [
   { market: "US", symbol: "CTVA", sourceName: "Corteva", sourceAssetType: "stock" },
   { market: "US", symbol: "AAPL", sourceName: "Apple", sourceAssetType: "stock" },
  ],
  exclusions: [{ category: "bond", label: "可转债", count: 3, instrumentSymbol: "AAPL" }],
  diagnostics: [
   { severity: "warning", code: "missing-target", message: "目标需要复核", instrumentSymbol: "CTVA" },
   { severity: "warning", code: "missing-other", message: "其他标的需要复核", instrumentSymbol: "AAPL" },
   { severity: "warning", code: "zone", message: "请核对原件时区" },
   { severity: "warning", code: "statement-position-row-unparsed", message: "无法确认证券行归属" },
  ],
  blocked: false,
  monthly,
 };

 const scoped = scopeStatementParseResult(parsed, scope);
 expect(scoped.records).toHaveLength(1);
 expect(scoped.records[0]).toMatchObject({
  ...original,
  source: {
   statementPositions: [monthly.positions[0]],
   positionEvents: [monthly.events[0]],
  },
 });
 expect(scoped.candidates).toEqual([parsed.candidates[0]]);
 expect(scoped.exclusions).toEqual(parsed.exclusions);
 expect(scoped.diagnostics).toEqual([
  parsed.diagnostics[0],
  parsed.diagnostics[2],
  parsed.diagnostics[3],
 ]);
 expect(scoped.monthly).toMatchObject({
  documentId: monthly.documentId,
  accountId: monthly.accountId,
  evidenceScope: { instrumentId: scope.instrumentId, accountId: scope.accountId },
  positions: [monthly.positions[0]],
  events: [monthly.events[0]],
  incompleteInstruments: [{ market: "US", symbol: "CTVA" }],
  reviewRequired: true,
 });
});

it("retains an unattributed monthly review flag when no exclusion proves it belongs elsewhere", () => {
 const scoped = scopeMonthlyStatement({
  ...monthly,
  reviewRequired: true,
  historyIncomplete: undefined,
  incompleteInstruments: undefined,
 }, scope)!;

 expect(scoped.reviewRequired).toBe(true);
});

it("can exclude a review flag when every named gap is explicitly outside the selected stock", () => {
 const scoped = scopeMonthlyStatement({
  ...monthly,
  reviewRequired: true,
  historyIncomplete: undefined,
  incompleteInstruments: [{ market: "US", symbol: "AAPL" }],
 }, scope)!;

 expect(scoped.reviewRequired).toBe(false);
});

it("retains a document-level history gap beside an unrelated named instrument gap", () => {
 const result = scopeStatementParseResult({
  broker: "tiger",
  records: [original],
  candidates: [],
  exclusions: [],
  diagnostics: [{ severity: "warning", code: "unassigned-row", message: "无法归属证券的行" }],
  blocked: false,
  monthly: {
   ...monthly,
   reviewRequired: true,
   historyIncomplete: true,
   incompleteInstruments: [{ market: "US", symbol: "AAPL" }],
  },
 }, scope);

 expect(result.monthly).toMatchObject({ reviewRequired: true, historyIncomplete: true });
 expect(result.monthly?.incompleteInstruments).toBeUndefined();
 expect(result.records[0].source.historyIncomplete).toContain(monthly.documentId);
});

it("does not block a usable target because an excluded row failed to parse", () => {
 const scoped = scopeStatementParseResult({
  broker: "tiger",
  records: [original],
  candidates: [],
  exclusions: [],
  diagnostics: [
   { severity: "error", code: "invalid-tiger-trade-row", message: "其他标的行无法解析", instrumentSymbol: "AAPL" },
  ],
  blocked: true,
 }, scope);
 expect(scoped.blocked).toBe(false);
 expect(scoped.diagnostics).toEqual([]);
});

it("creates a real evidence-only change without touching financial fields", () => {
 const incomingMonthly = scopeMonthlyStatement(monthly, scope)!;
 const after = applyScopedMonthlyEvidence([original], [incomingMonthly], scope);
 const changes = supplementChanges([original], after, scope);
 expect(changes).toHaveLength(1);
 expect(changes[0]).toMatchObject({
  before: original,
  after: {
   id: original.id,
   quantity: original.quantity,
   price: original.price,
   fee: original.fee,
   source: { statementPositions: [incomingMonthly.positions[0]], positionEvents: [incomingMonthly.events[0]] },
  },
 });
});

it("summarizes added, unchanged, and evidence-only target changes", () => {
 const incoming = [{ ...original, source: { ...original.source, fileFingerprint: "new-document" } }];
 const monthlyForTarget = scopeMonthlyStatement(monthly, scope)!;
 const after = applyScopedMonthlyEvidence(
  [original],
  [monthlyForTarget],
  scope,
 );
 expect(supplementChangeSummary([original], incoming, after, scope)).toEqual({
  newTradeCount: 0,
  revisedTradeCount: 1,
  evidenceRevisionCount: 1,
  unchangedTradeCount: 0,
 });
 expect(supplementChangeSummary([original], [original], [original], scope)).toEqual({
  newTradeCount: 0,
  revisedTradeCount: 0,
  evidenceRevisionCount: 0,
  unchangedTradeCount: 1,
 });
});

it("keeps same-document evidence when two scoped supplements are applied", () => {
 const instrumentB = { id: "US:AAPL", symbol: "AAPL", name: "Apple", market: "US" as const, currency: "USD" as const };
 const executionB: TradeExecution = { ...original, id: "b", accountId: "account-a", instrument: instrumentB };
 const monthlyA = scopeMonthlyStatement(monthly, scope)!;
 const monthlyB = scopeMonthlyStatement(monthly, { ...scope, instrumentId: instrumentB.id })!;

 const afterA = applyScopedMonthlyEvidence([original, executionB], [monthlyA], scope);
 const afterB = applyScopedMonthlyEvidence(afterA, [monthlyA, monthlyB], { ...scope, instrumentId: instrumentB.id });
 expect(afterB.find((execution) => execution.id === original.id)?.source.statementPositions).toEqual([monthlyA.positions[0]]);
 expect(afterB.find((execution) => execution.id === executionB.id)?.source.statementPositions).toEqual([monthlyB.positions[0]]);
});
