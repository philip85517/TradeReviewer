import type { TradeExecution, TradeTimePrecision } from "../trades/types";
import type { ImportDiagnostic } from "./import-result";

export type StatementBroker = "futu" | "tiger" | "china-merchants";

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

export type ImportExclusion = {
  category:
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
};

export type StatementParseResult = {
  broker: StatementBroker;
  records: TradeExecution[];
  candidates: ParsedInstrumentCandidate[];
  exclusions: ImportExclusion[];
  diagnostics: ImportDiagnostic[];
  blocked: boolean;
};

export type BrokerStatementParser = {
  detect(input: StatementInput): Promise<DetectionResult>;
  parse(input: StatementInput): Promise<StatementParseResult>;
};

export type { TradeTimePrecision };
