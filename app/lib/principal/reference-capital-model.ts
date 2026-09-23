import Decimal from "decimal.js";

export const REFERENCE_CAPITAL_SCHEMA_VERSION = 2 as const;
export const REFERENCE_CAPITAL_SETTINGS_KEY = "trading-room.reference-capital.v2" as const;
export const REFERENCE_CAPITAL_CURRENCIES = ["CNY", "USD", "HKD"] as const;
export type ReferenceCapitalCurrency = (typeof REFERENCE_CAPITAL_CURRENCIES)[number];
export type ReferenceCapitalNature = "live" | "simulation";
export type ReferenceCapitalRecord = {
  id: string;
  nature: ReferenceCapitalNature;
  simulationRunId: string | null;
  accountId: string;
  currency: ReferenceCapitalCurrency;
  fromDate: string;
  toDate: string;
  amount: string;
  updatedAt: string;
};
export type ReferenceCapitalState = { version: typeof REFERENCE_CAPITAL_SCHEMA_VERSION; records: ReferenceCapitalRecord[] };
export type ReferenceCapitalDraft = Omit<ReferenceCapitalRecord, "id" | "updatedAt"> & { id?: string };

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const validDate = (v: unknown): v is string => { if (typeof v !== "string" || !datePattern.test(v)) return false; const parsed = new Date(`${v}T00:00:00Z`); return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v; };
const validCurrency = (v: unknown): v is ReferenceCapitalCurrency => typeof v === "string" && (REFERENCE_CAPITAL_CURRENCIES as readonly string[]).includes(v);
const validNature = (v: unknown): v is ReferenceCapitalNature => v === "live" || v === "simulation";

export function emptyReferenceCapitalState(): ReferenceCapitalState { return { version: 2, records: [] }; }
export function normalizeReferenceCapitalDraft(value: unknown): ReferenceCapitalDraft | null {
  if (!isRecord(value) || !validNature(value.nature) || typeof value.accountId !== "string" || !value.accountId.trim() || !validCurrency(value.currency) || !validDate(value.fromDate) || !validDate(value.toDate) || value.toDate < value.fromDate || typeof value.amount !== "string") return null;
  if (value.nature === "simulation" && (typeof value.simulationRunId !== "string" || !value.simulationRunId.trim())) return null;
  if (value.nature === "live" && value.simulationRunId !== null) return null;
  try { const amount = new Decimal(value.amount); if (!amount.isFinite() || !amount.gt(0)) return null; return { id: typeof value.id === "string" ? value.id : undefined, nature: value.nature, simulationRunId: value.nature === "simulation" ? (value.simulationRunId as string).trim() : null, accountId: value.accountId.trim(), currency: value.currency, fromDate: value.fromDate, toDate: value.toDate, amount: amount.toString() }; } catch { return null; }
}
export function referenceCapitalScopeKey(record: Pick<ReferenceCapitalRecord, "nature" | "simulationRunId" | "accountId" | "currency">): string { return `${record.nature}:${record.nature === "simulation" ? record.simulationRunId : ""}:${record.accountId}:${record.currency}`; }
export function rangesOverlap(a: Pick<ReferenceCapitalRecord, "fromDate" | "toDate">, b: Pick<ReferenceCapitalRecord, "fromDate" | "toDate">): boolean { return a.fromDate <= b.toDate && b.fromDate <= a.toDate; }
export function validateReferenceCapitalDraft(state: ReferenceCapitalState, draft: ReferenceCapitalDraft, replacingId?: string): string | null {
  const normalized = normalizeReferenceCapitalDraft(draft); if (!normalized) return "账户、币种、期间或金额无效";
  const conflict = state.records.find(record => record.id !== (replacingId ?? draft.id) && referenceCapitalScopeKey(record) === referenceCapitalScopeKey(normalized) && rangesOverlap(record, normalized));
  return conflict ? "相同账户、币种和账本期间不能重叠" : null;
}
export function normalizeReferenceCapitalState(value: unknown): ReferenceCapitalState {
  if (!isRecord(value) || value.version !== 2 || !Array.isArray(value.records)) return emptyReferenceCapitalState();
  const records: ReferenceCapitalRecord[] = [];
  for (const raw of value.records) { const draft = normalizeReferenceCapitalDraft(raw); if (!draft || typeof raw !== "object" || typeof (raw as Record<string, unknown>).id !== "string" || typeof (raw as Record<string, unknown>).updatedAt !== "string") continue; if (!records.some(item => referenceCapitalScopeKey(item) === referenceCapitalScopeKey(draft) && rangesOverlap(item, draft))) records.push({ ...draft, id: (raw as Record<string, unknown>).id as string, updatedAt: (raw as Record<string, unknown>).updatedAt as string }); }
  return { version: 2, records };
}
export function validateReferenceCapitalState(value: unknown): string | null {
  if (!isRecord(value) || value.version !== 2 || !Array.isArray(value.records)) return "参考资本配置版本或 records 无效";
  const ids = new Set<string>(); const records: ReferenceCapitalRecord[] = [];
  for (const raw of value.records) {
    const draft = normalizeReferenceCapitalDraft(raw); if (!draft || typeof (raw as Record<string, unknown>).id !== "string" || typeof (raw as Record<string, unknown>).updatedAt !== "string") return "参考资本存在无效记录";
    const id = (raw as Record<string, unknown>).id as string; if (ids.has(id)) return "参考资本存在重复 id"; ids.add(id);
    const record = { ...draft, id, updatedAt: (raw as Record<string, unknown>).updatedAt as string } as ReferenceCapitalRecord;
    if (records.some(item => referenceCapitalScopeKey(item) === referenceCapitalScopeKey(record) && rangesOverlap(item, record))) return "参考资本存在重叠期间";
    records.push(record);
  }
  return null;
}
export function upsertReferenceCapital(state: ReferenceCapitalState, draft: ReferenceCapitalDraft, now = new Date().toISOString()): ReferenceCapitalState {
  const error = validateReferenceCapitalDraft(state, draft, draft.id); if (error) throw new Error(error); const record: ReferenceCapitalRecord = { ...normalizeReferenceCapitalDraft(draft)!, id: draft.id ?? crypto.randomUUID(), updatedAt: now }; return { version: 2, records: [...state.records.filter(item => item.id !== record.id), record] };
}
export function deleteReferenceCapital(state: ReferenceCapitalState, id: string): ReferenceCapitalState { return { version: 2, records: state.records.filter(record => record.id !== id) }; }

