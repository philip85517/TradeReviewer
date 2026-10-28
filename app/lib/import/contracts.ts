import type {
  TradeExecution,
  TradeNature,
  TradeTimePrecision,
} from "../trades/types";
import type { ImportDiagnostic } from "./import-result";
import type { MonthlyStatement } from "./monthly-statement";

export type StatementBroker =
  | "futu"
  | "tiger"
  | "china-merchants"
  | "tradingview";

export type StatementInput = {
  fileName: string;
  bytes: ArrayBuffer | Uint8Array;
  mimeType?: string;
  fileFingerprint: string;
};

export type DetectionResult = {
  matched: boolean;
  confidence: number;
  diagnostics?: ImportDiagnostic[];
};

export type ParsedInstrumentCandidate = {
  market: "US" | "HK" | "CN-SH" | "CN-SZ";
  symbol: string;
  sourceName?: string;
  sourceAssetType?: "stock" | "etf" | "unknown";
};

export type TradingViewSimulationContext = {
  market: "CN-SH" | "CN-SZ";
  symbol: string;
};

export type ImportExclusion = {
  category:
    | "market"
    | "fund"
    | "fx"
    | "bond"
    | "repo"
    | "cash"
    | "corporate-action"
    | "subscription"
    | "unknown-asset"
    | "invalid-row";
  label: string;
  count: number;
  instrumentSymbol?: string;
  /** Only a recognized parser rule may close an intentionally unsupported row. */
  disposition?: "ignored" | "pending";
  ruleId?: string;
};

export type StatementParseResult = {
  fileContent?: import("./file-fingerprint").FileContentIdentity;
  tradingViewEvidence?: TradingViewDecodedEvidence;
  broker: StatementBroker;
  records: TradeExecution[];
  candidates: ParsedInstrumentCandidate[];
  exclusions: ImportExclusion[];
  diagnostics: ImportDiagnostic[];
  blocked: boolean;
  monthly?: MonthlyStatement;
  tradeNature?: TradeNature;
  simulationRunId?: string;
};

export type BrokerStatementParser = {
  detect(input: StatementInput): Promise<DetectionResult>;
  parse(input: StatementInput): Promise<StatementParseResult>;
};

export type { TradeTimePrecision };
/** Earliest XLSX-decoded values, not CSV bytes or physical line numbers. */
export type DecodedCell =
  | { kind: "string"; value: string }
  | { kind: "number"; value: number; negativeZero: boolean }
  | { kind: "boolean"; value: boolean } | { kind: "null" } | { kind: "undefined" }
  | { kind: "non-finite"; value: "NaN" | "+Infinity" | "-Infinity" }
  | { kind: "bigint"; decimal: string }
  | { kind: "error"; code: string | null; message: string | null }
  | { kind: "unsupported"; jsType: "object" | "function" | "symbol"; diagnosticId: string };
export type TradingViewDecodedEvidence = {
  kind: "tradingview-xlsx-records-v1";
  fidelity: "xlsx-decoded-records-raw-false";
  parserVersion: "tradingview-simulation-v2";
  fileFingerprint: string;
  sheet: { ordinal: 0; name: string };
  headers: DecodedCell[];
  rows: { logicalRow: number; entries: { key: string; cell: DecodedCell }[];
    outcome: "accepted" | "invalid" | "duplicate-role" | "unpaired" | "ambiguous";
    candidateIds: string[]; diagnosticCodes: string[] }[];
  cellDiagnostics: { id: string; sheet: string; logicalRow: number; column: string }[];
  derived: { accountId: string; accountOrigin: "parser-canonical-constant";
    tradeNature: "simulation"; natureOrigin: "parser-format-contract";
    sourceRun: string; runOrigin: "parser-fingerprint-market-symbol";
    market: string; symbol: string; currency: string };
};