export type ReferenceCapitalCoverage = { status: "complete" | "partial" | "missing"; records: ReferenceCapitalRecord[]; reason: string | null };
export function referenceCapitalCoverage(state: ReferenceCapitalState, input: { nature: ReferenceCapitalNature; simulationRunId: string | null; pairs: readonly { accountId: string; currency: string }[]; fromDate: string; toDate: string }): ReferenceCapitalCoverage {
  const records = state.records.filter(record => record.nature === input.nature && record.simulationRunId === (input.nature === "simulation" ? input.simulationRunId : null) && input.pairs.some(pair => pair.accountId === record.accountId && pair.currency === record.currency) && record.fromDate <= input.fromDate && record.toDate >= input.toDate);
  if (input.pairs.length === 0) return { status: "missing", records: [], reason: "当前范围缺少账户/币种配对" };
  const complete = input.pairs.every(pair => records.some(record => record.accountId === pair.accountId && record.currency === pair.currency));
  return { status: complete ? "complete" : records.length ? "partial" : "missing", records, reason: complete ? null : "参考资本未覆盖完整统计期间" };
}

export type ReferenceReturnSummary = { status: "available" | "partial" | "missing"; returnPercent: string | null; netPnlByPair: Readonly<Record<string, string>>; capitalByPair: Readonly<Record<string, string>>; reason: string | null };
export function buildReferenceReturnSummary(state: ReferenceCapitalState, input: { nature: ReferenceCapitalNature; simulationRunId: string | null; pairs: readonly { accountId: string; currency: string }[]; fromDate: string; toDate: string; trustedClosedPnl: readonly { accountId: string; currency: string; amount: string }[]; fxRatesToCny?: Readonly<Record<string, string>> }): ReferenceReturnSummary {
  const coverage = referenceCapitalCoverage(state, input); const pnl: Record<string, Decimal> = {}; const capital: Record<string, Decimal> = {};
  for (const pair of input.pairs) { const key = `${pair.accountId}:${pair.currency}`; pnl[key] = new Decimal(0); capital[key] = new Decimal(0); for (const item of input.trustedClosedPnl) if (item.accountId === pair.accountId && item.currency === pair.currency) pnl[key] = pnl[key].plus(item.amount); for (const record of coverage.records) if (record.accountId === pair.accountId && record.currency === pair.currency) capital[key] = capital[key].plus(record.amount); }
  const complete = coverage.status === "complete"; const currencies = new Set(input.pairs.map(pair => pair.currency)); const sameCurrency = currencies.size <= 1;
  if (!complete) return { status: coverage.status === "complete" ? "available" : coverage.status, returnPercent: null, netPnlByPair: Object.fromEntries(Object.entries(pnl).map(([k,v])=>[k,v.toString()])), capitalByPair: Object.fromEntries(Object.entries(capital).map(([k,v])=>[k,v.toString()])), reason: coverage.reason };
  const rates = input.fxRatesToCny ?? {};
  const validRate = (currency: string) => {
    if (currency === "CNY") return true;
    try { const rate = new Decimal(rates[currency]); return rate.isFinite() && rate.gt(0); } catch { return false; }
  };
  if (!sameCurrency && input.pairs.some(pair => !validRate(pair.currency))) {
    return { status: "partial", returnPercent: null, netPnlByPair: Object.fromEntries(Object.entries(pnl).map(([k, v]) => [k, v.toString()])), capitalByPair: Object.fromEntries(Object.entries(capital).map(([k, v]) => [k, v.toString()])), reason: "跨币种参考回报需要完整汇率快照" };
  }
  // A native-currency ratio needs no FX; mixed amounts use one common CNY basis.
  const convert = (currency: string, value: Decimal) => sameCurrency || currency === "CNY" ? value : value.times(rates[currency]);
  const uniquePairs = [...new Map(input.pairs.map(pair => [`${pair.accountId}:${pair.currency}`, pair])).values()];
  const totalPnl = uniquePairs.reduce((sum, pair) => sum.plus(convert(pair.currency, pnl[`${pair.accountId}:${pair.currency}`] ?? new Decimal(0))), new Decimal(0));
  const totalCapital = uniquePairs.reduce((sum, pair) => sum.plus(convert(pair.currency, capital[`${pair.accountId}:${pair.currency}`] ?? new Decimal(0))), new Decimal(0));
  return { status: "available", returnPercent: totalCapital.gt(0) ? totalPnl.div(totalCapital).times(100).toDecimalPlaces(8).toString() : null, netPnlByPair: Object.fromEntries(Object.entries(pnl).map(([k,v])=>[k,v.toString()])), capitalByPair: Object.fromEntries(Object.entries(capital).map(([k,v])=>[k,v.toString()])), reason: totalCapital.gt(0) ? null : "参考资本金额不可用" };
}
